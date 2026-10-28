# Victoria Fresh Fish API

Express API and PostgreSQL data layer for the Victoria Fresh Fish storefront.
The database is authoritative for catalogue, stock, prices, orders, delivery
zones, accounts, FAQs and moderated reviews.

## Local setup

From the repository root:

```powershell
npm install
npm --prefix backend install
Copy-Item backend\.env.example backend\.env
```

Set unique local values for `DB_PASSWORD`, `AUTH_SECRET` and
`ADMIN_DASHBOARD_KEY` in the private environment file. Point
`DATABASE_URL` and `TEST_DATABASE_URL` at `127.0.0.1`, using the configured
port; the integration-test URL must name the isolated test database and must
not point at production.

Start the full local application:

```powershell
npm run dev
```

The root `dev` command starts the Docker Compose PostgreSQL service, waits for
its health check, and then starts the frontend and API. The API initializes
and migrates the schema at startup. Docker Desktop must be running; enable its
“Start Docker Desktop when you sign in” option to avoid starting it by hand
after a Windows sign-in. PostgreSQL data is kept in a persistent Docker volume.

The API listens on port `5000` by default. Use `npm run db:up` and
`npm run db:setup` from the repository root for explicit database
administration. If the default API port is occupied, use
`npm --prefix backend run dev:fresh` to start the API on port `5001`.

## Database and catalogue behavior

Schema migrations are safe to rerun. Startup seeds only missing launch SKUs;
existing product price, quantity, active state, and photo edits are preserved.
The automatic launch catalogue contains 40 distinct products across eight
categories. Unconfirmed prices remain visible but cannot be checked out.

To seed missing products locally:

```powershell
npm run catalogue:seed
```

Production seeding is intentionally explicit and requires PostgreSQL SSL:

```powershell
npm run catalogue:seed:prod -- --confirm-production
```

For a price/quantity import, review `docs/catalogue-to-fill.csv`, fill only
owner-approved values, and run `npm run catalogue:import`. The importer reports
rejected rows and does not replace existing edited products.

## API surface

- `GET /api/health` and `GET /api/readiness`: API and database health.
- `GET /api/products`: active catalogue, filtering and search.
- `/api/orders`: checkout quote, guest/account checkout, tracking, admin
  fulfilment, delivery-worker and payment flows.
- `/api/auth`: password account signup, login, current session, logout and
  admin-controlled temporary password setup.
- `/api/reviews`, `/api/faqs`, `/api/support-requests`,
  `/api/delivery-zones`: public read/submission and protected operations routes.

Admin operations require the configured `x-admin-key`; customer-owned
operations require a verified customer session; private order tracking uses
its tracking token. Checkout recalculates price and availability from the
database, reserves stock transactionally, and uses an idempotency key.

Customer sessions expire after seven days and are issued in an HttpOnly cookie.
The Vercel `/api` rewrite makes production storefront requests same-origin and
uses `SameSite=Lax; Secure`; direct cross-site Render requests use
`SameSite=None; Secure`. Local development uses a non-Secure `SameSite=Lax`
cookie over HTTP. The browser client includes credentials only for API
requests and sends the `x-vff-csrf: 1` header. The API requires that header for
state-changing requests carrying the customer-session cookie. CORS credentials
remain restricted to the exact configured origins.

`render.yaml` retains `DATABASE_SSL=require` for compatibility with the current
Render database. This encrypts traffic without verifying the server certificate.
`DATABASE_SSL=verify` enables certificate and hostname verification. When the
provider supplies a CA, add it as a Render Secret File and set
`NODE_EXTRA_CA_CERTS` to the mounted CA file path. The same path is passed as
`PGSSLROOTCERT` to backup/restore client tools. A TLS verification failure is
reported without exposing the database connection URL. Local Docker TLS
behavior is unchanged.

## Payments and optional integrations

Guest checkout supports Cash on Delivery and M-Pesa after delivery. Live
Daraja credentials are required before M-Pesa prompts can be used; mock mode
does not record a successful payment. Customer passwords are hashed with
bcrypt. Admin endpoints and customer sessions remain disabled when their
respective secrets are not configured.

## Test and build

```powershell
npm --prefix backend run build
npm run test:backend
```

Integration tests require `TEST_DATABASE_URL` to refer to the isolated test
database. They create and clean up test fixtures; never run the integration
suite against a production database or a database containing real customer,
order or payment records.

## Backups and deployment

Use the safe, empty-target-only recovery process in
[docs/BACKUP_AND_RESTORE.md](../docs/BACKUP_AND_RESTORE.md). Production
environment configuration and release steps are in
[DEPLOYMENT.md](../DEPLOYMENT.md) and
[docs/RENDER_ENV_CHECKLIST.md](../docs/RENDER_ENV_CHECKLIST.md).
