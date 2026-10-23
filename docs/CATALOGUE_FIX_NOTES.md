# Catalogue recovery notes

## Outcome and important limitation

The catalogue, storefront, admin, checkout, and import changes are implemented on
`fix/catalogue-restore`. No changes were pushed or deployed.

The app now reads products from PostgreSQL and the public routes return only
active products. The configured local database is reachable, but its existing
product rows prevent the recovered catalogue from appearing without an owner
review:

- The local database contains 81 product rows, 0 active rows, and 0 duplicate
  SKUs.
- All 21 recovered SKUs already exist there with a zero price, an unconfirmed
  price, quantity 0, inactive status, and the placeholder description
  `Product details pending owner confirmation.` No price-history records exist
  for them.
- `GET /api/health` returns HTTP 200 with the database connected.
  `GET /api/products?limit=100` returns HTTP 200 with an empty `data` array
  because the existing rows are inactive.

The startup seed uses `ON CONFLICT (sku) DO NOTHING`; it deliberately does not
overwrite these existing rows. Re-activating or rewriting them automatically
could overwrite an owner's choices, contrary to the no-overwrite requirement.
An owner must review the existing rows in `/admin/products`, set their verified
descriptions and images, enter the historical prices as unconfirmed, set real
stock, and activate the products. Price confirmation should happen only after
the owner approves each price. This is the remaining step before this local
database can show the restored catalogue.

## Baseline and investigation

- The working branch was created as `fix/catalogue-restore`.
- At baseline, `backend/src/data/catalog.json` at commit `5f24de7` had category
  labels but an empty `products` array.
- Historical product names, descriptions, categories, and positive prices were
  recovered from `src/data/products.ts` at commit `70ef2aa`. Its image paths
  (`/images/products/fw-1.jpg`, etc.) do not exist in the current asset folder,
  so current image assignments use the existing photo inventory instead.
- The additional `Dried Omena` row and its named photo were present in the
  existing candidate catalogue; `omena-dried-wikimedia.jpg` and
  `public/images/products/ATTRIBUTION.md` corroborate the photo association.
  No exact price evidence was found for it.
- Branches and reflogs were inspected; `git stash list` was empty and the
  unreachable-object scan found no unreachable commits containing catalogue
  history.
- The public list filters `active=true`. Product visibility is now independent
  of price and stock: active products with pending prices remain visible.
  Purchase eligibility is separately checked in the API and requires an active
  product, confirmed positive price, `in_stock=true`, and enough quantity.
- The storefront category filters use the backend catalogue's actual category
  keys: `fresh-whole`, `fillet`, `dried`, `smoked`, `small-fish`,
  `coastal-seafood`, `ready-to-eat`, and `fish-processing`.

## Recovered products and price evidence

All prices below are stored as historical evidence with `priceConfirmed=false`.
Seed stock is quantity 0 and not in stock. The database rows described above
pre-date this seed and were not overwritten.

| SKU | Product | Historical price (KES) | Evidence |
|---|---|---:|---|
| FW-1 | Fresh Whole Tilapia | 850 | `src/data/products.ts` at `70ef2aa` |
| FW-2 | Fresh Whole Nile Perch (Mbuta) | 1,500 | `src/data/products.ts` at `70ef2aa` |
| FW-3 | Fresh Whole Catfish (Nduma) | 950 | `src/data/products.ts` at `70ef2aa` |
| FW-4 | Fresh Whole Omena (Sardines) | 450 | `src/data/products.ts` at `70ef2aa` |
| OMENA-DRIED | Dried Omena | Not found | Existing candidate catalogue; no exact historical price |
| FF-1 | Tilapia Fillets (1kg) | 1,200 | `src/data/products.ts` at `70ef2aa` |
| FF-2 | Nile Perch Fillets (1kg) | 1,800 | `src/data/products.ts` at `70ef2aa` |
| FF-3 | Catfish Fillets (1kg) | 1,400 | `src/data/products.ts` at `70ef2aa` |
| SF-1 | Smoked Whole Tilapia | 1,100 | `src/data/products.ts` at `70ef2aa` |
| SF-2 | Smoked Catfish (Nduma) | 1,300 | `src/data/products.ts` at `70ef2aa` |
| SF-3 | Smoked Omena Pack | 650 | `src/data/products.ts` at `70ef2aa` |
| FRD-1 | Fried Tilapia (Ready to Eat) | 950 | `src/data/products.ts` at `70ef2aa` |
| FRD-2 | Fried Perch Fillets (Ready to Eat) | 1,300 | `src/data/products.ts` at `70ef2aa` |
| FRD-3 | Fried Catfish (Ready to Eat) | 1,100 | `src/data/products.ts` at `70ef2aa` |
| FRD-4 | Fried Omena (Ready to Eat) | 550 | `src/data/products.ts` at `70ef2aa` |
| CK-1 | Whole Cooked Tilapia | 1,050 | `src/data/products.ts` at `70ef2aa` |
| CK-2 | Cooked Perch Fillets with Sauce | 1,400 | `src/data/products.ts` at `70ef2aa` |
| CK-3 | Cooked Catfish Stew | 1,200 | `src/data/products.ts` at `70ef2aa` |
| SP-1 | Mixed Fresh Fish Pack (3kg) | 3,500 | `src/data/products.ts` at `70ef2aa` |
| SP-2 | Premium Whole Fish on Ice (5kg) | 5,200 | `src/data/products.ts` at `70ef2aa` |
| SP-3 | Fish Processing Package | Not used | Historical value was 0; zero is not a valid confirmed price |

Thus 19 positive prices are available for owner review. `OMENA-DRIED` and
`SP-3` remain without a price.

## Product image inventory

All 18 JPG assets remain under `public/images/products` and are included in the
admin photo picker. The existing catalogue's named/category photo assignments
are retained; photos without a clear match remain available for owner
assignment. The product gallery has an image fallback and alt text.

| Filename | Present | Catalogue assignment | Basis / status |
|---|---|---|---|
| `catfish-wikimedia.jpg` | Yes | FW-3 | Filename and attribution identify catfish |
| `fish fresh.jpg` | Yes | None | Kept in picker; URL is `/images/products/fish%20fresh.jpg` |
| `fresh-nile-perch.jpg` | Yes | FW-2 | Filename identifies Nile perch |
| `fresh-pexels-a.jpg` | Yes | FW-4, CK-1–CK-3, SP-1–SP-3; gallery fallback | Existing candidate catalogue assignment; also the existing generic fallback |
| `fresh-pexels-b.jpg` | Yes | None | Unassigned for the owner photo picker |
| `fresh-pexels-c.jpg` | Yes | None | Unassigned for the owner photo picker |
| `nile-perch-wikimedia.jpg` | Yes | FW-2 | Filename and attribution identify Nile perch |
| `omena-dried-wikimedia.jpg` | Yes | OMENA-DRIED | Filename and attribution identify dried Omena |
| `pexels-10039794.jpg` | Yes | None | Unassigned for the owner photo picker |
| `pexels-12572537.jpg` | Yes | None | Unassigned for the owner photo picker |
| `pexels-14879227.jpg` | Yes | None | Unassigned for the owner photo picker |
| `pexels-15553656.jpg` | Yes | None | Unassigned for the owner photo picker |
| `pexels-8352050.jpg` | Yes | None | Unassigned for the owner photo picker |
| `pexels-fillet.jpg` | Yes | FF-1–FF-3 | Filename identifies the fillet preparation category |
| `pexels-fried.jpg` | Yes | FRD-1–FRD-4 | Filename identifies the fried preparation category |
| `pexels-grilled.jpg` | Yes | None | Unassigned; no matching grilled product |
| `pexels-smoked.jpg` | Yes | SF-1–SF-3 | Filename identifies the smoked preparation category |
| `pexels-tilapia.jpg` | Yes | FW-1 | Filename identifies tilapia |

Pexels and Wikimedia source/licence details are recorded in
`public/images/products/ATTRIBUTION.md`. A production build smoke check returned
HTTP 200 for all 18 image URLs, including the encoded space in `fish fresh.jpg`.

## Persistence, storefront, and admin changes

- PostgreSQL remains the source of truth for public and admin product reads.
  Migration 11 adds the nullable price and required product fields, a unique
  SKU index, and the positive-price confirmation constraint. Migrations are
  guarded by schema version and use idempotent DDL; no tables are dropped,
  truncated, or reset.
- Catalogue startup seeding inserts only missing SKUs with
  `ON CONFLICT (sku) DO NOTHING`.
- Public list and detail endpoints hide inactive products and mask
  unconfirmed prices. Admin inventory retains the stored pending price.
- Admin APIs support product edits, availability/stock updates, local photo
  assignment, per-product and bulk price confirmation, and price history.
  The shared admin-key setup records the admin role and timestamp, not an
  individual administrator identity.
- Cart and product details show pending-price, out-of-stock, and unavailable
  states and prevent adding non-purchasable products. Checkout re-reads locked
  database product rows, ignores client-submitted prices, and preserves
  checkout idempotency, payment, and fulfilment paths.
- CSV import supports preview/reporting, validates the exact template,
  category, SKU uniqueness, price/confirmation and stock fields, and only
  accepts paths in the approved local photo inventory. Duplicate SKUs are
  rejected without changing existing inventory.
- The empty-state storefront text now says no products are available rather
  than implying pending-price products are hidden.
- Backend startup handles `EADDRINUSE` without a stack trace. `npm run
  dev:fresh` starts the backend on port 5001 when the default port 5000 is
  occupied.

## Authentication and OTP

There is no password-based customer login in this project; sign-up and login
both use phone/email OTP. The integration suite exercises registration,
missing fields, duplicate email and phone, invalid and expired OTP, verified
login, protected session access, and logout/session revocation with the
development-only console OTP provider. Production OTP configuration and its
rate limits/expiry checks are unchanged. A real SMS/email delivery provider
was not exercised.

## Files changed

- `README.md`
- `backend/package.json`
- `backend/src/data/catalog.js`
- `backend/src/data/catalog.json`
- `backend/src/data/productPhotoPaths.js`
- `backend/src/index.js`
- `backend/src/lib/catalogImport.js`
- `backend/src/lib/db.js`
- `backend/src/lib/orderUtils.js`
- `backend/src/routes/orderRoutes.js`
- `backend/src/routes/productRoutes.js`
- `backend/test/api.integration.test.js`
- `backend/test/catalog.test.js`
- `backend/test/catalogImport.test.js`
- `backend/test/orderUtils.test.js`
- `src/components/ProductCard.css`
- `src/components/ProductCard.tsx`
- `src/components/ProductGallery.tsx`
- `src/contexts/CartContext.tsx`
- `src/contexts/cartUtils.test.mjs`
- `src/contexts/cartUtils.ts`
- `src/data/productPhotoAssets.ts`
- `src/pages/AdminProducts.css`
- `src/pages/AdminProducts.tsx`
- `src/pages/Cart.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/Products.css`
- `src/pages/Products.tsx`
- `src/services/api.ts`
- `src/types/index.ts`
- `docs/CATALOGUE_FIX_NOTES.md`

## Validation results

Baseline results before the changes:

- `npm run build`: failed because `AdminProducts.tsx` imported the missing
  `importAdminProducts` API helper.
- `npm run test:cart`: 5 passed, 2 failed because existing fixtures did not
  satisfy the price-confirmation rule.
- `npm run test:backend`: initially blocked by a refused local test-database
  connection.
- `npm run db:up`: Docker Compose could not start because the Docker engine
  was unavailable. The configured PostgreSQL database later became reachable,
  allowing the final integration suite to run.

Final observed checks:

- `npm run build`: passed.
- `npm --prefix backend run build`: passed.
- `npm run test:backend`: 65 passed, 0 failed, including PostgreSQL
  integration, checkout pricing/stock, catalogue idempotency, admin, import,
  OTP, and session tests.
- `npm run test:cart`: 7 passed, 0 failed.
- `npm run smoke -- --local-only` against port 5001: 5 checks passed. The
  health endpoint reported the database connected; the catalogue check
  reported no owner-confirmed products.
- Local backend `GET /api/health`: HTTP 200, database connected.
- Local backend `GET /api/products?limit=100`: HTTP 200, 0 products, due to the
  pre-existing inactive rows described above.
- Two backend restarts left 81 database rows, 0 active products, and 0
  duplicate SKUs. Integration tests also called the seed twice and verified
  that a simulated admin edit was preserved.
- Production frontend browser smoke with a mocked active pending-price product:
  one card rendered; pending-price and out-of-stock labels appeared; Add to
  Cart was disabled. This was a UI fixture, not a claim that the local
  inactive database rows were visible.
- Production image URL smoke: 18/18 images returned HTTP 200.
- With port 5000 occupied, backend startup printed the requested
  `EADDRINUSE` message, exited with code 1, and emitted no stack trace.
  `npm run dev:fresh` started the app on port 5001 and connected to PostgreSQL.

## Assumptions

- Historical positive prices are useful stored evidence but are not owner
  approval; every recovered price starts unconfirmed.
- A historical zero price for Fish Processing Package is not a real price.
  Dried Omena has no verified price.
- No stock level is inferred. Seed quantities are zero and unavailable until
  the owner sets actual stock.
- Existing inactive/zero-price database rows may encode admin decisions.
  Preserving them is safer than automatically activating or replacing them.
- The owner can review the shared admin key's actions by role and timestamp;
  the current authentication model has no per-admin identity to record.

## Safe Render deployment and remaining steps

1. Back up the production PostgreSQL database and confirm Render's backend
   points to the intended database. Check environment variable *names and
   configuration* without exposing values: `DATABASE_URL`, `DATABASE_SSL`,
   `ADMIN_DASHBOARD_KEY`, `AUTH_SECRET`, the configured OTP provider settings,
   and the existing M-Pesa credentials/callback settings. Preserve TLS; do not
   disable SSL.
2. Deploy through the normal reviewed release process. Startup migrations
   apply schema versions idempotently; they do not reset tables. Review any
   duplicate-SKU migration failure rather than deleting existing rows.
3. In `/admin/products`, review the existing 21 recovered SKU rows before
   activating them. Replace placeholder descriptions, select the correct
   existing photo, enter an evidence-backed price as pending, set actual
   stock and availability, and activate only products approved for display.
4. After owner price review, use per-product confirmation or **Confirm all
   recovered prices**. Confirming a price does not create stock; set stock
   separately.
5. Check `GET /api/health` reports PostgreSQL connected and
   `GET /api/products?limit=100` returns the expected active products. Verify
   pending prices are `null` publicly, checkout rejects pending/out-of-stock
   products, and approved products use the database price even if the client
   submits a different value. Check image URLs, including
   `/images/products/fish%20fresh.jpg`, and verify OTP delivery with the
   configured production provider.

## Verification run 2026-10-23

The requested branch was already checked out with the recovery implementation
committed, so no application code was changed during this verification run.
The existing untracked path `$null` was left untouched.

- Docker was available (`docker version` reported server version `29.8.0`).
  Backend startup connected to PostgreSQL and completed schema migration and
  seeding without printing any environment-variable values.
- Baseline on the checked-out branch, before this notes update:
  `npm run build` passed; `npm run test:backend` passed 65/65 tests with 0
  failures and 0 skipped; `npm run test:cart` passed 7/7 with 0 failures; and
  `npm --prefix backend run build` passed.
- `npm run smoke -- --local-only` passed all 5 checks: connected health,
  catalogue response shape, version response, invalid quote rejection, and
  incomplete checkout rejection.
- Live `GET /api/health` returned HTTP 200 with `status=OK` and
  `database=connected`. Live `GET /api/products?limit=100` returned HTTP 200
  with 0 products.
- A read-only PostgreSQL check found 81 products, 0 active, 81 inactive, and
  81 unique SKUs. All 21 recovered SKUs exist and remain inactive with
  unconfirmed prices, quantity 0, and the placeholder description. This
  verifies the current database state described above; it is not evidence that
  the live storefront currently renders those 21 products.
- The backend was restarted twice. After the second restart the database still
  contained 81 rows, 0 active rows, and 81 unique SKUs; health remained
  connected and the public product response remained empty. Existing admin
  records were not activated or overwritten.
- The production Vite preview returned HTTP 200 for all 18 product image
  assets. This includes `fish fresh.jpg` requested as
  `/images/products/fish%20fresh.jpg`.
- `git diff --check` passed before this notes update; rerun it before commit.
- The integration suite covers pending-price visibility and checkout denial,
  active versus inactive products, admin create/edit/confirmation, idempotent
  seed and import, server-side price tampering and stock checks, and signup/
  login OTP verification, duplicate details, missing fields, invalid/expired
  codes, protected session access, logout, and authenticated checkout. The
  suite passed in full.
- The existing browser smoke result above used a mocked active pending-price
  product. A live browser card could not be demonstrated in this run because
  the preserved local database has no active products. The integration test
  does verify that active pending-price products are returned by the API.

No test failures occurred in this verification run. The remaining blocker is
business-data review, not database connectivity: the owner must update and
activate the 21 existing placeholder rows through `/admin/products` after
confirming descriptions, photo assignments, current prices, and actual stock.
No price or stock was invented and no existing row was changed to make the
public endpoint appear populated. `git diff --check` also passed after this
notes update.
