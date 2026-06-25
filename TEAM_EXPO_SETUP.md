# Team Expo Setup

Use this guide when running TukTukGo on a new development computer or phone.
Local `.env` files are intentionally excluded from Git, so every team member
must create their own copies.

## Requirements

- Node.js 20 or newer
- npm
- Access to the project PostgreSQL database
- Expo Go installed on the test phone
- Computer and phone connected to the same Wi-Fi network

## 1. Install dependencies

From the repository root:

```powershell
cd web
npm install

cd ..\mobile
npm install
```

## 2. Find the computer's LAN address

```powershell
ipconfig
```

Use the active Wi-Fi adapter's IPv4 address. For example:
`192.168.1.25`.

Do not use `localhost` for a physical phone. On the phone, `localhost` means
the phone itself rather than the development computer.

## 3. Configure the web server

Copy `web/.env.example` to `web/.env` and configure at least:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
AUTH_SECRET=use-the-team-development-secret
AUTH_URL=http://192.168.1.25:4000
ENABLE_OTP_VERIFICATION=false
```

Replace `192.168.1.25` with the current computer's LAN address. Share database
credentials and `AUTH_SECRET` through a secure channel, never through Git.

Apply and verify the database migrations:

```powershell
cd web
npm run db:migrate
npm run db:check
```

Migration rule: after every pull or branch switch, if a new file exists under
`web/db/migrations`, run `npm run db:migrate` before starting or testing the
apps. The author of a migration must also apply it to the configured shared
development database and run `npm run db:check` before committing or pushing.

## 4. Configure Expo

Copy `mobile/.env.example` to `mobile/.env` and set:

```env
EXPO_PUBLIC_APP_URL=http://192.168.1.25:4000
EXPO_PUBLIC_BASE_URL=http://192.168.1.25:4000
EXPO_PUBLIC_HOST=192.168.1.25:4000
EXPO_PUBLIC_PROXY_BASE_URL=http://192.168.1.25:4000
EXPO_PUBLIC_WEB_URL=http://192.168.1.25:4000
```

Optional provider keys can remain empty for features that are not being
tested.

## 5. Start the project

Terminal 1:

```powershell
cd web
npm run dev:lan
```

Terminal 2:

```powershell
cd mobile
npm start
```

Scan the QR code with Expo Go.

Alternatively, the repository helper detects the LAN address and starts both
processes:

```powershell
.\run-local.ps1
```

Use `.\run-local.ps1 -ClearExpoCache` after environment or Metro-cache changes.

## Troubleshooting

- Confirm the web server opens at `http://YOUR_LAN_IP:4000` from the phone.
- Allow Node.js through Windows Firewall and allow ports `4000` and `8081`.
- Restart both the web server and Expo after changing either `.env` file.
- If Expo retains old environment values, run:

  ```powershell
  cd mobile
  powershell -File scripts/start-expo.ps1 -Clear
  ```

- If API writes return server errors, run `npm run db:migrate` and
  `npm run db:check` from `web` before debugging application code.
- Keep the development computer's LAN address stable or update both `.env`
  files whenever the address changes.
