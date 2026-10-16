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
  The owner confirmed that Render service `nyakundi-victoriafresh-2` has
  `DATABASE_URL` linked to the existing `victoriafresh-db`. The API still
  deploys from `main`, whose runtime logs show legacy MongoDB DNS failures.
  Merge the PostgreSQL branch after its required local checks pass; production
  health/version/catalogue checks are post-deploy release verification, not a
  prerequisite that old MongoDB code must satisfy.
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
- Expose `/api/version` using Render's `RENDER_GIT_COMMIT` (or an explicit
  `GIT_COMMIT` in other deployments) so a live deployment can be matched to
  source. Smoke checks validate every returned product's owner-confirmed flag
  and price but must not invent or publish products to make an empty
  owner-confirmed catalogue look complete.
- Never inspect, log, or share the value of `DATABASE_URL`. Render
  auto-deploys `main`; the owner has confirmed the variable is linked to the
  existing PostgreSQL service. Do not merge until local release checks pass.
  After merge/deploy, verify health reports PostgreSQL connected and validate
  version, catalogue, and the production smoke contract.
