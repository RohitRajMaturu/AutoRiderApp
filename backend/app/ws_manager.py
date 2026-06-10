import asyncio
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._by_user: dict[str, set[WebSocket]] = defaultdict(set)
        self._driver_to_user: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket, driver_id: str | None = None) -> None:
        await websocket.accept()
        async with self._lock:
            self._by_user[user_id].add(websocket)
            if driver_id:
                self._driver_to_user[driver_id] = user_id

    async def disconnect(self, user_id: str, websocket: WebSocket, driver_id: str | None = None) -> None:
        async with self._lock:
            self._by_user[user_id].discard(websocket)
            if not self._by_user[user_id]:
                self._by_user.pop(user_id, None)
            if driver_id:
                self._driver_to_user.pop(driver_id, None)

    async def send_user(self, user_id: str, payload: dict) -> bool:
        sockets = list(self._by_user.get(user_id, set()))
        if not sockets:
            return False
        delivered = False
        for socket in sockets:
            try:
                await socket.send_json(payload)
                delivered = True
            except Exception:
                pass
        return delivered

    async def send_driver(self, driver_id: str, payload: dict) -> bool:
        user_id = self._driver_to_user.get(driver_id)
        if not user_id:
            return False
        return await self.send_user(user_id, payload)


manager = ConnectionManager()
