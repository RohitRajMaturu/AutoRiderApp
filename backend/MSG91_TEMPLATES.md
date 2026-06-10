# MSG91 Templates

Use these templates when creating MSG91-approved message templates. Store the
approved template IDs in the backend environment variables after MSG91 approves
them.

## Template 1 - OTP Login

Message:

```text
Your AutoRide OTP is {#var#}. Valid for 10 minutes. Do not share with anyone. - AutoRide
```

Type: Transactional

Route: OTP

Environment variable:

```env
MSG91_OTP_TEMPLATE_ID=
```

## Template 2 - Ride Alert SMS

Driver offline fallback.

Message:

```text
New ride request on AutoRide. Pickup: {#var#}. Destination: {#var#}. Open app to accept. - AutoRide
```

Type: Transactional

Route: Transactional

Environment variable:

```env
MSG91_TRANSACTIONAL_TEMPLATE_ID=
```

## Template 3 - Ride Accepted Confirmation

Passenger fallback.

Message:

```text
Your AutoRide request has been accepted. Driver: {#var#}, Vehicle: {#var#}. Call: {#var#}. - AutoRide
```

Type: Transactional

Route: Transactional

Environment variable:

```env
MSG91_RIDE_ACCEPTED_TEMPLATE_ID=
```
