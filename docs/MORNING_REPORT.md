# Morning report — in progress

This report is being updated as the R1–R16 roadmap is executed. No production
deployment or merge to `main` has been performed.

## Status

| Phase | Status | Verified result |
|---|---|---|
| R1 | PARTIAL — local complete; production configuration blocked | PostgreSQL setup succeeded; backend 38 passed, 0 failed, 0 skipped; cart 7 passed, 0 failed, 0 skipped; frontend and backend builds passed. |
| R2 | DONE | Backend: 40 passed, 0 failed, 0 skipped. Added persisted order-history assertions, blocked-phone management/enforcement tests, and robots/sitemap validation. |
| R3 | PARTIAL — local complete; deployed API mismatch blocks confirmation | Backend: 42 passed, 0 failed, 0 skipped; cart: 7 passed, 0 failed, 0 skipped; frontend and backend builds passed; local smoke 4/4. All 60 matching generated legacy catalogue rows were hidden without deletion. Deployed smoke: health/catalogue timed out, quote returned 404, checkout returned 401. |
| R4 | TODO | |
| R5 | TODO | |
| R6 | TODO | |
| R7 | TODO | |
| R8 | TODO | |
| R9 | TODO | |
| R10 | TODO | |
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
- Release branch: `overnight/upgrade` (R1 and R2 commits are pushed; R3 commit
  is pending).
- Commit hash: update after the R3 commit and again for the final release.
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
