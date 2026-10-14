# Roadmap progress

Statuses are updated only after running the phase's relevant checks. Test counts
refer to observed runs, not estimates.

| Phase | Scope | Status | Verification |
|---|---|---|---|
| R1 | Restore local PostgreSQL, seed, test, and diagnose production connectivity | PARTIAL — local complete; production configuration blocked | Backend: 38 passed, 0 failed, 0 skipped. Cart: 7 passed, 0 failed, 0 skipped. Frontend and backend builds passed. |
| R2 | Verify existing order, delivery, payment, review, inventory, blocking, and SEO work | DONE | Backend: 40 passed, 0 failed, 0 skipped; includes PostgreSQL journeys for order history, delivery/location, cash/M-Pesa receipts, reviews, stock, blocked phones, and static SEO artifacts. |
| R3 | Fix catalogue preview fallback and add smoke/contract coverage | PARTIAL — local complete; deployed API mismatch blocks end-to-end confirmation | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend/backend builds passed; local smoke 4/4. Hidden 60 generated legacy rows without deleting them. Deployed smoke: health/catalogue timed out; quote returned 404; checkout returned 401. |
| R4 | Complete catalogue categories, product data, media, and administration | PARTIAL — catalogue schema and admin CRUD implemented; verified business data and media storage blocked | Backend: 43 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed. Added confirmed-price visibility gate, size and multi-photo fields, price history, soft-delete, admin editor, and CSV header template. |
| R5 | Add eatery menu, dine-in, reservations, and competitor research | BLOCKED — owner menu/address/hours and verifiable competitor menu sources required | No eatery menu, reservation collection, or pricing was published. Added a source/date-required comparison template with no invented figures. |
| R6 | Add scheduled, margin-safe promotions | BLOCKED — product costs, minimum margin, and campaign rules require owner input | No promotion engine or discount was enabled without verified costs and approved margin rules. No runtime changes; last verified backend baseline remains 43 passed, 0 failed, 0 skipped. |
| R7 | Add optional customer accounts, staff roles, and audit coverage | PARTIAL — optional guest-first customer accounts exist; staff RBAC and audit log remain | Existing OTP accounts, customer sessions, guest checkout, and order history are covered by the backend suite (43 passed, 0 failed, 0 skipped); no new R7 runtime changes in this checkpoint. |
| R8 | Add inspect-before-pay delivery acceptance and dispute handling | BLOCKED — acceptance, rejection, photo, and payment policies require owner approval | Existing payment and delivery journeys remain verified; no inspect/reject workflow or customer-facing policy is claimed. Requires owner policy and persistent photo handling. |
| R9 | Add Nairobi maps, zones, and dispatch | PARTIAL — configured zones verified; map, dispatch-point, and driver-map workflows need owner/provider details | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. |
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

## R4

- Added additive PostgreSQL migration 7 for size labels, multiple photo paths,
  owner price confirmation, and append-only product price history.
- Product CRUD is available under the admin-key protected product API and
  `/admin/products`. Unconfirmed-price products are forced inactive and out of
  stock, excluded from public product/detail queries, and rejected by quote and
  checkout. Hiding products is a soft-delete to preserve order/history links.
- Added validation for product data and safe photo references, plus
  `docs/catalog-import-template.csv`. Product records remain empty until the
  owner supplies verified information.
- R4 is partial: no owner-confirmed products or photos have been supplied, and
  upload/resizing is not enabled because a persistent approved media store has
  not been configured. The editor accepts safe existing image paths or HTTPS
  photo URLs; it does not upload files.
- R4 verification: backend 43 passed, 0 failed, 0 skipped; cart 7 passed,
  0 failed, 0 skipped; frontend production build and backend syntax build
  passed. Tests cover draft hiding, confirmation gating, price history, safe
  photo validation, and retained records after hiding.

## R5

- No cooked menu, portion sizes, sides, add-ons, drinks, combos, spice options,
  preparation times, address, or opening hours were supplied. These remain
  blocked rather than guessed; no reservation form is enabled before the
  business contact/consent wording and privacy workflow are confirmed.
- Added `docs/eatery-competitor-comparison.csv` as an empty source/evidence
  template. Search endpoints did not provide reliable public fish-menu prices
  during this run; no competitor figures or competitor claims were invented.
- R5 is blocked pending owner-supplied eatery details and accessible,
  verifiable public menu sources. This documentation-only checkpoint added no
  runtime changes.

## R6

- Promotions cannot be safely enabled without owner-confirmed product costs,
  the minimum acceptable margin, campaign/recurrence rules, discount limits,
  and redemption/stacking policy. No offer, discount, or fabricated cost was
  added.
- R6 is blocked on these owner decisions. No runtime changes were made; the
  latest code verification remains R4's backend 43/43 passing, cart 7/7
  passing, and frontend/backend builds passing.

## R7

- Verified the existing guest-first checkout and optional phone/OTP account
  flow, including session validation, logout revocation, and customer order
  history; these paths are covered by the 43-test backend suite.
- R7 remains partial: staff access is still based on shared admin and
  delivery-worker keys. Role-based staff sessions, manager/kitchen/dispatcher
  boundaries, and a persistent sensitive-action audit log are not implemented
  and must not be represented as complete.

## R8

- Existing delivery assignment, status history, expiring location sharing,
  payment receipt, and pay-after-delivery behavior are verified, but the new
  inspect-then-pay acceptance/rejection workflow has not been added.
- This phase needs owner-approved full/partial rejection rules, required
  reasons, evidence-photo handling, handover-code policy, revised totals and
  payment timing, plus reviewed freshness/refund/dispute wording. No policy was
  invented and no customer-facing acceptance claim was added.
- R8 is blocked pending those owner decisions and persistent photo storage.

## R9

- Added additive migration 8 and owner-key protected create, edit, list, and
  deactivate operations for explicitly configured delivery zones. Public
  coverage checks and checkout quotes return only configured coverage; quote
  and checkout reject unconfigured locations and enforce configured fees and
  minimums. Delivery terms are snapshotted into each order.
- Added `/admin/delivery-zones` and a home-page county/town coverage checker.
  Delivery and FAQ copy no longer lists unverified coverage. Checkout remains
  usable with typed address/landmark fields; no default fee or service area is
  configured.
- R9 remains partial: no owner-confirmed service zones, dispatch-point
  coordinates, map-provider configuration, address geocoding/pin selection,
  waitlist workflow, or live operations map has been supplied or verified.
  Existing temporary driver-location sharing is not a live dispatch map.
- Verification: `npm run db:setup` succeeded; backend 42 passed, 0 failed,
  0 skipped; cart 7 passed, 0 failed, 0 skipped; frontend and backend builds
  passed; local read-only smoke 4/4 passed. Integration tests cover zone
  administration, public coverage, minimum-order enforcement, and fail-closed
  handling of unconfigured areas.
