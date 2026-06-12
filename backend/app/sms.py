import httpx
from .config import get_settings
from .logging import log_event, mask_phone


FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"
MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow"
MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


def _selected_provider() -> str:
    return get_settings().sms_provider.strip().lower()


def _fast2sms_number(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        return digits[2:]
    return digits


async def _send_fast2sms_otp(phone: str, otp: str) -> bool:
    settings = get_settings()
    number = _fast2sms_number(phone)
    if not settings.fast2sms_api_key or not number:
        log_event("fast2sms.otp.skipped", phone=mask_phone(phone), reason="missing_config_or_phone")
        return False

    payload = {
        "route": settings.fast2sms_otp_route,
        "message": f"Your Auto Ride OTP is {otp}. Do not share it with anyone.",
        "language": settings.fast2sms_language,
        "numbers": number,
    }
    if settings.fast2sms_sender_id:
        payload["sender_id"] = settings.fast2sms_sender_id

    headers = {"authorization": settings.fast2sms_api_key}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(FAST2SMS_URL, data=payload, headers=headers)
        ok = response.status_code < 400
        log_event("fast2sms.otp.sent", phone=mask_phone(phone), status_code=response.status_code, ok=ok)
        return ok


async def _send_fast2sms_transactional(phone: str | None, message: str) -> bool:
    settings = get_settings()
    number = _fast2sms_number(phone)
    if not settings.fast2sms_api_key or not number:
        log_event("fast2sms.transactional.skipped", phone=mask_phone(phone), reason="missing_config_or_phone")
        return False

    payload = {
        "route": settings.fast2sms_route,
        "message": message,
        "language": settings.fast2sms_language,
        "numbers": number,
    }
    if settings.fast2sms_sender_id:
        payload["sender_id"] = settings.fast2sms_sender_id

    headers = {"authorization": settings.fast2sms_api_key}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(FAST2SMS_URL, data=payload, headers=headers)
        ok = response.status_code < 400
        log_event("fast2sms.transactional.sent", phone=mask_phone(phone), status_code=response.status_code, ok=ok)
        return ok


async def _send_msg91_otp(phone: str, otp: str) -> bool:
    settings = get_settings()
    if not settings.msg91_auth_key or not settings.msg91_otp_template_id:
        log_event("msg91.otp.skipped", phone=mask_phone(phone), reason="missing_config")
        return False

    payload = {
        "template_id": settings.msg91_otp_template_id,
        "mobile": phone,
        "otp": otp,
    }
    headers = {"authkey": settings.msg91_auth_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(MSG91_OTP_URL, json=payload, headers=headers)
        ok = response.status_code < 400
        log_event("msg91.otp.sent", phone=mask_phone(phone), status_code=response.status_code, ok=ok)
        return ok


async def _send_msg91_transactional(phone: str | None, message: str) -> bool:
    settings = get_settings()
    if not phone or not settings.msg91_auth_key or not settings.msg91_transactional_template_id:
        log_event("msg91.transactional.skipped", phone=mask_phone(phone), reason="missing_config_or_phone")
        return False

    payload = {
        "template_id": settings.msg91_transactional_template_id,
        "short_url": "0",
        "recipients": [{"mobiles": phone, "message": message}],
    }
    headers = {"authkey": settings.msg91_auth_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(MSG91_FLOW_URL, json=payload, headers=headers)
        ok = response.status_code < 400
        log_event("msg91.transactional.sent", phone=mask_phone(phone), status_code=response.status_code, ok=ok)
        return ok


async def send_otp_sms(phone: str, otp: str) -> bool:
    provider = _selected_provider()
    if provider == "fast2sms":
        return await _send_fast2sms_otp(phone, otp)
    if provider == "msg91":
        return await _send_msg91_otp(phone, otp)
    log_event("sms.otp.skipped", phone=mask_phone(phone), provider=provider, reason="unknown_provider")
    return False


async def send_transactional_sms(phone: str | None, message: str) -> bool:
    provider = _selected_provider()
    if provider == "fast2sms":
        return await _send_fast2sms_transactional(phone, message)
    if provider == "msg91":
        return await _send_msg91_transactional(phone, message)
    log_event("sms.transactional.skipped", phone=mask_phone(phone), provider=provider, reason="unknown_provider")
    return False
