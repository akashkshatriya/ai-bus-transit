
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.security import get_password_hash, require_admin
from app.schemas.admin import (
    DriverCreate,
    DriverCreateOut,
    ResetPasswordRequest,
    ActiveTripOut,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

# Create driver
@router.post("/drivers", response_model=DriverCreateOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    cleaned_name = driver_in.name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty")
    cleaned_email = driver_in.email.lower().strip()
    existing_user = db.query(User).filter(User.email == cleaned_email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    new_driver = User(
        name=cleaned_name,
        email=cleaned_email,
        hashed_password=get_password_hash(driver_in.password),
        role="driver",
    )
    db.add(new_driver)
    db.commit()
    db.refresh(new_driver)
    return new_driver

# List drivers (including disabled)
@router.get("/drivers", response_model=list[DriverCreateOut])
def list_drivers(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    drivers = db.query(User).filter(User.role.in_(["driver", "disabled"]))\
        .order_by(User.id.asc()).all()
    return drivers

# Disable driver
@router.post("/drivers/{driver_id}/disable", response_model=DriverCreateOut)
def disable_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == driver_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Driver not found.")
    if target.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Admins cannot disable themselves.")
    if target.role != "driver":
        raise HTTPException(status_code=400, detail="Can only disable active drivers.")
    target.role = "disabled"
    db.commit()
    db.refresh(target)
    return target

# Enable driver
@router.post("/drivers/{driver_id}/enable", response_model=DriverCreateOut)
def enable_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == driver_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Driver not found.")
    if target.role != "disabled":
        raise HTTPException(status_code=400, detail="Can only enable disabled drivers.")
    target.role = "driver"
    db.commit()
    db.refresh(target)
    return target

# Reset password
@router.post("/drivers/{driver_id}/reset-password")
def reset_password(
    driver_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    target = db.query(User).filter(User.id == driver_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Driver not found.")
    if target.role not in ["driver", "disabled"]:
        raise HTTPException(status_code=400, detail="Can only reset password for drivers.")
    target.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": "Password reset successfully."}

# Active trips
@router.get("/active-trips", response_model=list[ActiveTripOut])
def get_active_trips(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    from app.models.trip import Trip, LivePosition
    active = (
        db.query(
            Trip.id,
            Trip.bus_name,
            Trip.route,
            Trip.started_at,
            User.id.label("driver_id"),
            User.name.label("driver_name"),
            User.email.label("driver_email"),
            LivePosition.updated_at.label("last_position_time"),
        )
        .join(User, Trip.driver_id == User.id)
        .outerjoin(LivePosition, LivePosition.trip_id == Trip.id)
        .filter(Trip.status == "active")
        .all()
    )
    result = []
    for row in active:
        result.append(
            ActiveTripOut(
                driver_id=row.driver_id,
                driver_name=row.driver_name,
                driver_email=row.driver_email,
                bus_name=row.bus_name,
                route=row.route,
                started_at=row.started_at,
                last_position_time=row.last_position_time,
            )
        )
    return result
