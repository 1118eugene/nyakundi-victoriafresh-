import crypto from 'node:crypto'
import express from 'express'
import { config, getMpesaConfigurationStatus } from '../config/index.js'
import { fetchOrder, isDatabaseReady, orderFromRows, query, withTransaction } from '../lib/db.js'
import { calculateShippingFee, createCheckoutFingerprint } from '../lib/orderUtils.js'
import { getInventoryExpiry } from '../lib/inventoryUtils.js'
import { normalizePhone, validateSuccessfulPayment } from '../lib/paymentUtils.js'
import { extractMpesaReceipt, initiateStkPush, isMpesaConfigured } from '../services/mpesa.js'
import { requireCustomer } from '../middleware/auth.js'

import { buildDailyAnalytics, parseAnalyticsRange } from '../lib/analyticsUtils.js'
const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

router.get('/analytics', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const range = parseAnalyticsRange({ from: req.query.from, to: req.query.to })
    if (range.error) return res.status(400).json({ status: 'error', message: range.error })
    const result = await query(`SELECT (created_at AT TIME ZONE 'UTC')::date::text AS date,
      count(*)::int AS orders,
      count(*) FILTER (WHERE payment_status='paid')::int AS "paidOrders",
      coalesce(sum(total_price) FILTER (WHERE payment_status='paid'),0)::numeric AS "paidRevenue",
      count(*) FILTER (WHERE payment_status <> 'paid')::int AS "awaitingPayment",
      count(*) FILTER (WHERE status IN ('confirmed','preparing','out_for_delivery'))::int AS "activeDeliveries"
      FROM orders
      WHERE created_at >= ($1::date AT TIME ZONE 'UTC') AND created_at < (($2::date + interval '1 day') AT TIME ZONE 'UTC')
      GROUP BY (created_at AT TIME ZONE 'UTC')::date
      ORDER BY (created_at AT TIME ZONE 'UTC')::date`, [range.from, range.to])
    res.json({ status: 'success', data: buildDailyAnalytics(range, result.rows) })
  } catch (error) { next(error) }
})

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

async function releaseOrderInventory(orderId, paymentStatus = null, transactionClient = null) {
  const release = async (client) => {
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
  }
  return transactionClient ? release(transactionClient) : withTransaction(release)
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
  const message = readiness.mode === 'mock'
    ? 'Development mock payment mode is enabled; no real M-Pesa request will be sent.'
    : readiness.configured
      ? 'M-Pesa is ready to receive payment callbacks.'
      : `M-Pesa is not ready. Configure: ${readiness.missing.join(', ')}.`
  res.json({ status: 'success', data: { configured: readiness.configured, mode: readiness.mode, callbackReady: readiness.callbackReady, missing: readiness.missing, mpesaBaseUrl: readiness.configured ? config.mpesaBaseUrl : null, mpesaShortcode: readiness.configured ? config.mpesaShortcode : null, mpesaCallbackUrl: readiness.configured ? config.mpesaCallbackUrl : null }, message })
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
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ status: 'error', message: 'Checkout details must be provided as a JSON object.' })
    const checkoutKey = req.get('x-checkout-key') || ''
    if (!UUID.test(checkoutKey)) return res.status(400).json({ status: 'error', message: 'A valid checkout attempt key is required. Refresh checkout and try again.' })
    const paymentPhone = String(req.body.paymentPhone || '')
    const county = String(req.body.county || '').trim()
    const town = String(req.body.town || '').trim()
    const addressLine = String(req.body.addressLine || '').trim()
    const landmark = String(req.body.landmark || '').trim()
    const notes = String(req.body.notes || '').trim()
    const items = req.body.items
    if (!county || !town || !addressLine) return res.status(400).json({ status: 'error', message: 'County, town, and address are required' })
    if (county.length > 100 || town.length > 100 || addressLine.length > 300 || landmark.length > 200 || notes.length > 1000) return res.status(400).json({ status: 'error', message: 'Delivery details exceed the allowed length.' })
    if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ status: 'error', message: 'Add between 1 and 50 cart items before checkout.' })
    const normalizedPaymentPhone = normalizePhone(paymentPhone || req.customer.phone)
    if (!/^\S+@\S+\.\S+$/.test(req.customer.email) || !/^254[17]\d{8}$/.test(normalizedPaymentPhone)) return res.status(400).json({ status: 'error', message: 'Enter a valid email address and Kenyan M-Pesa phone number.' })
    const quantities = new Map()
    const expectedPrices = new Map()
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return res.status(400).json({ status: 'error', message: 'Each cart item must be a valid object.' })
      if (!UUID.test(String(item.productId))) return res.status(400).json({ status: 'error', message: 'Each cart item must use a valid product ID.' })
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return res.status(400).json({ status: 'error', message: 'Each cart quantity must be an integer between 1 and 100.' })
      const expectedPrice = Number(item.expectedPrice)
      if (!Number.isFinite(expectedPrice) || expectedPrice < 0) return res.status(400).json({ status: 'error', message: 'Refresh your cart to confirm current product prices before checkout.' })
      const priorPrice = expectedPrices.get(item.productId)
      if (priorPrice !== undefined && priorPrice !== expectedPrice) return res.status(400).json({ status: 'error', message: 'A product has conflicting prices in the cart. Refresh your cart and try again.' })
      const total = (quantities.get(item.productId) || 0) + quantity
      if (total > 100) return res.status(400).json({ status: 'error', message: 'The total quantity for a product cannot exceed 100.' })
      quantities.set(item.productId, total)
      expectedPrices.set(item.productId, expectedPrice)
    }
    const fingerprint = createCheckoutFingerprint({ customerId: req.customer.id, paymentPhone: normalizedPaymentPhone, county, town, addressLine, landmark, notes, items: [...quantities].map(([productId, quantity]) => ({ productId, quantity, expectedPrice: expectedPrices.get(productId) })) })
    const trackingToken = crypto.randomBytes(24).toString('hex')
    const reservation = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [checkoutKey])
      const prior = await client.query('SELECT * FROM orders WHERE checkout_key=$1', [checkoutKey])
      if (prior.rows[0]) {
        const order = prior.rows[0]
        if (order.customer_id !== req.customer.id) {
          const error = new Error('This checkout attempt belongs to another customer session.')
          error.status = 409
          throw error
        }
        return { order, reused: true }
      }
      if (!isMpesaConfigured()) {
        const error = new Error('M-Pesa checkout is unavailable until the server has valid credentials and a public HTTPS callback URL.')
        error.status = 503
        throw error
      }
      const orderItems = []
      let subtotal = 0
      for (const [productId, quantity] of quantities) {
        const found = await client.query('SELECT * FROM products WHERE id=$1 AND active=true AND in_stock=true FOR UPDATE', [productId])
        const product = found.rows[0]
        if (!product) { const error = new Error('One or more products are no longer available'); error.status = 404; throw error }
        if (product.quantity < quantity) { const error = new Error(`${product.name} only has ${product.quantity} unit(s) available right now`); error.status = 400; throw error }
        const expectedPrice = expectedPrices.get(productId)
        if (Math.round(Number(product.price) * 100) !== Math.round(expectedPrice * 100)) {
          const error = new Error(`${product.name} price changed from KES ${expectedPrice.toLocaleString()} to KES ${Number(product.price).toLocaleString()}. Refresh your cart to review it.`)
          error.status = 409
          error.code = 'PRICE_CHANGED'
          throw error
        }
        await client.query('UPDATE products SET quantity=quantity-$1,updated_at=now() WHERE id=$2', [quantity, productId])
        const price = Number(product.price)
        const lineTotal = price * quantity
        subtotal += lineTotal
        orderItems.push({ productId, sku: product.sku, name: product.name, unit: product.unit, price, quantity, lineTotal, image: product.image })
      }
      const shippingFee = calculateShippingFee(county)
      const totalPrice = subtotal + shippingFee
      const orderResult = await client.query(`INSERT INTO orders
        (order_number,user_id,customer_id,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,checkout_key,checkout_fingerprint,mpesa)
        VALUES ($1,$2,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [createOrderNumber(), req.customer.id, trackingToken, getInventoryExpiry(), JSON.stringify({ name: req.customer.customerName, email: req.customer.email, phone: req.customer.phone }), JSON.stringify({ county, town, addressLine, landmark, notes }), subtotal, shippingFee, totalPrice, checkoutKey, fingerprint, JSON.stringify({ phone: normalizedPaymentPhone })])
      const order = orderResult.rows[0]
      for (const item of orderItems) await client.query(`INSERT INTO order_items (order_id,product_id,sku,name,unit,price,quantity,line_total,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [order.id, item.productId, item.sku, item.name, item.unit, item.price, item.quantity, item.lineTotal, item.image])
      return { order, orderItems, reused: false }
    })
    if (reservation.reused) {
      const data = await fetchOrder(reservation.order.id)
      const cartMatchesOrder = reservation.order.checkout_fingerprint === fingerprint
      return res.json({ status: 'success', message: 'Recovered the existing checkout attempt. No new payment request was sent.', data, payment: { configured: isMpesaConfigured(), status: reservation.order.payment_status, trackingToken: reservation.order.tracking_token, cartMatchesOrder, customerMessage: cartMatchesOrder ? reservation.order.mpesa.resultDescription || 'Check the existing M-Pesa prompt before trying again.' : 'This attempt belongs to an earlier cart or delivery address. Its payment will not be repeated; your current cart has been kept.' } })
    }
    let orderId = reservation.order.id
    let stkAccepted = false
    try {
      const stkResponse = await initiateStkPush({ phone: paymentPhone || req.customer.phone, amount: Number(reservation.order.total_price), orderNumber: reservation.order.order_number, description: `Fish order ${reservation.order.order_number}` })
      stkAccepted = true
      const paid = config.mpesaMode === 'mock'
      const mpesa = { ...(reservation.order.mpesa || {}), phone: stkResponse.normalizedPhone, merchantRequestID: stkResponse.MerchantRequestID || '', checkoutRequestID: stkResponse.CheckoutRequestID || '', resultDescription: stkResponse.ResponseDescription || '', requestedAt: stkResponse.requestedAt, ...(paid ? { resultCode: 0, receiptNumber: stkResponse.mockReceiptNumber, paidAt: new Date() } : {}) }
      await query(`UPDATE orders SET payment_status=$1,status=$2,inventory_expires_at=$3,mpesa=$4,updated_at=now() WHERE id=$5`, [paid ? 'paid' : 'initiated', paid ? 'confirmed' : 'awaiting_payment', paid ? null : reservation.order.inventory_expires_at, JSON.stringify(mpesa), orderId])
      const data = await fetchOrder(orderId)
      return res.status(201).json({ status: 'success', message: 'Order created and M-Pesa prompt sent successfully.', data, payment: { configured: true, status: paid ? 'paid' : 'initiated', trackingToken, cartMatchesOrder: true, customerMessage: stkResponse.CustomerMessage || stkResponse.ResponseDescription || '', mode: config.mpesaMode } })
    } catch (paymentError) {
      if (stkAccepted || paymentError.paymentOutcomeUnknown) {
        const message = 'We could not confirm whether M-Pesa received the request. Do not submit another payment attempt; check the existing prompt or contact support.'
        await query(`UPDATE orders SET mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ resultDescription: message, paymentOutcomeUnknown: true }), orderId]).catch(() => {})
        return res.status(202).json({ status: 'success', message, data: await fetchOrder(orderId), payment: { configured: true, status: 'pending', trackingToken, cartMatchesOrder: true, customerMessage: message } })
      }
      await releaseOrderInventory(orderId, 'failed')
      await query(`UPDATE orders SET payment_status='failed',mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ resultDescription: paymentError.message }), orderId])
      return res.status(paymentError.status || 502).json({ status: 'error', message: paymentError.message, data: await fetchOrder(orderId), payment: { configured: true, status: 'failed', trackingToken, cartMatchesOrder: true, customerMessage: paymentError.message } })
    }
  } catch (error) {
    if (error.code === 'PRICE_CHANGED') return res.status(409).json({ status: 'error', code: error.code, message: error.message })
    next(error)
  }
})

router.post('/mpesa/callback', async (req, res, next) => {
  try {
    const callback = req.body?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' })
    if (!config.mpesaCallbackSecret || req.query.secret !== config.mpesaCallbackSecret) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized callback' })
    const found = await query(`SELECT * FROM orders WHERE mpesa->>'checkoutRequestID'=$1`, [callback.CheckoutRequestID])
    const order = found.rows[0]
    if (!order) return res.status(404).json({ ResultCode: 1, ResultDesc: 'Order not found' })
    if (order.payment_status === 'paid') return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed' })
    const receipt = extractMpesaReceipt(callback.CallbackMetadata?.Item || [])
    if (callback.ResultCode === 0 && !validateSuccessfulPayment({ receipt, expectedAmount: Math.round(Number(order.total_price)), expectedPhone: order.mpesa.phone })) {
      await query(`UPDATE orders SET mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: 'Payment verification failed: amount, receipt, or phone did not match the order.' }), order.id])
      return res.status(422).json({ ResultCode: 1, ResultDesc: 'Payment verification failed' })
    }
    if (callback.ResultCode === 0) {
      const paid = await withTransaction(async (client) => {
        const locked = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [order.id])
        const current = locked.rows[0]
        if (!current) return { accepted: false, reviewRequired: false }
        if (current.payment_status === 'paid') return { accepted: true, reviewRequired: Boolean(current.mpesa.paymentReviewRequired) }
        if (!['pending', 'initiated', 'failed'].includes(current.payment_status)) return { accepted: false, reviewRequired: false }
        const expiry = current.inventory_expires_at ? new Date(current.inventory_expires_at) : null
        const paidAt = receipt.paidAt || new Date()
        const reservationValidAtPayment = Boolean(current.inventory_reserved && expiry && paidAt <= expiry && paidAt <= new Date())
        const reviewRequired = !reservationValidAtPayment
        const resultDescription = reviewRequired
          ? 'Payment was received after its stock reservation expired. Fulfillment or refund review is required.'
          : callback.ResultDesc || ''
        await client.query(`UPDATE orders SET payment_status='paid',status=$1,inventory_expires_at=NULL,
          mpesa=mpesa || $2::jsonb,updated_at=now() WHERE id=$3`, [reviewRequired ? current.status : 'confirmed', JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription, receiptNumber: receipt.receiptNumber, paidAt, phone: receipt.phone || current.mpesa.phone, ...(reviewRequired ? { paymentReviewRequired: true } : {}) }), order.id])
        return { accepted: true, reviewRequired }
      })
      return res.status(paid.accepted ? 200 : 409).json({ ResultCode: paid.accepted ? 0 : 1, ResultDesc: paid.reviewRequired ? 'Payment accepted for manual fulfillment review' : paid.accepted ? 'Accepted' : 'Order payment is already being processed' })
    }
    await releaseOrderInventory(order.id, 'failed')
    await query(`UPDATE orders SET payment_status='failed',mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2 AND payment_status <> 'paid'`, [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: callback.ResultDesc || '' }), order.id])
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) { next(error) }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const validStatuses = ['awaiting_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
    if (!validStatuses.includes(req.body.status)) return res.status(400).json({ status: 'error', message: 'Invalid status supplied' })
    const status = req.body.status
    const data = await withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = result.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      const transitions = { awaiting_payment: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered'], delivered: [], cancelled: [] }
      if (status !== order.status && !transitions[order.status]?.includes(status)) return { error: [409, `Cannot move an order from ${order.status} to ${status}`] }
      if (status === 'confirmed' && order.payment_status !== 'paid') return { error: [409, 'An order can only be confirmed after payment is received'] }
      if (status === 'confirmed' && order.mpesa?.paymentReviewRequired) return { error: [409, 'This late payment requires fulfillment review before the order can be confirmed.'] }
      if (status === 'cancelled' && order.payment_status === 'paid') return { error: [409, 'Paid orders require an explicit refund process before cancellation.'] }
      if (status === 'cancelled' && order.payment_status !== 'paid') await releaseOrderInventory(order.id, 'failed', client)
      await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2', [status, order.id])
      return { data: await fetchOrder(order.id, { client }) }
    })
    if (data.error) return res.status(data.error[0]).json({ status: 'error', message: data.error[1] })
    res.json({ status: 'success', data: data.data })
  } catch (error) { next(error) }
})

export default router
