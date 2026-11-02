from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bus_name = Column(String, nullable=False)
    route = Column(String, nullable=False)      # "belman_to_udupi" | "udupi_to_belman"
    status = Column(String, nullable=False, default="active")  # "active" | "ended"
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    driver = relationship("User", backref="trips")
    live_position = relationship("LivePosition", back_populates="trip", uselist=False)


class LivePosition(Base):
    __tablename__ = "live_positions"
    __table_args__ = (UniqueConstraint("trip_id", name="uq_live_position_trip"),)

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, unique=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Trip", back_populates="live_position")
