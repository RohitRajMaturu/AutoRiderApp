import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .auth import hash_token
from .db import get_pool
from .logging import log_event, mask_phone
from .sms import send_otp_sms

router = APIRouter(prefix="/api/otp", tags=["otp"])


class OtpSend(BaseModel):
    phone: str = Field(min_length=8, max_length=20)


class OtpVerify(BaseModel):
    phone: str = Field(min_length=8, max_length=20)
    otp: str = Field(min_length=4, max_length=8)


def normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit() or ch == "+")


@router.post("/send", status_code=202)
async def send_otp(body: OtpSend):
    phone = normalize_phone(body.phone)
    pool = get_pool()
    cooldown = await pool.fetchrow(
        """
        SELECT last_sent_at
        FROM otp_cooldowns
        WHERE identifier = $1
          AND last_sent_at > CURRENT_TIMESTAMP - interval '60 seconds'
        """,
        phone,
    )
    if cooldown:
        log_event("otp.send.rejected", phone=mask_phone(phone), reason="cooldown")
        raise HTTPException(status_code=429, detail="OTP cooldown active")

    otp = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = hash_token(f"{phone}:{otp}")
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO otp_cooldowns (identifier, last_sent_at, updated_at)
                VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (identifier)
                DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                """,
                phone,
            )
            await conn.execute(
                """
                INSERT INTO otp_challenges (identifier, otp_hash, expires_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP + interval '5 minutes')
                """,
                phone,
                otp_hash,
            )

    await send_otp_sms(phone, otp)
    log_event("otp.send.accepted", phone=mask_phone(phone))
    return {"sent": True}


@router.post("/verify")
async def verify_otp(body: OtpVerify):
    phone = normalize_phone(body.phone)
    otp_hash = hash_token(f"{phone}:{body.otp}")
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            challenge = await conn.fetchrow(
                """
                UPDATE otp_challenges
                SET consumed_at = CURRENT_TIMESTAMP
                WHERE id = (
                  SELECT id
                  FROM otp_challenges
                  WHERE identifier = $1
                    AND otp_hash = $2
                    AND consumed_at IS NULL
                    AND expires_at > CURRENT_TIMESTAMP
                  ORDER BY created_at DESC
                  LIMIT 1
                )
                RETURNING id
                """,
                phone,
                otp_hash,
            )
            if not challenge:
                log_event("otp.verify.rejected", phone=mask_phone(phone), reason="invalid_or_expired")
                raise HTTPException(status_code=401, detail="Invalid or expired OTP")
            user = await conn.fetchrow(
                """
                SELECT id::text, phone, role
                FROM auth_users
                WHERE phone = $1
                ORDER BY created_at ASC
                LIMIT 1
                """,
                phone,
            )
            if not user:
                user = await conn.fetchrow(
                    """
                    INSERT INTO auth_users (phone, role)
                    VALUES ($1, 'passenger')
                    RETURNING id::text, phone, role
                    """,
                    phone,
                )
            token = secrets.token_urlsafe(32)
            await conn.execute(
                """
                INSERT INTO realtime_tokens (user_id, token_hash, expires_at)
                VALUES ($1, $2, $3)
                """,
                user["id"],
                hash_token(token),
                datetime.now(timezone.utc) + timedelta(days=7),
            )
    log_event("otp.verify.accepted", phone=mask_phone(phone), user_id=user["id"])
    return {"token": token, "user": dict(user)}
