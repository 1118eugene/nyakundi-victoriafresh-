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

Set these environment variables in Render:

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend.onrender.com
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require
ADMIN_DASHBOARD_KEY=use-a-long-random-secret
AUTH_SECRET=use-a-different-long-random-session-secret
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_SECRET=use-a-different-long-random-secret
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=https://your-backend.onrender.com/api/orders/mpesa/callback
SMS_PROVIDER=twilio
# Or use africas_talking with SMS_API_KEY, SMS_USERNAME, and SMS_SENDER_ID.
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
```

`MPESA_CALLBACK_URL` must be public HTTPS. Do not use localhost in production.
`SMS_PROVIDER` must be `twilio` or `africas_talking` in production. Demo SMS
and mock M-Pesa are development-only and are rejected during production startup.
For Africa's Talking, the API sends the provider's required form-encoded
`application/x-www-form-urlencoded` request.

Verify the backend after deployment:

```text
GET https://your-backend.onrender.com/api/health
GET https://your-backend.onrender.com/api/readiness
GET https://your-backend.onrender.com/api/orders/mpesa/status
```

The health endpoint confirms that the process is alive and includes the current
database state. Render should use `/api/health` so a temporary PostgreSQL outage
does not restart-loop the web service. `/api/readiness` reports whether the
database is currently connected. M-Pesa status must report `configured: true`
and `callbackReady: true` before accepting live orders.

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
VITE_API_BASE_URL=https://nyakundi-victoriafresh-2.onrender.com/api
```

The frontend build embeds this URL, so redeploy after changing it.

After both services exist, set `VITE_API_BASE_URL` to the exact backend URL ending in
`/api`, trigger a frontend deploy, and open the frontend in a private browser window.
The shop should show product cards rather than a connection recovery message.

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
