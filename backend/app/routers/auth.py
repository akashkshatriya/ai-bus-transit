from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    user_email = user_in.email.lower().strip()
    # Check if email is already registered
    existing_user = db.query(User).filter(User.email == user_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Determine role: check against admin list
    admin_list = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    assigned_role = "admin" if (user_email in admin_list or user_email.startswith("admin@")) else "passenger"

    # Create new user
    new_user = User(
        name=user_in.name.strip(),
        email=user_email,
        hashed_password=get_password_hash(user_in.password),
        role=assigned_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT token
    access_token = create_access_token(subject=new_user.id, role=new_user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=new_user.role,
        name=new_user.name
    )

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user_email = login_in.email.lower().strip()
    user = db.query(User).filter(User.email == user_email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Block disabled accounts
    if user.role == "disabled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact the administrator.",
        )

    # Auto-promote to admin if email matches admin list
    admin_list = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if (user_email in admin_list or user_email.startswith("admin@")) and user.role != "admin":
        user.role = "admin"
        db.commit()
        db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        name=user.name
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
