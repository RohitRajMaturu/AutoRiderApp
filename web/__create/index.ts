import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { skipCSRFCheck } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { hash, verify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import ws from 'ws';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';
neonConfig.webSocketConstructor = ws;

const als = new AsyncLocalStorage<{ requestId: string }>();

function isIgnorableDevStreamClose(args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const first = args[0];
  return (
    first instanceof Error &&
    first.message === 'The destination stream closed early.'
  );
}

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    if (method === 'error' && isIgnorableDevStreamClose(args)) {
      return;
    }
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = NeonAdapter(pool);
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function readClientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

function isPhoneIdentifier(value: string) {
  return value.replace(/\D/g, '').length >= 7 && !value.includes('@');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function hashOtp(phone: string, otp: string) {
  return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
}

function getAllowedAdminPhones() {
  return String(process.env.ADMIN_SETUP_PHONES || process.env.ADMIN_SETUP_PHONE || '')
    .split(',')
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

function canCreateAdminForPhone(phone: string) {
  const allowed = getAllowedAdminPhones();
  return process.env.ENABLE_ADMIN_SETUP === 'true' && (allowed.length === 0 || allowed.includes(phone));
}

function isOtpVerificationEnabled() {
  return process.env.ENABLE_OTP_VERIFICATION === 'true';
}

const app = new Hono();

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  await next();
});

app.onError((err, c) => {
  if (c.req.method !== 'GET') {
    return c.json(
      {
        error: 'An error occurred in your app',
        details: serializeError(err),
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024, // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      },
    })
  );
}

app.use('/api/*', async (c, next) => {
  const maxRequests = readPositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 120);
  if (maxRequests === 0) {
    return next();
  }

  const windowMs = readPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const now = Date.now();
  const resetAt = now + windowMs;
  const key = `${readClientIp(c.req.raw.headers)}:${c.req.method}:${c.req.path}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt });
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - 1)));
    return next();
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    c.header('Retry-After', String(retryAfterSeconds));
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', '0');
    return c.json({ error: 'Too many requests' }, 429);
  }

  bucket.count += 1;
  c.header('X-RateLimit-Limit', String(maxRequests));
  c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
  return next();
});

if (process.env.AUTH_SECRET) {
  app.use(
    '*',
    initAuthConfig((c) => {
      const authUrl = c.env.AUTH_URL || c.req.url;
      const useSecureCookies = authUrl.startsWith('https://');
      const sameSite = useSecureCookies ? 'none' : 'lax';

      return {
        secret: c.env.AUTH_SECRET,
        basePath: '/api/auth',
        pages: {
          signIn: '/account/signin',
          signOut: '/account/logout',
        },
        skipCSRFCheck,
        session: {
          strategy: 'jwt',
        },
        callbacks: {
          session({ session, token }) {
            if (token.sub) {
              session.user.id = token.sub;
            }
            return session;
          },
        },
        cookies: {
          csrfToken: {
            options: {
              secure: useSecureCookies,
              sameSite,
            },
          },
          sessionToken: {
            options: {
              secure: useSecureCookies,
              sameSite,
            },
          },
          callbackUrl: {
            options: {
              secure: useSecureCookies,
              sameSite,
            },
          },
        },
        providers: [
        // Dev-only provider for simulated social sign-in (Google, Facebook, etc.)
        // Creates or finds a user by email without requiring a password.
        ...(process.env.NEXT_PUBLIC_CREATE_ENV === 'DEVELOPMENT'
          ? [
              Credentials({
                id: 'dev-social',
                name: 'Development Social Sign-in',
                credentials: {
                  email: { label: 'Email', type: 'email' },
                  name: { label: 'Name', type: 'text' },
                  provider: { label: 'Provider', type: 'text' },
                },
                authorize: async (credentials) => {
                  const { email, name, provider } = credentials;
                  if (!email || typeof email !== 'string') return null;

                  const existing = await adapter.getUserByEmail(email);
                  if (existing) return existing;

                  const allowedProviders = new Set(['google', 'facebook', 'twitter', 'apple']);
                  const providerName =
                    typeof provider === 'string' && allowedProviders.has(provider.toLowerCase())
                      ? provider.toLowerCase()
                      : 'google';
                  const newUser = await adapter.createUser({
                    emailVerified: null,
                    email,
                    name:
                      typeof name === 'string' && name.length > 0
                        ? name
                        : undefined,
                  });
                  await adapter.linkAccount({
                    type: 'oauth',
                    userId: newUser.id,
                    provider: providerName,
                    providerAccountId: `dev-${newUser.id}`,
                  });
                  return newUser;
                },
              }),
            ]
          : []),
        Credentials({
          id: 'credentials-signin',
          name: 'Credentials Sign in',
          credentials: {
            email: {
              label: 'Email or phone',
              type: 'text',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
          },
          authorize: async (credentials) => {
            const { email, password } = credentials;
            console.log('[auth] credentials-signin attempt', { email });
            if (!email || !password) {
              console.error('[auth] credentials-signin missing email/password');
              return null;
            }
            if (typeof email !== 'string' || typeof password !== 'string') {
              console.error('[auth] credentials-signin invalid credential types');
              return null;
            }

            const identifier = email.trim();
            const user = isPhoneIdentifier(identifier)
              ? await adapter.getUserByPhone(identifier)
              : await adapter.getUserByEmail(identifier.toLowerCase());
            if (!user) {
              console.error('[auth] credentials-signin user not found', { identifier });
              return null;
            }
            const matchingAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
            );
            const accountPassword = matchingAccount?.password;
            if (!accountPassword && !isOtpVerificationEnabled()) {
              console.log('[auth] credentials-signin passwordless test login', { userId: user.id });
              return user;
            }
            if (!accountPassword) {
              console.error('[auth] credentials-signin missing credentials account', { userId: user.id });
              return null;
            }

            const isValid = await verify(accountPassword, password);
            if (!isValid) {
              console.error('[auth] credentials-signin invalid password', { userId: user.id });
              return null;
            }

            // return user object with the their profile data
            return user;
          },
        }),
        Credentials({
          id: 'credentials-signup',
          name: 'Credentials Sign up',
          credentials: {
            email: {
              label: 'Email',
              type: 'email',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
            phone: { label: 'Phone', type: 'text' },
            role: { label: 'Role', type: 'text' },
            otp: { label: 'OTP', type: 'text', required: false },
            name: { label: 'Name', type: 'text' },
            image: { label: 'Image', type: 'text', required: false },
          },
          authorize: async (credentials) => {
            const { email, password, phone, role, otp, name, image } = credentials;
            console.log('[auth] credentials-signup attempt', { email, phone, role, otpEnabled: isOtpVerificationEnabled() });
            if (!email || !password) {
              console.error('[auth] credentials-signup missing email/password');
              return null;
            }
            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }
            if (password.length < 1) {
              console.error('[auth] credentials-signup empty password');
              return null;
            }

            const normalizedEmail = email.trim().toLowerCase();
            const normalizedPhone = typeof phone === 'string' ? normalizePhone(phone) : '';
            const normalizedOtp = typeof otp === 'string' ? otp.replace(/\D/g, '') : '';
            const requestedRole =
              role === 'driver' || role === 'admin' || role === 'passenger' ? role : 'passenger';
            const nextRole =
              requestedRole === 'admin'
                ? canCreateAdminForPhone(normalizedPhone)
                  ? 'admin'
                  : null
                : requestedRole;

            if (isOtpVerificationEnabled() && normalizedOtp.length < 4) {
              console.error('[auth] credentials-signup otp required', { normalizedPhone });
              return null;
            }
            if (!nextRole || normalizedPhone.length < 8) {
              console.error('[auth] credentials-signup invalid role/phone', { nextRole, normalizedPhone });
              return null;
            }

            // logic to verify if user exists
            const user = await adapter.getUserByEmail(normalizedEmail);
            const phoneUser = await adapter.getUserByPhone(normalizedPhone);
            const existing = user || phoneUser;
            if (!user) {
              if (phoneUser && phoneUser.email && phoneUser.email !== normalizedEmail) {
                console.error('[auth] credentials-signup phone belongs to different email', {
                  phone: normalizedPhone,
                  existingEmail: phoneUser.email,
                  normalizedEmail,
                });
                return null;
              }
            }

            if (!existing) {
              const created = await pool.query(
                `
                  INSERT INTO auth_users (email, phone, role, name, image)
                  VALUES ($1, $2, $3, $4, $5)
                  RETURNING id, name, email, phone, role, "emailVerified", image
                `,
                [
                  normalizedEmail,
                  normalizedPhone,
                  nextRole,
                  typeof name === 'string' && name.length > 0 ? name : null,
                  typeof image === 'string' && image.length > 0 ? image : null,
                ]
              );
              const newUser = created.rows[0];
              console.log('[auth] credentials-signup created user', { userId: newUser.id, role: newUser.role });
              await adapter.linkAccount({
                extraData: {
                  password: await hash(password),
                },
                type: 'credentials',
                userId: newUser.id,
                providerAccountId: newUser.id,
                provider: 'credentials',
              });
              return newUser;
            }

            const matchingAccount = existing.accounts.find(
              (account) => account.provider === 'credentials'
            );
            if (matchingAccount?.password) {
              const isValid = await verify(matchingAccount.password, password);
              if (!isValid) {
                return null;
              }
            } else {
              await adapter.linkAccount({
                extraData: {
                  password: await hash(password),
                },
                type: 'credentials',
                userId: existing.id,
                providerAccountId: existing.id,
                provider: 'credentials',
              });
            }

            const updated = await pool.query(
              `
                UPDATE auth_users
                SET email = $2,
                    phone = $3,
                    role = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id, name, email, phone, role, "emailVerified", image
              `,
              [existing.id, normalizedEmail, normalizedPhone, nextRole]
            );
            console.log('[auth] credentials-signup updated user', { userId: updated.rows[0].id, role: updated.rows[0].role });
            return updated.rows[0];
          },
        }),
        Credentials({
          id: 'phone-otp',
          name: 'Phone OTP',
          credentials: {
            phone: {
              label: 'Phone',
              type: 'text',
            },
            otp: {
              label: 'OTP',
              type: 'text',
            },
          },
          authorize: async (credentials) => {
            const { phone, otp } = credentials;
            if (!phone || !otp || typeof phone !== 'string' || typeof otp !== 'string') {
              return null;
            }

            const normalizedPhone = normalizePhone(phone);
            const normalizedOtp = otp.replace(/\D/g, '');
            if (normalizedPhone.length < 8 || (isOtpVerificationEnabled() && normalizedOtp.length < 4)) {
              return null;
            }

            const existing = await adapter.getUserByPhone(normalizedPhone);
            if (existing) return existing;

            const created = await pool.query(
              `
                INSERT INTO auth_users (phone, role)
                VALUES ($1, 'passenger')
                RETURNING id, name, email, phone, role, "emailVerified", image
              `,
              [normalizedPhone]
            );
            return created.rows[0];
          },
        }),
        Credentials({
          id: 'test-register',
          name: 'Test Register',
          credentials: {
            phone: { label: 'Phone', type: 'text' },
            email: { label: 'Email', type: 'email' },
            role: { label: 'Role', type: 'text' },
            otp: { label: 'OTP', type: 'text' },
          },
          authorize: async (credentials) => {
            const { phone, email, role, otp } = credentials;
            if (!phone || !otp || typeof phone !== 'string' || typeof otp !== 'string') {
              return null;
            }

            const normalizedPhone = normalizePhone(phone);
            const normalizedOtp = otp.replace(/\D/g, '');
            const normalizedEmail =
              typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
            const requestedRole =
              role === 'driver' || role === 'admin' || role === 'passenger' ? role : 'passenger';
            const nextRole =
              requestedRole === 'admin'
                ? canCreateAdminForPhone(normalizedPhone)
                  ? 'admin'
                  : null
                : requestedRole;

            if (normalizedPhone.length < 8 || (isOtpVerificationEnabled() && normalizedOtp.length < 4) || !nextRole) {
              return null;
            }

            const existingByPhone = await adapter.getUserByPhone(normalizedPhone);
            const existingByEmail = normalizedEmail ? await adapter.getUserByEmail(normalizedEmail) : null;
            const existing = existingByPhone || existingByEmail;

            if (existing) {
              const nextEmail =
                normalizedEmail && (!existingByEmail || existingByEmail.id === existing.id)
                  ? normalizedEmail
                  : existing.email;
              const updated = await pool.query(
                `
                  UPDATE auth_users
                  SET phone = COALESCE($2, phone),
                      email = COALESCE($3, email),
                      role = $4,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                  RETURNING id, name, email, phone, role, "emailVerified", image
                `,
                [existing.id, normalizedPhone, nextEmail, nextRole]
              );
              return updated.rows[0];
            }

            const created = await pool.query(
              `
                INSERT INTO auth_users (phone, email, role)
                VALUES ($1, $2, $3)
                RETURNING id, name, email, phone, role, "emailVerified", image
              `,
              [normalizedPhone, normalizedEmail, nextRole]
            );
            return created.rows[0];
          },
        }),
        ],
      };
    })
  );
}
app.all('/integrations/:path{.+}', async (c, next) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? 'https://www.create.xyz'}/integrations/${c.req.param('path')}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    // @ts-expect-error -- duplex is accepted by the runtime even though the
    // type declarations don't include it; required for streaming integrations
    duplex: 'half',
    redirect: 'manual',
    headers: {
      ...c.req.header(),
      'X-Forwarded-For': process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-host': process.env.NEXT_PUBLIC_CREATE_HOST,
      Host: process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-project-group-id': process.env.NEXT_PUBLIC_PROJECT_GROUP_ID,
    },
  });
});

app.use('/api/auth/*', async (c, next) => {
  if (isAuthAction(c.req.path)) {
    return authHandler()(c, next);
  }
  return next();
});
app.route(API_BASENAME, api);

if (process.env.NODE_ENV === 'development') {
  mkdirSync('build/client', { recursive: true });
  mkdirSync('public', { recursive: true });
}

export default await createHonoServer({
  app,
  defaultLogger: false,
});
