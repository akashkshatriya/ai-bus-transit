from app.routers.auth import router as auth_router
from app.routers.trips import router as trips_router
from app.routers.predict import router as predict_router

__all__ = ["auth_router", "trips_router", "predict_router"]
