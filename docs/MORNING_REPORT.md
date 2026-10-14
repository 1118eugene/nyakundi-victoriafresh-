# Morning report — in progress

This report is being updated as the R1–R16 roadmap is executed. No production
deployment or merge to `main` has been performed. Round 3 verified the local
backend on a newly created isolated PostgreSQL database; production is blocked
by missing Render environment configuration.

## Status

| Phase | Status | Verified result |
|---|---|---|
| R1 | PARTIAL — fresh local database verified; production configuration blocked | Fresh PostgreSQL migrated/seeded; backend 44 passed, 0 failed, 0 skipped; cart 7 passed, 0 failed, 0 skipped; frontend/backend builds passed. Render logs confirm missing production configuration. |
| R2 | DONE | Backend: 40 passed, 0 failed, 0 skipped. Added persisted order-history assertions, blocked-phone management/enforcement tests, and robots/sitemap validation. |
| R3 | PARTIAL — fresh local DB verified; production deployment blocked | Backend: 44 passed, 0 failed, 0 skipped; local smoke 5/5 (including health, catalogue contract, version, quote and guest-checkout validation). Local catalogue has 0 confirmed products. Latest production smoke: health request failed, catalogue 500, version/quote 404, checkout 401. |
| R4 | PARTIAL — DB/admin flows verified; owner data and media blocked | Backend: 44 passed, 0 failed, 0 skipped. Owner price-confirmation gate, product CRUD, price history, and soft-delete tests pass. No confirmed catalogue products or persistent media were supplied. |
| R5 | BLOCKED — owner menu/address/hours and verifiable competitor menu sources required | No menu, reservation workflow, or competitor pricing was invented. Added a source/date-required comparison template; current network search did not return a reliable published menu source. |
| R6 | BLOCKED — product costs and margin/campaign rules required | No promotions or discounts enabled without owner-supplied costs and an approved minimum-margin/stacking policy. Runtime unchanged; latest verified test baseline is R4. |
| R7 | PARTIAL — guest-first customer accounts exist; staff roles/audit remain incomplete | Existing OTP, session revocation, guest checkout and order history tests pass; shared admin/delivery keys have not yet been replaced by role-based staff sessions and audit logging. |
| R8 | BLOCKED — owner inspection, rejection, payment and dispute policy required | Existing delivery/payment journeys remain verified; inspect-before-pay, per-item rejection and evidence photo flow are not implemented pending policy and persistent photo storage. |
| R9 | PARTIAL — configured zones verified; map, dispatch-point, and driver-map workflows need owner/provider details | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. |
| R10 | PARTIAL — existing unit prices and order snapshots; final weight, preparation fees, provenance, and agreed alternatives need owner rules/data | No runtime changes; latest applicable backend 42 passed, cart 7 passed, zero failures/skips; builds passed. |
| R11 | PARTIAL — design tokens and responsive states retained; added skip navigation and mobile cart summary; translation/assets/offer/inspection details remain | Frontend build passed; cart 7 passed, 0 failed, 0 skipped. |
| R12 | PARTIAL — support intake and response/outcome tracking added; evidence photos, data export/delete, refund workflow, and reviewed policy pages remain | Backend: 43 passed, 0 failed, 0 skipped; frontend/backend builds passed. |
| R13 | TODO | |
| R14 | TODO | |
| R15 | TODO | |
| R16 | PARTIAL — version endpoint added; production release checks blocked | `/api/version` returns the full current commit hash on the fresh local API; production returns 404 because it is still on older code. CI and completed release checks remain. |

## Round 3 — 2026-10-14

### Step status

1. **PARTIAL** — PostgreSQL was already running locally. Created isolated,
   empty database `vff_r3_clean_69058398`; migration/seed setup succeeded.
   Backend: 44 passed, 0 failed, 0 skipped. Backend syntax build and frontend
   production build passed; cart: 7 passed, 0 failed, 0 skipped. Local smoke
   passed 5/5 against that database. Catalogue is intentionally empty (0 real
   priced products) pending owner-confirmed product data.
2. **DONE** — Reviewed and pushed commit `fdcf822` to
   `origin/overnight/upgrade`; branch is synchronized with GitHub. No personal
   data or real secrets were added. The branch has 14 commits not yet on
   `main`.
3. **DONE** — Render service is on `main`, auto-deploy is enabled, and the
   root directory is `backend`. Its PostgreSQL resource reports available and
   is not expired as of this check. The October 9 build for main commit
   `f2e4ee4f23df4b5cdc9f6eddcf7709391906a43a` succeeded, but the deploy status
   is `update_failed`. Start logs report missing `DATABASE_URL`,
   `AUTH_SECRET`, `SMS_API_KEY`, `SMS_USERNAME`, `ADMIN_DASHBOARD_KEY`, Daraja
   credentials, and `MPESA_CALLBACK_SECRET`; runtime logs continue reporting a
   MongoDB DNS lookup failure. The branch is outdated and configuration is
   missing; deploy auto-trigger is not disabled, and the build did not fail.
4. **BLOCKED** — Did not alter Render settings or merge/deploy to `main`.
   Configure/verify the existing database's private URL as Render
   `DATABASE_URL` first. Do not share its value. Optional OTP/SMS, M-Pesa,
   admin and customer-auth integrations may be configured later if needed.
5. **BLOCKED** — Latest production smoke: health request failed; catalogue
   returned HTTP 500; version returned 404; quote returned 404; guest checkout
   validation returned 401. Local smoke passed all five checks, with commit
   `ec5e80c` returned by `/api/version`.
6. **PARTIAL** — R3 and R4 have fresh-database local verification only. R3
   needs a successful production deploy/smoke. R4 needs owner-confirmed
   product details/prices/photos and persistent media hosting. No later phase
   is newly claimed complete.

### Exact owner action

In Render Dashboard, open Web Service `nyakundi-victoriafresh-2` → **Environment**.
Set `DATABASE_URL` to the **Internal Database URL** shown for existing
PostgreSQL service `victoriafresh-db` in the same region. Save it only in
Render—do not paste or commit it. Confirm the variable is present without
sharing its value, then the upgrade branch can be merged/deployed and watched.
Do not create or reset a database. The upgrade code lets guest ordering start
without OTP, M-Pesa, or admin integrations; configure those only when their
features are approved.

R4 also requires owner-approved catalogue data: product name/category,
description, unit/size, price, availability/quantity, preparation details, and
approved product images. The current public catalogue has 0 such products;
none were fabricated.

## R1 production blocker

The existing Render PostgreSQL resource is available and not suspended. The
Render API service is configured for `main` with auto-deploy enabled, but the
upgrade branch has not been merged. The October 9 main build completed; deploy
status is `update_failed`. Start logs explicitly list missing production
configuration, including `DATABASE_URL`; current runtime logs continue to show
legacy MongoDB DNS failures. Production health is not verified against the
PostgreSQL application in this worktree. Set/verify `DATABASE_URL` in Render
before any merge/deploy. Do not paste the connection string into chat or commit
it. No production resource or setting was changed.

## Items requiring business-owner input

- Confirmed product names, categories, descriptions, sizes, units, prices,
  availability, preparation options, sourcing/arrival details, and real product
  photographs.
- Persistent photo hosting/upload configuration and owner-provided image files
  are needed before upload and resizing can safely be enabled.
- Eatery menu items, options, sides, add-ons, drinks, combos, preparation times,
  and prices.
- Business address, opening hours, delivery service areas, fees, minimums,
  delivery windows, and directions.
- Real phone and WhatsApp contact numbers, support escalation details, and
  approved English/Swahili translations.
- Confirmed product rows must be supplied in `backend/src/data/catalog.json`;
  `VITE_WHATSAPP_NUMBER` must be set only after the real WhatsApp number is
  confirmed.
- Promotion cost/margin rules and any campaigns to schedule.
- Customer-facing freshness, inspection, rejection, cancellation, refund, and
  privacy policies; a qualified legal review is still required, including
  confirmation of obligations under Kenya's Data Protection Act.
- Production credentials for any enabled M-Pesa, OTP/SMS, email, map, or other
  third-party service. Configure these only in the corresponding provider's
  secret store.

## Release metadata

- Production API URL: https://nyakundi-victoriafresh-2.onrender.com
- Production branch observed: `main`
- Release branch: `overnight/upgrade` (14 commits ahead of `main` before this
  round; pushed and synchronized with `origin`).
- Round 3 commit: `fdcf822`; this is not a production release hash.
- Production merge/deploy: not performed.

## Manual checks still required

- Set and verify Render `DATABASE_URL` without exposing its value; confirm
  production health, version, and catalogue after an approved release.
- Configure Vercel `VITE_API_URL` to the production API's `/api` endpoint and
  verify its deployment.
- Configure only confirmed `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_EMAIL`, and
  `VITE_WHATSAPP_NUMBER` values in the frontend deployment.
- Obtain and review the business data listed above.
- Review legal/policy pages with a qualified person.
- Define and review customer-data export/deletion, complaint, refund, photo
  evidence, and retention procedures before enabling those workflows.
- Test real Daraja, SMS/OTP, email, and map credentials and callback routes.
- Perform physical-device geolocation, customer inspection/handover, real
  delivery-zone, reservation, and support workflow checks.
- Supply fish-specific sale basis, estimated-weight rules, preparation choices
  and charges, verified source/arrival information, handling notes, and
  approved substitution choices before R10 can be completed.
- Review accurate Swahili translations and supply real catalogue/eatery photos,
  verified menu and visit details, and any active offer before R11 can be
  completed.

## R9 delivery-zone verification

- Added owner-key protected delivery-zone management, public coverage checks,
  home-page location checker, and fail-closed quote/checkout enforcement.
- No delivery areas, fee, minimum, dispatch point, or delivery window is
  activated without business-owner confirmation. Map search, pin-drop,
  geolocation, a waitlist, and live operations map remain unimplemented pending
  confirmed locations, provider setup, and operational review.
- `npm run db:setup` succeeded; backend 42/42, cart 7/7, frontend/backend
  builds passed, and local read-only smoke checks passed 4/4.

## R10 fish-specific order details

- Existing product units and order-item snapshots are retained and shown to
  customers. Final actual-weight pricing, chargeable preparation options,
  provenance/handling details, and alternative-item consent are not yet
  implemented; no values or rules were inferred from incomplete catalogue
  data.
- Owner input required: sale basis by product, estimated and actual weighing
  procedure, preparation options and surcharges, accurate catch/arrival source
  information, handling notes, and exact remove/wait/alternative choices.

## R11 design and accessibility

- Existing shared visual tokens, responsive layouts, reduced-motion rules,
  lazy-loaded images, accessible catalogue loading/error states, and
  review-backed ratings remain in place. Added keyboard skip navigation and a
  small-screen cart summary with a safe-area-aware position.
- English/Swahili translations are not published without owner review. Real
  product images, eatery/visit content, a verified promotion, and the
  inspect-before-pay flow remain blocked by missing data or unfinished phases.
- Frontend production build passed; cart suite 7/7 passed, 0 skipped.

## R12 support and trust

- Added PostgreSQL-backed support requests for questions, complaints, and
  refund requests, including required response-purpose consent, submit-rate
  limiting, private staff review, and recorded staff response/outcome.
- Removed hard-coded contact phone/email details; configured support phone,
  email, and WhatsApp must use `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_EMAIL`, and
  `VITE_WHATSAPP_NUMBER`. The form remains available when direct channels are
  not configured.
- Backend 43/43 passed with zero skipped; frontend and backend builds passed.
  No evidence photo is accepted because persistent media storage is not
  configured. Data export/deletion and a refund adjudication flow remain
  incomplete. Legal review and owner confirmation of data-protection
  obligations are outstanding.
