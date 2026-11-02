from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


VALID_ROUTES = Literal["belman_to_udupi", "udupi_to_belman"]
VALID_STATUSES = Literal["active", "ended"]


class TripStart(BaseModel):
    bus_name: str = Field(..., min_length=1, max_length=100)
    route: VALID_ROUTES


class TripOut(BaseModel):
    id: int
    bus_name: str
    route: str
    status: str
    started_at: datetime
    driver_id: int

    class Config:
        from_attributes = True


class ActiveTripOut(BaseModel):
    id: int
    bus_name: str
    route: str
    status: str
    started_at: datetime
    driver_id: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class LocationPing(BaseModel):
    lat: float
    lng: float
    timestamp: Optional[str] = None  # ISO string from browser


class LivePositionOut(BaseModel):
    trip_id: int
    bus_name: str
    route: str
    lat: float
    lng: float
    updated_at: str  # ISO string
