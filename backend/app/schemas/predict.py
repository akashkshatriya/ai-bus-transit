from pydantic import BaseModel, Field
from typing import Optional, Literal


class PredictRequest(BaseModel):
    stop_name: str = Field(..., min_length=1, description="Stop name, e.g. 'Bantakal'")
    route: str = Field(..., description="Route key: 'belman_to_udupi' or 'udupi_to_belman'")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format, e.g. '08:30'")
    day_type: Literal["Weekday", "Weekend"] = Field(..., description="Weekday or Weekend")


class LiveBus(BaseModel):
    bus_name: str
    trip_id: int
    last_lat: Optional[float] = None
    last_lng: Optional[float] = None
    updated_at: Optional[str] = None  # ISO string from LivePosition.updated_at


class PredictResponse(BaseModel):
    # Whether a valid prediction could be made
    no_prediction: bool = False
    no_prediction_reason: Optional[str] = None

    # Bus identification — from historical frequency lookup
    next_bus_name: Optional[str] = None

    # Historical / normal arrival — median scheduled arrival from dataset
    normal_arrival_time: Optional[str] = None

    # ML model outputs
    predicted_arrival_time: Optional[str] = None
    bus_delay_minutes: Optional[float] = None        # predicted_arrival - normal_arrival
    passenger_wait_minutes: Optional[float] = None   # predicted_arrival - passenger_entered_time
    predicted_crowd_level: Optional[str] = None

    # Data quality / confidence
    historical_data_points: Optional[int] = None

    # Live bus info — only populated when an active trip exists on the route
    live_bus: Optional[LiveBus] = None

    # Explanatory note
    confidence_note: str = ""
