import os
import json
from typing import Union
from pydantic_settings import BaseSettings
from pydantic import field_validator


DEFAULT_SECRET_KEY = "dev_secret_key_bus_tracker_987654321"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bus Tracker + ML Prediction API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    DATABASE_URL: str = "sqlite:///./bus_tracker.db"
    # CORS_ORIGINS accepts a comma-separated string or JSON array string.
    # In production set:
    #   CORS_ORIGINS=https://your-app.vercel.app,capacitor://localhost
    CORS_ORIGINS: Union[list[str], str] = [
        "http://localhost:5173",
        "capacitor://localhost",
        "http://localhost",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [i.strip() for i in v_stripped.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:5173", "capacitor://localhost", "http://localhost"]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Startup security validation for SECRET_KEY
if settings.SECRET_KEY == DEFAULT_SECRET_KEY:
    raise ValueError(
        "Insecure SECRET_KEY: SECRET_KEY cannot match the hard-coded default value. "
        "Please generate a secure secret key and set SECRET_KEY in your .env file.\n"
        "Run: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
if len(settings.SECRET_KEY) < 32:
    raise ValueError(
        f"Insecure SECRET_KEY: SECRET_KEY must be at least 32 characters long "
        f"(current length is {len(settings.SECRET_KEY)})."
    )


