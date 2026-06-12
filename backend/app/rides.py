import asyncio
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .auth import CurrentUser, current_user
from .config import get_settings
from .db import get_pool
from .maintenance import cancel_ghost_rides, offline_stale_or_expired_drivers
from .sms import send_transactional_sms
from .ws_manager import manager
from .logging import log_event

router = APIRouter(prefix="/api", tags=["rides"])


class RideCreate(BaseModel):
    pickup_address: str = Field(min_length=3, max_length=500)
    pickup_lat: float = Field(ge=-90, le=90)
    pickup_lng: float = Field(ge=-180, le=180)
    dest_address: str = Field(min_length=3, max_length=500)
    dest_lat: float = Field(ge=-90, le=90)
    dest_lng: float = Field(ge=-180, le=180)
    pickup_place_id: str | None = None
    dest_place_id: str | None = None
    distance_km: Decimal | None = None
    duration_mins: int | None = None
    estimated_fare: int | None = None


class RideAction(BaseModel):
    action: str


async def find_zone(lat: float, lng: float):
    return await get_pool().fetchrow(
        """
        SELECT id::text, name, max_online_drivers
        FROM geo_zones
        WHERE is_active = true
          AND ST_Covers(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        ORDER BY created_at ASC
        LIMIT 1
        """,
        lng,
        lat,
    )


async def dispatch_ride(ride_id: str, zone_id: str) -> None:
    settings = get_settings()
    await offline_stale_or_expired_drivers()
    drivers = await get_pool().fetch(
        """
        SELECT d.id::text, d.user_id::text, u.phone
        FROM drivers d
        JOIN auth_users u ON u.id = d.user_id
        WHERE d.zone_id = $1
          AND d.is_online = true
          AND d.is_approved = true
          AND d.subscription_expiry > CURRENT_TIMESTAMP
          AND d.last_heartbeat_at >= CURRENT_TIMESTAMP - make_interval(secs => $2)
        ORDER BY d.online_since ASC NULLS LAST, d.updated_at ASC
        LIMIT (SELECT max_online_drivers FROM geo_zones WHERE id = $1)
        """,
        zone_id,
        settings.driver_heartbeat_timeout_seconds,
    )
    websocket_delivered = 0
    sms_attempted = 0
    sms_delivered = 0
    for driver in drivers:
        await get_pool().execute(
            """
            INSERT INTO ride_driver_notifications (ride_id, driver_id, channel, status, payload)
            VALUES ($1, $2, 'websocket', 'pending', $3::jsonb)
            ON CONFLICT (ride_id, driver_id, channel) DO NOTHING
            """,
            ride_id,
            driver["id"],
            '{"type":"ride_request"}',
        )
        delivered = await manager.send_driver(
            driver["id"],
            {"type": "ride_request", "ride_id": ride_id},
        )
        if delivered:
            websocket_delivered += 1
            await get_pool().execute(
                """
                UPDATE ride_driver_notifications
                SET status = 'sent', delivered_at = CURRENT_TIMESTAMP
                WHERE ride_id = $1 AND driver_id = $2 AND channel = 'websocket'
                """,
                ride_id,
                driver["id"],
            )
        else:
            sms_attempted += 1
            await get_pool().execute(
                """
                INSERT INTO ride_driver_notifications (ride_id, driver_id, channel, status, payload)
                VALUES ($1, $2, 'sms', 'pending', $3::jsonb)
                ON CONFLICT (ride_id, driver_id, channel) DO NOTHING
                """,
                ride_id,
                driver["id"],
                '{"type":"ride_request_sms"}',
            )
            ok = await send_transactional_sms(driver["phone"], "New AutoRide request available. Open the app to accept.")
            if ok:
                sms_delivered += 1
            await get_pool().execute(
                """
                UPDATE ride_driver_notifications
                SET status = $3, delivered_at = CASE WHEN $3 = 'sent' THEN CURRENT_TIMESTAMP ELSE delivered_at END
                WHERE ride_id = $1 AND driver_id = $2 AND channel = 'sms'
                """,
                ride_id,
                driver["id"],
                "sent" if ok else "failed",
            )
    log_event(
        "ride.dispatch",
        ride_id=ride_id,
        zone_id=zone_id,
        candidate_drivers=len(drivers),
        websocket_delivered=websocket_delivered,
        sms_attempted=sms_attempted,
        sms_delivered=sms_delivered,
    )


@router.post("/rides", status_code=202)
async def create_ride(body: RideCreate, user: CurrentUser = Depends(current_user)):
    await cancel_ghost_rides()
    pool = get_pool()
    active = await pool.fetchrow(
        "SELECT id::text FROM rides WHERE passenger_id = $1 AND status IN ('requested', 'accepted') LIMIT 1",
        user.id,
    )
    if active:
        log_event("ride.create.rejected", user_id=user.id, reason="active_ride")
        raise HTTPException(status_code=400, detail="You already have an active ride request")

    settings = get_settings()
    recent = await pool.fetchrow(
        """
        SELECT id FROM rides
        WHERE passenger_id = $1
          AND created_at > CURRENT_TIMESTAMP - make_interval(secs => $2)
        LIMIT 1
        """,
        user.id,
        settings.passenger_request_cooldown_seconds,
    )
    if recent:
        log_event("ride.create.rejected", user_id=user.id, reason="request_cooldown")
        raise HTTPException(status_code=429, detail="Request cooldown active")

    cancelled = await pool.fetchrow(
        """
        SELECT id FROM rides
        WHERE passenger_id = $1
          AND status = 'cancelled'
          AND cancelled_at > CURRENT_TIMESTAMP - make_interval(secs => $2)
        LIMIT 1
        """,
        user.id,
        settings.passenger_post_cancel_cooldown_seconds,
    )
    if cancelled:
        log_event("ride.create.rejected", user_id=user.id, reason="post_cancel_cooldown")
        raise HTTPException(status_code=429, detail="Post-cancellation cooldown active")

    zone = await find_zone(body.pickup_lat, body.pickup_lng)
    if not zone:
        log_event("ride.create.rejected", user_id=user.id, reason="no_zone")
        raise HTTPException(status_code=422, detail="Pickup is outside all active service zones")

    ride = await pool.fetchrow(
        """
        INSERT INTO rides (
          passenger_id, pickup_address, pickup_place_id, pickup_lat, pickup_lng,
          dest_address, dest_place_id, dest_lat, dest_lng,
          distance_km, duration_mins, estimated_fare, zone_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id::text, status, zone_id::text
        """,
        user.id,
        body.pickup_address,
        body.pickup_place_id,
        body.pickup_lat,
        body.pickup_lng,
        body.dest_address,
        body.dest_place_id,
        body.dest_lat,
        body.dest_lng,
        body.distance_km,
        body.duration_mins,
        body.estimated_fare,
        zone["id"],
    )
    asyncio.create_task(dispatch_ride(ride["id"], ride["zone_id"]))
    log_event("ride.create.accepted", user_id=user.id, ride_id=ride["id"], zone_id=ride["zone_id"])
    return {"ride": dict(ride), "zone": dict(zone)}


@router.patch("/rides/{ride_id}")
async def update_ride(ride_id: str, body: RideAction, user: CurrentUser = Depends(current_user)):
    await cancel_ghost_rides()
    pool = get_pool()
    driver = await pool.fetchrow(
        "SELECT id::text, zone_id::text FROM drivers WHERE user_id = $1 LIMIT 1",
        user.id,
    )
    driver_id = driver["id"] if driver else None

    if body.action == "accept":
        if not driver:
            raise HTTPException(status_code=403, detail="Only drivers can accept rides")
        ride = await pool.fetchrow(
            """
            UPDATE rides
            SET driver_id = $2,
                status = 'accepted',
                accepted_at = CURRENT_TIMESTAMP,
                expires_at = CURRENT_TIMESTAMP + make_interval(mins => $3),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND status = 'requested'
              AND driver_id IS NULL
              AND zone_id = $4
              AND EXISTS (
                SELECT 1 FROM ride_driver_notifications n
                WHERE n.ride_id = rides.id AND n.driver_id = $2
              )
            RETURNING *
            """,
            ride_id,
            driver_id,
            get_settings().accepted_ride_timeout_minutes,
            driver["zone_id"],
        )
        if not ride:
            log_event("ride.accept.rejected", ride_id=ride_id, driver_id=driver_id)
            raise HTTPException(status_code=409, detail="Ride already accepted, cancelled, or unavailable")
        asyncio.create_task(manager.send_user(str(ride["passenger_id"]), {"type": "ride_accepted", "ride_id": ride_id}))
        log_event("ride.accepted", ride_id=ride_id, driver_id=driver_id, passenger_id=str(ride["passenger_id"]))
        return {"ride": dict(ride)}

    if body.action == "complete":
        ride = await pool.fetchrow(
            """
            UPDATE rides
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
            RETURNING *
            """,
            ride_id,
            driver_id,
        )
        if not ride:
            log_event("ride.complete.rejected", ride_id=ride_id, driver_id=driver_id)
            raise HTTPException(status_code=409, detail="Ride cannot be completed")
        log_event("ride.completed", ride_id=ride_id, driver_id=driver_id)
        return {"ride": dict(ride)}

    if body.action == "cancel":
        ride = await pool.fetchrow(
            """
            UPDATE rides
            SET status = 'cancelled',
                cancelled_at = CURRENT_TIMESTAMP,
                cancellation_reason = 'user_cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND (passenger_id = $2 OR driver_id = $3)
              AND status IN ('requested', 'accepted')
            RETURNING *
            """,
            ride_id,
            user.id,
            driver_id,
        )
        if not ride:
            log_event("ride.cancel.rejected", ride_id=ride_id, user_id=user.id, driver_id=driver_id)
            raise HTTPException(status_code=409, detail="Ride cannot be cancelled")
        log_event("ride.cancelled", ride_id=ride_id, user_id=user.id, driver_id=driver_id)
        return {"ride": dict(ride)}

    raise HTTPException(status_code=400, detail="Invalid action")
