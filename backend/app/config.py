from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    msg91_auth_key: str | None = None
    msg91_otp_template_id: str | None = None
    msg91_transactional_template_id: str | None = None
    msg91_sender_id: str | None = None
    passenger_request_cooldown_seconds: int = 30
    passenger_post_cancel_cooldown_seconds: int = 60
    driver_heartbeat_timeout_seconds: int = 120
    accepted_ride_timeout_minutes: int = 45
    maintenance_interval_seconds: int = 15
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=(".env", "../web/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
