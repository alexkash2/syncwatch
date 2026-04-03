import secrets
import warnings

from pydantic_settings import BaseSettings

_DEFAULT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://syncwatch:syncwatch@localhost:5432/syncwatch"
    SECRET_KEY: str = _DEFAULT_SECRET
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    WS_TICKET_EXPIRE_SECONDS: int = 30
    CORS_ORIGINS: str = "http://localhost:3000"
    ALGORITHM: str = "HS256"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

if settings.SECRET_KEY == _DEFAULT_SECRET:
    warnings.warn(
        "SECRET_KEY is using the default value! Set a real secret in .env for production.",
        stacklevel=1,
    )
