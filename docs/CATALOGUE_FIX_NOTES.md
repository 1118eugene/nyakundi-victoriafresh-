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

## Customer accounts

Customer accounts use email or Kenyan phone plus a password. Signup creates a
signed session; login checks bcrypt password hashes. Account sessions remain
signed and revocable, and guest checkout remains available without an account.
Accounts created before password sign-in do not have password hashes; customers
who need access to those legacy accounts must contact support to establish a
password. No password reset method is enabled.

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
  and customer session tests.
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
   `ADMIN_DASHBOARD_KEY`, `AUTH_SECRET`,
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
   `/images/products/fish%20fresh.jpg`, and verify password signup/login.

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
  login password authentication, duplicate details, missing fields, wrong
  passwords, protected session access, logout, and authenticated checkout.
  The suite passed in full.
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

## OTP removal and password authentication

The checkout and account screens no longer request or verify one-time codes.
Signup and login use a password (bcrypt hash) and signed customer session.
Migration 12 adds `users.password_hash` without changing existing data.
Existing accounts from the former code-based sign-in flow have no password
hash; they cannot use password login until support establishes a password.
Guest checkout remains available for customers who do not need an account.

The legacy `users.otp_hash`, `otp_expires_at`, `otp_attempts`, `otp_sent_at`,
`otp_verified_at`, and `verified_phone` columns remain in PostgreSQL and are
unused. No database table or column was dropped. Removing those columns is
deferred to a separate reviewed migration after confirming no older deployed
application version needs them.

The current deployment configuration no longer declares messaging credentials.
Guests are protected by per-IP and per-phone order-creation limits, strict
Kenyan mobile format validation, and required delivery-address validation.

### Password-auth and guest-checkout validation

- Frontend `npm run build`: passed.
- Backend `npm run test:backend`: 60 passed, 0 failed, 0 skipped. This includes
  password signup/login, password hashing, invalid credentials, duplicate
  accounts, protected sessions and logout; guest COD and M-Pesa-on-delivery
  orders; missing/invalid phone and delivery address; per-phone/per-IP limits;
  pending-price checkout rejection; and existing stock, idempotency, payment,
  callback, and admin integration coverage.
- `npm run test:cart`: 7 passed, 0 failed, 0 skipped.
- `npm --prefix backend run build`: passed.
- `git diff --check`: passed.
- A live API was started on port 5018 using the isolated test database.
  `GET /api/health` returned HTTP 200 with PostgreSQL connected; guest COD
  checkout with a confirmed, stocked product returned HTTP 201 without an
  account session; a pending-price product was rejected with HTTP 409. The
  temporary test product, zone, and order were cleaned up.
- The M-Pesa-on-delivery order path was exercised by the PostgreSQL integration
  suite; the live smoke used COD and did not invoke an external payment service.

## Real local database catalogue recovery (2026-10-23)

The previous 81-row snapshot above has been superseded by the live recovery:

- The configured local `DATABASE_URL` database is `victoria_fish`. It contained
  **81 rows**, **0 active products**, and no duplicate SKUs before this work.
- Root cause: all 21 official catalogue SKUs already existed as inactive
  `Product details pending owner confirmation.` placeholders. Startup seeding
  used `ON CONFLICT (sku) DO NOTHING`, so it correctly avoided overwriting
  existing records but never recovered these untouched placeholder rows.
- Seeding now recovers only an exact placeholder match: canonical SKU/name,
  placeholder description, zero price, unconfirmed price, zero quantity,
  inactive/out-of-stock flags, and unchanged catalogue metadata. It preserves
  existing photos and rejects any row with owner edits. New SKUs still use
  insert-if-missing; no table is dropped, truncated, or reset.
- The real database now has **91 rows**, **31 active**, **60 inactive**, and
  **0 duplicate SKU groups**. All 31 rows in `catalog.json` are present and
  active. Active products have unconfirmed prices and zero stock, so none is
  purchasable yet. The other 60 pre-existing records were left untouched.
- The 21 recovered catalogue products retain source-evidenced historical
  prices as unconfirmed (19 products); 2 have no evidenced price. Ten
  photo-derived product records were added with null price, unconfirmed
  status, zero stock, and active visibility.
- No delivery zones are configured in the real local database. A live COD
  checkout cannot succeed until an owner configures coverage and approves
  price/stock. This avoids inventing delivery areas or business availability.

### Product photo inventory and assignment

`docs/IMAGE_INVENTORY.csv` lists all **18 image files** in
`public/images/products`, preserving exact filenames. The folder is the only
product-image directory found. All 18 files exist in the production `dist`
output and return HTTP 200 when served with encoded URLs, including
`/images/products/fish%20fresh.jpg`.

Nine filename/metadata or preparation-category associations are verified.
Nine broadly identifiable but species/product-uncertain images are marked
`verified=false` and **need admin assignment**: `fish fresh.jpg`,
`fresh-pexels-a.jpg`, `fresh-pexels-b.jpg`, `fresh-pexels-c.jpg`,
`pexels-10039794.jpg`, `pexels-12572537.jpg`, `pexels-14879227.jpg`,
`pexels-15553656.jpg`, and `pexels-8352050.jpg`. They are attached only to
neutral, pending-price photo records; product/species details still need owner
review. Existing files were not deleted.

The browser check rendered 8 species cards from the active catalogue, showed
pending-price labels and disabled add buttons, loaded all visible card photos,
filtered `Fish Fillets` to 3 cards, and searched `Mbuta` to 1 card. The Nile
Perch details gallery displayed 2 thumbnails and switched between the
Wikimedia and locally named Nile-perch images. Forcing a missing image URL
triggered the existing neutral fallback image successfully.

### Systematic catalogue fill and import

`docs/catalogue-to-fill.csv` contains one row for each of the 31 seeded
products in the existing import-template format. The `price` and `quantity`
(stock) cells are blank for the owner to complete. Run this from the repository
root after filling both fields:

```cmd
npm run catalogue:import
```

The importer validates SKU, category, local image path, price, and stock;
confirmed imports set `price_confirmed=true`, activate the product, derive
`in_stock` from quantity, and record price history. Blank or invalid rows are
reported as rejected. New products use `ON CONFLICT (sku) DO NOTHING`.
Existing seeded rows may be updated only when all catalogue metadata still
matches the untouched seed state and the stored unconfirmed price is still the
historical seed price. Edited or already confirmed products are rejected
without overwrite. A second import cannot create duplicates or replace the
approved price/stock.

Initial execution against the real database reported **0 accepted, 31
rejected** because the provided price and quantity cells are intentionally
blank. No product was changed by that import.

### Admin customer password recovery

The existing admin-key gate remains unchanged. `/admin/support` now includes
an administrator-only action to set a customer's temporary password by
registered email or Kenyan phone. Passwords are bcrypt-hashed, existing
sessions are revoked, and only the success message is returned. Validation
and API tests cover authorization, invalid passwords, login with a reset
password, and session revocation.

### Postman terminal tests

Run these one-line commands in Windows `cmd.exe` with the backend listening on
port 5000. The signup email/phone must be unused; change them if signup returns
409. Copy the `token` value from the login JSON into the protected-route
command.

```cmd
curl.exe -X POST "http://localhost:5000/api/auth/signup" -H "Content-Type: application/json" -d "{\"customerName\":\"Postman Customer\",\"email\":\"postman-customer@example.com\",\"phone\":\"+254711223344\",\"password\":\"Postman-Local-Test-2026\"}"
curl.exe -X POST "http://localhost:5000/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"postman-customer@example.com\",\"password\":\"Postman-Local-Test-2026\"}"
curl.exe "http://localhost:5000/api/auth/me" -H "Authorization: Bearer <paste-login-token-here>"
curl.exe -X POST "http://localhost:5000/api/orders/checkout" -H "Content-Type: application/json" -H "X-Checkout-Key: 5017a99c-4cda-4a13-88c6-42b43e664404" -d "{\"customerName\":\"Postman Guest\",\"phone\":\"0711223344\",\"county\":\"Kisumu\",\"town\":\"Kisumu\",\"addressLine\":\"Test Road 1\",\"paymentMethod\":\"cash_on_delivery\",\"items\":[{\"productId\":\"ab5ddc1c-7900-4675-86ba-dc4c1e414731\",\"quantity\":1}]}"
```

The product ID in the COD command is the real local `FW-1` ID. For this order
to succeed, the owner must first configure the requested delivery zone and
confirm a price and sufficient stock for that product. The current real
database has no delivery zones and no purchasable product; with the untouched
state, order creation is correctly rejected rather than creating an invalid
order. Use a fresh UUID for `X-Checkout-Key` on each distinct checkout attempt.

### Dependency audit and final verification

- `npm audit fix` and `npm --prefix backend audit fix` were run without
  `--force`.
- Root audit: **0 vulnerabilities**.
- Backend audit: **3 high vulnerabilities** remain in `braces`, `chokidar`,
  and `nodemon`. npm reports that resolving these through its available fix
  requires `--force` and a breaking downgrade of `nodemon`; that change was
  deliberately not applied.
- `npm run build`: passed.
- `npm run test:backend`: 66 passed, 0 failed, 0 skipped after making the
  importer integration fixture deterministic inside a rolled-back transaction.
- `npm run test:cart`: 7 passed, 0 failed, 0 skipped.
- `npm --prefix backend run build`: passed.
- The production Vite preview returned HTTP 200 for all 18 image URLs,
  including the encoded filename with a space.
- Real local `DATABASE_URL` verification: 91 product rows, 31 active, 0
  duplicate SKU groups. Two consecutive backend restarts each reconnected to
  PostgreSQL, returned HTTP 200 from `/api/health`, and served all 31 active
  products from `/api/products`.

### Assumptions

- A generic fish photo with no reliable species or product association is
  represented by a neutral active photo record with an explicit pending-details
  name, no price, and zero stock. It remains marked for admin assignment.
- Historical catalogue prices are retained only as unconfirmed evidence. No
  stock or delivery coverage is inferred from prior examples.

Files changed for this removal: `DEPLOYMENT.md`, `README.md`, `SETUP.md`,
`backend/.env.example`, `backend/package.json`, `backend/package-lock.json`,
`backend/src/config/index.js`, `backend/src/index.js`, `backend/src/lib/db.js`,
`backend/src/middleware/auth.js`, `backend/src/routes/authRoutes.js`,
`backend/src/routes/orderRoutes.js`, `backend/src/services/otp.js` (deleted),
`backend/test/api.integration.test.js`, `backend/test/config.test.js`,
`backend/test/otp.test.js` (deleted), `docs/CATALOGUE_FIX_NOTES.md`,
`docs/MORNING_REPORT.md`, `docs/PROGRESS.md`,
`docs/RENDER_ENV_CHECKLIST.md`, `render.yaml`, `src/pages/Auth.css`,
`src/pages/Checkout.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, and
`src/services/api.ts`.

No secrets were printed.

### Final verification update

After making the importer integration fixture deterministic inside a rolled-back
transaction, `git diff --check`, `npm run build`, `npm run test:backend`
(66 passed, 0 failed, 0 skipped), `npm run test:cart` (7 passed, 0 failed,
0 skipped), and `npm --prefix backend run build` all passed. The real local
database still contains 91 products, 31 active and zero duplicate SKUs.
Two backend restarts each reconnected to PostgreSQL, returned HTTP 200 from
`/api/health`, and served all 31 active products from `/api/products`.
