import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .auth import websocket_user
from .config import get_settings
from .db import close_db, connect_db, get_pool
from .drivers import router as drivers_router
from .maintenance import maintenance_loop
from .otp import router as otp_router
from .rides import router as rides_router
from .ws_manager import manager

stop_event = asyncio.Event()
maintenance_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global maintenance_task
    await connect_db()
    stop_event.clear()
    maintenance_task = asyncio.create_task(maintenance_loop(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        if maintenance_task:
            maintenance_task.cancel()
            try:
                await maintenance_task
            except asyncio.CancelledError:
                pass
        await close_db()


settings = get_settings()
app = FastAPI(title="AutoRide Realtime Backend", version="1.0.0", lifespan=lifespan)
origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(rides_router)
app.include_router(drivers_router)
app.include_router(otp_router)


@app.get("/health")
async def health():
    return {"ok": True}


async def get_driver_id(user_id: str) -> str | None:
    row = await get_pool().fetchrow("SELECT id::text FROM drivers WHERE user_id = $1 LIMIT 1", user_id)
    return row["id"] if row else None


async def replay_pending(driver_id: str) -> None:
    rows = await get_pool().fetch(
        """
        SELECT r.id::text AS ride_id
        FROM ride_driver_notifications n
        JOIN rides r ON r.id = n.ride_id
        WHERE n.driver_id = $1
          AND n.channel = 'websocket'
          AND n.status IN ('pending', 'failed', 'sent')
          AND r.status = 'requested'
          AND r.driver_id IS NULL
        ORDER BY n.created_at ASC
        """,
        driver_id,
    )
    for row in rows:
        await manager.send_driver(driver_id, {"type": "ride_request", "ride_id": row["ride_id"], "replay": True})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user = await websocket_user(websocket)
    driver_id = await get_driver_id(user.id) if user.role == "driver" else None
    await manager.connect(user.id, websocket, driver_id)
    try:
        await websocket.send_json({"type": "connected", "user_id": user.id, "role": user.role})
        if driver_id:
            await replay_pending(driver_id)
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            if message.get("type") == "ack" and driver_id and message.get("ride_id"):
                await get_pool().execute(
                    """
                    UPDATE ride_driver_notifications
                    SET status = 'sent', delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
                    WHERE ride_id = $1 AND driver_id = $2 AND channel = 'websocket'
                    """,
                    message["ride_id"],
                    driver_id,
                )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user.id, websocket, driver_id)
