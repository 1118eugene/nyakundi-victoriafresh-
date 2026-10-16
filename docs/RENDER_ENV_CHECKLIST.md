# Production environment checklist

All examples below are fake format examples; do not copy credentials from a
report, commit, or chat. PostgreSQL features require a valid `DATABASE_URL`.
The API can remain up without it to report a degraded health state and retry
the database connection. `PORT` defaults to `5000`, and the other integration
settings are optional for API startup. If either delivery-staff credential is
set, both must be set, and the key must be at least 32 characters.

Use Render's Environment settings for the backend service and Vercel's
Environment Variables settings for the Vercel frontend. `render.yaml` is also
used for the optional Render static-site frontend. Secret values are declared
with `sync: false`; they must be entered in the hosting dashboard, not in Git.

| Name | Required? | Secret? | Example format (fake) | Set on |
|---|---|---|---|---|
| `NODE_ENV` | Optional; set to `production` in production | No | `production` | Render backend (declared in `render.yaml`) |
| `PORT` | Optional; defaults to `5000` | No | `5000` | Render assigns this |
| `DATABASE_URL` | **Required for database-backed features** | **Yes** | `postgresql://fake_user:fake_password@db.example.invalid:5432/fake_db` | Render backend |
| `DATABASE_SSL` | Optional; `disable`, `require` (TLS without certificate verification), or `verify`; defaults to no TLS for localhost and verified TLS for remote hosts | No | `verify` | Render backend |
| `CLIENT_URL` | Optional; recommended browser origin | No | `https://store.example.invalid` | Render backend |
| `CORS_ALLOWED_ORIGINS` | Optional; recommended browser origin allow-list | No | `https://store.example.invalid,https://preview.example.invalid` | Render backend |
| `VERCEL_URL` | Optional; Vercel deployment hostname for CORS | No | `store-preview.example.invalid` | Supplied by Vercel; normally do not set on Render |
| `VERCEL_PRODUCTION_URL` | Optional; Vercel production hostname for CORS | No | `store.example.invalid` | Vercel; set on Render only if needed for CORS |
| `FRONTEND_URL` | Optional CORS origin alias | No | `https://store.example.invalid` | Render backend only if needed |
| `APP_URL` | Optional CORS origin alias | No | `https://store.example.invalid` | Render backend only if needed |
| `ADMIN_DASHBOARD_KEY` | Optional; required to enable admin endpoints | **Yes** | `fake-admin-key-not-for-use-0123456789abcdef` | Render backend |
| `DELIVERY_STAFF_ID` | Optional; pair with `DELIVERY_STAFF_KEY` | No | `fake-driver-01` | Render backend |
| `DELIVERY_STAFF_NAME` | Optional display name | No | `Example Delivery Staff` | Render backend |
| `DELIVERY_STAFF_KEY` | Optional; pair with ID; at least 32 characters | **Yes** | `fake-delivery-key-not-for-use-0123456789abcdef` | Render backend |
| `AUTH_SECRET` | Optional; required for customer sessions | **Yes** | `fake-auth-secret-not-for-use-0123456789abcdef` | Render backend |
| `MPESA_MODE` | Optional; defaults to Daraja in production | No | `daraja` or `mock` | Render backend |
| `MPESA_BASE_URL` | Optional; defaults by mode/environment | No | `https://sandbox.safaricom.co.ke` | Render backend if overriding |
| `MPESA_API_URL` | Optional alias for `MPESA_BASE_URL` | No | `https://sandbox.safaricom.co.ke` | Render backend only if using alias |
| `MPESA_CONSUMER_KEY` | Optional; required to enable Daraja | **Yes** | `fake-consumer-key` | Render backend |
| `MPESA_CONSUMER_SECRET` | Optional; required to enable Daraja | **Yes** | `fake-consumer-secret` | Render backend |
| `MPESA_SHORTCODE` | Optional; required to enable Daraja | No | `123456` | Render backend |
| `MPESA_BUSINESS_SHORTCODE` | Optional alias for `MPESA_SHORTCODE` | No | `123456` | Render backend only if using alias |
| `MPESA_PASSKEY` | Optional; required to enable Daraja | **Yes** | `fake-passkey` | Render backend |
| `MPESA_CALLBACK_SECRET` | Optional; required to enable Daraja | **Yes** | `fake-callback-secret` | Render backend |
| `MPESA_CALLBACK_URL` | Optional; required to enable Daraja; public HTTPS URL | No | `https://api.example.invalid/api/orders/mpesa/callback` | Render backend |
| `MPESA_PAYMENT_CALLBACK_URL` | Optional callback URL alias | No | `https://api.example.invalid/api/orders/mpesa/callback` | Render backend only if using alias |
| `MPESA_LOCAL_CALLBACK_URL` | Optional local-development callback alias | No | `http://localhost:5000/api/orders/mpesa/callback` | Local development only |
| `MPESA_TRANSACTION_TYPE` | Optional; defaults to `CustomerPayBillOnline` | No | `CustomerPayBillOnline` | Render backend if overriding |
| `GOOGLE_CLIENT_ID` | Optional; required only for Google sign-in | No | `fake-client-id.apps.example.invalid` | Render backend |
| `OTP_EXPIRY_MINUTES` | Optional; defaults to `5` | No | `5` | Render backend if overriding |
| `OTP_PROVIDER` | Optional; defaults to `africastalking` | No | `africastalking` or `email` | Render backend if using account OTP |
| `SMS_API_KEY` | Optional; required only for Africa's Talking OTP | **Yes** | `fake-sms-api-key` | Render backend |
| `SMS_USERNAME` | Optional; required only for Africa's Talking OTP | No | `sandbox` | Render backend |
| `SMS_SENDER_ID` | Optional sender label | No | `VFFTEST` | Render backend if configured |
| `RESEND_API_KEY` | Optional; required only for email OTP | **Yes** | `re_fake_not_a_real_key` | Render backend |
| `OTP_EMAIL_FROM` | Optional; required only for email OTP | No | `Victoria Fresh Fish <auth@example.invalid>` | Render backend |
| `FULIZA_API_KEY` | Optional; required only if Fuliza integration is used | **Yes** | `fake-fuliza-api-key` | Render backend |
| `FULIZA_CLIENT_ID` | Optional; required only if Fuliza integration is used | No | `fake-client-id` | Render backend |
| `FULIZA_BASE_URL` | Optional; required only if Fuliza integration is used | No | `https://fuliza.example.invalid` | Render backend |
| `RENDER_GIT_COMMIT` | Optional; automatically provided by Render when available | No | `0123456789abcdef0123456789abcdef01234567` | Render-managed; do not set manually |
| `GIT_COMMIT` | Optional version-endpoint fallback | No | `0123456789abcdef0123456789abcdef01234567` | CI only if Render metadata is unavailable |
| `VITE_API_URL` | **Required for the Vercel production frontend**; also required if using Render's static-site frontend | No | `https://api.example.invalid/api` | Vercel frontend and Render static site |
| `VITE_API_BASE_URL` | Optional alias/fallback for `VITE_API_URL` | No | `https://api.example.invalid/api` | Vercel frontend only if using alias |
| `VITE_WHATSAPP_NUMBER` | Optional support contact | No | `254700000000` | Vercel frontend |
| `VITE_SUPPORT_PHONE` | Optional support contact | No | `+254 700 000 000` | Vercel frontend |
| `VITE_SUPPORT_EMAIL` | Optional support contact | No | `support@example.invalid` | Vercel frontend |

The customer purchase flow is guest-accessible without OTP. Cash on delivery
is the default; M-Pesa after delivery is available only when its integration
is configured. OTP, account sessions, admin, delivery staff, M-Pesa, and
Fuliza credentials do not block API startup.

For remote PostgreSQL connections, keep `DATABASE_SSL=verify` unless the
database provider requires TLS without certificate verification. Use
`DATABASE_SSL=require` only for that case; `DATABASE_SSL=disable` turns TLS off.

## Render secret declaration check

`render.yaml` declares each backend secret above with `sync: false`, including
`DATABASE_URL`, admin/auth/delivery secrets, M-Pesa credentials, SMS/Resend
API keys, and the optional Fuliza API key. The manifest contains no secret
values. Public frontend/API URLs and CORS origins are non-secret settings.
