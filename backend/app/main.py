from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base
import app.models  # noqa: F401 — registers all ORM models before create_all
from app.routers import auth_router, trips_router, predict_router
from app.routers.admin import router as admin_router

# Create / migrate tables on startup
Base.metadata.create_all(bind=engine)

def seed_admin():
    from app.db.database import SessionLocal
    from app.models.user import User
    from app.core.security import get_password_hash
    db = SessionLocal()
    try:
        # Seed or sync master admins
        admin_emails = ["admin@bustracker.com", "akashkshatriya918@gmail.com"]
        for a_email in admin_emails:
            a_user = db.query(User).filter(User.email == a_email).first()
            if a_user:
                a_user.role = "admin"
                a_user.hashed_password = get_password_hash(settings.ADMIN_DEFAULT_PASSWORD)
            else:
                a_user = User(
                    name="System Admin" if "admin" in a_email else "Akash Admin",
                    email=a_email,
                    hashed_password=get_password_hash(settings.ADMIN_DEFAULT_PASSWORD),
                    role="admin",
                )
                db.add(a_user)
        db.commit()

        # Seed existing drivers from seed_drivers.json with standard password Driver@1234
        import json
        from pathlib import Path
        seed_path = Path(__file__).resolve().parent / "db" / "seed_drivers.json"
        driver_default_hash = get_password_hash("Driver@1234")
        if seed_path.exists():
            with open(seed_path, "r", encoding="utf-8") as f:
                drivers_data = json.load(f)
            for d in drivers_data:
                driver_email = d["email"].lower().strip()
                existing_driver = db.query(User).filter(User.email == driver_email).first()
                if not existing_driver:
                    new_driver = User(
                        name=d["name"],
                        email=driver_email,
                        hashed_password=driver_default_hash,
                        role=d.get("role", "driver"),
                    )
                    db.add(new_driver)
                else:
                    existing_driver.hashed_password = driver_default_hash
            db.commit()
    except Exception as e:
        print(f"Admin seeding notice: {e}")
    finally:
        db.close()

seed_admin()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI Backend for Bus Tracking & ML Prediction App",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# REST routes live under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(trips_router, prefix=settings.API_V1_STR)
app.include_router(predict_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)

# Note: the WebSocket route /ws/driver/{trip_id} is defined inside trips_router
# but mounted under /api/v1 just like the REST routes — the full path becomes
# ws://host/api/v1/trips/ws/driver/{trip_id}


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
