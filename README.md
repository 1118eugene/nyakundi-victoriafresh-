# Victoria Fresh Fish Kenya

Victoria Fresh Fish is a React and TypeScript storefront backed by an Express
API and PostgreSQL. The app includes a database-backed catalogue, guest
checkout, customer accounts, order tracking, support requests, reviews, FAQs
and protected operations pages.

## Local setup

Requirements: Node.js, npm, Docker Desktop (for the included local PostgreSQL
service), and the PostgreSQL client tools only if using the backup/restore
commands.

1. Install the frontend and backend dependencies:

   ```powershell
   npm install
   npm --prefix backend install
   ```

2. Copy `backend/.env.example` to `backend/.env`. Configure unique local values
   for `DB_PASSWORD`, `AUTH_SECRET` and `ADMIN_DASHBOARD_KEY`, then ensure the
   database URLs use `127.0.0.1` and the same port/user/database configured for
   Docker. Do not commit `backend/.env`.
3. Start PostgreSQL and initialize its schema:

   ```powershell
   npm run db:up
   npm run db:setup
   ```

4. Start the API and storefront:

   ```powershell
   npm run dev
   ```

   The frontend runs at `http://localhost:3000`; the API runs at
   `http://localhost:5000`. Use `npm run dev:frontend` and
   `npm run dev:backend` to start them separately.

If Docker or PostgreSQL is unavailable, the frontend can still be built and
the API can start in degraded mode, but database-backed catalogue, account and
order flows are not operational until the database is ready.

## Verification

```powershell
npm run build
npm run test:cart
npm run test:backend
npm --prefix backend run build
```

Backend integration tests require `TEST_DATABASE_URL` to point to the isolated
test database; they do not skip database tests when it is unavailable. For an
API health check, request `http://127.0.0.1:5000/api/health`. The smoke script
can check local endpoints without checking the deployed service:

```powershell
npm run smoke -- --local-only
```

## Catalogue and operations

The PostgreSQL database is the source of truth for active products, prices,
stock, delivery zones, orders, customer accounts, FAQs and reviews. The
startup seed inserts missing launch products by SKU and does not overwrite
existing catalogue edits. To import the prepared catalogue, review
`docs/catalogue-to-fill.csv` and run `npm run catalogue:import`.

Optimized WebP copies are served for local raster images while the original
image files remain preserved. If source images are added or replaced, install
Pillow for Python and regenerate copies with `python scripts\\optimize-images.py`.

Admin pages require the configured admin key. Product prices and stock are
validated server-side during checkout. Order tracking uses a private tracking
token. Reviews are moderated and are not public until approved.

## Deployment and operations

- Render service configuration and release steps: [DEPLOYMENT.md](DEPLOYMENT.md)
- Render environment-variable checklist: [docs/RENDER_ENV_CHECKLIST.md](docs/RENDER_ENV_CHECKLIST.md)
- Backup and safe restore procedures: [docs/BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md)
- Unconfirmed customer-facing facts: [docs/OWNER_TO_CONFIRM.md](docs/OWNER_TO_CONFIRM.md)

Do not deploy for real orders until owner-only business details and production
credentials have been confirmed, the production database is provisioned and
backed up, and the release checklist is complete. Never commit credentials or
customer-data backups.
