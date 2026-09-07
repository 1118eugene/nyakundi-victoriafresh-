# Deployment Guide

Victoria Fresh Fish runs as two Render services: a frontend and an API backend.
The included `render.yaml` can create both services from the Render Blueprint flow.

## 1. Backend service

Create a Render Web Service with the Blueprint, or configure it manually with:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

Set these environment variables in Render:

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend.onrender.com
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/victoria_fish
DB_NAME=victoria_fish
ADMIN_DASHBOARD_KEY=use-a-long-random-secret
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_SECRET=use-a-different-long-random-secret
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=https://your-backend.onrender.com/api/orders/mpesa/callback
```

`MPESA_CALLBACK_URL` must be public HTTPS. Do not use localhost in production.

Verify the backend after deployment:

```text
GET https://your-backend.onrender.com/api/health
GET https://your-backend.onrender.com/api/orders/mpesa/status
```

The health response must report `database: connected`. M-Pesa status must report
`configured: true` and `callbackReady: true` before accepting live orders.

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
VITE_API_URL=https://your-backend.onrender.com/api
```

The frontend build embeds this URL, so redeploy after changing it.

After both services exist, set `VITE_API_URL` to the exact backend URL ending in
`/api`, trigger a frontend deploy, and open the frontend in a private browser window.
The shop should show product cards rather than a connection recovery message.

## Local development

Run MongoDB locally, then start the API and frontend in separate terminals:

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
