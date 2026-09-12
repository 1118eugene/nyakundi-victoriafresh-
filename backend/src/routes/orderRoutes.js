import crypto from 'node:crypto'
import express from 'express'
import { config, getMpesaConfigurationStatus } from '../config/index.js'
import { fetchOrder, isDatabaseReady, orderFromRows, query, withTransaction } from '../lib/db.js'
import { calculateShippingFee } from '../lib/orderUtils.js'
import { getInventoryExpiry } from '../lib/inventoryUtils.js'
import { normalizePhone, validateSuccessfulPayment } from '../lib/paymentUtils.js'
import { extractMpesaReceipt, initiateStkPush, isMpesaConfigured } from '../services/mpesa.js'
import { requireCustomer } from '../middleware/auth.js'

const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function createOrderNumber() {
  const date = new Date()
  const random = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `VFF-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${random}`
}

function requireAdminKey(req) {
  const candidate = Buffer.from(req.get('x-admin-key') || '')
  const expected = Buffer.from(config.adminDashboardKey || '')
  return Boolean(expected.length && candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected))
}

function requireConfiguredAdminKey(req, res) {
  if (!config.adminDashboardKey) {
    res.status(503).json({ status: 'error', message: 'Admin access is not configured on this server' })
    return false
  }
  if (!requireAdminKey(req)) {
    res.status(401).json({ status: 'error', message: 'Admin access key required' })
    return false
  }
  return true
}

async function releaseOrderInventory(orderId, paymentStatus = null) {
  return withTransaction(async (client) => {
    const result = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [orderId])
    const order = result.rows[0]
    if (!order || !order.inventory_reserved || !['pending', 'initiated'].includes(order.payment_status)) return false
    const items = await client.query('SELECT * FROM order_items WHERE order_id=$1', [orderId])
    for (const item of items.rows) {
      await client.query('UPDATE products SET quantity=quantity+$1,updated_at=now() WHERE id=$2', [item.quantity, item.product_id])
    }
    await client.query(`UPDATE orders SET inventory_reserved=false,inventory_expires_at=NULL,
      payment_status=COALESCE($1,payment_status),updated_at=now() WHERE id=$2`, [paymentStatus, orderId])
    return true
  })
}

async function getOrders(rows) {
  return Promise.all(rows.map((row) => fetchOrder(row.id)))
}

router.get('/', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const conditions = []
    const values = []
    if (req.query.status) { values.push(req.query.status); conditions.push(`status=$${values.length}`) }
    if (req.query.paymentStatus) { values.push(req.query.paymentStatus); conditions.push(`payment_status=$${values.length}`) }
    if (req.query.phone) { values.push(req.query.phone); conditions.push(`customer->>'phone'=$${values.length}`) }
    const limit = Math.min(Math.max(Number(req.query.limit) || config.defaultLimit, 1), config.maxLimit)
    const skip = Math.max(Number(req.query.skip) || 0, 0)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [dataResult, countResult] = await Promise.all([
      query(`SELECT * FROM orders ${where} ORDER BY created_at DESC OFFSET $${values.length + 1} LIMIT $${values.length + 2}`, [...values, skip, limit]),
      query(`SELECT count(*)::int AS total FROM orders ${where}`, values),
    ])
    const data = await getOrders(dataResult.rows)
    res.json({ status: 'success', data, pagination: { total: countResult.rows[0].total, skip, limit, returned: data.length } })
  } catch (error) { next(error) }
})

router.get('/mpesa/status', (_req, res) => {
  const readiness = getMpesaConfigurationStatus()
  res.json({ status: 'success', data: { configured: readiness.configured, mode: readiness.mode, callbackReady: readiness.callbackReady, missing: readiness.missing, mpesaBaseUrl: readiness.configured ? config.mpesaBaseUrl : null, mpesaShortcode: readiness.configured ? config.mpesaShortcode : null, mpesaCallbackUrl: readiness.configured ? config.mpesaCallbackUrl : null }, message: readiness.configured ? 'M-Pesa is ready to receive payment callbacks.' : 'M-Pesa is not ready for live payment callbacks.' })
})

async function listCustomerOrders(customerId, req, res, next) {
  try {
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, config.maxLimit) : config.defaultLimit
    const result = await query(`SELECT * FROM orders WHERE customer_id=$1 OR user_id=$1 ORDER BY created_at DESC LIMIT $2`, [customerId, limit])
    const data = await getOrders(result.rows)
    res.json({ status: 'success', data, pagination: { limit, returned: data.length } })
  } catch (error) { next(error) }
}

router.get('/my-orders', requireCustomer, (req, res, next) => listCustomerOrders(req.customer.id, req, res, next))
router.get('/mine', requireCustomer, (req, res, next) => listCustomerOrders(req.customer.id, req, res, next))

router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const order = await fetchOrder(req.params.id, { includeTrackingToken: true })
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' })
    const isAdmin = config.adminDashboardKey && requireAdminKey(req)
    if (!isAdmin && req.get('x-order-token') !== order.trackingToken) return res.status(401).json({ status: 'error', message: 'Order tracking token required' })
    delete order.trackingToken
    res.json({ status: 'success', data: order })
  } catch (error) { next(error) }
})

router.post('/checkout', requireCustomer, async (req, res, next) => {
  try {
    if (!isMpesaConfigured()) return res.status(503).json({ status: 'error', message: 'M-Pesa checkout is unavailable until the server has valid credentials and a public HTTPS callback URL.' })
    const { paymentPhone, county, town, addressLine, landmark, notes, items } = req.body
    if (!county || !town || !addressLine) return res.status(400).json({ status: 'error', message: 'County, town, and address are required' })
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ status: 'error', message: 'Cart items are required' })
    const normalizedPaymentPhone = normalizePhone(paymentPhone || req.customer.phone)
    if (!/^\S+@\S+\.\S+$/.test(req.customer.email) || !/^2547\d{8}$/.test(normalizedPaymentPhone)) return res.status(400).json({ status: 'error', message: 'Enter a valid email address and Kenyan M-Pesa phone number.' })
    const quantities = new Map()
    for (const item of items) {
      if (!UUID.test(String(item.productId))) return res.status(400).json({ status: 'error', message: 'Each cart item must use a valid product ID.' })
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return res.status(400).json({ status: 'error', message: 'Each cart quantity must be an integer between 1 and 100.' })
      const total = (quantities.get(item.productId) || 0) + quantity
      if (total > 100) return res.status(400).json({ status: 'error', message: 'The total quantity for a product cannot exceed 100.' })
      quantities.set(item.productId, total)
    }
    const trackingToken = crypto.randomBytes(24).toString('hex')
    const reservation = await withTransaction(async (client) => {
      const orderItems = []
      let subtotal = 0
      for (const [productId, quantity] of quantities) {
        const found = await client.query('SELECT * FROM products WHERE id=$1 AND active=true AND in_stock=true FOR UPDATE', [productId])
        const product = found.rows[0]
        if (!product) { const error = new Error('One or more products are no longer available'); error.status = 404; throw error }
        if (product.quantity < quantity) { const error = new Error(`${product.name} only has ${product.quantity} unit(s) available right now`); error.status = 400; throw error }
        await client.query('UPDATE products SET quantity=quantity-$1,updated_at=now() WHERE id=$2', [quantity, productId])
        const price = Number(product.price)
        const lineTotal = price * quantity
        subtotal += lineTotal
        orderItems.push({ productId, sku: product.sku, name: product.name, unit: product.unit, price, quantity, lineTotal, image: product.image })
      }
      const shippingFee = calculateShippingFee(county)
      const totalPrice = subtotal + shippingFee
      const orderResult = await client.query(`INSERT INTO orders
        (order_number,user_id,customer_id,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,mpesa)
        VALUES ($1,$2,$2,$3,true,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [createOrderNumber(), req.customer.id, trackingToken, getInventoryExpiry(), JSON.stringify({ name: req.customer.customerName, email: req.customer.email, phone: req.customer.phone }), JSON.stringify({ county, town, addressLine, landmark: landmark || '', notes: notes || '' }), subtotal, shippingFee, totalPrice, JSON.stringify({ phone: normalizedPaymentPhone })])
      const order = orderResult.rows[0]
      for (const item of orderItems) await client.query(`INSERT INTO order_items (order_id,product_id,sku,name,unit,price,quantity,line_total,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [order.id, item.productId, item.sku, item.name, item.unit, item.price, item.quantity, item.lineTotal, item.image])
      return { order, orderItems }
    })
    let orderId = reservation.order.id
    try {
      const stkResponse = await initiateStkPush({ phone: paymentPhone || req.customer.phone, amount: Number(reservation.order.total_price), orderNumber: reservation.order.order_number, description: `Fish order ${reservation.order.order_number}` })
      const paid = config.mpesaMode === 'mock'
      const mpesa = { ...(reservation.order.mpesa || {}), phone: stkResponse.normalizedPhone, merchantRequestID: stkResponse.MerchantRequestID || '', checkoutRequestID: stkResponse.CheckoutRequestID || '', resultDescription: stkResponse.ResponseDescription || '', requestedAt: stkResponse.requestedAt, ...(paid ? { resultCode: 0, receiptNumber: stkResponse.mockReceiptNumber, paidAt: new Date() } : {}) }
      await query(`UPDATE orders SET payment_status=$1,status=$2,inventory_expires_at=$3,mpesa=$4,updated_at=now() WHERE id=$5`, [paid ? 'paid' : 'initiated', paid ? 'confirmed' : 'awaiting_payment', paid ? null : reservation.order.inventory_expires_at, JSON.stringify(mpesa), orderId])
      const data = await fetchOrder(orderId)
      return res.status(201).json({ status: 'success', message: 'Order created and M-Pesa prompt sent successfully.', data, payment: { configured: true, status: paid ? 'paid' : 'initiated', trackingToken, customerMessage: stkResponse.CustomerMessage || stkResponse.ResponseDescription || '', mode: config.mpesaMode } })
    } catch (paymentError) {
      await releaseOrderInventory(orderId, 'failed')
      await query(`UPDATE orders SET payment_status='failed',mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ resultDescription: paymentError.message }), orderId])
      return res.status(paymentError.status || 502).json({ status: 'error', message: paymentError.message, data: await fetchOrder(orderId), payment: { configured: true, status: 'failed', customerMessage: paymentError.message } })
    }
  } catch (error) { next(error) }
})

router.post('/mpesa/callback', async (req, res, next) => {
  try {
    const callback = req.body?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' })
    if (!config.mpesaCallbackSecret || req.query.secret !== config.mpesaCallbackSecret) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized callback' })
    const found = await query(`SELECT * FROM orders WHERE mpesa->>'checkoutRequestID'=$1`, [callback.CheckoutRequestID])
    const order = found.rows[0]
    if (!order) return res.status(404).json({ ResultCode: 1, ResultDesc: 'Order not found' })
    if (['paid', 'failed'].includes(order.payment_status)) return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed' })
    const receipt = extractMpesaReceipt(callback.CallbackMetadata?.Item || [])
    if (callback.ResultCode === 0 && !validateSuccessfulPayment({ receipt, expectedAmount: Number(order.total_price), expectedPhone: order.mpesa.phone })) {
      await query(`UPDATE orders SET mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: 'Payment verification failed: amount, receipt, or phone did not match the order.' }), order.id])
      return res.status(422).json({ ResultCode: 1, ResultDesc: 'Payment verification failed' })
    }
    if (callback.ResultCode === 0) {
      const paid = await withTransaction(async (client) => {
        const locked = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [order.id])
        const current = locked.rows[0]
        if (!current || current.payment_status !== 'initiated' || !current.inventory_reserved || !current.inventory_expires_at || new Date(current.inventory_expires_at) <= new Date()) return false
        await client.query(`UPDATE orders SET payment_status='paid',status='confirmed',inventory_expires_at=NULL,
          mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: callback.ResultDesc || '', receiptNumber: receipt.receiptNumber, paidAt: receipt.paidAt || new Date(), phone: receipt.phone || current.mpesa.phone }), order.id])
        return true
      })
      return res.status(paid ? 200 : 409).json({ ResultCode: paid ? 0 : 1, ResultDesc: paid ? 'Accepted' : 'Order payment is expired or already being processed' })
    }
    await releaseOrderInventory(order.id, 'failed')
    await query(`UPDATE orders SET mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: callback.ResultDesc || '' }), order.id])
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) { next(error) }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const validStatuses = ['awaiting_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
    if (!validStatuses.includes(req.body.status)) return res.status(400).json({ status: 'error', message: 'Invalid status supplied' })
    const result = await query('SELECT * FROM orders WHERE id=$1', [req.params.id])
    const order = result.rows[0]
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' })
    const transitions = { awaiting_payment: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered'], delivered: [], cancelled: [] }
    const status = req.body.status
    if (status !== order.status && !transitions[order.status].includes(status)) return res.status(409).json({ status: 'error', message: `Cannot move an order from ${order.status} to ${status}` })
    if (status === 'confirmed' && order.payment_status !== 'paid') return res.status(409).json({ status: 'error', message: 'An order can only be confirmed after payment is received' })
    if (status === 'cancelled' && order.payment_status === 'paid') return res.status(409).json({ status: 'error', message: 'Paid orders require an explicit refund process before cancellation.' })
    if (status === 'cancelled' && order.payment_status !== 'paid') await releaseOrderInventory(order.id, 'failed')
    await query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2', [status, order.id])
    res.json({ status: 'success', data: await fetchOrder(order.id) })
  } catch (error) { next(error) }
})

export default router
