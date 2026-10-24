# Production readiness audit

**Project:** Victoria Fresh Fish / Nyakundi  
**Branch:** `fix/catalogue-restore`  
**Audit date:** 2026-10-24  
**Scope:** Source review, local build and tests, local browser checks, read-only storefront API checks, and write-flow HTTP checks against the isolated `victoria_fish_test` database. No production service was deployed and no production customer, order, or payment data was used.

| area | status | evidence | fix applied |
|---|---|---|---|
| Functionality and customer/admin flows | Partial | The local storefront rendered all 26 application routes at 360px. The real API returned 40 catalogue products. HTTP checks on port 5002 verified an unconfirmed-price checkout is rejected (409), a guest Cash on Delivery order succeeds (201), a submitted client price of KES 0.01 is ignored in favor of the stored KES 575 price, and stock falls by one. Signup/login/logout returned 201/200/200. A review stayed pending until admin approval, then appeared publicly. The 81-test backend suite also covers M-Pesa-on-delivery, tracking, idempotency, admin operations and status changes. Admin UI controls and live Daraja payments were not exercised against a deployed service. | Added a friendly application 404/error boundary, page loading and metadata behavior, customer-facing “Received” status, and an admin new-order count/refresh. Kept all write-flow HTTP checks on the isolated test database. |
| Data and catalogue | Partial | PostgreSQL-backed API health and readiness returned 200. Integration tests confirm idempotent migrations/seeding, 40 distinct launch SKUs across eight categories, and preservation of existing admin edits. The local public catalogue had seven products with unconfirmed prices. The launch CSV uses an initial quantity of 10 per product; that is not verified live stock. Thirty-six products had no assigned photo in the checked database. | Added safe insert-only launch seeding and owner-controlled price/stock workflow in the existing project. Removed the shared generic fish-photo fallback: missing photos now show an accessible product-specific placeholder. New admin products without photos remain photo-less. Added a backend regression test. |
| Content and customer trust | Partial | Privacy, terms, delivery, and returns/refunds pages now describe the known data/order flows without inventing fees, service areas, contact details, or remedies. The privacy draft covers names, phone, delivery details, orders, browser storage, and the Kenya Data Protection Act, 2019. Direct contact details and owner/legal/privacy procedures remain unconfirmed. | Added policy pages and `docs/OWNER_TO_CONFIRM.md`; unverified links/details are called out there. These drafts require owner and appropriate legal review before publication. |
| UX and design | Partial | All 26 routes had a main heading at 360px and no horizontal overflow. The product page also had no overflow at 768px or 1280px. The final browser pass reported zero console/page errors and zero broken product images. The shared-photo issue was visible in an earlier pass and has been corrected; 36 cards now show a placeholder and four distinct assigned images load. | Added the 404/error states, route-level loading, metadata, accessible product-photo placeholder, mobile menu ARIA/Escape/focus behavior, and optimized local image copies. |
| Accessibility | Partial | The app has a skip link, semantic page headings, labelled catalogue search, descriptive product image alt text/placeholders, and keyboard-operable mobile navigation. The menu was opened and closed with Escape and focus returned correctly. A full automated WCAG/contrast audit and manual keyboard traversal of every form/control were not run. | Improved mobile-menu state/ARIA/focus handling and ensured photo-less products have a meaningful accessible label. |
| Performance | Partial | Vite produced lazy route chunks. The main JavaScript bundle is 268.64 kB (84.55 kB gzip); main CSS is 14.98 kB (4.06 kB gzip). The image script generated 21 WebP copies, reducing raster asset size from 36.33 MB to 5.37 MB (85.2%); originals were preserved. Static cache headers are configured. No Lighthouse or deployed-network measurement was run. | Added route splitting, lazy/async image loading, reproducible WebP generation, and static-asset cache headers. |
| SEO and sharing | Pass | Each known route sets a title, description, Open Graph metadata and canonical URL; private/operations/unknown routes are `noindex`. `public/sitemap.xml` and `public/robots.txt` expose only intended public pages. Unknown URLs render a friendly 404 with `noindex`. No unverified structured business data was added. | Implemented route-aware metadata, canonical/noindex rules, and policy sitemap entries. |
| Security | Partial | API uses Helmet, bounded JSON input, parameterized SQL, Kenyan-phone/order validation, endpoint rate limits, bcrypt password hashing, protected admin-key routes, and server-side price/stock checks. The three backend test runs cover tampered prices, idempotency, auth/logout, pending reviews, and protected admin operations. High-confidence credential signatures found: zero in tracked Git history and zero in workspace text scanned (private `.env` excluded). Customer JWTs remain 30-day bearer tokens in browser `localStorage`; this increases impact of any XSS. `render.yaml` selects TLS encryption with `DATABASE_SSL=require` (certificate verification disabled), and the existing CORS allow-list includes local development origins; these settings were intentionally left unchanged as requested and need a production security decision. | Added no new secrets, ran full dependency audits (zero vulnerabilities), aligned database backup/restore TLS handling with application TLS defaults, and kept admin auth, CORS, PostgreSQL SSL configuration, checkout idempotency, and server-side pricing/stock validation unchanged. |
| Reliability and operations | Partial | Docker was initially unavailable but later reported a healthy `nyakundi-db-1`; the requested `npm run db:up` completed with the container healthy. The supplied `verify-all.ps1` completed successfully: local health 200, a 40-product catalogue (five in each of eight categories), four products with photos and seven unconfirmed prices, plus a read-only live Render health 200. Local `/api/health` and `/api/readiness` also returned 200. Startup retries database initialization; shutdown closes the HTTP server and PostgreSQL pool; port-in-use errors are explicit. Backup/restore execution and Render cold-start behavior were not tested. | Added graceful shutdown, explicit port handling, environment documentation, backup/restore scripts with an empty-target guard, and setup/deployment instructions. No backup or restore was run. |
| Business flow and order operations | Partial | Isolated-database HTTP tests verified guest ordering, server price authority, stock decrement, private tracking, signup/login/logout, pending-review moderation and public approval. Integration tests cover status transitions, delivery assignment, stock reservations/expiry and both payment-on-delivery methods. The admin queue provides a new-order count and manual refresh; no paid notification service was added. | Added the dashboard queue count/refresh and consistent “Received” status display. The admin dashboard is the free new-order notification method; staff must check it. |
| Tests and dependency health | Pass | `npm run test:backend`: three runs, each 81 passed, 0 failed, 0 skipped (243 passing test executions total). `npm run test:cart`: 7 passed, 0 failed. Frontend and backend builds passed. Full root and backend `npm audit` each reported 0 vulnerabilities. `git diff --check` passed; Git printed only line-ending conversion warnings. | Added a regression assertion for photo-less admin products and corrected two pre-existing test assumptions/CSV parsing issues. Three legacy-catalogue test scenarios were replaced with launch-catalogue seeding and admin-edit-preservation tests because the old catalogue is no longer the launch dataset; no tests were skipped to get green. |

## Proof details

### HTTP checks

The write-capable API was started on port 5002 with an explicit guard that the database name contain `test`. The process used only `victoria_fish_test`; a temporary delivery zone, product, order, review, and signup were removed by exact fixture IDs afterward. A follow-up count confirmed zero remaining HTTP verification product, review, signup, or delivery-zone fixtures.

| Request/flow | Result |
|---|---|
| `GET /api/health` | 200 |
| `GET /api/readiness` | 200 |
| `GET /api/products?limit=100` | 200; 40 products; seven unconfirmed prices visible |
| Checkout an unconfirmed-price product | 409; checkout rejected it |
| Guest Cash on Delivery checkout | 201 |
| Submit client `expectedPrice` KES 0.01 for a KES 575 test product | Order used KES 575 from PostgreSQL; stock decreased from 3 to 2 |
| Signup / login / logout | 201 / 200 / 200 |
| Submit review / approve as admin / public read | 201 pending / 200 / approved review count 1 |
| Unknown frontend URL | Friendly “We couldn’t find that page” screen; `noindex, nofollow` |

These writes were isolated test fixtures only. No write request was sent to the unidentified service that already occupied port 5000.

### Browser and responsive checks

- 26 application routes were visited at 360px; no route lacked a main heading and none had horizontal overflow.
- Product catalogue was additionally checked at 768px and 1280px, with no horizontal overflow.
- The product page rendered 40 cards. Thirty-six had no assigned photo and rendered the labelled placeholder; all four assigned, distinct optimized photos decoded successfully. Broken product images: 0.
- The final route and product checks reported zero browser console errors and zero uncaught page errors.
- A prior broader 81 route/viewport sweep against the default development proxy triggered rate-limit 429 responses because of the repeated automated requests. It did not identify layout overflow; the final checks used the dedicated local backend and reported no errors.

### Environment and security checks

- Docker Desktop was initially unavailable, then became available. `npm run db:up` completed successfully and Docker reported the project database container healthy. The environment-check script also observed a separate PostgreSQL container with its own name; this audit did not inspect or modify that other project's database.
- Git-history scan: zero matches for high-confidence AWS/GitHub/Google/Stripe/private-key signatures. Workspace text and generated client assets were also scanned with private `.env` files excluded; zero such signatures were found. This signature scan is not proof that arbitrary credentials do not exist.
- Full dependency audits: root 0 vulnerabilities; backend 0 vulnerabilities.
- The live Render check was read-only `GET /api/health` (200); no live order, login or payment was attempted. No backup, restore, deployment, push, or merge was performed.

## Files changed in this worktree

The worktree also contained pre-existing uncommitted catalogue changes when this audit started; they were preserved. The task-related file set is recorded by category:

- **App and UI:** `src/App.tsx`, `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/components/FoundersSection.tsx`, `src/components/InfoPage.tsx`, `src/components/ProductGallery.tsx`, `src/pages/About.tsx`, `src/pages/AdminOrders.tsx`, `src/pages/AdminProducts.tsx`, `src/pages/Cart.tsx`, `src/pages/Home.tsx`, `src/pages/TrackOrder.tsx`, `src/pages/PolicyPage.tsx`, `src/pages/PrivacyPolicy.tsx`, `src/pages/ReturnsPolicy.tsx`, `src/pages/TermsOfService.tsx`, `src/services/api.ts`, `src/utils/imageSource.ts`.
- **Backend and tests:** `backend/.env.example`, `backend/README.md`, `backend/package.json`, `backend/package-lock.json`, `backend/src/data/launchCatalog.js`, `backend/src/data/productPhotoPaths.js`, `backend/src/index.js`, `backend/src/lib/db.js`, `backend/src/routes/productRoutes.js`, `backend/src/scripts/catalogue-seed.js`, `backend/src/scripts/catalogue-seed-prod.js`, `backend/src/scripts/databaseCli.js`, `backend/src/scripts/database-backup.js`, `backend/src/scripts/database-restore.js`, `backend/test/api.integration.test.js`, `backend/test/databaseCli.test.js`, `backend/test/launchCatalogue.test.js`.
- **Docs and catalogue:** `README.md`, `SETUP.md`, `docs/BACKUP_AND_RESTORE.md`, `docs/CATALOGUE_FIX_NOTES.md`, `docs/OWNER_TO_CONFIRM.md`, `docs/PRODUCTION_READINESS_AUDIT.md`, `docs/RENDER_ENV_CHECKLIST.md`, `docs/catalogue-launch.csv`, `docs/legacy-products-backup.csv`, `docs/photos-needed.csv`.
- **Build, assets and configuration:** `.gitignore`, `index.html`, `package.json`, `public/sitemap.xml`, `public/images/optimized/` (21 generated WebP copies; original images preserved), `scripts/optimize-images.py`, `vercel.json`, `restart-and-verify.bat`, `start-backend-auto.bat`, `verify-all.ps1`.

## Remaining blockers and owner-supplied facts

The app is **not ready for real customer orders** until the owner:

1. Confirms the seven unconfirmed launch prices and verifies every product’s real unit, current stock, activation state and availability; the seed quantity of 10 is not verified inventory.
2. Supplies or approves accurate, properly licensed photos for the 36 products without an assigned image (or explicitly approves leaving their placeholders).
3. Supplies/validates contact phone, email and WhatsApp; delivery areas, delivery fees, minimums, timing and opening hours; order-change/cancellation rules; and payment-on-delivery availability by area.
4. Confirms the business/controller legal identity, registration/service address, privacy-request contact/process, database/provider locations, subprocessors, access controls, retention/deletion schedule and any cross-border transfers.
5. Defines and approves returns, replacement, cancellation and refund rules for perishable products; verifies social-profile ownership and any founder/dine-in/cooked-food claims shown publicly.
6. Configures and tests production Render database, secrets and admin access. If offering M-Pesa, configure real Daraja credentials and callback settings; otherwise verify the production checkout clearly offers only configured payment methods.
7. Resolves the 30-day `localStorage` bearer-token exposure and reviews the existing `DATABASE_SSL=require` certificate-verification behavior and production CORS allow-list. These were not changed because the task explicitly required preserving auth/CORS/PostgreSQL SSL behavior.
8. Sets an owner-approved encrypted backup/retention policy and performs a restore drill only into a separate empty database.
9. Completes an owner/legal review of policy drafts, a full keyboard/contrast/accessibility review, and a production or staging smoke test before taking live orders.

The owner-specific business details are itemized in [`OWNER_TO_CONFIRM.md`](./OWNER_TO_CONFIRM.md).

## Safe Render release steps

1. Confirm the owner-supplied catalogue, product stock/prices/photos, contact and policy details above. Keep unconfirmed prices unavailable for checkout.
2. Provision or verify the managed PostgreSQL database. Take a protected backup before release; configure and verify provider-required certificate-checked TLS without exposing the URL. Do not point tests or restore drills at production.
3. Enter the production database URL, strong admin/session secrets, exact frontend origin, and only the required integrations in Render’s private environment settings. Keep the existing admin-key auth, CORS behavior, and SSL implementation intact unless separately reviewed and approved.
4. If enabling M-Pesa, complete Safaricom/Daraja setup, verify the public HTTPS callback and callback secret, and test the integration in a non-production environment. Do not use mock mode to accept or mark real payments.
5. Deploy the backend and confirm `/api/health`, `/api/readiness`, database migrations and read-only product listing. Deploy the frontend with `VITE_API_URL` set to the actual backend `/api` URL, then verify direct-route rewrites and the production CORS origin.
6. In staging, test guest checkout, server price/stock enforcement, order tracking/status changes, admin queue and review moderation. Use only test records and remove only those exact fixtures. For production, use read-only smoke tests unless the owner expressly authorizes a controlled test order.
7. Verify HTTPS, admin access, customer session behavior, policy links, contact channels, sitemap/robots, image loading, logs without sensitive data, and the backup/restore procedure. Monitor the admin new-order queue after opening.

## Verdict

**Ready for real customers: No**

The application builds and its tested catalogue, checkout, authentication, review and operations flows work against the isolated test database. A production launch is blocked by owner-only catalogue and legal/operational facts, unverified real stock and seven prices, 36 missing product photos, production secrets/database/payment setup, and the remaining session/SSL security review listed above. Docker startup and production Render behavior were not verified. Do not treat this audit as a deployment approval.
