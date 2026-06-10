import httpx
from .config import get_settings


async def send_transactional_sms(phone: str | None, message: str) -> bool:
    settings = get_settings()
    if not phone or not settings.msg91_auth_key or not settings.msg91_transactional_template_id:
        return False

    payload = {
        "template_id": settings.msg91_transactional_template_id,
        "short_url": "0",
        "recipients": [{"mobiles": phone, "message": message}],
    }
    headers = {"authkey": settings.msg91_auth_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://control.msg91.com/api/v5/flow", json=payload, headers=headers)
        return response.status_code < 400


async def send_otp_sms(phone: str, otp: str) -> bool:
    settings = get_settings()
    if not settings.msg91_auth_key or not settings.msg91_otp_template_id:
        return False

    payload = {
        "template_id": settings.msg91_otp_template_id,
        "mobile": phone,
        "otp": otp,
    }
    headers = {"authkey": settings.msg91_auth_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://control.msg91.com/api/v5/otp", json=payload, headers=headers)
        return response.status_code < 400
