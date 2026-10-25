import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { catalogProducts } from '../src/data/catalog.js'
import { launchProducts } from '../src/data/launchCatalog.js'
import { importFilledCatalogueRows } from '../src/lib/catalogueFillImport.js'

process.env.NODE_ENV = 'test'
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is required; database integration tests do not run against a mocked or skipped database.')
}
let testDatabase
try {
  testDatabase = new URL(process.env.TEST_DATABASE_URL)
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid local PostgreSQL test-database URL.')
}
const testDatabaseName = decodeURIComponent(testDatabase.pathname.slice(1))
if (!['localhost', '127.0.0.1', '::1'].includes(testDatabase.hostname)
  || !/(?:^|[_-])test(?:$|[_-])/i.test(testDatabaseName)) {
  throw new Error('Refusing integration-test cleanup: TEST_DATABASE_URL must target a local database whose name identifies it as a test database.')
}
process.env.DATABASE_URL = testDatabase.toString()
process.env.MPESA_CALLBACK_SECRET = 'integration-test-secret'
process.env.AUTH_SECRET = 'integration-auth-secret'
process.env.MPESA_MODE = 'mock'
process.env.ADMIN_DASHBOARD_KEY = 'integration-admin-secret'
process.env.DELIVERY_STAFF_ID = 'integration-delivery-worker'
process.env.DELIVERY_STAFF_KEY = 'integration-delivery-secret-longer-than-32-characters'

let app
let query
let initializeDatabase
let seedLaunchCatalogue
let releaseExpiredInventory
let fetchOrder
let closeDatabase
let withTransaction
let seedFaqs
let integrationReady = false
let deliveryZoneId
let adminDeliveryZoneId
let supportRequestId

const testRunId = crypto.randomBytes(6).toString('hex')
const [{ default: requestApp }, db] = await Promise.all([
  import('supertest'),
  import('../src/lib/db.js'),
])
const { config } = await import('../src/config/index.js')
const index = await import('../src/index.js')
app = requestApp(index.default)
;({ query, initializeDatabase, seedLaunchCatalogue, releaseExpiredInventory, fetchOrder, closeDatabase, withTransaction, seedFaqs } = db)
await initializeDatabase({ retry: false })
await withTransaction(async (client) => {
  await client.query(`DELETE FROM product_reviews
    WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'TEST-%' OR sku LIKE 'IMPORT-%' OR sku LIKE 'EXTERNAL-%')
      OR order_id IN (SELECT o.id FROM orders o LEFT JOIN users u ON u.id=o.customer_id
        WHERE o.order_number LIKE 'TEST-%' OR u.email LIKE 'logout-%@example.com'
          OR u.email LIKE 'pending-%@example.com' OR u.email LIKE 'auth-flow-%@example.com'
          OR u.email LIKE 'duplicate-%@example.com' OR u.email LIKE 'password-reset-%@example.com'
          OR u.email LIKE 'checkout-%@example.com'
          OR o.id IN (SELECT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id
            WHERE p.sku LIKE 'TEST-%' OR p.sku LIKE 'IMPORT-%' OR p.sku LIKE 'EXTERNAL-%'))`)
  await client.query(`DELETE FROM service_feedback WHERE order_id IN
    (SELECT o.id FROM orders o LEFT JOIN users u ON u.id=o.customer_id
      WHERE o.order_number LIKE 'TEST-%' OR u.email LIKE 'logout-%@example.com'
        OR u.email LIKE 'pending-%@example.com' OR u.email LIKE 'auth-flow-%@example.com'
        OR u.email LIKE 'duplicate-%@example.com' OR u.email LIKE 'password-reset-%@example.com'
        OR u.email LIKE 'checkout-%@example.com'
        OR o.id IN (SELECT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id
          WHERE p.sku LIKE 'TEST-%' OR p.sku LIKE 'IMPORT-%' OR p.sku LIKE 'EXTERNAL-%'))`)
  await client.query('DELETE FROM support_requests WHERE email=$1 OR email LIKE $2 OR order_number LIKE $3',
    ['support-test@example.com', 'support-test-%@example.com', 'TEST-%'])
  await client.query(`DELETE FROM orders WHERE order_number LIKE 'TEST-%' OR customer_id IN
    (SELECT id FROM users WHERE email LIKE 'logout-%@example.com' OR email LIKE 'pending-%@example.com'
      OR email LIKE 'auth-flow-%@example.com' OR email LIKE 'duplicate-%@example.com'
      OR email LIKE 'password-reset-%@example.com' OR email LIKE 'checkout-%@example.com')
    OR id IN (SELECT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id
      WHERE p.sku LIKE 'TEST-%' OR p.sku LIKE 'IMPORT-%' OR p.sku LIKE 'EXTERNAL-%')`)
  await client.query(`DELETE FROM product_price_history
    WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'TEST-%' OR sku LIKE 'IMPORT-%' OR sku LIKE 'EXTERNAL-%')`)
  await client.query(`DELETE FROM products WHERE sku LIKE 'TEST-%' OR sku LIKE 'IMPORT-%' OR sku LIKE 'EXTERNAL-%'`)
  await client.query("DELETE FROM faqs WHERE category LIKE 'test-%'")
  await client.query("DELETE FROM blocked_phones WHERE reason IN ('Integration test', 'Updated integration test')")
  await client.query(`DELETE FROM delivery_zones WHERE name='Integration Kisumu'
    OR name LIKE 'Integration Kisumu test-%' OR name='Test zone' OR name LIKE 'Test zone test-%'`)
  await client.query(`DELETE FROM users WHERE email LIKE 'logout-%@example.com'
    OR email LIKE 'pending-%@example.com' OR email LIKE 'auth-flow-%@example.com'
    OR email LIKE 'duplicate-%@example.com' OR email LIKE 'password-reset-%@example.com'
    OR email LIKE 'checkout-%@example.com'`)
})
const testZone = await query(`INSERT INTO delivery_zones
  (name,county,towns,fee,minimum_order,delivery_windows,active,priority)
  VALUES ($1,'Kisumu',ARRAY['Kisumu'],250,0,'["09:00-17:00"]'::jsonb,true,100)
  RETURNING id`, [`Integration Kisumu test-${testRunId}`])
deliveryZoneId = testZone.rows[0].id
integrationReady = true

let integrationTestQueue = Promise.resolve()
const integrationTest = (name, handler) => test(name, async (context) => {
  const previousTest = integrationTestQueue
  let releaseTest
  integrationTestQueue = new Promise((resolve) => { releaseTest = resolve })
  await previousTest
  try {
    await handler(context)
  } finally {
    releaseTest()
  }
})
const cookieForToken = (token) => `vff_customer_session=${token}`
const sessionCookieFrom = (response) => response.headers['set-cookie']
  ?.find((cookie) => cookie.startsWith('vff_customer_session='))
  ?.split(';', 1)[0]
const withCustomerCookie = (request, token) => request
  .set('Cookie', cookieForToken(token))
  .set('x-vff-csrf', '1')

let orderId
let latePaymentOrderId
let postDeliveryPaymentOrderId
let guestOrderId
let operationsOrderId
let operationsProductId
let blockedPhoneForTest
let blockedProductId
let blockedOrderId
let contractProductId
let adminProductId
let photoLessAdminProductId
let expiredInventoryOrderId
let productId
let signupUserId
let checkoutUserId
let checkoutProductId
let guestProductId
let authFlowUserId
let passwordResetUserId

integrationTest('preserves non-launch products and their inventory state during launch seeding', async () => {
  const sku = `EXTERNAL-${crypto.randomBytes(6).toString('hex')}`
  await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock)
    VALUES ($1,'External Product','Existing inventory',125,'kg','fresh-whole','Tilapia','Fresh',7,false,false)`,
  [sku])

  try {
    await seedLaunchCatalogue()
    const result = await query('SELECT quantity,active,in_stock FROM products WHERE sku=$1', [sku])
    assert.deepEqual(result.rows[0], { quantity: 7, active: false, in_stock: false })
  } finally {
    await query('DELETE FROM products WHERE sku=$1', [sku])
  }
})

integrationTest('seeds 40 launch products idempotently and never reactivates legacy or edited rows', async () => {
  const counts = await query(`SELECT COUNT(*)::int AS launch
    FROM products WHERE sku ~ '^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-[0-9]{3}$'`)
  assert.deepEqual(counts.rows[0], { launch: 40 })
  const categoryCounts = await query(`SELECT category,COUNT(*)::int AS count
    FROM products WHERE sku ~ '^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-[0-9]{3}$'
    GROUP BY category ORDER BY category`)
  assert.equal(categoryCounts.rows.length, 8)
  assert.ok(categoryCounts.rows.every(({ count }) => count === 5))
  const duplicateSkus = await query(`SELECT COUNT(*)::int AS groups FROM (
    SELECT sku FROM products GROUP BY sku HAVING COUNT(*) > 1
  ) duplicates`)
  assert.equal(duplicateSkus.rows[0].groups, 0)

  const launchProduct = launchProducts.find((product) => product.sku === 'VFF-FW-001')
  assert.ok(launchProduct)
  const before = await query(`SELECT price,price_confirmed,quantity,active,in_stock,image,photos
    FROM products WHERE sku='VFF-FW-001'`)
  assert.equal(before.rowCount, 1)
  const legacySku = `TEST-${testRunId}-LEGACY-${crypto.randomBytes(4).toString('hex')}`
  const restoreLaunchProduct = () => query(`UPDATE products SET price=$1,price_confirmed=$2,
    quantity=$3,active=$4,in_stock=$5,image=$6,photos=$7::jsonb
    WHERE sku='VFF-FW-001'`,
  [launchProduct.price, launchProduct.priceConfirmed, launchProduct.quantity, launchProduct.active,
    launchProduct.inStock, launchProduct.photos[0] || '', JSON.stringify(launchProduct.photos)])
  try {
    await restoreLaunchProduct()
    await query(`UPDATE products SET price=123,price_confirmed=false,quantity=7,
      active=false,in_stock=false,image='admin-photo.jpg',photos='["admin-photo.jpg"]'::jsonb
      WHERE sku='VFF-FW-001'`)
    await query(`INSERT INTO products
      (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock)
      VALUES ($1,'Legacy Whole Tilapia','Legacy row',850,'kg','fresh-whole','Tilapia','Fresh',0,false,false)`,
    [legacySku])
    await seedLaunchCatalogue()
    await seedLaunchCatalogue()
    const after = await query(`SELECT price,price_confirmed,quantity,active,in_stock,image,photos,
      (SELECT count(*)::int FROM products WHERE sku='VFF-FW-001') AS copies
      FROM products WHERE sku='VFF-FW-001'`)
    assert.deepEqual(after.rows[0], {
      price: '123.00',
      price_confirmed: false,
      quantity: 7,
      active: false,
      in_stock: false,
      image: 'admin-photo.jpg',
      photos: ['admin-photo.jpg'],
      copies: 1,
    })
    const legacy = await query('SELECT active FROM products WHERE sku=$1', [legacySku])
    assert.equal(legacy.rows[0].active, false)
    const launchCount = await query(`SELECT COUNT(*)::int AS count FROM products
      WHERE sku ~ '^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-[0-9]{3}$'`)
    assert.equal(launchCount.rows[0].count, 40)
  } finally {
    await query('DELETE FROM products WHERE sku=$1', [legacySku])
    await restoreLaunchProduct()
  }
})

integrationTest('product photo picker inventory is available only with the existing admin key', async () => {
  const denied = await app.get('/api/products/photo-inventory')
  assert.equal(denied.status, 401)
  const allowed = await app.get('/api/products/photo-inventory')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  assert.equal(allowed.status, 200)
  assert.ok(allowed.body.data.includes('/images/products/pexels-tilapia.jpg'))
  assert.ok(allowed.body.data.includes('/images/products/fish%20fresh.jpg'))
})

integrationTest('imports filled catalogue rows idempotently and preserves changed products', async () => {
  const seed = catalogProducts.find((product) => product.sku === 'FW-1')
  const candidate = { ...seed, price: 999, priceConfirmed: true, quantity: 5, active: true, inStock: true }
  const newProduct = {
    ...candidate,
    sku: `IMPORT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    name: 'CSV import test product',
    photos: ['/images/products/pexels-tilapia.jpg'],
  }
  try {
    await query(`INSERT INTO products
      (sku,name,description,price,unit,size_label,image,photos,category,species,preparation,
        quantity,active,in_stock,price_confirmed,price_updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'',$7::jsonb,$8,$9,$10,0,true,false,false,NULL)`,
    [seed.sku, seed.name, seed.description, seed.price, seed.unit, seed.sizeLabel,
      JSON.stringify(seed.photos), seed.category, seed.species, seed.preparation])
    await withTransaction(async (client) => {
      const restored = await importFilledCatalogueRows(client, [{ line: 2, product: candidate }])
      assert.deepEqual(restored.accepted.map(({ action }) => action), ['updated'], JSON.stringify(restored))
      assert.equal(restored.rejected.length, 0)
      const updatedRow = await client.query(`SELECT price,price_confirmed,quantity,in_stock
          FROM products WHERE sku='FW-1'`)
      assert.deepEqual(updatedRow.rows[0], {
        price: '999.00',
        price_confirmed: true,
        quantity: 5,
        in_stock: true,
      })
      const repeated = await importFilledCatalogueRows(client, [{ line: 2, product: candidate }])
      assert.equal(repeated.accepted.length, 0)
      assert.equal(repeated.rejected.length, 1)

      const inserted = await importFilledCatalogueRows(client, [{ line: 3, product: newProduct }])
      assert.deepEqual(inserted.accepted.map(({ action }) => action), ['inserted'])
      const duplicate = await importFilledCatalogueRows(client, [{ line: 3, product: newProduct }])
      assert.equal(duplicate.accepted.length, 0)
      assert.equal(duplicate.rejected.length, 1)
      const count = await client.query('SELECT count(*)::int AS count FROM products WHERE sku=$1', [newProduct.sku])
      assert.equal(count.rows[0].count, 1)
    })
  } finally {
    await query('DELETE FROM product_price_history WHERE product_id=(SELECT id FROM products WHERE sku=$1)', [seed.sku])
    await query('DELETE FROM products WHERE sku=$1', [seed.sku])
  }
})

integrationTest('matches the storefront product response contract', async () => {
  const inserted = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,featured,price_confirmed)
    VALUES ($1,'Contract Test Fish','Test fixture only',710,'kg','fresh-whole','Tilapia','Fresh',3,true,true,true)
    RETURNING id`, [`TEST-CONTRACT-${crypto.randomBytes(3).toString('hex')}`])
  contractProductId = inserted.rows[0].id

  const response = await app.get('/api/products?limit=100')
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(response.body.data))
  assert.ok(response.body.filters.categories && typeof response.body.filters.categories === 'object')
  assert.equal(response.body.pagination.returned, response.body.data.length)
  const product = response.body.data.find((entry) => entry.id === contractProductId)
  assert.ok(product)
  for (const field of ['sku', 'name', 'description', 'unit', 'image', 'category', 'species', 'preparation']) {
    assert.equal(typeof product[field], 'string', `Expected product.${field} to be a string`)
  }
  for (const field of ['price', 'quantity']) {
    assert.equal(typeof product[field], 'number', `Expected product.${field} to be a number`)
  }
  assert.equal(typeof product.sizeLabel, 'string')
  assert.ok(Array.isArray(product.photos))
  assert.equal(product.priceConfirmed, true)
  assert.equal(typeof product.inStock, 'boolean')
  assert.equal(typeof product.featured, 'boolean')
})

integrationTest('shows active pending-price products and hides inactive products publicly', async () => {
  const suffix = crypto.randomBytes(3).toString('hex')
  const pending = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,'Pending Price Test Fish','Integration test product',725,'kg','fresh-whole','Tilapia','Fresh',0,true,false,false)
    RETURNING id`, [`TEST-PENDING-${suffix}`])
  const inactive = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,'Inactive Test Fish','Integration test product',725,'kg','fresh-whole','Tilapia','Fresh',2,false,true,true)
    RETURNING id`, [`TEST-INACTIVE-${suffix}`])
  try {
    const response = await app.get('/api/products?limit=100')
    assert.equal(response.status, 200)
    const pendingProduct = response.body.data.find((item) => item.id === pending.rows[0].id)
    assert.ok(pendingProduct)
    assert.equal(pendingProduct.price, null)
    assert.equal(pendingProduct.priceConfirmed, false)
    assert.equal(response.body.data.some((item) => item.id === inactive.rows[0].id), false)
    const hiddenDetails = await app.get(`/api/products/${inactive.rows[0].id}`)
    assert.equal(hiddenDetails.status, 404)
  } finally {
    await query('DELETE FROM products WHERE id=ANY($1::uuid[])', [[pending.rows[0].id, inactive.rows[0].id]])
  }
})

integrationTest('rejects pending-price checkout and charges an approved database price despite tampering', async () => {
  const suffix = crypto.randomBytes(3).toString('hex')
  const product = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,'Checkout Price Test Fish','Integration test product',NULL,'kg','fresh-whole','Tilapia','Fresh',2,true,true,false)
    RETURNING id`, [`TEST-PRICE-${suffix}`])
  let orderId
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const body = {
    customerName: 'Checkout Price Test',
    email: '',
    phone,
    county: 'Kisumu',
    town: 'Kisumu',
    addressLine: 'Integration Test Road',
    paymentMethod: 'cash_on_delivery',
    items: [{ productId: product.rows[0].id, quantity: 1, expectedPrice: 1 }],
  }
  try {
    const pending = await app.post('/api/orders/checkout')
      .set('x-checkout-key', crypto.randomUUID())
      .send(body)
    assert.equal(pending.status, 409)
    assert.match(pending.body.message, /Price to be confirmed/)

    await query(`UPDATE products SET price=575,price_confirmed=true,quantity=2,in_stock=true WHERE id=$1`,
      [product.rows[0].id])
    const approved = await app.post('/api/orders/checkout')
      .set('x-checkout-key', crypto.randomUUID())
      .send(body)
    assert.equal(approved.status, 201, approved.body.message)
    orderId = approved.body.data.id
    assert.equal(approved.body.data.items[0].price, 575)
    assert.equal(approved.body.data.subtotal, 575)
    const remaining = await query('SELECT quantity FROM products WHERE id=$1', [product.rows[0].id])
    assert.equal(remaining.rows[0].quantity, 1)
  } finally {
    if (orderId) await query('DELETE FROM orders WHERE id=$1', [orderId])
    await query('DELETE FROM products WHERE id=$1', [product.rows[0].id])
  }
})

integrationTest('imports validated catalogue rows idempotently without publishing pending prices', async () => {
  const sku = `TEST-IMPORT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const csv = [
    'sku,name,description,price,priceConfirmed,unit,sizeLabel,photos,category,species,preparation,quantity,active,inStock,featured,priceUpdatedAt',
    `${sku},CSV Test Fish,Test import,450,false,kg,,/images/products/pexels-tilapia.jpg,fresh-whole,Tilapia,Fresh,0,true,false,false,`,
  ].join('\n')
  const headers = { 'x-admin-key': process.env.ADMIN_DASHBOARD_KEY }
  try {
    const preview = await app.post('/api/products/import').set(headers).send({ csv, dryRun: true })
    assert.equal(preview.status, 200, preview.body.message)
    assert.equal(preview.body.data.accepted.length, 1)

    const imported = await app.post('/api/products/import').set(headers).send({ csv })
    assert.equal(imported.status, 201, imported.body.message)
    assert.equal(imported.body.data.accepted.length, 1)
    const repeated = await app.post('/api/products/import').set(headers).send({ csv })
    assert.equal(repeated.status, 201)
    assert.equal(repeated.body.data.accepted.length, 0)
    assert.match(repeated.body.data.rejected[0].reason, /already exists/)

    const stored = await query('SELECT id,price,price_confirmed,quantity FROM products WHERE sku=$1', [sku])
    assert.equal(stored.rowCount, 1)
    assert.equal(stored.rows[0].price, '450.00')
    assert.equal(stored.rows[0].price_confirmed, false)
    assert.equal(stored.rows[0].quantity, 0)
    const publicProduct = await app.get(`/api/products/${stored.rows[0].id}`)
    assert.equal(publicProduct.status, 200)
    assert.equal(publicProduct.body.data.price, null)
  } finally {
    await query('DELETE FROM products WHERE sku=$1', [sku])
  }
})

integrationTest('reports the deployed commit when available', async () => {
  const response = await app.get('/api/version')
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'success')
  assert.equal(response.body.commit, process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown')
})

integrationTest('admin product CRUD keeps pending prices private and records explicit price confirmation', async () => {
  const headers = { 'x-admin-key': process.env.ADMIN_DASHBOARD_KEY }
  const draft = {
    sku: `TEST-ADMIN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    name: 'Admin Catalogue Test',
    description: 'Integration test only',
    price: null,
    priceConfirmed: false,
    unit: 'kg',
    sizeLabel: 'Test size',
    photos: ['/images/products/fish%20fresh.jpg'],
    category: 'fresh-whole',
    species: 'Test species',
    preparation: 'Fresh',
    quantity: 4,
    active: true,
    inStock: true,
    featured: true,
  }
  const unsafePhoto = await app.post('/api/products').set(headers).send({ ...draft, photos: ['javascript:alert(1)'] })
  assert.equal(unsafePhoto.status, 400)
  const created = await app.post('/api/products').set(headers).send(draft)
  assert.equal(created.status, 201, created.body.message)
  adminProductId = created.body.data.id
  assert.equal(created.body.data.priceConfirmed, false)
  assert.equal(created.body.data.active, true)
  assert.equal(created.body.data.inStock, true)
  assert.equal(created.body.data.quantity, 4)
  assert.deepEqual(created.body.data.photos, ['/images/products/fish%20fresh.jpg'])
  const photoLessProduct = await app.post('/api/products').set(headers).send({
    ...draft,
    sku: `TEST-ADMIN-NO-PHOTO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    name: 'Admin Catalogue Product Without Photo',
    photos: [],
  })
  assert.equal(photoLessProduct.status, 201, photoLessProduct.body.message)
  photoLessAdminProductId = photoLessProduct.body.data.id
  assert.equal(photoLessProduct.body.data.image, '')
  assert.deepEqual(photoLessProduct.body.data.photos, [])
  const publicDrafts = await app.get('/api/products?limit=100')
  const publicDraft = publicDrafts.body.data.find((product) => product.id === adminProductId)
  assert.ok(publicDraft)
  assert.equal(publicDraft.price, null)

  const priceEntered = await app.put(`/api/products/${adminProductId}`).set(headers).send({
    ...draft,
    price: 700,
    priceConfirmed: false,
  })
  assert.equal(priceEntered.status, 200, priceEntered.body.message)
  assert.equal(priceEntered.body.data.price, 700)
  assert.equal(priceEntered.body.data.priceConfirmed, false)
  const confirmPrice = await app.post(`/api/products/${adminProductId}/confirm-price`).set(headers).send({})
  assert.equal(confirmPrice.status, 200, confirmPrice.body.message)
  const confirmed = confirmPrice
  assert.equal(confirmed.body.data.priceConfirmed, true)
  assert.equal(confirmed.body.data.active, true)
  assert.deepEqual(confirmed.body.data.photos, ['/images/products/fish%20fresh.jpg'])
  const priceHistory = await app.get(`/api/products/${adminProductId}/price-history`).set(headers)
  assert.equal(priceHistory.status, 200)
  assert.equal(priceHistory.body.data.length, 1)
  assert.equal(priceHistory.body.data[0].previousPrice, null)
  assert.equal(priceHistory.body.data[0].newPrice, 700)
  assert.equal(priceHistory.body.data[0].changedBy, 'admin')

  const bulkProduct = await app.post('/api/products').set(headers).send({
    ...draft,
    sku: `TEST-BULK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    name: 'Bulk Confirmation Test',
    price: 350,
    priceConfirmed: false,
    active: true,
  })
  assert.equal(bulkProduct.status, 201, bulkProduct.body.message)
  const bulkConfirmed = await app.post('/api/products/confirm-prices').set(headers).send({})
  assert.equal(bulkConfirmed.status, 200)
  assert.ok(bulkConfirmed.body.data.confirmed >= 1)
  const bulkHistory = await app.get(`/api/products/${bulkProduct.body.data.id}/price-history`).set(headers)
  assert.equal(bulkHistory.body.data.length, 1)
  await query('DELETE FROM product_price_history WHERE product_id=$1', [bulkProduct.body.data.id])
  await query('DELETE FROM products WHERE id=$1', [bulkProduct.body.data.id])

  const updated = await app.put(`/api/products/${adminProductId}`).set(headers).send({
    ...draft,
    price: 725,
    priceConfirmed: true,
  })
  assert.equal(updated.status, 200)
  const updatedHistory = await app.get(`/api/products/${adminProductId}/price-history`).set(headers)
  assert.deepEqual(updatedHistory.body.data.map((entry) => [entry.previousPrice, entry.newPrice]), [[700, 725], [null, 700]])

  const hidden = await app.delete(`/api/products/${adminProductId}`).set(headers)
  assert.equal(hidden.status, 200)
  assert.equal(hidden.body.data.active, false)
  assert.equal(hidden.body.data.inStock, false)
  const publicProducts = await app.get('/api/products?limit=100')
  assert.equal(publicProducts.body.data.some((product) => product.id === adminProductId), false)
})

integrationTest('admin manages confirmed delivery zones and public checks fail closed', async () => {
  const headers = { 'x-admin-key': process.env.ADMIN_DASHBOARD_KEY }
  const unauthenticated = await app.get('/api/delivery-zones')
  assert.equal(unauthenticated.status, 401)

  const covered = await app.get('/api/delivery-zones/check').query({ county: 'Kisumu', town: 'Kisumu' })
  assert.equal(covered.status, 200)
  assert.equal(covered.body.data.covered, true)
  assert.equal(covered.body.data.fee, 250)
  const uncovered = await app.get('/api/delivery-zones/check').query({ county: 'Unconfigured County', town: 'Nowhere' })
  assert.equal(uncovered.status, 200)
  assert.equal(uncovered.body.data.covered, false)
  const unconfiguredQuote = await app.post('/api/orders/quote').send({
    county: 'Unconfigured County',
    town: 'Nowhere',
    items: [{ productId: contractProductId, quantity: 1, expectedPrice: 710 }],
  })
  assert.equal(unconfiguredQuote.status, 422)

  const invalid = await app.post('/api/delivery-zones').set(headers).send({
    name: 'Invalid test zone',
    county: 'Test County',
    towns: ['Testville'],
    fee: 100,
    minimumOrder: 0,
    deliveryWindows: [],
    cutoffAt: null,
    priority: 0,
    active: true,
  })
  assert.equal(invalid.status, 400)

  const created = await app.post('/api/delivery-zones').set(headers).send({
    name: `Test zone test-${testRunId}`,
    county: 'Test County',
    towns: ['Testville'],
    fee: 0,
    minimumOrder: 900,
    deliveryWindows: ['09:00-12:00'],
    cutoffAt: '10:30',
    priority: 1,
    active: true,
  })
  assert.equal(created.status, 201, created.body.message)
  adminDeliveryZoneId = created.body.data.id
  assert.equal(created.body.data.minimumOrder, 900)
  const belowMinimum = await app.post('/api/orders/quote').send({
    county: 'Test County',
    town: 'Testville',
    items: [{ productId: contractProductId, quantity: 1, expectedPrice: 710 }],
  })
  assert.equal(belowMinimum.status, 400)
  const coverage = await app.get('/api/delivery-zones/check').query({ county: 'test county', town: 'TESTVILLE' })
  assert.equal(coverage.body.data.covered, true)
  assert.deepEqual(coverage.body.data.deliveryWindows, ['09:00-12:00'])

  const deactivated = await app.delete(`/api/delivery-zones/${adminDeliveryZoneId}`).set(headers)
  assert.equal(deactivated.status, 200)
  const afterDeactivation = await app.get('/api/delivery-zones/check').query({ county: 'Test County', town: 'Testville' })
  assert.equal(afterDeactivation.body.data.covered, false)
})

integrationTest('stores support requests with contact consent and records staff outcomes', async () => {
  const supportPhone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const missingConsent = await app.post('/api/support-requests').send({
    type: 'complaint',
    name: 'Support Test Customer',
    phone: supportPhone,
    message: 'A detailed test complaint message.',
  })
  assert.equal(missingConsent.status, 400)

  const submitted = await app.post('/api/support-requests').send({
    type: 'complaint',
    name: 'Support Test Customer',
    phone: supportPhone,
    email: `support-test-${testRunId}@example.com`,
    orderNumber: `TEST-${testRunId}-ORDER-1`,
    message: 'A detailed test complaint message.',
    contactConsent: true,
  })
  assert.equal(submitted.status, 201, submitted.body.message)
  supportRequestId = submitted.body.data.id
  assert.equal(submitted.body.data.requestType, 'complaint')
  assert.equal(submitted.body.data.status, 'new')

  const unauthorized = await app.get('/api/support-requests')
  assert.equal(unauthorized.status, 401)
  const headers = { 'x-admin-key': process.env.ADMIN_DASHBOARD_KEY }
  const inProgress = await app.patch(`/api/support-requests/${supportRequestId}`).set(headers).send({
    status: 'in_review',
    staffResponse: 'We are reviewing the request.',
    resolutionOutcome: '',
  })
  assert.equal(inProgress.status, 200, inProgress.body.message)
  const resolvedWithoutOutcome = await app.patch(`/api/support-requests/${supportRequestId}`).set(headers).send({
    status: 'resolved',
    staffResponse: 'Reviewed.',
    resolutionOutcome: '',
  })
  assert.equal(resolvedWithoutOutcome.status, 400)
  const resolved = await app.patch(`/api/support-requests/${supportRequestId}`).set(headers).send({
    status: 'resolved',
    staffResponse: 'The team reviewed the test request.',
    resolutionOutcome: 'Test resolution recorded.',
  })
  assert.equal(resolved.status, 200)
  assert.equal(resolved.body.data.status, 'resolved')
  const adminList = await app.get('/api/support-requests').set(headers)
  assert.equal(adminList.status, 200)
  assert.ok(adminList.body.data.some((entry) => entry.id === supportRequestId && entry.contactConsent))
})

integrationTest('keeps database health checks available beyond the general API rate limit', async () => {
  for (let requestCount = 0; requestCount <= 300; requestCount += 1) {
    const response = await app.get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.database, 'connected')
  }
  const readiness = await app.get('/api/readiness')
  assert.equal(readiness.status, 200)
  assert.equal(readiness.body.status, 'READY')
})

integrationTest('rejects customer session endpoints without a token', async () => {
  const me = await app.get('/api/auth/me')
  assert.equal(me.status, 401)
  const orders = await app.get('/api/orders/my-orders')
  assert.equal(orders.status, 401)
  const checkout = await app.post('/api/orders/checkout').send({ items: [] })
  assert.equal(checkout.status, 400)
})

integrationTest('rejects an invalid customer JWT', async () => {
  const response = await app.get('/api/auth/me').set('Authorization', 'Bearer invalid')
  assert.equal(response.status, 401)
})

integrationTest('revokes a customer session on logout and rejects it thereafter', async () => {
  const customer = await query(`INSERT INTO users (email,phone,customer_name,verified_phone)
    VALUES ($1,$2,'Logout Test Customer',true) RETURNING id,session_version`,
  [`logout-${crypto.randomBytes(4).toString('hex')}@example.com`, `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`])
  const token = jwt.sign({ sub: customer.rows[0].id, ver: customer.rows[0].session_version }, process.env.AUTH_SECRET, { expiresIn: '7d' })
  const logout = await app.post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
  assert.equal(logout.status, 200)
  const after = await app.get('/api/auth/me').set('Authorization', `Bearer ${token}`)
  assert.equal(after.status, 401)
  await query('DELETE FROM users WHERE id=$1', [customer.rows[0].id])
})

integrationTest('protects analytics with the admin key and validates date ranges', async () => {
  const unauthenticated = await app.get('/api/orders/analytics?from=2026-09-01&to=2026-09-30')
  assert.equal(unauthenticated.status, 401)
  const invalidRange = await app.get('/api/orders/analytics?from=2026-02-30&to=2026-03-01')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  assert.equal(invalidRange.status, 400)
  const valid = await app.get('/api/orders/analytics?from=2026-09-01&to=2026-09-30')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  assert.equal(valid.status, 200)
  assert.equal(valid.body.data.daily.length, 30)
  assert.equal(typeof valid.body.data.summary.paidRevenue, 'number')
  assert.equal('customer' in valid.body.data, false)
})

integrationTest('creates a guest pay-after-delivery order and protects its persistent tracking link', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'Guest Checkout Fish','Integration test product',700,'kg','fresh-whole','Tilapia','Fresh',3,true,true) RETURNING id`,
  [`TEST-GUEST-${crypto.randomBytes(3).toString('hex')}`])
  guestProductId = product.rows[0].id
  const body = {
    customerName: 'Guest Checkout Customer',
    email: '',
    phone: `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`,
    county: 'Kisumu',
    town: 'Kisumu',
    addressLine: 'Guest Test Road',
    landmark: 'Market',
    notes: 'Call on arrival',
    paymentMethod: 'mpesa_after_delivery',
    items: [{ productId: guestProductId, quantity: 1, expectedPrice: 700 }],
  }
  const key = crypto.randomUUID()
  const quote = await app.post('/api/orders/quote').send({ county: body.county, town: body.town, items: body.items })
  assert.equal(quote.status, 200)
  assert.deepEqual(quote.body.data, {
    items: [{ productId: guestProductId, quantity: 1, price: 700, lineTotal: 700 }],
    subtotal: 700,
    shippingFee: 250,
    totalPrice: 950,
    deliveryZone: {
      name: `Integration Kisumu test-${testRunId}`,
      minimumOrder: 0,
      deliveryWindows: ['09:00-17:00'],
      cutoffAt: null,
    },
  })

  const response = await app.post('/api/orders/checkout').set('x-checkout-key', key).send(body)
  assert.equal(response.status, 201, response.body.message)
  guestOrderId = response.body.data.id
  assert.equal(response.body.data.paymentMethod, 'mpesa_after_delivery')
  assert.equal(response.body.data.paymentStatus, 'pending')
  assert.equal(response.body.data.totalPrice, 950)
  assert.equal(response.body.data.items[0].quantity, 1)
  assert.equal(response.body.data.mpesa.checkoutRequestID, undefined)
  assert.equal(response.body.payment.trackingToken.length, 48)

  const privateRequest = await app.get(`/api/orders/${guestOrderId}`)
  assert.equal(privateRequest.status, 401)
  const tracking = await app.get(`/api/orders/${guestOrderId}`).set('x-order-token', response.body.payment.trackingToken)
  assert.equal(tracking.status, 200)
  assert.equal(tracking.body.data.customer.name, body.customerName)
  assert.equal(tracking.body.data.items[0].quantity, 1)

  const duplicate = await app.post('/api/orders/checkout').set('x-checkout-key', key).send(body)
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.body.data.id, guestOrderId)
  const unavailable = await app.post('/api/orders/checkout').set('x-checkout-key', crypto.randomUUID()).send({
    ...body,
    items: [{ ...body.items[0], quantity: 4 }],
  })
  assert.equal(unavailable.status, 409)
  const stock = await query('SELECT quantity FROM products WHERE id=$1', [guestProductId])
  assert.equal(stock.rows[0].quantity, 2)
})

integrationTest('supports delivery assignment, expiring location, cash receipts, and moderated reviews', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'Operations Test Fish','Integration test product',800,'kg','fresh-whole','Tilapia','Fresh',2,true,true) RETURNING id,sku`,
  [`TEST-OPS-${crypto.randomBytes(3).toString('hex')}`])
  operationsProductId = product.rows[0].id
  const body = {
    customerName: 'Operations Test Customer',
    email: '',
    phone: `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`,
    county: 'Kisumu',
    town: 'Kisumu',
    addressLine: 'Operations Test Road',
    paymentMethod: 'cash_on_delivery',
    items: [{ productId: operationsProductId, quantity: 1, expectedPrice: 800 }],
  }
  const checkout = await app.post('/api/orders/checkout')
    .set('x-checkout-key', crypto.randomUUID())
    .send(body)
  assert.equal(checkout.status, 201, checkout.body.message)
  operationsOrderId = checkout.body.data.id
  const trackingToken = checkout.body.payment.trackingToken

  const unauthenticated = await app.get('/api/orders/assigned')
  assert.equal(unauthenticated.status, 401)
  for (const status of ['confirmed', 'preparing']) {
    const response = await app.patch(`/api/orders/${operationsOrderId}/status`)
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
      .send({ status })
    assert.equal(response.status, 200, response.body.message)
  }
  const assigned = await app.post(`/api/orders/${operationsOrderId}/assign-delivery`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({})
  assert.equal(assigned.status, 200)
  assert.equal(assigned.body.data.assignedDeliveryPerson, process.env.DELIVERY_STAFF_ID)
  const dispatch = await app.patch(`/api/orders/${operationsOrderId}/status`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ status: 'out_for_delivery' })
  assert.equal(dispatch.status, 200)
  const dispatchedEvents = dispatch.body.data.history.map((event) => event.type)
  assert.ok(dispatchedEvents.includes('order_placed'))
  assert.ok(dispatchedEvents.includes('delivery_assigned'))
  assert.ok(dispatchedEvents.includes('status_changed'))
  const assignedOrders = await app.get('/api/orders/assigned').set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
  assert.equal(assignedOrders.status, 200)
  assert.ok(assignedOrders.body.data.some((order) => order.id === operationsOrderId))

  const invalidLocation = await app.post(`/api/orders/${operationsOrderId}/location`)
    .set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
    .send({ latitude: 100, longitude: 37 })
  assert.equal(invalidLocation.status, 400)
  const location = await app.post(`/api/orders/${operationsOrderId}/location`)
    .set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
    .send({ latitude: -1.2864, longitude: 36.8172 })
  assert.equal(location.status, 200)
  const tracking = await app.get(`/api/orders/${operationsOrderId}`).set('x-order-token', trackingToken)
  assert.equal(tracking.body.data.deliveryLocation.latitude, -1.2864)
  await query(`UPDATE orders SET delivery_location_expires_at=now()-interval '1 second' WHERE id=$1`, [operationsOrderId])
  const expiredLocation = await app.get(`/api/orders/${operationsOrderId}`).set('x-order-token', trackingToken)
  assert.equal(expiredLocation.body.data.deliveryLocation, null)

  const delivered = await app.patch(`/api/orders/${operationsOrderId}/delivery-status`)
    .set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
    .send({ status: 'delivered' })
  assert.equal(delivered.status, 200)
  assert.equal(delivered.body.data.status, 'delivered')
  assert.ok(delivered.body.data.timestamps.deliveredAt)
  const deliveredEvents = delivered.body.data.history.map((event) => event.type)
  assert.ok(deliveredEvents.includes('delivery_location_updated'))
  assert.ok(deliveredEvents.includes('status_changed'))
  const cash = await app.post(`/api/orders/${operationsOrderId}/payment/cash`)
    .set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
    .send({})
  assert.equal(cash.status, 200)
  assert.match(cash.body.data.receiptNumber, /^CASH-/)
  const paidOrder = await app.get(`/api/orders/${operationsOrderId}`).set('x-order-token', trackingToken)
  assert.ok(paidOrder.body.data.payments.some((payment) => payment.receiptNumber === cash.body.data.receiptNumber))
  assert.ok(paidOrder.body.data.history.some((event) => event.type === 'payment_received'))
  const review = await app.post('/api/orders/reviews')
    .set('x-order-token', trackingToken)
    .send({ orderId: operationsOrderId, productId: operationsProductId, rating: 5, body: 'Fresh and carefully packed.' })
  assert.equal(review.status, 201)
  assert.equal(review.body.data.status, 'pending')
  const duplicateReview = await app.post('/api/orders/reviews')
    .set('x-order-token', trackingToken)
    .send({ orderId: operationsOrderId, productId: operationsProductId, rating: 4, body: '' })
  assert.equal(duplicateReview.status, 409)
  const pending = await app.get('/api/orders/reviews/moderation').set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  assert.ok(pending.body.data.some((item) => item.id === review.body.data.id))
  const approved = await app.patch(`/api/orders/reviews/${review.body.data.id}`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ status: 'approved' })
  assert.equal(approved.status, 200)
  const publicReviews = await app.get('/api/orders/reviews').query({ productId: operationsProductId })
  assert.deepEqual(publicReviews.body.data.summary, { count: 1, average: 5 })
  const catalog = await app.get(`/api/products/${operationsProductId}`)
  assert.equal(catalog.body.data.rating.count, 1)
})

integrationTest('admin manages blocked phones and checkout enforces the block', async () => {
  const suffix = String(crypto.randomInt(0, 100000000)).padStart(8, '0')
  const phone = `07${suffix}`
  blockedPhoneForTest = `2547${suffix}`
  const product = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'Blocked Phone Test Fish','Integration test product',600,'kg','fresh-whole','Tilapia','Fresh',2,true,true)
    RETURNING id`, [`TEST-BLOCK-${crypto.randomBytes(3).toString('hex')}`])
  blockedProductId = product.rows[0].id

  const unauthenticated = await app.get('/api/orders/blocked-phones')
  assert.equal(unauthenticated.status, 401)
  const invalid = await app.post('/api/orders/blocked-phones')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ phone: 'not-a-phone', reason: 'Test' })
  assert.equal(invalid.status, 400)

  const created = await app.post('/api/orders/blocked-phones')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ phone, reason: 'Integration test' })
  assert.equal(created.status, 201)
  assert.equal(created.body.data.phone, blockedPhoneForTest)
  const updated = await app.post('/api/orders/blocked-phones')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ phone: `+${blockedPhoneForTest}`, reason: 'Updated integration test' })
  assert.equal(updated.status, 201)
  const listed = await app.get('/api/orders/blocked-phones')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  const match = listed.body.data.filter((entry) => entry.phone === blockedPhoneForTest)
  assert.equal(match.length, 1)
  assert.equal(match[0].reason, 'Updated integration test')

  const checkout = {
    customerName: 'Blocked Phone Test Customer',
    email: '',
    phone,
    county: 'Kisumu',
    town: 'Kisumu',
    addressLine: 'Blocked Test Road',
    paymentMethod: 'cash_on_delivery',
    items: [{ productId: blockedProductId, quantity: 1, expectedPrice: 600 }],
  }
  const denied = await app.post('/api/orders/checkout')
    .set('x-checkout-key', crypto.randomUUID())
    .send(checkout)
  assert.equal(denied.status, 403)
  let stock = await query('SELECT quantity FROM products WHERE id=$1', [blockedProductId])
  assert.equal(stock.rows[0].quantity, 2)

  const removed = await app.delete(`/api/orders/blocked-phones/${blockedPhoneForTest}`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
  assert.equal(removed.status, 200)
  const allowed = await app.post('/api/orders/checkout')
    .set('x-checkout-key', crypto.randomUUID())
    .send(checkout)
  assert.equal(allowed.status, 201, allowed.body.message)
  blockedOrderId = allowed.body.data.id
  stock = await query('SELECT quantity FROM products WHERE id=$1', [blockedProductId])
  assert.equal(stock.rows[0].quantity, 1)
})

integrationTest('does not allow signup to reuse an existing account email or phone', async () => {
  const email = `pending-${crypto.randomBytes(4).toString('hex')}@example.com`
  const phoneNumber = crypto.randomInt(0, 100000000)
  const phone = `+2547${String(phoneNumber).padStart(8, '0')}`
  const otherPhone = `+2547${String((phoneNumber + 1) % 100000000).padStart(8, '0')}`
  const inserted = await query(`INSERT INTO users (customer_name,email,phone)
    VALUES ('Pending Customer',$1,$2) RETURNING id`, [email, phone])
  signupUserId = inserted.rows[0].id

  const response = await app.post('/api/auth/signup').send({
    customerName: 'Different Person',
    email,
    phone: otherPhone,
    password: 'valid-test-password',
  })
  assert.equal(response.status, 409)
  const persisted = await query('SELECT email,phone FROM users WHERE id=$1', [signupUserId])
  assert.equal(persisted.rows[0].email, email)
  assert.equal(persisted.rows[0].phone, phone)
})

integrationTest('creates and authenticates password accounts, rejects bad credentials, and revokes sessions', async () => {
  const email = `auth-flow-${crypto.randomBytes(4).toString('hex')}@example.com`
  const phone = `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const password = 'correct-horse-battery'
  const missingFields = await app.post('/api/auth/signup').send({ email, phone })
  assert.equal(missingFields.status, 400)
  const weakPassword = await app.post('/api/auth/signup').send({
    customerName: 'Auth Flow Customer', email, phone, password: 'short',
  })
  assert.equal(weakPassword.status, 400)

  const signup = await app.post('/api/auth/signup').send({
    customerName: 'Auth Flow Customer',
    email,
    phone,
    password,
    county: 'Kisumu',
    town: 'Kisumu',
    addressLine: 'Integration Test Road',
  })
  assert.equal(signup.status, 201, signup.body.message)
  assert.equal(signup.body.data.token, undefined)
  const signupCookie = sessionCookieFrom(signup)
  assert.ok(signupCookie)
  const signupCookieHeader = signup.headers['set-cookie'].find((cookie) => cookie.startsWith('vff_customer_session='))
  assert.match(signupCookieHeader, /HttpOnly/)
  assert.match(signupCookieHeader, /Max-Age=604800/)
  assert.match(signupCookieHeader, /SameSite=Lax/)
  const signupToken = signupCookie.slice('vff_customer_session='.length)
  const signupClaims = jwt.decode(signupToken)
  assert.equal(signupClaims.exp - signupClaims.iat, 7 * 24 * 60 * 60)
  const oldLifetimeToken = jwt.sign(
    { sub: signup.body.data.user.id, ver: 1 },
    process.env.AUTH_SECRET,
    { expiresIn: '30d' },
  )
  const oldLifetimeSession = await app.get('/api/auth/me').set('Cookie', cookieForToken(oldLifetimeToken))
  assert.equal(oldLifetimeSession.status, 401)
  authFlowUserId = signup.body.data.user.id
  const passwordRecord = await query('SELECT password_hash FROM users WHERE id=$1', [authFlowUserId])
  assert.match(passwordRecord.rows[0].password_hash, /^\$2[aby]\$/)
  assert.notEqual(passwordRecord.rows[0].password_hash, password)
  const signupSession = await app.get('/api/auth/me').set('Cookie', signupCookie)
    .set('Authorization', `Bearer ${signup.body.data.token}`)
  assert.equal(signupSession.status, 200)

  const duplicateEmail = await app.post('/api/auth/signup').send({
    customerName: 'Duplicate Email Customer',
    email,
    phone: `+2547${String((Number(phone.slice(-8)) + 1) % 100000000).padStart(8, '0')}`,
    password,
  })
  assert.equal(duplicateEmail.status, 409)
  const duplicatePhone = await app.post('/api/auth/signup').send({
    customerName: 'Duplicate Phone Customer',
    email: `duplicate-${crypto.randomBytes(4).toString('hex')}@example.com`,
    phone,
    password,
  })
  assert.equal(duplicatePhone.status, 409)

  const wrongPassword = await app.post('/api/auth/login').send({ email, password: 'wrong-password' })
  assert.equal(wrongPassword.status, 401)
  const missingLoginFields = await app.post('/api/auth/login').send({})
  assert.equal(missingLoginFields.status, 400)
  const login = await app.post('/api/auth/login').send({ phone, password })
  assert.equal(login.status, 200, login.body.message)
  assert.equal(login.body.data.token, undefined)
  const loginCookie = sessionCookieFrom(login)
  assert.ok(loginCookie)
  const emailLogin = await app.post('/api/auth/login').send({ email, password })
  assert.equal(emailLogin.status, 200, emailLogin.body.message)

  const session = await app.get('/api/auth/me').set('Cookie', loginCookie)
  assert.equal(session.status, 200)
  assert.equal(session.body.data.user.email, email)
  const csrfRejectedLogout = await app.post('/api/auth/logout').set('Cookie', loginCookie).send({})
  assert.equal(csrfRejectedLogout.status, 403)
  const logout = await app.post('/api/auth/logout')
    .set('Cookie', loginCookie)
    .set('x-vff-csrf', '1')
    .send({})
  assert.equal(logout.status, 200)
  assert.match(logout.headers['set-cookie'].find((cookie) => cookie.startsWith('vff_customer_session=')), /Expires=Thu, 01 Jan 1970/)
  const endedSession = await app.get('/api/auth/me').set('Cookie', loginCookie)
  assert.equal(endedSession.status, 401)

  const originalNodeEnv = config.nodeEnv
  try {
    config.nodeEnv = 'production'
    const sameOriginLogin = await app.post('/api/auth/login')
      .set('Origin', 'https://nyakundi-victoriafresh.vercel.app')
      .set('X-Forwarded-Host', 'nyakundi-victoriafresh.vercel.app')
      .set('X-Forwarded-Proto', 'https')
      .send({ email, password })
    assert.equal(sameOriginLogin.status, 200)
    const sameOriginCookie = sameOriginLogin.headers['set-cookie']
      .find((cookie) => cookie.startsWith('vff_customer_session='))
    assert.match(sameOriginCookie, /HttpOnly/)
    assert.match(sameOriginCookie, /Secure/)
    assert.match(sameOriginCookie, /SameSite=Lax/)

    const crossOriginLogin = await app.post('/api/auth/login')
      .set('Origin', 'https://nyakundi-victoriafresh.vercel.app')
      .set('X-Forwarded-Host', 'nyakundi-victoriafresh-2.onrender.com')
      .set('X-Forwarded-Proto', 'https')
      .send({ email, password })
    assert.equal(crossOriginLogin.status, 200)
    const crossOriginCookie = crossOriginLogin.headers['set-cookie']
      .find((cookie) => cookie.startsWith('vff_customer_session='))
    assert.match(crossOriginCookie, /HttpOnly/)
    assert.match(crossOriginCookie, /Secure/)
    assert.match(crossOriginCookie, /SameSite=None/)
  } finally {
    config.nodeEnv = originalNodeEnv
  }

})

integrationTest('allows admin-only temporary password setup for legacy accounts and revokes sessions', async () => {
  const email = `password-reset-${crypto.randomBytes(4).toString('hex')}@example.com`
  const phone = `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const inserted = await query(`INSERT INTO users (customer_name,email,phone,session_version)
    VALUES ('Legacy Customer',$1,$2,1) RETURNING id`, [email, phone])
  passwordResetUserId = inserted.rows[0].id
  const oldToken = jwt.sign({ sub: passwordResetUserId, phone, ver: 1 }, process.env.AUTH_SECRET, { expiresIn: '1h' })

  const denied = await app.post('/api/auth/admin/set-password')
    .set('x-admin-key', 'wrong-admin-key')
    .send({ identifier: email, temporaryPassword: 'Temporary-password-123' })
  assert.equal(denied.status, 401)
  const shortPassword = await app.post('/api/auth/admin/set-password')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ identifier: email, temporaryPassword: 'short' })
  assert.equal(shortPassword.status, 400)
  const setPassword = await app.post('/api/auth/admin/set-password')
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ identifier: email, temporaryPassword: 'Temporary-password-123' })
  assert.equal(setPassword.status, 200, setPassword.body.message)
  const staleSession = await app.get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`)
  assert.equal(staleSession.status, 401)
  const login = await app.post('/api/auth/login')
    .send({ email, password: 'Temporary-password-123' })
  assert.equal(login.status, 200, login.body.message)
})

integrationTest('confirms a matching M-Pesa callback once and treats replay as harmless', async () => {
  const checkoutRequestID = `ws_CO_TEST_${testRunId}_${crypto.randomBytes(4).toString('hex')}`
  const receiptNumber = `TEST${crypto.randomBytes(5).toString('hex').toUpperCase()}`
  const phoneNumber = 254700000000 + crypto.randomInt(0, 100000000)
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status,mpesa)
    VALUES ($1,$2,true,now()+interval '15 minutes',$3,$4,1250,250,1500,'initiated',$5) RETURNING id`,
  [`TEST-${testRunId}-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Integration Customer', email: `integration-${testRunId}@example.com`, phone: String(phoneNumber) }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' }), JSON.stringify({ phone: String(phoneNumber), checkoutRequestID })])
  orderId = order.rows[0].id
  const callback = { Body: { stkCallback: { CheckoutRequestID: checkoutRequestID, ResultCode: 0, ResultDesc: 'Processed', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }, { Name: 'MpesaReceiptNumber', Value: receiptNumber }, { Name: 'PhoneNumber', Value: phoneNumber }, { Name: 'TransactionDate', Value: 20260907123000 }] } } } }
  const response = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(response.status, 200)
  const paid = await fetchOrder(orderId)
  assert.equal(paid.paymentStatus, 'paid')
  assert.equal(paid.status, 'confirmed')
  const cancelPaid = await app.patch(`/api/orders/${orderId}/status`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ status: 'cancelled' })
  assert.equal(cancelPaid.status, 409)
  const replay = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(replay.status, 200)
  assert.match(replay.body.ResultDesc, /already processed/i)
})

integrationTest('recovers a late successful payment after its reservation was released for review', async () => {
  const checkoutRequestID = `ws_CO_LATE_${testRunId}_${crypto.randomBytes(4).toString('hex')}`
  const receiptNumber = `LATE${crypto.randomBytes(5).toString('hex').toUpperCase()}`
  const phoneNumber = 254700000000 + crypto.randomInt(0, 100000000)
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status,mpesa)
    VALUES ($1,$2,false,NULL,$3,$4,1250,250,1500,'failed',$5) RETURNING id`,
  [`TEST-${testRunId}-LATE-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Late Payment Customer', email: `late-${testRunId}@example.com`, phone: String(phoneNumber) }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' }), JSON.stringify({ phone: String(phoneNumber), checkoutRequestID })])
  latePaymentOrderId = order.rows[0].id
  const callback = { Body: { stkCallback: { CheckoutRequestID: checkoutRequestID, ResultCode: 0, ResultDesc: 'Processed', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }, { Name: 'MpesaReceiptNumber', Value: receiptNumber }, { Name: 'PhoneNumber', Value: phoneNumber }, { Name: 'TransactionDate', Value: 20260907123000 }] } } } }
  const response = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(response.status, 200)
  const paid = await fetchOrder(latePaymentOrderId)
  assert.equal(paid.paymentStatus, 'paid')
  assert.equal(paid.status, 'awaiting_payment')
  assert.equal(paid.mpesa.paymentReviewRequired, true)
})

integrationTest('accepts a verified post-delivery M-Pesa payment without reopening fulfilment', async () => {
  const checkoutRequestID = `ws_CO_POST_${crypto.randomBytes(4).toString('hex')}`
  const receiptNumber = `POST${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,customer,delivery,subtotal,shipping_fee,total_price,
     status,payment_method,payment_status,mpesa)
    VALUES ($1,$2,false,$3,$4,1250,250,1500,'delivered','mpesa_after_delivery','initiated',$5) RETURNING id`,
  [`TEST-POST-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'),
    JSON.stringify({ name: 'Post Delivery Customer', email: 'post@example.com', phone: '254712345678' }),
    JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' }),
    JSON.stringify({ phone: '254712345678', checkoutRequestID })])
  postDeliveryPaymentOrderId = order.rows[0].id
  await query(`INSERT INTO payments (order_id,method,amount,status,provider_request_id,phone)
    VALUES ($1,'mpesa',1500,'initiated',$2,'254712345678')`, [postDeliveryPaymentOrderId, checkoutRequestID])
  const callback = { Body: { stkCallback: { CheckoutRequestID: checkoutRequestID, ResultCode: 0, ResultDesc: 'Processed', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }, { Name: 'MpesaReceiptNumber', Value: receiptNumber }, { Name: 'PhoneNumber', Value: 254712345678 }, { Name: 'TransactionDate', Value: 20261014080000 }] } } } }
  const response = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(response.status, 200)
  const paid = await fetchOrder(postDeliveryPaymentOrderId)
  assert.equal(paid.paymentStatus, 'paid')
  assert.equal(paid.status, 'delivered')
  assert.equal(paid.mpesa.paymentReviewRequired, undefined)
  assert.equal(paid.payments[0].receiptNumber, receiptNumber)
})

integrationTest('ignores client-submitted checkout prices and deduplicates concurrent checkout attempts', async () => {
  const customer = await query(`INSERT INTO users (email,phone,customer_name,verified_phone)
    VALUES ($1,$2,'Checkout Test Customer',true) RETURNING id,session_version,email,phone`,
  [`checkout-${crypto.randomBytes(4).toString('hex')}@example.com`, `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`])
  checkoutUserId = customer.rows[0].id
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'Checkout Test Fish','Integration test product',500,'kg','fresh-whole','Tilapia','Fresh',5,true,true) RETURNING id`,
  [`TEST-CHECKOUT-${crypto.randomBytes(3).toString('hex')}`])
  checkoutProductId = product.rows[0].id
  const token = jwt.sign({ sub: checkoutUserId, ver: customer.rows[0].session_version }, process.env.AUTH_SECRET, { expiresIn: '7d' })
  const body = { customerName: 'Checkout Test Customer', email: customer.rows[0].email, phone: customer.rows[0].phone, county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street', items: [{ productId: checkoutProductId, quantity: 1, expectedPrice: 500 }] }
  const tampered = await app.post('/api/orders/checkout')
    .set('Authorization', `Bearer ${token}`)
    .set('x-checkout-key', crypto.randomUUID())
    .send({ ...body, items: [{ ...body.items[0], expectedPrice: 499 }] })
  assert.equal(tampered.status, 201, tampered.body.message)
  assert.equal(tampered.body.data.items[0].price, 500)
  const stockAfterTampered = await query('SELECT quantity FROM products WHERE id=$1', [checkoutProductId])
  assert.equal(stockAfterTampered.rows[0].quantity, 4)

  const key = crypto.randomUUID()
  const submit = () => app.post('/api/orders/checkout').set('Authorization', `Bearer ${token}`).set('x-checkout-key', key).send(body)
  const responses = await Promise.all([submit(), submit()])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201])
  assert.equal(responses[0].body.data.id, responses[1].body.data.id)
  const recovered = await app.post('/api/orders/checkout')
    .set('Authorization', `Bearer ${token}`)
    .set('x-checkout-key', key)
    .send({ ...body, addressLine: 'A newer cart address' })
  assert.equal(recovered.status, 409)
  const count = await query('SELECT count(*)::int AS total FROM orders WHERE checkout_key=$1', [key])
  assert.equal(count.rows[0].total, 1)

  await query('UPDATE products SET quantity=1 WHERE id=$1', [checkoutProductId])
  const racePhone = `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const raceBody = { ...body, phone: racePhone }
  const raceSubmit = (attemptKey) => app.post('/api/orders/checkout')
    .set('Authorization', `Bearer ${token}`)
    .set('x-checkout-key', attemptKey)
    .send(raceBody)
  const raceResponses = await Promise.all([raceSubmit(crypto.randomUUID()), raceSubmit(crypto.randomUUID())])
  assert.deepEqual(raceResponses.map((response) => response.status).sort(), [201, 409])
  const remainingStock = await query('SELECT quantity FROM products WHERE id=$1', [checkoutProductId])
  assert.equal(remainingStock.rows[0].quantity, 0)
})

integrationTest('releases expired inventory reservations in PostgreSQL', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'Expiry Test Fish','Integration test product',500,'kg','fresh-whole','Tilapia','Fresh',0,true,true) RETURNING id,sku`,
  [`TEST-EXPIRY-${crypto.randomBytes(3).toString('hex')}`])
  productId = product.rows[0].id
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status)
    VALUES ($1,$2,true,now()-interval '1 second',$3,$4,500,250,750,'pending') RETURNING id`,
  [`TEST-EXP-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Expiry Customer', email: 'expiry@example.com', phone: '0712345678' }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' })])
  expiredInventoryOrderId = order.rows[0].id
  await query(`INSERT INTO order_items (order_id,product_id,sku,name,unit,price,quantity,line_total) VALUES ($1,$2,$3,'Expiry Test Fish','kg',500,1,500)`, [order.rows[0].id, productId, product.rows[0].sku])
  await releaseExpiredInventory()
  const releasedProduct = await query('SELECT quantity FROM products WHERE id=$1', [productId])
  const releasedOrder = await fetchOrder(order.rows[0].id)
  assert.equal(releasedProduct.rows[0].quantity, 1)
  assert.equal(releasedOrder.inventoryReserved, false)
  assert.equal(releasedOrder.paymentStatus, 'failed')
})

integrationTest('allows guest checkout without account verification for both delivery payment methods', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock,price_confirmed)
    VALUES ($1,'No Verification Guest Fish','Integration test product',700,'kg','fresh-whole','Tilapia','Fresh',3,true,true) RETURNING id`,
  [`TEST-GUEST-AUTHLESS-${crypto.randomBytes(3).toString('hex')}`])
  const ids = []
  try {
    for (const paymentMethod of ['cash_on_delivery', 'mpesa_after_delivery']) {
      const body = {
        customerName: 'No Verification Guest',
        phone: `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`,
        county: 'Kisumu',
        town: 'Kisumu',
        addressLine: 'Required Guest Delivery Road',
        paymentMethod,
        items: [{ productId: product.rows[0].id, quantity: 1 }],
      }
      const response = await app.post('/api/orders/checkout')
        .set('x-checkout-key', crypto.randomUUID())
        .send(body)
      assert.equal(response.status, 201, response.body.message)
      ids.push(response.body.data.id)
      assert.equal(response.body.data.paymentMethod, paymentMethod)
      assert.equal(response.body.data.paymentStatus, 'pending')
      assert.equal(response.body.payment.trackingToken.length, 48)
    }
  } finally {
    if (ids.length) await query('DELETE FROM orders WHERE id=ANY($1::uuid[])', [ids])
    await query('DELETE FROM products WHERE id=$1', [product.rows[0].id])
  }
})

integrationTest('rejects invalid guest phones and missing delivery addresses', async () => {
  const invalidPhone = await app.post('/api/orders/checkout')
    .set('x-checkout-key', crypto.randomUUID())
    .send({ customerName: 'Invalid Phone Customer', phone: 'not-a-kenyan-number', county: 'Kisumu', town: 'Kisumu', addressLine: 'Road' })
  assert.equal(invalidPhone.status, 400)
  assert.match(invalidPhone.body.message, /Kenyan mobile number/)

  const missingAddress = await app.post('/api/orders/checkout')
    .set('x-checkout-key', crypto.randomUUID())
    .send({ customerName: 'Missing Address Customer', phone: '0712345678', county: 'Kisumu', town: 'Kisumu', addressLine: '  ' })
  assert.equal(missingAddress.status, 400)
  assert.match(missingAddress.body.message, /Delivery address/)
})

integrationTest('rate-limits order creation by phone and IP', async () => {
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const phoneAttempts = await Promise.all(Array.from({ length: 6 }, () => app.post('/api/orders/checkout')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ phone })))
  assert.deepEqual(phoneAttempts.map((response) => response.status), [400, 400, 400, 400, 400, 429])
  assert.match(phoneAttempts[5].body.message, /phone number/)

  const networkAttempts = await Promise.all(Array.from({ length: 40 }, (_, index) => {
    const generated = String((crypto.randomInt(0, 100000000) + index) % 100000000).padStart(8, '0')
    return app.post('/api/orders/checkout')
      .set('X-Forwarded-For', '203.0.113.11')
      .send({ phone: `07${generated}` })
  }))
  assert.ok(networkAttempts.some((response) => response.status === 429
    && /network/.test(response.body.message)), 'Requests from one IP must be rate-limited.')
})

integrationTest('isolates checkout IP limits across Vercel clients and ignores spoofed extra XFF entries', async () => {
  const clientA = `198.18.${crypto.randomInt(0, 256)}.${crypto.randomInt(1, 255)}`
  let clientB = `198.18.${crypto.randomInt(0, 256)}.${crypto.randomInt(1, 255)}`
  while (clientB === clientA) {
    clientB = `198.18.${crypto.randomInt(0, 256)}.${crypto.randomInt(1, 255)}`
  }
  const vercelHop = '203.0.113.254'
  const attempt = (forwardedFor) => app.post('/api/orders/checkout')
    .set('X-Forwarded-For', forwardedFor)
    .send({})

  const clientAAttempts = await Promise.all(Array.from({ length: 30 }, () => attempt(`${clientA}, ${vercelHop}`)))
  assert.ok(clientAAttempts.every((response) => response.status === 400))
  const limitedClientA = await attempt(`${clientA}, ${vercelHop}`)
  assert.equal(limitedClientA.status, 429)
  assert.match(limitedClientA.body.message, /network/)

  const clientBResponse = await attempt(`${clientB}, ${vercelHop}`)
  assert.equal(clientBResponse.status, 400)
  const spoofedClientA = await attempt(`192.0.2.123, ${clientA}, ${vercelHop}`)
  assert.equal(spoofedClientA.status, 429)
  assert.match(spoofedClientA.body.message, /network/)
})

integrationTest('seeds public FAQs idempotently without seeding customer reviews', async () => {
  const before = await query(`SELECT
    (SELECT count(*)::int FROM product_reviews) AS products,
    (SELECT count(*)::int FROM service_feedback) AS service`)
  const response = await app.get('/api/faqs')
  assert.equal(response.status, 200)
  assert.ok(response.body.data.length >= 20)
  assert.ok(response.body.data.some((faq) => /guest checkout/i.test(`${faq.question} ${faq.answer}`)))
  assert.ok(response.body.data.some((faq) => /payment/i.test(faq.question)))
  await seedFaqs()
  const after = await query(`SELECT
    (SELECT count(*)::int FROM product_reviews) AS products,
    (SELECT count(*)::int FROM service_feedback) AS service`)
  assert.deepEqual(after.rows[0], before.rows[0])
})

integrationTest('protects FAQ administration and supports create, edit, reorder, and hide', async () => {
  const noKey = await app.get('/api/faqs/admin')
  assert.equal(noKey.status, 401)
  let faqId
  try {
    const created = await app.post('/api/faqs/admin').set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
      .send({ category: `test-${crypto.randomBytes(3).toString('hex')}`, question: 'Test feedback FAQ?', answer: 'Test answer.', sortOrder: 99 })
    assert.equal(created.status, 201, created.body.message)
    faqId = created.body.data.id
    const updated = await app.patch(`/api/faqs/admin/${faqId}`)
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
      .send({ answer: 'Updated test answer.', sortOrder: 3 })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.answer, 'Updated test answer.')
    assert.equal(updated.body.data.sortOrder, 3)
    const hidden = await app.delete(`/api/faqs/admin/${faqId}`).set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    assert.equal(hidden.status, 200)
    const visible = await app.get('/api/faqs')
    assert.equal(visible.body.data.some((faq) => faq.id === faqId), false)
  } finally {
    if (faqId) await query('DELETE FROM faqs WHERE id=$1', [faqId])
  }
})

integrationTest('holds public product reviews pending, strips HTML, and exposes only approved ratings', async () => {
  const product = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,'Review API Test Tilapia','Test-only product',500,'kg','fresh-whole','Tilapia','Fresh',1,true,true,true)
    RETURNING id`, [`TEST-REVIEW-${crypto.randomBytes(4).toString('hex')}`])
  const productId = product.rows[0].id
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  try {
    const invalidRating = await app.post('/api/reviews/products').send({
      productId, customerName: 'Review Test Customer', phone, rating: 6, title: 'Test', comment: 'Test comment',
    })
    assert.equal(invalidRating.status, 400)

    const submitted = await app.post('/api/reviews/products').send({
      productId,
      customerName: 'Review Test Customer',
      phone,
      rating: 4,
      title: 'A <b>helpful</b> title',
      comment: 'Fresh <b>and</b> useful <script>alert(1)</script> feedback.',
      verifiedPurchase: true,
    })
    assert.equal(submitted.status, 201, submitted.body.message)
    assert.equal(submitted.body.data.status, 'pending')
    assert.equal(submitted.body.data.verifiedPurchase, false)
    const hidden = await app.get(`/api/reviews/products/${productId}`)
    assert.equal(hidden.body.data.reviews.length, 0)
    assert.equal(hidden.body.data.summary.count, 0)
    const duplicateReview = await app.post('/api/reviews/products').send({
      productId, customerName: 'Review Test Customer', phone, rating: 4,
      title: 'Duplicate', comment: 'Should be blocked.',
    })
    assert.equal(duplicateReview.status, 409)
    const secondPhone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
    const secondReview = await app.post('/api/reviews/products').send({
      productId, customerName: 'Second Review Customer', phone: secondPhone,
      rating: 2, title: 'Second test review', comment: 'Another real test fixture.',
    })
    assert.equal(secondReview.status, 201, secondReview.body.message)

    const unauthenticatedModeration = await app.patch(`/api/reviews/admin/products/${submitted.body.data.id}`)
      .send({ status: 'approved' })
    assert.equal(unauthenticatedModeration.status, 401)
    const unauthenticatedReply = await app.patch(`/api/reviews/admin/products/${submitted.body.data.id}`)
      .send({ adminReply: 'Unauthorized reply.' })
    assert.equal(unauthenticatedReply.status, 401)
    const unauthenticatedReject = await app.patch(`/api/reviews/admin/products/${secondReview.body.data.id}`)
      .send({ status: 'rejected' })
    assert.equal(unauthenticatedReject.status, 401)
    const adminList = await app.get('/api/reviews/admin?type=products&status=pending')
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    assert.ok(adminList.body.data.some((review) => review.id === submitted.body.data.id))
    const approved = await app.patch(`/api/reviews/admin/products/${submitted.body.data.id}`)
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
      .send({ status: 'approved', adminReply: 'Thank you for your feedback.' })
    assert.equal(approved.status, 200)
    const secondApproval = await app.patch(`/api/reviews/admin/products/${secondReview.body.data.id}`)
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
      .send({ status: 'approved' })
    assert.equal(secondApproval.status, 200)
    const visible = await app.get(`/api/reviews/products/${productId}`)
    assert.equal(visible.body.data.reviews.length, 2)
    const firstReview = visible.body.data.reviews.find((review) => review.id === submitted.body.data.id)
    assert.equal(firstReview.title, 'A helpful title')
    assert.equal(firstReview.comment, 'Fresh and useful feedback.')
    assert.equal(firstReview.verifiedPurchase, false)
    assert.equal(visible.body.data.summary.average, 3)
    assert.equal(visible.body.data.summary.count, 2)
    assert.equal(visible.body.data.summary.twoStar, 1)
    assert.equal(visible.body.data.summary.fourStar, 1)
    assert.equal(firstReview.adminReply, 'Thank you for your feedback.')
    const csv = await app.get('/api/reviews/admin/export.csv').set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    assert.equal(csv.status, 200)
    assert.match(csv.text, /Review Test Customer/)
  } finally {
    await query('DELETE FROM product_reviews WHERE product_id=$1', [productId])
    await query('DELETE FROM products WHERE id=$1', [productId])
  }
})

integrationTest('marks a product review verified only for an order that contains it and is delivered', async () => {
  const product = await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,'Verified Review Test Fish','Test-only product',450,'kg','fresh-whole','Tilapia','Fresh',0,true,false,true)
    RETURNING id,sku`, [`TEST-VERIFIED-REVIEW-${crypto.randomBytes(3).toString('hex')}`])
  const productId = product.rows[0].id
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const pendingToken = crypto.randomBytes(24).toString('hex')
  const pendingOrder = await query(`INSERT INTO orders
    (order_number,tracking_token,customer,delivery,subtotal,shipping_fee,total_price,status,payment_method,payment_status)
    VALUES ($1,$2,$3,$4,450,0,450,'preparing','cash_on_delivery','pending') RETURNING id`,
  [`TEST-PENDING-VERIFIED-${crypto.randomBytes(3).toString('hex')}`, pendingToken,
    JSON.stringify({ name: 'Verified Review Customer', phone }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Road' })])
  const trackingToken = crypto.randomBytes(24).toString('hex')
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,customer,delivery,subtotal,shipping_fee,total_price,status,payment_method,payment_status)
    VALUES ($1,$2,$3,$4,450,0,450,'delivered','cash_on_delivery','paid') RETURNING id`,
  [`TEST-VERIFIED-REVIEW-${crypto.randomBytes(3).toString('hex')}`, trackingToken,
    JSON.stringify({ name: 'Verified Review Customer', phone }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Road' })])
  try {
    await query(`INSERT INTO order_items(order_id,product_id,sku,name,unit,price,quantity,line_total)
      VALUES ($1,$2,$3,'Verified Review Test Fish','kg',450,1,450)`, [pendingOrder.rows[0].id, productId, product.rows[0].sku])
    const notDelivered = await app.post('/api/reviews/products').set('x-order-token', pendingToken).send({
      productId, orderId: pendingOrder.rows[0].id, customerName: 'Verified Review Customer', phone, rating: 5, title: 'Good', comment: 'Too early.',
    })
    assert.equal(notDelivered.status, 409)
    await query(`INSERT INTO order_items(order_id,product_id,sku,name,unit,price,quantity,line_total)
      VALUES ($1,$2,$3,'Verified Review Test Fish','kg',450,1,450)`, [order.rows[0].id, productId, product.rows[0].sku])
    const wrongOrder = await app.post('/api/reviews/products').set('x-order-token', 'not-the-token').send({
      productId, orderId: order.rows[0].id, customerName: 'Verified Review Customer', phone, rating: 5, title: 'Good', comment: 'Test review',
    })
    assert.equal(wrongOrder.status, 401)
    const statusResponse = await app.get(`/api/reviews/products/${productId}/orders/${order.rows[0].id}`)
      .set('x-order-token', trackingToken)
    assert.equal(statusResponse.status, 200)
    assert.deepEqual(statusResponse.body.data, { delivered: true, purchased: true, submitted: false })
    const submitted = await app.post('/api/reviews/products').set('x-order-token', trackingToken).send({
      productId, orderId: order.rows[0].id, customerName: 'Verified Review Customer', phone, rating: 5, title: 'Good', comment: 'Test review',
    })
    assert.equal(submitted.status, 201, submitted.body.message)
    assert.equal(submitted.body.data.verifiedPurchase, true)
    const submittedStatus = await app.get(`/api/reviews/products/${productId}/orders/${order.rows[0].id}`)
      .set('x-order-token', trackingToken)
    assert.equal(submittedStatus.body.data.submitted, true)
  } finally {
    await query('DELETE FROM product_reviews WHERE product_id=$1', [productId])
    await query('DELETE FROM orders WHERE id=$1', [pendingOrder.rows[0].id])
    await query('DELETE FROM orders WHERE id=$1', [order.rows[0].id])
    await query('DELETE FROM products WHERE id=$1', [productId])
  }
})

integrationTest('requires delivered orders for service feedback and rejects duplicates', async () => {
  const pendingToken = crypto.randomBytes(24).toString('hex')
  const pendingPhone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const pendingOrder = await query(`INSERT INTO orders
    (order_number,tracking_token,customer,delivery,subtotal,shipping_fee,total_price,status,payment_method,payment_status)
    VALUES ($1,$2,$3,$4,0,0,0,'preparing','cash_on_delivery','pending') RETURNING id`,
  [`TEST-PENDING-FEEDBACK-${crypto.randomBytes(3).toString('hex')}`, pendingToken,
    JSON.stringify({ name: 'Pending Feedback Customer', phone: pendingPhone }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Road' })])
  try {
    const notDelivered = await app.post('/api/reviews/service').set('x-order-token', pendingToken).send({
      orderId: pendingOrder.rows[0].id, customerName: 'Pending Feedback Customer', phone: pendingPhone,
      deliveryRating: 5, productQualityRating: 5, customerServiceRating: 5, wouldRecommend: true,
    })
    assert.equal(notDelivered.status, 409)
  } finally {
    await query('DELETE FROM orders WHERE id=$1', [pendingOrder.rows[0].id])
  }

  const trackingToken = crypto.randomBytes(24).toString('hex')
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,customer,delivery,subtotal,shipping_fee,total_price,status,payment_method,payment_status)
    VALUES ($1,$2,$3,$4,0,0,0,'delivered','cash_on_delivery','paid') RETURNING id`,
  [`TEST-SERVICE-FEEDBACK-${crypto.randomBytes(3).toString('hex')}`, trackingToken,
    JSON.stringify({ name: 'Service Feedback Customer', phone }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Road' })])
  try {
    const payload = {
      orderId: order.rows[0].id, customerName: 'Service Feedback Customer', phone,
      deliveryRating: 5, productQualityRating: 4, customerServiceRating: 3,
      comment: 'A helpful service note.', wouldRecommend: true,
    }
    const submitted = await app.post('/api/reviews/service').set('x-order-token', trackingToken).send(payload)
    assert.equal(submitted.status, 201, submitted.body.message)
    const stored = await query('SELECT overall_rating,status FROM service_feedback WHERE order_id=$1', [order.rows[0].id])
    assert.equal(stored.rows[0].overall_rating, 4)
    assert.equal(stored.rows[0].status, 'pending')
    const duplicate = await app.post('/api/reviews/service').set('x-order-token', trackingToken).send(payload)
    assert.equal(duplicate.status, 409)
    const unauthorizedAdmin = await app.get('/api/reviews/admin?type=service')
    assert.equal(unauthorizedAdmin.status, 401)
    const adminList = await app.get('/api/reviews/admin?type=service')
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    assert.ok(adminList.body.data.some((entry) => entry.orderId === order.rows[0].id))
    const approval = await app.patch(`/api/reviews/admin/service/${submitted.body.data.id}`)
      .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY).send({ status: 'approved' })
    assert.equal(approval.status, 200)
  } finally {
    await query('DELETE FROM service_feedback WHERE order_id=$1', [order.rows[0].id])
    await query('DELETE FROM orders WHERE id=$1', [order.rows[0].id])
  }
})

integrationTest('rate-limits product feedback by phone', async () => {
  const products = await Promise.all(Array.from({ length: 5 }, (_, index) => query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock,price_confirmed)
    VALUES ($1,$2,'Test-only feedback product',450,'kg','fresh-whole','Tilapia','Fresh',1,true,true,true)
    RETURNING id`, [`TEST-REVIEW-LIMIT-${crypto.randomBytes(3).toString('hex')}`, `Review Rate Limit ${index}`])))
  const ids = products.map((result) => result.rows[0].id)
  const phone = `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  try {
    const responses = []
    for (const [index, productId] of ids.entries()) {
      responses.push(await app.post('/api/reviews/products').send({
        productId, customerName: 'Rate Limit Customer', phone, rating: 5,
        title: `Review ${index}`, comment: 'Rate limit test.',
      }))
    }
    assert.deepEqual(responses.map((response) => response.status), [201, 201, 201, 201, 429])
    assert.match(responses[4].body.message, /phone number/)
    const ipAttempts = await Promise.all(Array.from({ length: 21 }, () => app.post('/api/reviews/products')
      .set('X-Forwarded-For', '203.0.113.91')
      .send({})))
    assert.equal(ipAttempts.filter((response) => response.status === 429).length, 1)
    assert.ok(ipAttempts.filter((response) => response.status === 400).length >= 20)
  } finally {
    await query('DELETE FROM product_reviews WHERE product_id=ANY($1::uuid[])', [ids])
    await query('DELETE FROM products WHERE id=ANY($1::uuid[])', [ids])
  }
})

after(async () => {
  if (integrationReady) {
    if (orderId) await query('DELETE FROM orders WHERE id=$1', [orderId])
    if (latePaymentOrderId) await query('DELETE FROM orders WHERE id=$1', [latePaymentOrderId])
    if (postDeliveryPaymentOrderId) await query('DELETE FROM orders WHERE id=$1', [postDeliveryPaymentOrderId])
    if (guestOrderId) await query('DELETE FROM orders WHERE id=$1', [guestOrderId])
    if (operationsOrderId) await query('DELETE FROM orders WHERE id=$1', [operationsOrderId])
    if (blockedOrderId) await query('DELETE FROM orders WHERE id=$1', [blockedOrderId])
    if (contractProductId) await query('DELETE FROM products WHERE id=$1', [contractProductId])
    if (adminDeliveryZoneId) await query('DELETE FROM delivery_zones WHERE id=$1', [adminDeliveryZoneId])
    if (deliveryZoneId) await query('DELETE FROM delivery_zones WHERE id=$1', [deliveryZoneId])
    if (supportRequestId) await query('DELETE FROM support_requests WHERE id=$1', [supportRequestId])
    if (adminProductId) {
      await query('DELETE FROM product_price_history WHERE product_id=$1', [adminProductId])
      await query('DELETE FROM products WHERE id=$1', [adminProductId])
    }
    if (photoLessAdminProductId) await query('DELETE FROM products WHERE id=$1', [photoLessAdminProductId])
    if (expiredInventoryOrderId) await query('DELETE FROM orders WHERE id=$1', [expiredInventoryOrderId])
    if (checkoutUserId) await query('DELETE FROM orders WHERE customer_id=$1', [checkoutUserId])
    if (productId) await query('DELETE FROM products WHERE id=$1', [productId])
    if (signupUserId) await query('DELETE FROM users WHERE id=$1', [signupUserId])
    if (authFlowUserId) await query('DELETE FROM users WHERE id=$1', [authFlowUserId])
    if (passwordResetUserId) await query('DELETE FROM users WHERE id=$1', [passwordResetUserId])
    if (checkoutUserId) await query('DELETE FROM users WHERE id=$1', [checkoutUserId])
    if (checkoutProductId) await query('DELETE FROM products WHERE id=$1', [checkoutProductId])
    if (guestProductId) await query('DELETE FROM products WHERE id=$1', [guestProductId])
    if (operationsProductId) await query('DELETE FROM products WHERE id=$1', [operationsProductId])
    if (blockedProductId) await query('DELETE FROM products WHERE id=$1', [blockedProductId])
    if (blockedPhoneForTest) await query('DELETE FROM blocked_phones WHERE phone=$1', [blockedPhoneForTest])
    await closeDatabase()
  }
})
