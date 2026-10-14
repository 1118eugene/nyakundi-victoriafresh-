# Roadmap progress

Statuses are updated only after running the phase's relevant checks. Test counts
refer to observed runs, not estimates.

| Phase | Scope | Status | Verification |
|---|---|---|---|
| R1 | Restore local PostgreSQL, seed, test, and diagnose production connectivity | PARTIAL — local complete; production configuration blocked | Backend: 38 passed, 0 failed, 0 skipped. Cart: 7 passed, 0 failed, 0 skipped. Frontend and backend builds passed. |
| R2 | Verify existing order, delivery, payment, review, inventory, blocking, and SEO work | DONE | Backend: 40 passed, 0 failed, 0 skipped; includes PostgreSQL journeys for order history, delivery/location, cash/M-Pesa receipts, reviews, stock, blocked phones, and static SEO artifacts. |
| R3 | Fix catalogue preview fallback and add smoke/contract coverage | PARTIAL — local complete; deployed API mismatch blocks end-to-end confirmation | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend/backend builds passed; local smoke 4/4. Hidden 60 generated legacy rows without deleting them. Deployed smoke: health/catalogue timed out; quote returned 404; checkout returned 401. |
| R4 | Complete catalogue categories, product data, media, and administration | TODO | |
| R5 | Add eatery menu, dine-in, reservations, and competitor research | TODO | |
| R6 | Add scheduled, margin-safe promotions | TODO | |
| R7 | Add optional customer accounts, staff roles, and audit coverage | TODO | |
| R8 | Add inspect-before-pay delivery acceptance and dispute handling | TODO | |
| R9 | Add Nairobi addresses, delivery zones, dispatch, and map workflows | TODO | |
| R10 | Add fish-specific weights, preparation, provenance, and substitutions | TODO | |
| R11 | Apply an accessible, responsive design system and reviewed translations | TODO | |
| R12 | Add support, complaints, policy pages, and customer-data tools | TODO | |
| R13 | Improve rendered search visibility and document webmaster setup | TODO | |
| R14 | Improve performance and verify browser journeys and mobile Lighthouse | TODO | |
| R15 | Review and harden security/privacy; document credential rotation | TODO | |
| R16 | Add CI/versioning, complete release checks, and publish the morning report | TODO | |

## R1

- Local PostgreSQL is healthy in the project Compose container on host port 5433;
  port 5432 belongs to an unrelated container and was left untouched.
- `npm run db:setup` completed successfully after the database was already
  initialized, confirming repeatable migration and seed setup without deleting
  the named volume or databases.
- Backend integration/unit suite: 38 passed, 0 failed, 0 skipped.
- Cart suite: 7 passed, 0 failed, 0 skipped.
- Backend syntax check and frontend production build passed.
- Local `/api/health` returned `status: OK`, `database: connected`; the Vite
  homepage returned HTTP 200.
- The Render PostgreSQL resource is available and not suspended. The production
  API service is still deployed from `main`; its recent logs repeatedly report
  a MongoDB host DNS lookup failure (`ENOTFOUND`). This is inconsistent with
  the PostgreSQL backend in this worktree, so production is not verified or
  changed. Set the Render service's `DATABASE_URL` to the existing database's
  private connection string and deploy the reviewed PostgreSQL branch only
  after the release checks pass. Do not paste the connection string into chat
  or commit it.

## R3

- Traced storefront requests to `/api/products`; production smoke checks do not
  match the expected PostgreSQL API: health and catalogue requests timed out,
  quote validation returned 404, and checkout validation returned 401. The
  current Render service remains on the older `main` deployment; do not merge
  or deploy before R16 release checks.
- Replaced the generated catalogue seed with editable
  `backend/src/data/catalog.json`. It contains category labels and no
  unconfirmed product rows; the importer remains additive and does not overwrite
  existing inventory state.
- Added an additive cleanup migration that deactivates and marks unavailable
  all 60 matching legacy generated product records. No product rows were
  deleted; a database query confirmed 0 of the 60 remain active or in stock.
- Removed the storefront preview-product fallback. Catalogue failures now show
  an honest error, loading uses accessible skeletons, safe GET requests retry,
  and WhatsApp links are generated only when a valid owner-configured
  `VITE_WHATSAPP_NUMBER` is present.
- Added product response contract coverage and `npm run smoke` checks for API
  health, catalogue shape, empty quote validation, and incomplete checkout
  validation. These POST checks do not create orders or send customer data.
- Local smoke: all 4 checks passed. Deployed smoke: health/catalogue timed out;
  quote returned 404; checkout returned 401. This is an observed production
  mismatch, not a successful production verification.
- R3 verification: backend 42 passed, 0 failed, 0 skipped; cart 7 passed,
  0 failed, 0 skipped; frontend build and backend syntax build passed.
