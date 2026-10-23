# Deployment Guide

Victoria Fresh Fish runs as two Render services: a frontend and an API backend.
The backend service must be a Render Web Service rooted at `backend`, not the
frontend Vite preview service. The expected backend URL is
`https://nyakundi-victoriafresh-2.onrender.com`.
The included `render.yaml` can create both services from the Render Blueprint flow.

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

## 2. Frontend service

Create a Render Static Site from the Blueprint, or configure it manually:

- Root directory: `.`, when deploying the repository root
- Build command: `cd nyakundi && npm install && npm run build`
- Publish directory: `nyakundi/dist` for a Static Site

If the Render service root directory is already `nyakundi`:

- Build command: `npm install && npm run build`
- Start command: `npm start`

Set this build environment variable:

```env
VITE_API_URL=https://nyakundi-victoriafresh-2.onrender.com/api
```

The frontend prefers `VITE_API_URL` and retains support for the older
`VITE_API_BASE_URL` alias. The frontend build embeds this URL, so redeploy after
changing it.

After both services exist, set `VITE_API_URL` to the backend URL ending in
`/api`, trigger a frontend deploy, and open the frontend in a private browser
window. The shop should show database-backed product cards.

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
