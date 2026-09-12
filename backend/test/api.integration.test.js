import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
process.env.MPESA_CALLBACK_SECRET = 'integration-test-secret'
process.env.AUTH_SECRET = 'integration-auth-secret'

let app
let query
let initializeDatabase
let releaseExpiredInventory
let fetchOrder
let closeDatabase
let integrationReady = false
let skipReason = 'PostgreSQL unavailable; integration tests skipped. Set TEST_DATABASE_URL to run them.'

if (process.env.DATABASE_URL) {
  try {
    const [{ default: requestApp }, db] = await Promise.all([
      import('supertest'),
      import('../src/lib/db.js'),
    ])
    const index = await import('../src/index.js')
    app = requestApp(index.default)
    ;({ query, initializeDatabase, releaseExpiredInventory, fetchOrder, closeDatabase } = db)
    await initializeDatabase({ retry: false })
    integrationReady = true
  } catch (error) {
    skipReason = `PostgreSQL unavailable; integration tests skipped (${error.message}).`
  }
}

const integrationTest = (name, handler) => test(name, { skip: integrationReady ? false : skipReason }, handler)

let orderId
let productId

integrationTest('rejects customer session endpoints without a token', async () => {
  const me = await app.get('/api/auth/me')
  assert.equal(me.status, 401)
  const orders = await app.get('/api/orders/my-orders')
  assert.equal(orders.status, 401)
  const checkout = await app.post('/api/orders/checkout').send({ items: [] })
  assert.equal(checkout.status, 401)
})

integrationTest('rejects an invalid customer JWT', async () => {
  const response = await app.get('/api/auth/me').set('Authorization', 'Bearer invalid')
  assert.equal(response.status, 401)
})

integrationTest('confirms a matching M-Pesa callback once and treats replay as harmless', async () => {
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status,mpesa)
    VALUES ($1,$2,true,now()+interval '15 minutes',$3,$4,1250,250,1500,'initiated',$5) RETURNING id`,
  [`TEST-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Integration Customer', email: 'integration@example.com', phone: '0712345678' }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' }), JSON.stringify({ phone: '254712345678', checkoutRequestID: 'ws_CO_TEST_123' })])
  orderId = order.rows[0].id
  const callback = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_TEST_123', ResultCode: 0, ResultDesc: 'Processed', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }, { Name: 'MpesaReceiptNumber', Value: 'TEST123' }, { Name: 'PhoneNumber', Value: 254712345678 }, { Name: 'TransactionDate', Value: 20260907123000 }] } } } }
  const response = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(response.status, 200)
  const paid = await fetchOrder(orderId)
  assert.equal(paid.paymentStatus, 'paid')
  assert.equal(paid.status, 'confirmed')
  const replay = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(replay.status, 200)
  assert.match(replay.body.ResultDesc, /already processed/i)
})

integrationTest('releases expired inventory reservations in PostgreSQL', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock)
    VALUES ($1,'Expiry Test Fish','Integration test product',500,'kg','fresh-whole','Tilapia','Fresh',0,true) RETURNING id,sku`,
  [`TEST-EXPIRY-${crypto.randomBytes(3).toString('hex')}`])
  productId = product.rows[0].id
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status)
    VALUES ($1,$2,true,now()-interval '1 second',$3,$4,500,250,750,'initiated') RETURNING id`,
  [`TEST-EXP-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Expiry Customer', email: 'expiry@example.com', phone: '0712345678' }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' })])
  await query(`INSERT INTO order_items (order_id,product_id,sku,name,unit,price,quantity,line_total) VALUES ($1,$2,$3,'Expiry Test Fish','kg',500,1,500)`, [order.rows[0].id, productId, product.rows[0].sku])
  await releaseExpiredInventory()
  const releasedProduct = await query('SELECT quantity FROM products WHERE id=$1', [productId])
  const releasedOrder = await fetchOrder(order.rows[0].id)
  assert.equal(releasedProduct.rows[0].quantity, 1)
  assert.equal(releasedOrder.inventoryReserved, false)
  assert.equal(releasedOrder.paymentStatus, 'failed')
})

after(async () => {
  if (integrationReady) {
    if (orderId) await query('DELETE FROM orders WHERE id=$1', [orderId])
    if (productId) await query('DELETE FROM products WHERE id=$1', [productId])
    await closeDatabase()
  }
})
