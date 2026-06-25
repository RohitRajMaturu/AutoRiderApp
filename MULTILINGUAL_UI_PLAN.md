# Multilingual Passenger and Driver UI Plan

## Goal

Support English, Hindi, and Telugu throughout passenger and driver mobile
experiences. The saved profile preference should control navigation labels,
forms, ride states, alerts, notifications, and informational content.

Admin and web operations can remain English during the first rollout.

## Existing foundation

- `auth_users.preferred_language` already exists.
- `/api/user-profile` already reads and updates the preference.
- Passenger Profile already has a Preferred Language selector.
- The remaining work is translation architecture, a Driver Profile selector,
  server notification localization, and replacing hardcoded mobile strings.

## Recommended rollout

### Phase 1: Translation foundation

Estimated effort: 2-3 developer days.

- Add `i18next` and `react-i18next` for Expo/React Native.
- Define locale codes `en`, `hi`, and `te`.
- Add translation namespaces: `common`, `auth`, `passenger`, `driver`,
  `rides`, `profile`, and `errors`.
- Add an app-level language provider.
- Resolve startup language from local preference, profile preference, device
  language, then English.
- Add locale-aware INR, date, duration, and pluralization helpers.
- Add English fallback and missing-key reporting.

Decision: confirm whether unauthenticated/login screens should follow device
language or remain English initially.

### Phase 2: Profile preference

Estimated effort: 1-2 developer days.

- Limit the first selector to English, हिन्दी, and తెలుగు.
- Add the same selector to Driver Profile.
- Store locale codes rather than translated labels.
- Map existing values such as `English`, `Hindi`, and `Telugu` during rollout.
- Apply language immediately after save without restarting the app.
- Cache preference locally so cold-start UI does not flash English.

This may need a small normalization migration. Per project policy, apply every
new migration immediately and run `npm run db:check`.

### Phase 3: Core ride journey

Estimated effort: 4-6 developer days.

Translate and test the highest-priority journey first:

- Passenger: booking, location selection, fare, negotiation, searching,
  driver assigned, trip started, completion, cancellation, and rating.
- Driver: online/offline, requests, accept/counter/decline, pickup, start,
  completion, fare collection, cancellation, passenger rating, and history.
- Shared: buttons, badges, validation, errors, empty states, confirmations,
  permissions, toasts, and accessibility labels.
- Generate push-notification text using the recipient's preferred language.

Decision: approve Hindi and Telugu terminology for safety, cancellation,
payment, and ride-status messages.

### Phase 4: Secondary screens

Estimated effort: 3-5 developer days.

- Passenger and driver profile/settings.
- Signup and onboarding WebView pages.
- KYC and document guidance.
- Ride history, chat labels, subscriptions, support, privacy, and consent.
- Return stable API error codes and translate them client-side instead of
  attempting to translate arbitrary English server messages.

### Phase 5: QA and rollout

Estimated effort: 3-4 developer days plus native-speaker review.

- Native Hindi and Telugu terminology review.
- Test small screens, font scaling, long labels, and multiline buttons.
- Screenshot regression coverage in all three languages.
- End-to-end passenger and driver lifecycle testing for each language.
- Verify Devanagari and Telugu rendering in Expo Go and release builds.
- Add translation completeness checks to CI.
- Release behind a feature flag before enabling Hindi and Telugu broadly.

## Architecture rules

- Use stable keys such as `ride.status.inProgress`, never visible English as a
  key.
- Store locale codes, not translated names.
- Keep API state values as machine codes such as `accepted` and `completed`.
- Translate only at the presentation boundary.
- Keep user-entered names, addresses, chat, and feedback unchanged.
- English is always the fallback.
- Format currency as INR using the selected locale.

## Estimated total effort

- Engineering: approximately 10-16 developer days.
- Translation/native-language review: 3-6 reviewer days.
- QA/release hardening: 3-5 developer or QA days.

Recommended first release: Phases 1-3, covering language preference and the
complete passenger/driver ride journey. Profiles, KYC, and secondary screens
can follow without delaying the core multilingual experience.
