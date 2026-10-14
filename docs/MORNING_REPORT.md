# Morning report — in progress

This report is being updated as the R1–R16 roadmap is executed. No production
deployment or merge to `main` has been performed.

## Status

| Phase | Status | Verified result |
|---|---|---|
| R1 | PARTIAL — local complete; production configuration blocked | PostgreSQL setup succeeded; backend 38 passed, 0 failed, 0 skipped; cart 7 passed, 0 failed, 0 skipped; frontend and backend builds passed. |
| R2 | DONE | Backend: 40 passed, 0 failed, 0 skipped. Added persisted order-history assertions, blocked-phone management/enforcement tests, and robots/sitemap validation. |
| R3 | PARTIAL — local complete; deployed API mismatch blocks confirmation | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. All 60 matching generated legacy catalogue rows were hidden without deletion. Deployed smoke: health/catalogue timed out, quote returned 404, checkout returned 401. |
| R4 | PARTIAL — data and persistent image storage blocked | Backend: 43 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed. Added owner price-confirmation enforcement, product CRUD, size/photo fields, price history, and an import template. Upload/resizing and real catalogue entries await owner/media-provider input. |
| R5 | BLOCKED — owner menu/address/hours and verifiable competitor menu sources required | No menu, reservation workflow, or competitor pricing was invented. Added a source/date-required comparison template; current network search did not return a reliable published menu source. |
| R6 | BLOCKED — product costs and margin/campaign rules required | No promotions or discounts enabled without owner-supplied costs and an approved minimum-margin/stacking policy. Runtime unchanged; latest verified test baseline is R4. |
| R7 | PARTIAL — guest-first customer accounts exist; staff roles/audit remain incomplete | Existing OTP, session revocation, guest checkout and order history tests pass; shared admin/delivery keys have not yet been replaced by role-based staff sessions and audit logging. |
| R8 | BLOCKED — owner inspection, rejection, payment and dispute policy required | Existing delivery/payment journeys remain verified; inspect-before-pay, per-item rejection and evidence photo flow are not implemented pending policy and persistent photo storage. |
| R9 | PARTIAL — configured zones verified; map, dispatch-point, and driver-map workflows need owner/provider details | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. |
| R10 | PARTIAL — existing unit prices and order snapshots; final weight, preparation fees, provenance, and agreed alternatives need owner rules/data | No runtime changes; latest applicable backend 42 passed, cart 7 passed, zero failures/skips; builds passed. |
| R11 | TODO | |
| R12 | TODO | |
| R13 | TODO | |
| R14 | TODO | |
| R15 | TODO | |
| R16 | TODO | |

## R1 production blocker

The existing Render PostgreSQL resource is available and not suspended. The
Render API service is deployed from `main`; recent logs show repeated DNS
resolution failures for a MongoDB host, rather than a PostgreSQL connection
failure. Production health is therefore not verified against the PostgreSQL
application in this worktree. Before a production release, set the service's
`DATABASE_URL` to the existing Render database's private connection string in
the Render dashboard and deploy only after R16 checks pass. Never paste the
connection string into chat or commit it. No production resource was changed.

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
- Release branch: `overnight/upgrade` (R1–R8 commits are pushed; R9 is in progress).
- R3 commit: `5f24de7`; R4 commit: `2788773`. Final release hash will be
  recorded after R16.
- Production merge/deploy: not performed.

## Manual checks still required

- Set and verify Render `DATABASE_URL` without exposing its value; confirm
  production health, version, and catalogue after an approved release.
- Configure Vercel `VITE_API_URL` to the production API's `/api` endpoint and
  verify its deployment.
- Obtain and review the business data listed above.
- Review legal/policy pages with a qualified person.
- Test real Daraja, SMS/OTP, email, and map credentials and callback routes.
- Perform physical-device geolocation, customer inspection/handover, real
  delivery-zone, reservation, and support workflow checks.
- Supply fish-specific sale basis, estimated-weight rules, preparation choices
  and charges, verified source/arrival information, handling notes, and
  approved substitution choices before R10 can be completed.

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
