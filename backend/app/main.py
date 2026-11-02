from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base
import app.models  # noqa: F401 — registers all ORM models before create_all
from app.routers import auth_router, trips_router, predict_router
from app.routers.admin import router as admin_router

# Create / migrate tables on startup
Base.metadata.create_all(bind=engine)

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
