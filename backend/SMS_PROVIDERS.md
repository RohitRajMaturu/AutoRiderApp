# SMS Providers

The FastAPI backend sends OTP and fallback ride SMS through `app.sms`. Keep OTP,
ride dispatch, and mobile code provider-neutral by changing only environment
configuration.

## Fast2SMS Testing

```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_fast2sms_api_key
FAST2SMS_OTP_ROUTE=q
FAST2SMS_ROUTE=q
FAST2SMS_LANGUAGE=english
FAST2SMS_SENDER_ID=
```

`FAST2SMS_SENDER_ID` is optional for the current testing setup. The backend
normalizes Indian numbers like `+919876543210` to `9876543210` before calling
Fast2SMS.

## MSG91 Production

```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_OTP_TEMPLATE_ID=your_otp_template_id
MSG91_TRANSACTIONAL_TEMPLATE_ID=your_transactional_template_id
MSG91_SENDER_ID=
```

After switching providers, restart the FastAPI backend. The same
`/api/otp/send` and ride dispatch flows will use the selected provider.
