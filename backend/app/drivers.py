from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .auth import CurrentUser, current_user
from .config import get_settings
from .db import get_pool
from .maintenance import offline_stale_or_expired_drivers

router = APIRouter(prefix="/api/drivers", tags=["drivers"])


class Heartbeat(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


async def find_zone(lat: float, lng: float):
    return await get_pool().fetchrow(
        """
        SELECT id::text, name
        FROM geo_zones
        WHERE is_active = true
          AND ST_Covers(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        ORDER BY created_at ASC
        LIMIT 1
        """,
        lng,
        lat,
    )


@router.post("/heartbeat")
async def heartbeat(body: Heartbeat, user: CurrentUser = Depends(current_user)):
    await offline_stale_or_expired_drivers()
    driver = await get_pool().fetchrow(
        """
        SELECT id::text, is_approved, subscription_expiry
        FROM drivers
        WHERE user_id = $1
        LIMIT 1
        """,
        user.id,
    )
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    if not driver["is_approved"]:
        raise HTTPException(status_code=403, detail="Driver is not approved")
    if not driver["subscription_expiry"]:
        raise HTTPException(status_code=403, detail="Subscription is inactive")

    zone_id = None
    if body.lat is not None and body.lng is not None:
        zone = await find_zone(body.lat, body.lng)
        if not zone:
            await get_pool().execute(
                "UPDATE drivers SET is_online = false, online_since = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                driver["id"],
            )
            raise HTTPException(status_code=422, detail="Driver is outside active service zones")
        zone_id = zone["id"]

    row = await get_pool().fetchrow(
        """
        UPDATE drivers
        SET is_online = true,
            zone_id = COALESCE($2, zone_id),
            online_since = COALESCE(online_since, CURRENT_TIMESTAMP),
            last_heartbeat_at = CURRENT_TIMESTAMP,
            last_lat = COALESCE($3, last_lat),
            last_lng = COALESCE($4, last_lng),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND subscription_expiry > CURRENT_TIMESTAMP
        RETURNING id::text, is_online, zone_id::text, last_heartbeat_at
        """,
        driver["id"],
        zone_id,
        body.lat,
        body.lng,
    )
    if not row:
        raise HTTPException(status_code=403, detail="Subscription expired")
    return {"driver": dict(row), "heartbeat_timeout_seconds": get_settings().driver_heartbeat_timeout_seconds}


@router.get("/pending-requests")
async def pending_requests(user: CurrentUser = Depends(current_user)):
    driver = await get_pool().fetchrow(
        "SELECT id::text FROM drivers WHERE user_id = $1 AND is_online = true LIMIT 1",
        user.id,
    )
    if not driver:
        return {"rides": []}
    rows = await get_pool().fetch(
        """
        SELECT r.*, n.created_at AS dispatched_at
        FROM ride_driver_notifications n
        JOIN rides r ON r.id = n.ride_id
        WHERE n.driver_id = $1
          AND n.channel = 'websocket'
          AND n.status IN ('pending', 'failed', 'sent')
          AND r.status = 'requested'
          AND r.driver_id IS NULL
        ORDER BY n.created_at ASC
        """,
        driver["id"],
    )
    return {"rides": [dict(row) for row in rows]}
