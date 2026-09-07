import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/victoria_fish_test'
process.env.DB_NAME = `victoria_fish_test_${process.pid}`
process.env.MPESA_CALLBACK_SECRET = 'integration-test-secret'

const [{ default: request }, { default: app }, { connectToDatabase, releaseExpiredInventory }, { default: Order }, { default: Product }] = await Promise.all([
  import('supertest'),
  import('../src/index.js'),
  import('../src/lib/db.js'),
  import('../src/models/Order.js'),
  import('../src/models/Product.js'),
])

const connection = await connectToDatabase()
await Order.deleteMany({})

const order = await Order.create({
  orderNumber: `TEST-${crypto.randomBytes(4).toString('hex')}`,
  trackingToken: crypto.randomBytes(24).toString('hex'),
  inventoryReserved: true,
  inventoryExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  customer: { name: 'Integration Customer', email: 'integration@example.com', phone: '0712345678' },
  delivery: { county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' },
  items: [{
    productId: new mongoose.Types.ObjectId(),
    sku: 'TEST-FISH',
    name: 'Test Fish',
    unit: 'kg',
    price: 1250,
    quantity: 1,
    lineTotal: 1250,
    image: '',
  }],
  subtotal: 1250,
  shippingFee: 250,
  totalPrice: 1500,
  paymentStatus: 'initiated',
  mpesa: { phone: '254712345678', checkoutRequestID: 'ws_CO_TEST_123' },
})

const callback = {
  Body: {
    stkCallback: {
      CheckoutRequestID: 'ws_CO_TEST_123',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 1500 },
          { Name: 'MpesaReceiptNumber', Value: 'TEST123' },
          { Name: 'PhoneNumber', Value: 254712345678 },
          { Name: 'TransactionDate', Value: 20260907123000 },
        ],
      },
    },
  },
}

test('rejects an M-Pesa callback without the callback secret', async () => {
  const response = await request(app).post('/api/orders/mpesa/callback').send(callback)
  assert.equal(response.status, 401)
})

test('confirms a matching M-Pesa callback once and treats replay as harmless', async () => {
  const response = await request(app).post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(response.status, 200)
  assert.equal(response.body.ResultCode, 0)

  const paidOrder = await Order.findById(order.id)
  assert.equal(paidOrder.paymentStatus, 'paid')
  assert.equal(paidOrder.status, 'confirmed')

  const replay = await request(app).post('/api/orders/mpesa/callback?secret=integration-test-secret').send(callback)
  assert.equal(replay.status, 200)
  assert.match(replay.body.ResultDesc, /already processed/i)
})

test('releases expired inventory reservations in MongoDB', async () => {
  const product = await Product.create({
    sku: `TEST-EXPIRY-${crypto.randomBytes(3).toString('hex')}`,
    name: 'Expiry Test Fish',
    description: 'Integration test product',
    price: 500,
    unit: 'kg',
    category: 'fresh-whole',
    species: 'Tilapia',
    preparation: 'Fresh',
    quantity: 1,
    inStock: true,
  })
  await Product.updateOne({ _id: product._id }, { $inc: { quantity: -1 } })

  const expiredOrder = await Order.create({
    orderNumber: `TEST-EXP-${crypto.randomBytes(4).toString('hex')}`,
    trackingToken: crypto.randomBytes(24).toString('hex'),
    inventoryReserved: true,
    inventoryExpiresAt: new Date(Date.now() - 1000),
    customer: { name: 'Expiry Customer', email: 'expiry@example.com', phone: '0712345678' },
    delivery: { county: 'Kisumu', town: 'Kisumu', addressLine: 'Test Street' },
    items: [{ productId: product._id, sku: product.sku, name: product.name, unit: 'kg', price: 500, quantity: 1, lineTotal: 500, image: '' }],
    subtotal: 500,
    shippingFee: 250,
    totalPrice: 750,
    paymentStatus: 'initiated',
  })

  await releaseExpiredInventory()
  const releasedProduct = await Product.findById(product._id)
  const releasedOrder = await Order.findById(expiredOrder._id)
  assert.equal(releasedProduct.quantity, 1)
  assert.equal(releasedOrder.inventoryReserved, false)
  assert.equal(releasedOrder.paymentStatus, 'failed')
})

after(async () => {
  await connection.connection.dropDatabase()
  await connection.connection.close()
})
