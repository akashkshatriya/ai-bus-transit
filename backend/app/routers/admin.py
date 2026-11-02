from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.security import get_password_hash, require_admin
from app.schemas.admin import DriverCreate, DriverCreateOut, DriverOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/drivers", response_model=DriverCreateOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    cleaned_name = driver_in.name.strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name cannot be empty"
        )

    cleaned_email = driver_in.email.lower().strip()

    # Duplicate e-mail returns 409 Conflict
    existing_user = db.query(User).filter(User.email == cleaned_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    new_driver = User(
        name=cleaned_name,
        email=cleaned_email,
        hashed_password=get_password_hash(driver_in.password),
        role="driver"
    )
    db.add(new_driver)
    db.commit()
    db.refresh(new_driver)

    return new_driver


@router.get("/drivers", response_model=list[DriverOut])
def list_drivers(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    drivers = db.query(User).filter(User.role == "driver").order_by(User.id.asc()).all()
    return drivers

