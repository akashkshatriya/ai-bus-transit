from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class DriverCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)

    class Config:
        extra = "ignore"

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)

class ActiveTripOut(BaseModel):
    driver_id: int
    driver_name: str
    driver_email: str
    bus_name: str
    route: str
    started_at: datetime
    last_position_time: Optional[datetime] = None

    class Config:
        from_attributes = True
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)

    class Config:
        extra = "ignore"


class DriverCreateOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class DriverOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

