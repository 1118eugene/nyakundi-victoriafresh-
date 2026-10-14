# Implementation decisions

- Keep the Victoria Fresh Fish development and test databases in the existing
  named Compose volume. The project uses host port 5433 because an unrelated
  PostgreSQL/PostGIS container already owns port 5432; that container was left
  untouched.
- Keep local credentials in the ignored `backend/.env`; never print or commit
  their values.
- Exempt `/api/health` and `/api/readiness` from the general API rate limiter so
  monitoring probes cannot make a healthy service appear unavailable.
- Do not alter, restart, create, or delete production databases or services.
  Render shows the existing PostgreSQL resource as available, while the API
  service is still deployed from `main` and its logs show a MongoDB hostname
  DNS failure. Verify and set the production `DATABASE_URL` through Render's
  secret configuration before deploying the PostgreSQL application.
- Do not invent fish products, prices, photographs, menu details, business
  contact details, delivery zones, reviews, or legal terms. Mark missing
  business-supplied information as blocked and continue work that does not
  depend on it.
- Require an explicit owner-confirmed price before products can become public,
  featured, or purchasable. Existing unconfirmed catalogue rows default to
  hidden; product hiding is soft-delete so orders and price history remain
  intact.
- Store multiple approved photo references and price history with catalogue
  records. Do not add local file uploads or image resizing until persistent
  media storage and owner-supplied photographs are available.
