"""
POST /predict — ML prediction endpoint (FIXED).

Passenger enters: reference time, stop, route, day_type.
The system:
  1. Finds the historical normal/scheduled arrival for the next bus
     using a fine-grained timetable (schedule_timetable.json) —
     binary search for the next scheduled minute >= passenger's entered time.
  2. Feeds the NORMAL arrival into the ML model to predict delay.
  3. Computes predicted_arrival = normal_arrival + delay.
  4. Bus Delay = predicted_arrival - normal_arrival (NOT passenger wait).
  5. Passenger Wait = predicted_arrival - entered_time.
"""

import bisect
import numpy as np
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.schemas.predict import PredictRequest, PredictResponse, LiveBus
from app.core.stops import get_stop_order, ALL_STOP_NAMES, ROUTE_API_TO_DATASET
from app.core.ml_models import (
    delay_model,
    crowd_model,
    encoders,
    bus_name_lookup,
    schedule_lookup,
    schedule_timetable,
    MODELS_LOADED,
)
from app.models.trip import Trip, LivePosition

router = APIRouter(prefix="/predict", tags=["predict"])


# ── Time-slot derivation (must match the dataset's boundaries exactly) ────────
TIME_SLOTS_ORDERED = ["Early Morning", "Morning Peak", "Midday", "Evening Peak", "Night"]

# Upper bound (exclusive) of each time slot in minutes
TIME_SLOT_BOUNDS = [420, 570, 960, 1110, 1440]

LAST_BUS_MINUTES = 20 * 60 + 30   # 20:30; no buses run after this time


def arrival_minutes_from_hhmm(time_str: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_hhmm(minutes: int) -> str:
    """Convert minutes since midnight to 'HH:MM'. Handles wrap past midnight."""
    minutes = minutes % 1440
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def derive_time_slot(arrival_minutes: int) -> str:
    """Derive Time_Slot from Arrival_Minutes using dataset-consistent boundaries."""
    if arrival_minutes < 420:
        return "Early Morning"
    elif arrival_minutes < 570:
        return "Morning Peak"
    elif arrival_minutes < 960:
        return "Midday"
    elif arrival_minutes < 1110:
        return "Evening Peak"
    else:
        return "Night"


def derive_is_peak_hour(time_slot: str) -> int:
    """Is_Peak_Hour = 1 for Morning Peak and Evening Peak, 0 otherwise."""
    return 1 if time_slot in ("Morning Peak", "Evening Peak") else 0


def get_time_slot_index(time_slot: str) -> int:
    """Return index of a time slot in the ordered list."""
    return TIME_SLOTS_ORDERED.index(time_slot)


def find_normal_arrival(route: str, stop_name: str, passenger_minutes: int, day_type: str):
    """
    Find the historical normal/scheduled arrival and bus name for the next bus after
    the passenger's entered time.

    Uses schedule_timetable.json: a sorted list of trip objects:
      [ { "scheduled_minutes": int, "bus_name": str, "time_slot": str, "count": int }, ... ]

    Binary-searches for the smallest scheduled_minutes >= passenger_minutes.

    Returns: (normal_arrival_minutes, next_bus_name, resolved_time_slot, data_count) or (None, None, None, None)
    """
    timetable_key = f"{route}|{stop_name}|{day_type}"
    timetable = schedule_timetable.get(timetable_key)

    if not timetable:
        return None, None, None, None

    # Binary search: find index of first trip whose scheduled_minutes >= passenger_minutes
    times = [t["scheduled_minutes"] for t in timetable]
    idx = bisect.bisect_left(times, passenger_minutes)

    if idx >= len(timetable):
        # No scheduled bus at or after passenger's time today
        return None, None, None, None

    matched_trip = timetable[idx]
    normal_arrival_minutes = matched_trip["scheduled_minutes"]
    if normal_arrival_minutes > LAST_BUS_MINUTES:
        return None, None, None, None

    next_bus_name = matched_trip["bus_name"]
    resolved_time_slot = matched_trip["time_slot"]
    data_count = matched_trip["count"]

    return normal_arrival_minutes, next_bus_name, resolved_time_slot, data_count




# ── Stops list endpoint (for frontend dropdown) ──────────────────────────────
@router.get("/stops")
def list_stops():
    """Return all known stop names for the frontend dropdown."""
    return {"stops": ALL_STOP_NAMES}


# ── Main prediction endpoint ─────────────────────────────────────────────────
@router.post("", response_model=PredictResponse)
def predict(body: PredictRequest, db: Session = Depends(get_db)):
    """
    Predict bus arrival for a passenger waiting at a stop.

    The passenger's entered time is used ONLY to determine which upcoming bus
    to consider. The ML model predicts delay based on the bus's NORMAL
    scheduled arrival (from historical data), NOT the passenger's entered time.
    """
    if not MODELS_LOADED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded. Run train_models.py first.",
        )

    # ── a. Convert passenger's entered time to minutes ────────────────────────
    try:
        passenger_minutes = arrival_minutes_from_hhmm(body.time)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM.")

    if passenger_minutes < 0 or passenger_minutes > 1439:
        raise HTTPException(status_code=400, detail="Time must be between 00:00 and 23:59.")

    # ── b. Look up Stop_Order ─────────────────────────────────────────────────
    stop_order = get_stop_order(body.route, body.stop_name)
    if stop_order is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Stop '{body.stop_name}' does not exist on route '{body.route}'. "
                f"Valid stops: {ALL_STOP_NAMES}"
            ),
        )

    # ── c. Find the next bus's NORMAL/scheduled arrival from historical data ──
    normal_arrival_minutes, next_bus_name, resolved_time_slot, data_count = find_normal_arrival(
        body.route, body.stop_name, passenger_minutes, body.day_type
    )

    # ── c2. Independently query for a live active trip on the route ───────────
    live_bus: LiveBus | None = None
    now_utc = datetime.utcnow()
    stale_threshold = now_utc - timedelta(minutes=5)

    active_trip = (
        db.query(Trip)
        .filter(Trip.route == body.route, Trip.status == "active")
        .options(joinedload(Trip.live_position))
        .order_by(Trip.started_at.desc())
        .first()
    )
    if active_trip:
        pos = active_trip.live_position
        last_time = pos.updated_at if (pos and pos.updated_at) else active_trip.started_at
        if last_time and last_time < stale_threshold:
            active_trip.status = "ended"
            active_trip.ended_at = now_utc
            db.commit()
        else:
            live_bus = LiveBus(
                bus_name=active_trip.bus_name,
                trip_id=active_trip.id,
                last_lat=pos.latitude  if pos else None,
                last_lng=pos.longitude if pos else None,
                updated_at=pos.updated_at.isoformat() if pos and pos.updated_at else None,
            )

    # ── d. Handle no data / no bus available ──────────────────────────────────
    if normal_arrival_minutes is None:
        live_note = ""
        if live_bus:
            live_note = f" However, a live bus ('{live_bus.bus_name}') is currently active on this route."

        return PredictResponse(
            no_prediction=True,
            no_prediction_reason=(
                f"No reliable historical bus data found for {body.stop_name} on "
                f"route {body.route} ({body.day_type}) at or after {body.time}. "
                f"There may be no scheduled service around this time.{live_note}"
            ),
            live_bus=live_bus,
            confidence_note="Insufficient historical data for prediction.",
        )

    # ── e. Derive features using the NORMAL arrival (not passenger's time) ────
    is_peak_hour = derive_is_peak_hour(resolved_time_slot)

    # Default assumptions for unobserved inputs
    weather = "Sunny"
    holiday = "No"
    bus_capacity = 65

    # Build the 12-feature vector in exact order from encoders
    route_map = encoders["route_map"]
    day_type_map = encoders["day_type_map"]
    stop_name_classes = encoders["stop_name_classes"]
    ts_map = encoders["time_slot_map"]
    holiday_map = encoders["holiday_map"]
    crowd_label_order = encoders["crowd_label_order"]

    dataset_route_name = ROUTE_API_TO_DATASET.get(body.route)
    if dataset_route_name is None or dataset_route_name not in route_map:
        raise HTTPException(status_code=400, detail=f"Unknown route: {body.route}")

    route_enc = route_map[dataset_route_name]

    if body.stop_name not in stop_name_classes:
        raise HTTPException(status_code=400, detail=f"Unknown stop name: {body.stop_name}")
    stop_name_enc = stop_name_classes.index(body.stop_name)

    day_type_enc = day_type_map.get(body.day_type, 0)
    time_slot_enc = ts_map.get(resolved_time_slot, 2)  # default Midday
    weather_cloudy = 1 if weather == "Cloudy" else 0
    weather_rainy  = 1 if weather == "Rainy"  else 0
    weather_sunny  = 1 if weather == "Sunny"  else 0
    holiday_enc    = holiday_map.get(holiday, 0)

    # KEY FIX: Use the NORMAL/historical arrival minutes, NOT the passenger's time
    feature_vector = np.array([[
        route_enc,
        stop_name_enc,
        stop_order,
        day_type_enc,
        is_peak_hour,
        time_slot_enc,
        weather_cloudy,
        weather_rainy,
        weather_sunny,
        holiday_enc,
        normal_arrival_minutes,    # <-- HISTORICAL arrival, not passenger's time
        bus_capacity,
    ]], dtype=float)

    # ── f. Run ML models ──────────────────────────────────────────────────────
    raw_delay             = float(delay_model.predict(feature_vector)[0])
    predicted_crowd_class = int(crowd_model.predict(feature_vector)[0])
    predicted_crowd_label = crowd_label_order[predicted_crowd_class]

    # Operational corridor delay variation (0 to 3 min) based on peak hours and stop progression
    traffic_delay = 0
    if is_peak_hour == 1:
        traffic_delay += 1
    if stop_order >= 4:  # Downstream & intermediate stops face cumulative traffic
        traffic_delay += 1
    if resolved_time_slot == "Evening Peak":
        traffic_delay += 1

    # Bounded to 0 - 3 min for standard conditions
    predicted_delay = float(min(3, max(0, round(raw_delay) + traffic_delay)))

    # ── g. Compute all arrival/delay/wait values ──────────────────────────────
    predicted_arrival_minutes = normal_arrival_minutes + int(round(predicted_delay))

    # Handle midnight crossing: if predicted goes past 1440, wrap
    normal_arrival_time    = minutes_to_hhmm(normal_arrival_minutes)
    predicted_arrival_time = minutes_to_hhmm(predicted_arrival_minutes)

    bus_delay_minutes = round(predicted_delay, 1)

    # Passenger wait: how long from their entered time until the predicted arrival
    # Handle midnight crossing properly
    if predicted_arrival_minutes >= passenger_minutes:
        passenger_wait_minutes = predicted_arrival_minutes - passenger_minutes
    else:
        # Bus arrives after midnight, passenger is before midnight
        passenger_wait_minutes = (1440 - passenger_minutes) + predicted_arrival_minutes

    passenger_wait_minutes = round(passenger_wait_minutes, 1)

    # ── h. Historical bus name ────────────────────────────────────────────────
    if not next_bus_name:
        lookup_key = f"{body.route}|{body.stop_name}|{resolved_time_slot}"
        next_bus_name = bus_name_lookup.get(lookup_key)

    # ── i. Confidence note ────────────────────────────────────────────────────
    ml_note = (
        f"ML prediction based on {data_count} historical trips "
        f"for {body.stop_name} ({resolved_time_slot}, {body.day_type})."
    )
    weather_note = "Assumes clear weather and a non-holiday."

    if live_bus:
        live_note = f" A live bus ('{live_bus.bus_name}') is currently active on this route."
    else:
        live_note = " No live bus is currently active — showing historical prediction only."

    confidence_note = f"{ml_note}{live_note} {weather_note}"

    return PredictResponse(
        no_prediction=False,
        next_bus_name=next_bus_name,
        normal_arrival_time=normal_arrival_time,
        predicted_arrival_time=predicted_arrival_time,
        bus_delay_minutes=bus_delay_minutes,
        passenger_wait_minutes=passenger_wait_minutes,
        predicted_crowd_level=predicted_crowd_label,
        historical_data_points=data_count,
        live_bus=live_bus,
        confidence_note=confidence_note,
    )
