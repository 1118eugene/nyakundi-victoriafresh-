# Roadmap progress

Statuses are updated only after running the phase's relevant checks. Test counts
refer to observed runs, not estimates.

| Phase | Scope | Status | Verification |
|---|---|---|---|
| R1 | Restore local PostgreSQL, seed, test, and diagnose production connectivity | PARTIAL — clean local database verified; production configuration blocked | Fresh isolated PostgreSQL database migrated and seeded; backend: 44 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend/backend builds passed. Render logs confirm missing production configuration. |
| R2 | Verify existing order, delivery, payment, review, inventory, blocking, and SEO work | DONE | Backend: 40 passed, 0 failed, 0 skipped; includes PostgreSQL journeys for order history, delivery/location, cash/M-Pesa receipts, reviews, stock, blocked phones, and static SEO artifacts. |
| R3 | Fix catalogue preview fallback and add smoke/contract coverage | PARTIAL — fresh local DB verified; production branch/configuration blocks end-to-end confirmation | Backend: 44 passed, 0 failed, 0 skipped; local smoke 5/5 including version and quote/guest-checkout validation. No preview fallback; catalogue contains 0 owner-confirmed products. Latest production smoke: health request failed, catalogue returned 500, version/quote returned 404, checkout returned 401. |
| R4 | Complete catalogue categories, product data, media, and administration | PARTIAL — schema/admin CRUD verified on fresh PostgreSQL; real business catalogue and persistent media remain blocked | Backend: 44 passed, 0 failed, 0 skipped; CRUD, confirmed-price gate, price history and soft-delete are covered. No products/prices/photos were invented; fresh database contains 0 published products. |
| R5 | Add eatery menu, dine-in, reservations, and competitor research | BLOCKED — owner menu/address/hours and verifiable competitor menu sources required | No eatery menu, reservation collection, or pricing was published. Added a source/date-required comparison template with no invented figures. |
| R6 | Add scheduled, margin-safe promotions | BLOCKED — product costs, minimum margin, and campaign rules require owner input | No promotion engine or discount was enabled without verified costs and approved margin rules. No runtime changes; last verified backend baseline remains 43 passed, 0 failed, 0 skipped. |
| R7 | Add optional customer accounts, staff roles, and audit coverage | PARTIAL — optional guest-first customer accounts exist; staff RBAC and audit log remain | Existing OTP accounts, customer sessions, guest checkout, and order history are covered by the backend suite (43 passed, 0 failed, 0 skipped); no new R7 runtime changes in this checkpoint. |
| R8 | Add inspect-before-pay delivery acceptance and dispute handling | BLOCKED — acceptance, rejection, photo, and payment policies require owner approval | Existing payment and delivery journeys remain verified; no inspect/reject workflow or customer-facing policy is claimed. Requires owner policy and persistent photo handling. |
| R9 | Add Nairobi maps, zones, and dispatch | PARTIAL — configured zones verified; map, dispatch-point, and driver-map workflows need owner/provider details | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. |
| R10 | Add fish-specific weights, preparation, provenance, and substitutions | PARTIAL — current unit display and order snapshots exist; final-weight, preparation-charge, and agreed-substitution workflows need confirmed product rules | No R10 runtime changes; R9 baseline: backend 42 passed, cart 7 passed, zero failures/skips; builds passed. |
| R11 | Apply an accessible, responsive design system and reviewed translations | PARTIAL — existing design tokens/responsive states retained; added skip navigation and mobile cart summary; reviewed translations and owner assets remain | Cart: 7 passed, 0 failed, 0 skipped; frontend build passed. |
| R12 | Add support, complaints, policy pages, and customer-data tools | PARTIAL — consent-recorded support intake and staff outcome tracking added; photos, export/delete tools, and reviewed policies remain | Backend: 43 passed, 0 failed, 0 skipped; frontend/backend builds passed. |
| R13 | Improve rendered search visibility and document webmaster setup | TODO | |
| R14 | Improve performance and verify browser journeys and mobile Lighthouse | TODO | |
| R15 | Review and harden security/privacy; document credential rotation | TODO | |
| R16 | Add CI/versioning, complete release checks, and publish the morning report | PARTIAL — commit version endpoint and smoke coverage added; production release checks blocked | `/api/version` returned the current 40-character commit locally; production endpoint still returns 404. CI/release/deployment verification remains. |

## Release gate recheck — 2026-10-16

- **Step 1 — DONE:** `git status -sb` shows branch
  `overnight/upgrade...origin/overnight/upgrade` with the pending changes listed
  below; HEAD is `c586bfd`. The last five commits are `c586bfd`,
  `ec5e80c`, `fdcf822`, `f121a5d`, and `a7072b7`. The branch is 16 commits
  ahead and 0 behind `origin/main`; it is synchronized with
  `origin/overnight/upgrade`.
- **Step 2 — BLOCKED:** `docker compose --env-file backend/.env up -d --wait
  db` failed because this Docker CLI reports `unknown flag: --env-file`, also
  reports `docker compose` as an unknown command, and reports access denied
  reading `C:\Users\Admin\.docker\config.json`. No alternate Docker invocation
  was attempted. A full database-backed integration run, fresh migration/seed
  run, and local smoke against that database therefore remain unverified in
  this pass. Earlier checks in this work session passed backend build and the
  27-test non-integration suite, frontend build, and 7 cart tests; these do
  not substitute for a real-test-database run.
- **Step 3 — PARTIAL:** Reviewed and committed 11 legitimate files as
  `f20885a` (`Report sanitized PostgreSQL health diagnostics`); no secret
  values or customer personal data were added. Normal push was attempted and
  rejected by GitHub HTTP 403: permission to
  `1118eugene/nyakundi-victoriafresh-.git` denied to `wuodoyugis9-lab`.
  Branch is locally one commit ahead of `origin/overnight/upgrade`; no
  alternate credential or force-push was attempted.
- **Step 4 — BLOCKED:** Not run because Step 2 validation and Step 3 push did
  not pass. No merge, Render deploy, or production change was triggered.
- **Step 5 — FAIL/BLOCKED:** Production read-only checks returned health HTTP
  200 with `DEGRADED` and database unavailable (no reason field), version
  HTTP 404, catalogue HTTP 500, empty quote validation HTTP 500, and guest
  checkout validation HTTP 401. The smoke script was not run because Node/npm
  execution is blocked by the sandbox `EPERM` on `C:\`.
- **Step 6 — PARTIAL:** The live Vercel bundle embeds
  `https://nyakundi-victoriafresh-2.onrender.com/api`, confirming its compiled
  API URL. A CORS preflight from `https://nyakundi-victoriafresh.vercel.app`
  returned HTTP 500 without `Access-Control-Allow-Origin`; configure the
  Render `CORS_ALLOWED_ORIGINS` variable to include that exact origin.
- **Step 7 — PARTIAL:** The progress/report update is being recorded here.
  A documentation commit/push remains outstanding because the branch push was
  rejected with HTTP 403. Further product phases are not claimed done; the
  local DB-backed test gate remains blocked.
- **Release gate:** Owner confirmed `DATABASE_URL` is linked to
  `victoriafresh-db`. Do not merge or deploy until local DB-backed checks pass
  and the branch can be pushed. Do not require old production health to report
  connected before merge; run production verification after the new code
  deploys.

## Round 3 verification — 2026-10-14

- **Step 1 — PARTIAL:** Started the existing local PostgreSQL service and
  created isolated database `vff_r3_clean_69058398` without deleting or
  modifying existing local databases. `npm run db:setup` migrated and seeded
  it. Full backend suite: 44 passed, 0 failed, 0 skipped. Backend syntax and
  frontend production builds passed; cart suite: 7 passed, 0 failed, 0 skipped.
  Smoke against the fresh database: health, catalogue contract, version, quote
  validation, and unauthenticated guest-checkout validation all passed (5/5).
  The catalogue correctly has 0 confirmed products, so the requirement to prove
  real owner-priced products is blocked on owner data.
- **Step 2 — DONE:** Reviewed the four-file change; no real credentials,
  personal data, or stray files were added. Commit `fdcf822` was pushed to
  `origin/overnight/upgrade`; that branch is synchronized with GitHub. Before
  any merge, it was 14 commits ahead of `main`.
- **Step 3 — DONE:** Render service `nyakundi-victoriafresh-2` is linked to
  `main`, with auto-deploy enabled and root directory `backend`. The existing
  PostgreSQL service is `available` (not expired as of this check); the API
  service is not suspended. Production `main` is
  `f2e4ee4f23df4b5cdc9f6eddcf7709391906a43a`; the latest deploy is
  `update_failed`. Render build logs show the October 9 build succeeded.
  Runtime logs show startup blocked by missing `DATABASE_URL` and other
  configuration, and repeated legacy MongoDB SRV `ENOTFOUND` messages. The
  cause is both the stale `main` branch and missing production configuration;
  auto-deploy is not off and the build itself passed.
- **Step 4 — BLOCKED:** No production environment variable or service was
  changed, and `main` was not merged or deployed. A new deployment cannot
  initialize the PostgreSQL backend until the existing database's private
  connection URL is configured as Render `DATABASE_URL`. The running legacy
  branch also reports missing auth/admin, OTP/SMS, and M-Pesa configuration;
  optional integrations are disabled rather than required by the upgrade
  branch. Do not disclose secret values.
- **Step 5 — BLOCKED:** Latest production smoke failed: health request failed;
  catalogue returned HTTP 500; `/api/version` returned 404; quote returned
  404; guest checkout validation returned 401. The new endpoint returned
  commit `ec5e80c` locally. Production has no verified live version or product
  list; local catalogue count is 0.
- **Step 6 — PARTIAL:** R3 and R4 checks ran on the fresh real PostgreSQL
  database, but neither is claimed complete in production. R3 awaits a
  successful production deploy/smoke. R4 also awaits owner-confirmed products,
  prices, photos and persistent media hosting. Work beyond R4 is not claimed
  as newly completed.

### Owner action required to unblock release

In the Render dashboard, open the existing `nyakundi-victoriafresh-2` Web
Service → **Environment**. Add or correct `DATABASE_URL` using the **Internal
Database URL** from the existing `victoriafresh-db` PostgreSQL service in the
same Render region. Save it only in Render; never paste it into chat or Git.
Then confirm that the key is present (without sharing its value) and ask for
the release to resume. Do not create, replace, or reset a database. OTP/SMS,
M-Pesa, admin and customer-auth credentials can be configured there later if
those features are to be enabled; they are optional in the upgrade branch.

Before R4 can publish a non-empty catalogue, supply owner-approved product
names, categories, descriptions, units/sizes, prices, quantities/availability,
preparation details, and approved photographs. Until then the empty public
catalogue is intentional and smoke output must not claim real products exist.

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

## R10

- The catalogue and checkout already represent a product's sale unit, show the
  unit price, validate prices server-side, and snapshot ordered item details.
  The confirmed catalogue is intentionally empty.
- Final weighed-price reconciliation, product-specific preparation choices and
  extra charges, provenance/handling fields, and customer-agreed alternatives
  are not enabled. Correct implementation needs owner-confirmed sale basis,
  weight estimate rules, preparation fees, sourcing/arrival data, handling
  guidance, and substitution choices; none may be guessed.
- R10 remains partial. No runtime changes were made because there is no
  confirmed fish data or pricing policy to configure. The R9 verification
  baseline remains backend 42 passed, cart 7 passed, 0 failed, 0 skipped,
  frontend/backend builds passed, and local smoke 4/4.

## R11

- The site already uses shared design tokens, responsive page layouts, reduced
  motion support, image lazy loading, catalogue skeleton/error/empty states,
  and real approved-review counts. Added a keyboard-visible skip link and a
  fixed, accessible mobile cart summary that is hidden on checkout/cart and
  staff administration routes.
- R11 remains partial. English/Swahili customer journey translations need
  owner review; real product photography, a verified active offer, an
  inspect-before-pay journey, and eatery visit details remain unavailable.
  No testimonials, offers, photos, or translated claims were fabricated.
- Verification: frontend production build passed; cart tests 7 passed,
  0 failed, 0 skipped.

## R12

- Added support request intake for questions, complaints, and refund requests.
  It validates contact data, requires and records response-purpose consent,
  limits submissions, stores requests in PostgreSQL, and returns a reference.
  The admin-key view lets staff record status, response, and outcome.
- Removed hard-coded personal phone numbers and email/address contact claims
  from the contact, footer, and founder cards. Contact channels are shown only
  when `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_EMAIL`, or the existing
  `VITE_WHATSAPP_NUMBER` is configured. The footer links to the support form.
- R12 remains partial: there is no approved attachment store for evidence
  photos, authenticated customer export/deletion tool, refund/payment
  adjudication workflow, or reviewed legal terms/privacy/cancellation pages.
  Admin access still uses the shared key; the R7 role/audit gap remains.
  Qualified legal review and owner confirmation of Kenya Data Protection Act
  obligations are required; no compliance claim is made.
- Verification: backend 43 passed, 0 failed, 0 skipped; frontend and backend
  builds passed. The integration test covers consent, request storage, denied
  unauthenticated access, and staff status/response/outcome recording.
