import asyncio
from .config import get_settings
from .db import get_pool


async def offline_stale_or_expired_drivers() -> None:
    settings = get_settings()
    await get_pool().execute(
        """
        UPDATE drivers
        SET is_online = false,
            online_since = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_online = true
          AND (
            last_heartbeat_at IS NULL
            OR last_heartbeat_at < CURRENT_TIMESTAMP - make_interval(secs => $1)
            OR subscription_expiry IS NULL
            OR subscription_expiry <= CURRENT_TIMESTAMP
          )
        """,
        settings.driver_heartbeat_timeout_seconds,
    )


async def cancel_ghost_rides() -> None:
    settings = get_settings()
    await get_pool().execute(
        """
        UPDATE rides
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = 'accepted_timeout',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'accepted'
          AND accepted_at < CURRENT_TIMESTAMP - make_interval(mins => $1)
        """,
        settings.accepted_ride_timeout_minutes,
    )


async def cleanup_realtime_tokens() -> None:
    await get_pool().execute("DELETE FROM realtime_tokens WHERE expires_at <= CURRENT_TIMESTAMP")


async def run_once() -> None:
    await offline_stale_or_expired_drivers()
    await cancel_ghost_rides()
    await cleanup_realtime_tokens()


async def maintenance_loop(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    while not stop_event.is_set():
        try:
            await run_once()
        except Exception as exc:
            print(f"maintenance loop error: {exc}")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.maintenance_interval_seconds)
        except asyncio.TimeoutError:
            pass
