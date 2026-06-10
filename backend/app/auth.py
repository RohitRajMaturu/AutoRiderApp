import hashlib
from dataclasses import dataclass
from fastapi import Depends, Header, HTTPException, WebSocket
from .db import get_pool


@dataclass
class CurrentUser:
    id: str
    role: str
    phone: str | None
    email: str | None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def resolve_realtime_token(token: str) -> CurrentUser:
    row = await get_pool().fetchrow(
        """
        UPDATE realtime_tokens rt
        SET last_used_at = CURRENT_TIMESTAMP
        FROM auth_users u
        WHERE rt.user_id = u.id
          AND rt.token_hash = $1
          AND rt.expires_at > CURRENT_TIMESTAMP
        RETURNING u.id::text AS id, u.role, u.phone, u.email
        """,
        hash_token(token),
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired realtime token")
    return CurrentUser(id=row["id"], role=row["role"], phone=row["phone"], email=row["email"])


async def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer realtime token required")
    return await resolve_realtime_token(authorization.split(" ", 1)[1].strip())


async def websocket_user(websocket: WebSocket) -> CurrentUser:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        raise RuntimeError("Missing token")
    try:
        return await resolve_realtime_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        raise
