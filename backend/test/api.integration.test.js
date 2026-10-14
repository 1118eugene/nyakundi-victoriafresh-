import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

process.env.NODE_ENV = 'test'
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is required; database integration tests do not run against a mocked or skipped database.')
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.MPESA_CALLBACK_SECRET = 'integration-test-secret'
process.env.AUTH_SECRET = 'integration-auth-secret'
process.env.MPESA_MODE = 'mock'
process.env.ADMIN_DASHBOARD_KEY = 'integration-admin-secret'
process.env.DELIVERY_STAFF_ID = 'integration-delivery-worker'
process.env.DELIVERY_STAFF_KEY = 'integration-delivery-secret-longer-than-32-characters'
process.env.OTP_PROVIDER = 'console'

let app
let query
let initializeDatabase
let seedVerifiedProducts
let releaseExpiredInventory
let fetchOrder
let closeDatabase
let integrationReady = false

const [{ default: requestApp }, db] = await Promise.all([
  import('supertest'),
  import('../src/lib/db.js'),
])
const index = await import('../src/index.js')
const { config } = await import('../src/config/index.js')
app = requestApp(index.default)
;({ query, initializeDatabase, seedVerifiedProducts, releaseExpiredInventory, fetchOrder, closeDatabase } = db)
await initializeDatabase({ retry: false })
integrationReady = true

const integrationTest = (name, handler) => test(name, handler)

let orderId
let latePaymentOrderId
let postDeliveryPaymentOrderId
let guestOrderId
let operationsOrderId
let operationsProductId
let expiredInventoryOrderId
let productId
let signupUserId
let checkoutUserId
let checkoutProductId
let guestProductId
let otpFlowUserId

integrationTest('preserves non-catalogue products and their inventory state during catalogue sync', async () => {
  const sku = `EXTERNAL-${crypto.randomBytes(6).toString('hex')}`
  await query(`INSERT INTO products
    (sku,name,description,price,unit,category,species,preparation,quantity,active,in_stock)
    VALUES ($1,'External Product','Existing inventory',125,'kg','fresh-whole','Tilapia','Fresh',7,false,false)`,
  [sku])

  try {
    await seedVerifiedProducts()
    const result = await query('SELECT quantity,active,in_stock FROM products WHERE sku=$1', [sku])
    assert.deepEqual(result.rows[0], { quantity: 7, active: false, in_stock: false })
  } finally {
    await query('DELETE FROM products WHERE sku=$1', [sku])
  }
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
  const token = jwt.sign({ sub: customer.rows[0].id, ver: customer.rows[0].session_version }, process.env.AUTH_SECRET)
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
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock)
    VALUES ($1,'Guest Checkout Fish','Integration test product',700,'kg','fresh-whole','Tilapia','Fresh',3,true) RETURNING id`,
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
  const quote = await app.post('/api/orders/quote').send({ county: body.county, items: body.items })
  assert.equal(quote.status, 200)
  assert.deepEqual(quote.body.data, {
    items: [{ productId: guestProductId, quantity: 1, price: 700, lineTotal: 700 }],
    subtotal: 700,
    shippingFee: 250,
    totalPrice: 950,
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
  assert.equal(unavailable.status, 400)
  const stock = await query('SELECT quantity FROM products WHERE id=$1', [guestProductId])
  assert.equal(stock.rows[0].quantity, 2)
})

integrationTest('supports delivery assignment, expiring location, cash receipts, and moderated reviews', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock)
    VALUES ($1,'Operations Test Fish','Integration test product',800,'kg','fresh-whole','Tilapia','Fresh',2,true) RETURNING id,sku`,
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
  const cash = await app.post(`/api/orders/${operationsOrderId}/payment/cash`)
    .set('x-delivery-key', process.env.DELIVERY_STAFF_KEY)
    .send({})
  assert.equal(cash.status, 200)
  assert.match(cash.body.data.receiptNumber, /^CASH-/)
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

integrationTest('does not allow signup to replace a pending account phone', async () => {
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
  })
  assert.equal(response.status, 409)
  const persisted = await query('SELECT email,phone FROM users WHERE id=$1', [signupUserId])
  assert.equal(persisted.rows[0].email, email)
  assert.equal(persisted.rows[0].phone, phone)
})

integrationTest('completes signup and login OTP verification and authenticated sessions with the development console provider', async () => {
  const email = `otp-flow-${crypto.randomBytes(4).toString('hex')}@example.com`
  const phone = `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const messages = []
  const originalWarn = console.warn
  console.warn = (...args) => messages.push(args.join(' '))

  try {
    const signup = await app.post('/api/auth/signup').send({
      customerName: 'OTP Flow Customer',
      email,
      phone,
      county: 'Kisumu',
      town: 'Kisumu',
      addressLine: 'Integration Test Road',
    })
    assert.equal(signup.status, 201, signup.body.message)
    assert.equal(signup.body.data.otp.provider, 'console')
    assert.equal(signup.body.data.otp.channel, 'console')
    otpFlowUserId = signup.body.data.user.id

    const code = messages.join('\n').match(/Development OTP for .+: (\d{6})/)?.[1]
    assert.ok(code, 'The development-only console provider should print the six-digit code.')

    const verified = await app.post('/api/auth/verify-otp').send({ phone, code })
    assert.equal(verified.status, 200, verified.body.message)
    assert.equal(typeof verified.body.data.token, 'string')
    assert.ok(verified.body.data.token.length > 20)

    const session = await app.get('/api/auth/me').set('Authorization', `Bearer ${verified.body.data.token}`)
    assert.equal(session.status, 200)
    assert.equal(session.body.data.user.email, email)

    messages.length = 0
    const login = await app.post('/api/auth/login').send({ phone })
    assert.equal(login.status, 200, login.body.message)
    assert.equal(login.body.data.provider, 'console')
    const loginCode = messages.join('\n').match(/Development OTP for .+: (\d{6})/)?.[1]
    assert.ok(loginCode, 'The development-only console provider should print the login code.')

    const loginVerified = await app.post('/api/auth/verify-otp').send({ phone, code: loginCode })
    assert.equal(loginVerified.status, 200, loginVerified.body.message)
    assert.equal(typeof loginVerified.body.data.token, 'string')
    const loginSession = await app.get('/api/auth/me').set('Authorization', `Bearer ${loginVerified.body.data.token}`)
    assert.equal(loginSession.status, 200)
    assert.equal(loginSession.body.data.user.email, email)
  } finally {
    console.warn = originalWarn
  }
})

integrationTest('removes a newly created account when the configured OTP provider is missing credentials', async () => {
  const email = `otp-delivery-failure-${crypto.randomBytes(4).toString('hex')}@example.com`
  const phone = `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`
  const originalProvider = config.otpProvider
  const originalApiKey = config.smsApiKey
  const originalUsername = config.smsUsername
  config.otpProvider = 'africastalking'
  config.smsApiKey = ''
  config.smsUsername = ''

  try {
    const response = await app.post('/api/auth/signup').send({
      customerName: 'OTP Delivery Failure Test',
      email,
      phone,
      county: 'Kisumu',
      town: 'Kisumu',
      addressLine: 'Integration Test Road',
    })
    assert.equal(response.status, 503)
    assert.match(response.body.message, /Missing: SMS_API_KEY, SMS_USERNAME/)
    const remaining = await query('SELECT count(*)::int AS count FROM users WHERE email=$1', [email])
    assert.equal(remaining.rows[0].count, 0)
  } finally {
    config.otpProvider = originalProvider
    config.smsApiKey = originalApiKey
    config.smsUsername = originalUsername
  }
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
  const cancelPaid = await app.patch(`/api/orders/${orderId}/status`)
    .set('x-admin-key', process.env.ADMIN_DASHBOARD_KEY)
    .send({ status: 'cancelled' })
  assert.equal(cancelPaid.status, 409)
  const replay = await app.post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(replay.status, 200)
  assert.match(replay.body.ResultDesc, /already processed/i)
})

integrationTest('recovers a late successful payment after its reservation was released for review', async () => {
  const order = await query(`INSERT INTO orders
    (order_number,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_status,mpesa)
    VALUES ($1,$2,false,NULL,$3,$4,1250,250,1500,'failed',$5) RETURNING id`,
  [`TEST-LATE-${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(24).toString('hex'), JSON.stringify({ name: 'Late Payment Customer', email: 'late@example.com', phone: '0712345678' }), JSON.stringify({ county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' }), JSON.stringify({ phone: '254712345678', checkoutRequestID: 'ws_CO_TEST_LATE' })])
  latePaymentOrderId = order.rows[0].id
  const callback = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_TEST_LATE', ResultCode: 0, ResultDesc: 'Processed', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }, { Name: 'MpesaReceiptNumber', Value: 'LATE123' }, { Name: 'PhoneNumber', Value: 254712345678 }, { Name: 'TransactionDate', Value: 20260907123000 }] } } } }
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

integrationTest('rejects stale checkout prices and deduplicates concurrent checkout attempts', async () => {
  const customer = await query(`INSERT INTO users (email,phone,customer_name,verified_phone)
    VALUES ($1,$2,'Checkout Test Customer',true) RETURNING id,session_version,email,phone`,
  [`checkout-${crypto.randomBytes(4).toString('hex')}@example.com`, `+2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`])
  checkoutUserId = customer.rows[0].id
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock)
    VALUES ($1,'Checkout Test Fish','Integration test product',500,'kg','fresh-whole','Tilapia','Fresh',5,true) RETURNING id`,
  [`TEST-CHECKOUT-${crypto.randomBytes(3).toString('hex')}`])
  checkoutProductId = product.rows[0].id
  const token = jwt.sign({ sub: checkoutUserId, ver: customer.rows[0].session_version }, process.env.AUTH_SECRET)
  const body = { customerName: 'Checkout Test Customer', email: customer.rows[0].email, phone: customer.rows[0].phone, county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street', items: [{ productId: checkoutProductId, quantity: 1, expectedPrice: 500 }] }
  const stale = await app.post('/api/orders/checkout')
    .set('Authorization', `Bearer ${token}`)
    .set('x-checkout-key', crypto.randomUUID())
    .send({ ...body, items: [{ ...body.items[0], expectedPrice: 499 }] })
  assert.equal(stale.status, 409)
  const stockAfterStale = await query('SELECT quantity FROM products WHERE id=$1', [checkoutProductId])
  assert.equal(stockAfterStale.rows[0].quantity, 5)

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
  assert.deepEqual(raceResponses.map((response) => response.status).sort(), [201, 400])
  const remainingStock = await query('SELECT quantity FROM products WHERE id=$1', [checkoutProductId])
  assert.equal(remainingStock.rows[0].quantity, 0)
})

integrationTest('releases expired inventory reservations in PostgreSQL', async () => {
  const product = await query(`INSERT INTO products (sku,name,description,price,unit,category,species,preparation,quantity,in_stock)
    VALUES ($1,'Expiry Test Fish','Integration test product',500,'kg','fresh-whole','Tilapia','Fresh',0,true) RETURNING id,sku`,
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

after(async () => {
  if (integrationReady) {
    if (orderId) await query('DELETE FROM orders WHERE id=$1', [orderId])
    if (latePaymentOrderId) await query('DELETE FROM orders WHERE id=$1', [latePaymentOrderId])
    if (postDeliveryPaymentOrderId) await query('DELETE FROM orders WHERE id=$1', [postDeliveryPaymentOrderId])
    if (guestOrderId) await query('DELETE FROM orders WHERE id=$1', [guestOrderId])
    if (operationsOrderId) await query('DELETE FROM orders WHERE id=$1', [operationsOrderId])
    if (expiredInventoryOrderId) await query('DELETE FROM orders WHERE id=$1', [expiredInventoryOrderId])
    if (checkoutUserId) await query('DELETE FROM orders WHERE customer_id=$1', [checkoutUserId])
    if (productId) await query('DELETE FROM products WHERE id=$1', [productId])
    if (signupUserId) await query('DELETE FROM users WHERE id=$1', [signupUserId])
    if (otpFlowUserId) await query('DELETE FROM users WHERE id=$1', [otpFlowUserId])
    if (checkoutUserId) await query('DELETE FROM users WHERE id=$1', [checkoutUserId])
    if (checkoutProductId) await query('DELETE FROM products WHERE id=$1', [checkoutProductId])
    if (guestProductId) await query('DELETE FROM products WHERE id=$1', [guestProductId])
    if (operationsProductId) await query('DELETE FROM products WHERE id=$1', [operationsProductId])
    await closeDatabase()
  }
})
