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
| `DATABASE_SSL` | `disable`, `require` (encrypted; no certificate verification), or `verify` (certificate and hostname verification). The Render Blueprint retains `require` for the current database; local Docker behavior is unchanged. | No | `require` | Render backend |
| `NODE_EXTRA_CA_CERTS` | Optional path to a provider-supplied CA certificate file. Use with `DATABASE_SSL=verify` after uploading the CA as a Render Secret File. | No | `/etc/secrets/postgres-ca.pem` | Render backend |
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
| `FULIZA_API_KEY` | Optional; required only if Fuliza integration is used | **Yes** | `fake-fuliza-api-key` | Render backend |
| `FULIZA_CLIENT_ID` | Optional; required only if Fuliza integration is used | No | `fake-client-id` | Render backend |
| `FULIZA_BASE_URL` | Optional; required only if Fuliza integration is used | No | `https://fuliza.example.invalid` | Render backend |
| `RENDER_GIT_COMMIT` | Optional; automatically provided by Render when available | No | `0123456789abcdef0123456789abcdef01234567` | Render-managed; do not set manually |
| `GIT_COMMIT` | Optional version-endpoint fallback | No | `0123456789abcdef0123456789abcdef01234567` | CI only if Render metadata is unavailable |
| `VITE_API_URL` | Set to `/api` for Vercel so production uses the same-origin proxy. Use the direct Render `/api` URL only for the optional Render static frontend. | No | `/api` | Vercel frontend |
| `VITE_API_BASE_URL` | Optional local-development API override; do not set to an absolute Render URL on Vercel. | No | `http://127.0.0.1:5000/api` | Local frontend only |
| `VITE_WHATSAPP_NUMBER` | Optional support contact | No | `254700000000` | Vercel frontend |
| `VITE_SUPPORT_PHONE` | Optional support contact | No | `+254 700 000 000` | Vercel frontend |
| `VITE_SUPPORT_EMAIL` | Optional support contact | No | `support@example.invalid` | Vercel frontend |

The customer purchase flow is guest-accessible. Cash on delivery
is the default; M-Pesa after delivery is available only when its integration
is configured. Password account sessions, admin, delivery staff, M-Pesa, and
Fuliza credentials do not block guest checkout.

For the current Render PostgreSQL database, keep the Blueprint setting
`DATABASE_SSL=require` unless the provider's CA and certificate chain are
available and verified. `require` encrypts but does not verify the server
certificate. To enable `verify`, upload the CA under Render **Environment →
Secret Files**, set `NODE_EXTRA_CA_CERTS` to the mounted path, set
`DATABASE_SSL=verify`, and confirm the connection in staging. `verify` also
checks the server hostname. If the provider's CA is already trusted by Node,
set only `DATABASE_SSL=verify`. TLS verification failures report the generic
reason `database SSL connection failed`; the database URL is not logged or
returned. Do not use `DATABASE_SSL=disable` for a remote database.

## Exact Vercel and Render web settings

For the Vercel storefront project, use repository root as the Root Directory,
`npm run build` as the Build Command, and `dist` as the Output Directory. Set
`VITE_API_URL=/api` for Production and for Preview deployments that use the
same Vercel rewrite. Do not set the Vercel API URL to the Render hostname.
`vercel.json` must keep `/api/:path*` rewritten to
`https://nyakundi-victoriafresh-2.onrender.com/api/:path*` before the `/(.*)`
SPA fallback rewrite.

For the Render API Web Service, use root directory `backend`, build command
`npm install && npm run build`, start command `npm start`, and health check
path `/api/health`. Keep `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` set to the
exact production frontend origin `https://nyakundi-victoriafresh.vercel.app`;
add only exact approved preview origins if needed. Keep the Render database's
current `DATABASE_SSL=require` value unless the provider CA is available and
verified in staging.

Behind the Vercel rewrite the browser calls a same-origin `/api` path, so the
session cookie uses `SameSite=Lax; Secure`. A direct cross-site browser call
to Render uses `SameSite=None; Secure`. For the production browser → Vercel →
Render path, Express trusts exactly two proxy hops; rate-limit keys therefore
use the client address in the leftmost untrusted position of the forwarded
chain, not the shared Vercel/Render proxy address. The integration suite
checks distinct client addresses, the `client, Vercel` X-Forwarded-For order,
and that an extra spoofed leftmost address does not bypass a limit when the
expected two-hop chain is present. This does not establish that direct calls
to the public Render API hostname cannot spoof forwarded headers; before
opening the store, verify direct-origin behavior and restrict direct ingress
or use an authenticated proxy path if the trusted chain can be forged. Per-
phone limits remain a separate safeguard. Local Vite development continues
to use `http://127.0.0.1:5000/api`.

The storefront probes `/api/health` on first load. If the free Render instance
is waking or the API is temporarily unavailable, a non-blocking message is
shown while the browser retries every five seconds. Customer-session lookup
also retries transient failures with increasing backoff so a cold start does
not immediately turn an existing session into a signed-out state. This
browser-driven recovery is free, but it is not an external keep-warm service
and does not guarantee recovery when Render, Vercel, or the database remains
unavailable.

## Render secret declaration check

`render.yaml` declares each backend secret above with `sync: false`, including
`DATABASE_URL`, admin/auth/delivery secrets, M-Pesa credentials, SMS/Resend
API keys, and the optional Fuliza API key. The manifest contains no secret
values. Public frontend/API URLs and CORS origins are non-secret settings.
