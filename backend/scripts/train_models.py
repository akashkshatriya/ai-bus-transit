# -*- coding: utf-8 -*-
"""
train_models.py
===============
Phase 4 - Standalone training script.

Trains two ML models on Master_Bus_Passenger_Flow.xlsx:
  1. RandomForestRegressor     -> target: Delay_Minutes
  2. GradientBoostingClassifier -> target: Crowd_Label

Also generates:
  - encoders.pkl           -> dict of encoding maps
  - schedule_timetable.json -> discrete timetable of all recurring scheduled bus runs per route/stop/day_type
  - schedule_lookup.json   -> historical summary stats per (route, stop, time_slot, day_type)
  - bus_name_lookup.json   -> most frequent bus lookup per (route, stop, time_slot)
"""

import sys
import io
import json

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import joblib

from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    accuracy_score,
    f1_score,
    confusion_matrix,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_PATH   = BACKEND_DIR / "dataset" / "Master_Bus_Passenger_Flow.xlsx"
MODELS_DIR  = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DELAY_MODEL_PATH = MODELS_DIR / "delay_model.pkl"
CROWD_MODEL_PATH = MODELS_DIR / "crowd_model.pkl"
ENCODERS_PATH    = MODELS_DIR / "encoders.pkl"
SCHEDULE_LOOKUP_PATH    = MODELS_DIR / "schedule_lookup.json"
BUS_NAME_LOOKUP_PATH    = MODELS_DIR / "bus_name_lookup.json"
SCHEDULE_TIMETABLE_PATH = MODELS_DIR / "schedule_timetable.json"

# ── Encoding constants ──────────────────────────────────────────────────────────
TIME_SLOT_ORDER = ["Early Morning", "Morning Peak", "Midday", "Evening Peak", "Night"]
WEATHER_CATEGORIES = ["Cloudy", "Rainy", "Sunny"]
CROWD_LABEL_ORDER = ["Low", "Medium", "High"]

# Exact feature column names IN ORDER as passed to both models
FEATURE_COLS = [
    "Route_enc",          # binary: 0 = "Belman -> Udupi", 1 = "Udupi -> Belman"
    "Stop_Name_enc",      # label-encoded int (0-8)
    "Stop_Order",         # int 1-9
    "Day_Type_enc",       # binary: 0 = Weekday, 1 = Weekend
    "Is_Peak_Hour",       # 0/1 int
    "Time_Slot_enc",      # ordinal 0-4
    "Weather_Cloudy",     # one-hot flag
    "Weather_Rainy",      # one-hot flag
    "Weather_Sunny",      # one-hot flag
    "Holiday_enc",        # binary: 0 = No, 1 = Yes
    "Scheduled_Minutes",  # normal scheduled arrival in minutes since midnight
    "Bus_Capacity",       # constant 65
]

# =============================================================================
# 1.  LOAD DATA
# =============================================================================
print("=" * 65)
print("PHASE 4 -- ML Training Script (Two-Stage Architecture)")
print("=" * 65)
print()
print(f"[1/5]  Loading data from: {DATA_PATH}")

df = pd.read_excel(DATA_PATH)
print(f"       Loaded {len(df):,} rows x {len(df.columns)} columns")

# Reconstruct Normal Scheduled Arrival = Arrival_Minutes - Delay_Minutes
df["Scheduled_Minutes"] = df["Arrival_Minutes"] - df["Delay_Minutes"]

# =============================================================================
# 2.  FEATURE ENGINEERING
# =============================================================================
print()
print("[2/5]  Feature engineering ...")

# Route: binary encode
unique_routes = sorted(df["Route"].unique().tolist())
route_map = {r: i for i, r in enumerate(unique_routes)}
df["Route_enc"] = df["Route"].map(route_map)
print(f"       Route binary map  : {route_map}")

# Day_Type: binary encode
day_type_map = {"Weekday": 0, "Weekend": 1}
df["Day_Type_enc"] = df["Day_Type"].map(day_type_map)
print(f"       Day_Type map      : {day_type_map}")

# Stop_Name: LabelEncoder
le_stop = LabelEncoder()
df["Stop_Name_enc"] = le_stop.fit_transform(df["Stop_Name"])
stop_name_classes = le_stop.classes_.tolist()
print(f"       Stop_Name classes : {stop_name_classes}")

# Time_Slot: ordinal encode
ts_map = {slot: i for i, slot in enumerate(TIME_SLOT_ORDER)}
df["Time_Slot_enc"] = df["Time_Slot"].map(ts_map)
print(f"       Time_Slot ordinal : {ts_map}")

# Weather: one-hot
for cat in WEATHER_CATEGORIES:
    df[f"Weather_{cat}"] = (df["Weather"] == cat).astype(int)
print(f"       Weather one-hot   : Weather_Cloudy / Weather_Rainy / Weather_Sunny")

# Holiday: binary encode
holiday_map = {"No": 0, "Yes": 1}
df["Holiday_enc"] = df["Holiday"].map(holiday_map)
print(f"       Holiday map       : {holiday_map}")

# Crowd_Label: ordinal encode
crowd_map = {label: i for i, label in enumerate(CROWD_LABEL_ORDER)}
df["Crowd_Label_enc"] = df["Crowd_Label"].map(crowd_map)
print(f"       Crowd_Label map   : {crowd_map}")

# =============================================================================
# 3.  TEMPORAL TRAIN / TEST SPLIT (Date-aware to avoid trip leakage)
# =============================================================================
print()
print("[3/5]  Temporal train/test split (80/20 by date) ...")

df["Date_dt"] = pd.to_datetime(df["Date"])
df_sorted = df.sort_values("Date_dt").reset_index(drop=True)

unique_dates = sorted(df_sorted["Date_dt"].unique())
cutoff_date = unique_dates[int(len(unique_dates) * 0.80)]

train_mask = df_sorted["Date_dt"] < cutoff_date
test_mask  = df_sorted["Date_dt"] >= cutoff_date

df_train = df_sorted[train_mask]
df_test  = df_sorted[test_mask]

X_train = df_train[FEATURE_COLS].values
X_test  = df_test[FEATURE_COLS].values

y_delay_train = df_train["Delay_Minutes"].values
y_delay_test  = df_test["Delay_Minutes"].values

y_crowd_train = df_train["Crowd_Label_enc"].values
y_crowd_test  = df_test["Crowd_Label_enc"].values

print(f"       Train rows  : {len(df_train):,}  |  Test rows: {len(df_test):,}")

# =============================================================================
# 4.  TRAIN MODELS
# =============================================================================
print()
print("[4/5]  Training models ...")

# ── Delay model: RandomForestRegressor
print("       [Delay] RandomForestRegressor (n_estimators=200, max_depth=12) ...")
delay_model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=5,
    n_jobs=-1,
    random_state=42,
)
delay_model.fit(X_train, y_delay_train)

y_delay_pred = delay_model.predict(X_test)
delay_mae  = mean_absolute_error(y_delay_test, y_delay_pred)
delay_rmse = float(np.sqrt(mean_squared_error(y_delay_test, y_delay_pred)))
print(f"       Delay model MAE  : {delay_mae:.4f} minutes")
print(f"       Delay model RMSE : {delay_rmse:.4f} minutes")

# ── Crowd model: GradientBoostingClassifier
print("       [Crowd] GradientBoostingClassifier (n_estimators=200, max_depth=5) ...")
crowd_model = GradientBoostingClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.1,
    min_samples_leaf=10,
    random_state=42,
)
crowd_model.fit(X_train, y_crowd_train)

y_crowd_pred = crowd_model.predict(X_test)
crowd_acc = accuracy_score(y_crowd_test, y_crowd_pred)
crowd_f1  = f1_score(y_crowd_test, y_crowd_pred, average="macro")
print(f"       Crowd model Accuracy : {crowd_acc*100:.2f}%")
print(f"       Crowd model F1 Macro : {crowd_f1:.4f}")

# =============================================================================
# 5.  SAVE ARTEFACTS & TIMETABLE
# =============================================================================
print()
print("[5/5]  Saving artefacts & building discrete master timetable ...")

encoders = {
    "route_map":          route_map,
    "day_type_map":       day_type_map,
    "stop_name_classes":  stop_name_classes,
    "time_slot_order":    TIME_SLOT_ORDER,
    "time_slot_map":      ts_map,
    "weather_categories": WEATHER_CATEGORIES,
    "holiday_map":        holiday_map,
    "crowd_label_order":  CROWD_LABEL_ORDER,
    "crowd_map":          crowd_map,
    "feature_cols":       FEATURE_COLS,
}

joblib.dump(delay_model, DELAY_MODEL_PATH)
joblib.dump(crowd_model, CROWD_MODEL_PATH)
joblib.dump(encoders, ENCODERS_PATH)

# Map dataset route names to API route keys
ROUTE_DATASET_TO_API = {
    "Belman \u2192 Udupi": "belman_to_udupi",
    "Udupi \u2192 Belman": "udupi_to_belman",
}

# ── 1. Schedule Timetable (Discrete 10-20 min headway master timetable per route/stop/day_type)
schedule_timetable = {}

for (route_str, day_type, stop_name), grp in df.groupby(["Route", "Day_Type", "Stop_Name"]):
    api_route = ROUTE_DATASET_TO_API.get(route_str)
    if not api_route:
        continue
    key = f"{api_route}|{stop_name}|{day_type}"

    # Count occurrences of each integer scheduled minute
    counts = grp["Scheduled_Minutes"].round().astype(int).value_counts().sort_index()

    # Extract prominent scheduled departures (threshold >= 6 for Weekday, >= 3 for Weekend)
    threshold = 6 if day_type == "Weekday" else 3
    prominent = []
    for m, c in counts.items():
        if c >= threshold:
            near_rows = grp[(grp["Scheduled_Minutes"] >= m - 2) & (grp["Scheduled_Minutes"] <= m + 2)]
            dom_bus = str(near_rows["Bus_Name"].value_counts().idxmax())
            dom_slot = str(near_rows["Time_Slot"].value_counts().idxmax())
            is_peak = int(near_rows["Is_Peak_Hour"].median() >= 0.5)
            prominent.append({
                "scheduled_minutes": int(m),
                "bus_name": dom_bus,
                "time_slot": dom_slot,
                "is_peak_hour": is_peak,
                "count": int(len(near_rows)),
            })

    # Merge departures closer than 8 minutes to maintain genuine 10-20 minute bus headways
    merged = []
    for p in prominent:
        if not merged:
            merged.append(p)
        else:
            last = merged[-1]
            if p["scheduled_minutes"] - last["scheduled_minutes"] < 8:
                if p["count"] > last["count"]:
                    merged[-1] = p
            else:
                merged.append(p)

    schedule_timetable[key] = merged

with open(SCHEDULE_TIMETABLE_PATH, "w", encoding="utf-8") as f:
    json.dump(schedule_timetable, f, indent=2, ensure_ascii=False)
print(f"       schedule_timetable.json -> {SCHEDULE_TIMETABLE_PATH} ({len(schedule_timetable)} entries)")

# ── 2. Schedule Lookup (Slot level summary)
schedule_lookup = {}
for (route, stop, ts, dt), grp in df.groupby(["Route", "Stop_Name", "Time_Slot", "Day_Type"]):
    api_route = ROUTE_DATASET_TO_API.get(route)
    if api_route is None:
        continue
    key = f"{api_route}|{stop}|{ts}|{dt}"
    sched = grp["Scheduled_Minutes"]
    schedule_lookup[key] = {
        "median_scheduled": int(round(sched.median())),
        "mean_scheduled":   round(float(sched.mean()), 1),
        "min_scheduled":    int(sched.min()),
        "max_scheduled":    int(sched.max()),
        "count":            int(len(grp)),
    }

with open(SCHEDULE_LOOKUP_PATH, "w", encoding="utf-8") as f:
    json.dump(schedule_lookup, f, indent=2, ensure_ascii=False)
print(f"       schedule_lookup.json -> {SCHEDULE_LOOKUP_PATH}")

# ── 3. Bus Name Lookup (Fallback)
bus_name_lookup = {}
for (route, stop, ts), grp in df.groupby(["Route", "Stop_Name", "Time_Slot"]):
    api_route = ROUTE_DATASET_TO_API.get(route)
    if api_route is None:
        continue
    key = f"{api_route}|{stop}|{ts}"
    most_common = str(grp["Bus_Name"].value_counts().idxmax())
    bus_name_lookup[key] = most_common

with open(BUS_NAME_LOOKUP_PATH, "w", encoding="utf-8") as f:
    json.dump(bus_name_lookup, f, indent=2, ensure_ascii=False)
print(f"       bus_name_lookup.json -> {BUS_NAME_LOOKUP_PATH}")

print("=" * 65)
print("TRAINING COMPLETE -- Two-Stage Model Artefacts Saved Successfully")
print("=" * 65)
