# Deployment Guide

Victoria Fresh Fish runs as two Render services: a frontend and an API backend.
The backend service must be a Render Web Service rooted at `backend`, not the
frontend Vite preview service. The expected backend URL is
`https://nyakundi-victoriafresh-2.onrender.com`.
The included `render.yaml` can create both services from the Render Blueprint flow.

## Git-triggered deployments

Connect this GitHub repository to the Render and Vercel projects, select the
intended production branch in each dashboard, and enable automatic deployments.
The GitHub Actions workflow runs tests; it does not deploy either host. Once the
host integrations are enabled, pushing a commit to the production branch starts
the builds and deployments without a manual Render deploy or server-side Git
pull. Local edits still need to be committed and pushed to GitHub before either
host can receive them. Other branches may create previews or may not deploy,
depending on each host's branch settings.

## 0. PostgreSQL setup

Create a managed PostgreSQL database (Render PostgreSQL, Neon, Supabase, or another provider) and copy its private connection URL without putting it in Git. The backend creates and upgrades its tables safely on startup:

```text
postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require
```

Never commit the URI, password, or an exported `.env` file.

## 1. Backend service

Create a Render Web Service with the Blueprint, or configure it manually with:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

Set `DATABASE_URL` to the private connection URL of the existing PostgreSQL
database. This is the only service credential required for the API to start.
Render supplies `PORT`. The production frontend origin is already configured
for `https://nyakundi-victoriafresh.vercel.app`; additional approved origins can
be added as comma-separated origins in `CORS_ALLOWED_ORIGINS`.

The Render Blueprint keeps `DATABASE_SSL=require` for the current database.
This encrypts PostgreSQL traffic without certificate verification. Keep this
setting for the current deployment unless the database provider supplies a CA
and the verified connection is tested. To enable certificate and hostname
verification, set `DATABASE_SSL=verify`. If the provider supplies a CA file,
add it in Render **Environment → Secret Files** and set
`NODE_EXTRA_CA_CERTS` to its mounted path (for example,
`/etc/secrets/postgres-ca.pem`). Node uses that CA for the verified connection;
backup and restore commands also pass the file to PostgreSQL client tools. Do
not switch the live database to `verify` until its CA is available and the
connection has been confirmed. A verification failure is reported as a generic
database SSL connection failure; the connection URL is not included.

The local Docker database remains on its existing plaintext localhost
connection by default. Do not set a TLS mode for local Docker unless its
configuration is intentionally changed.

Customer sessions are issued as seven-day HttpOnly cookies, not returned to
frontend JavaScript. The Vercel frontend proxies `/api/*` to the Render API, so
normal production browser requests are same-origin and use `SameSite=Lax;
Secure`. Direct cross-site frontend-to-Render requests use `SameSite=None;
Secure`. Cookie-authenticated state-changing requests require the
`x-vff-csrf: 1` header. Express trusts the two hops in the production
Render/Vercel forwarding chain for HTTPS and client-IP headers, so checkout,
authentication, and review rate limits use the original client IP. The
backend tests the `client, Vercel` forwarding order and confirms a spoofed
extra leftmost address cannot create a new limit bucket. Credentialed CORS
remains restricted to the exact configured frontend origins.

This fixed-hop configuration assumes production requests arrive through the
Vercel rewrite. The public Render API hostname may also be directly reachable;
the integration test does not prove that Render strips or replaces forged
forwarded headers on direct requests. Before opening the store, verify the
direct-origin behavior and restrict direct ingress or use an authenticated
proxy path if callers can influence the trusted forwarding chain. Per-phone
limits remain active, but they are not a substitute for trustworthy IP limits.

Customer password sessions, administration, and M-Pesa use these environment
variables when enabled:

```env
NODE_ENV=production
CLIENT_URL=https://nyakundi-victoriafresh.vercel.app
CORS_ALLOWED_ORIGINS=https://nyakundi-victoriafresh.vercel.app
DATABASE_URL=<private PostgreSQL connection URL>
ADMIN_DASHBOARD_KEY=<random admin key>
AUTH_SECRET=<random session-signing key>
MPESA_MODE=daraja
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_SECRET=<random callback secret>
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=https://nyakundi-victoriafresh-2.onrender.com/api/orders/mpesa/callback
```

Guest ordering and cash-on-delivery do not require `AUTH_SECRET`,
`ADMIN_DASHBOARD_KEY` or M-Pesa to be configured. Missing integrations
disable only their own functions; they do not prevent the API from starting or
customers from placing orders. M-Pesa is not requested at checkout. To enable
post-delivery M-Pesa, configure real Daraja credentials and a public HTTPS
callback URL. Mock mode never records a payment.

Customer accounts use email or phone plus a password. Existing accounts
created before password sign-in may need support assistance to establish a
password; guest ordering remains available.

Verify the backend after deployment:

```text
GET https://your-backend.onrender.com/api/health
GET https://your-backend.onrender.com/api/readiness
GET https://your-backend.onrender.com/api/orders/mpesa/status
```

`/api/health` and `/health` check PostgreSQL and return `503` while it is
unavailable. `/api/readiness` is also database-aware. The backend retries
schema initialization and connection in the background. A `503` means the
service cannot read or write orders; check the database service and the
`DATABASE_URL` setting without sharing its value.

The storefront probes `/api/health` at first load. If the API is waking from
Render's free-instance sleep or is temporarily unavailable, it displays a
non-blocking waking-up message and retries every five seconds. Customer-session
lookup also retries for up to about a minute. This is a browser-triggered
cold-start recovery flow, not an external keep-warm service; it cannot prevent
the instance from sleeping or guarantee recovery if the proxy/database remains
unavailable. Customer-session lookup retries transient failures with increasing
backoff so a sleeping API does not immediately turn an existing session into a
signed-out state.

## 2. Vercel frontend

Configure the Vercel project with:

- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable for Production (and Preview if previews use the proxy):
  `VITE_API_URL=/api`

Do not set `VITE_API_URL` to the Render hostname. Production builds use the
relative `/api` path, and [vercel.json](./vercel.json) proxies `/api/:path*`
before applying the SPA fallback rewrite. This keeps session cookies
first-party. Keep the API rewrite before the catch-all rewrite.

For local development, leave the production setting aside and run the frontend
with `npm run dev`; the client uses
`http://127.0.0.1:5000/api` unless a local Vite API URL override is supplied.

## 3. Optional Render static frontend

Create a Render Static Site from the Blueprint, or configure it manually:

- Root directory: `.`, when deploying the repository root
- Build command: `cd nyakundi && npm install && npm run build`
- Publish directory: `nyakundi/dist` for a Static Site

If the Render service root directory is already `nyakundi`:

- Build command: `npm install && npm run build`
- Start command: `npm start`

If using the optional Render static frontend, set this build environment
variable to the direct API URL because Vercel's rewrite does not apply there:

```env
VITE_API_URL=https://nyakundi-victoriafresh-2.onrender.com/api
```

For a direct cross-site connection, the API sets a `SameSite=None; Secure`
session cookie. The API CORS allow-list must include the exact frontend origin.
The frontend build embeds environment values, so redeploy after changing them.

For the Vercel production storefront, keep `VITE_API_URL=/api`; do not replace
it with the Render API hostname. Verify the Vercel rewrite and open the
storefront in a private browser window. The shop should show database-backed
product cards, and account sign-in should survive a page refresh.

## Local development

Run PostgreSQL locally, then start the API and frontend in separate terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
npm install
npm run dev
```

The frontend uses the Vite proxy to send `/api` requests to `http://localhost:5000`.

Or run both services together from the frontend directory:

```powershell
npm run dev:full
```

## Release checks

```powershell
cd backend
npm test
npm run build

cd ..
npm run build
```

Never commit `.env` files or payment credentials. Use Render environment variables
for production secrets.
