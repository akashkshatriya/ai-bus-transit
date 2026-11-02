"""
ML model loader.

Loads the trained models and encoders ONCE at import time so they stay in
memory for the entire FastAPI process lifetime.  The predict router imports
from here rather than loading per-request.
"""

import json
import logging
from pathlib import Path
import joblib

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"

# ── Load artefacts ─────────────────────────────────────────────────────────────
try:
    delay_model = joblib.load(MODELS_DIR / "delay_model.pkl")
    crowd_model = joblib.load(MODELS_DIR / "crowd_model.pkl")
    encoders: dict = joblib.load(MODELS_DIR / "encoders.pkl")

    with open(MODELS_DIR / "bus_name_lookup.json", "r", encoding="utf-8") as f:
        bus_name_lookup: dict[str, str] = json.load(f)

    with open(MODELS_DIR / "schedule_lookup.json", "r", encoding="utf-8") as f:
        schedule_lookup: dict[str, dict] = json.load(f)

    with open(MODELS_DIR / "schedule_timetable.json", "r", encoding="utf-8") as f:
        # {route|stop|day_type: [sorted list of scheduled minutes]}
        schedule_timetable: dict[str, list] = json.load(f)

    logger.info("ML models and encoders loaded successfully from %s", MODELS_DIR)
    MODELS_LOADED = True

except Exception as exc:
    logger.warning("ML models could not be loaded: %s", exc)
    delay_model = None
    crowd_model = None
    encoders = {}
    bus_name_lookup = {}
    schedule_lookup = {}
    schedule_timetable = {}
    MODELS_LOADED = False

