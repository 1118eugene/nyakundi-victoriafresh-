import crypto from 'node:crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { config, getMpesaConfigurationStatus } from '../config/index.js'
import { fetchOrder, isDatabaseReady, orderFromRows, query, withTransaction } from '../lib/db.js'
import { calculateShippingFee, findDeliveryZone } from '../lib/deliveryZones.js'
import { createCheckoutFingerprint } from '../lib/orderUtils.js'
import { normalizePhone, validateSuccessfulPayment } from '../lib/paymentUtils.js'
import { extractMpesaReceipt, initiateStkPush } from '../services/mpesa.js'
import { optionalCustomer, requireCustomer } from '../middleware/auth.js'

import { buildDailyAnalytics, parseAnalyticsRange } from '../lib/analyticsUtils.js'
const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_GUEST_ITEMS = 20
const MAX_GUEST_UNITS = 30
const MAX_GUEST_ORDER_VALUE = 100000

const checkoutPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => normalizePhone(req.body?.phone || ''),
  skip: (req) => !normalizePhone(req.body?.phone || ''),
  handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many checkout attempts for this phone number. Please wait and try again.' }),
})

function sanitizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

function requiredText(value, label, maxLength, minLength = 1) {
  const text = sanitizeText(value)
  if (text.length < minLength || text.length > maxLength) {
    const error = new Error(`${label} must be between ${minLength} and ${maxLength} characters.`)
    error.status = 400
    throw error
  }
  return text
}

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

function requireDeliveryStaff(req, res) {
  if (!config.deliveryStaffKey || !config.deliveryStaffId) {
    res.status(503).json({ status: 'error', message: 'Delivery staff access is not configured on this server.' })
    return false
  }
  const candidate = Buffer.from(req.get('x-delivery-key') || '')
  const expected = Buffer.from(config.deliveryStaffKey)
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    res.status(401).json({ status: 'error', message: 'Delivery staff access key required.' })
    return false
  }
  req.deliveryStaffId = config.deliveryStaffId
  return true
}

async function recordOrderEvent(client, orderId, type, actorRole, details = {}) {
  await client.query(`INSERT INTO order_events (order_id,event_type,actor_role,actor_id,details)
    VALUES ($1,$2,$3,$4,$5)`,
  [orderId, type, actorRole, actorRole === 'delivery' ? config.deliveryStaffId : '', JSON.stringify(details)])
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
    ? 'M-Pesa is disabled in mock mode; no payment will be simulated.'
    : readiness.configured
      ? 'M-Pesa is ready to receive payment callbacks.'
      : `M-Pesa is not ready. Configure: ${readiness.missing.join(', ')}.`
  res.json({ status: 'success', data: { configured: readiness.configured, mode: readiness.mode, callbackReady: readiness.callbackReady, missing: readiness.missing, mpesaBaseUrl: readiness.configured ? config.mpesaBaseUrl : null, mpesaShortcode: readiness.configured ? config.mpesaShortcode : null, mpesaCallbackUrl: readiness.configured ? config.mpesaCallbackUrl : null }, message })
})

router.get('/reviews', async (req, res, next) => {
  try {
    const productId = String(req.query.productId || '')
    if (!UUID.test(productId)) return res.status(400).json({ status: 'error', message: 'A valid product ID is required.' })
    const result = await query(`SELECT r.rating,r.body,r.created_at AS "createdAt",p.name AS "productName"
      FROM reviews r JOIN products p ON p.id=r.product_id
      WHERE r.product_id=$1 AND r.status='approved' ORDER BY r.created_at DESC LIMIT 100`, [productId])
    const summary = await query(`SELECT count(*)::int AS count,coalesce(round(avg(rating),1),0)::float AS average
      FROM reviews WHERE product_id=$1 AND status='approved'`, [productId])
    res.json({ status: 'success', data: { reviews: result.rows, summary: summary.rows[0] } })
  } catch (error) { next(error) }
})

router.post('/reviews', async (req, res, next) => {
  try {
    const orderId = String(req.body?.orderId || '')
    const productId = String(req.body?.productId || '')
    const rating = Number(req.body?.rating)
    const body = sanitizeText(req.body?.body || '')
    if (!UUID.test(orderId) || !UUID.test(productId)) return res.status(400).json({ status: 'error', message: 'A valid order and purchased product are required.' })
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ status: 'error', message: 'Choose a rating from 1 to 5.' })
    if (body.length > 1000) return res.status(400).json({ status: 'error', message: 'Reviews must be 1,000 characters or fewer.' })
    const token = req.get('x-order-token') || ''
    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId])
      const order = found.rows[0]
      if (!order) return { error: [404, 'Order not found.'] }
      if (token !== order.tracking_token) return { error: [401, 'Order tracking token required.'] }
      if (order.status !== 'delivered' || order.payment_status !== 'paid') {
        return { error: [409, 'A review can be submitted after the order is delivered and paid.'] }
      }
      const purchasedProduct = await client.query('SELECT 1 FROM order_items WHERE order_id=$1 AND product_id=$2', [orderId, productId])
      if (!purchasedProduct.rowCount) return { error: [400, 'Reviews can only be submitted for products in this order.'] }
      const inserted = await client.query(`INSERT INTO reviews (order_id,product_id,rating,body)
        VALUES ($1,$2,$3,$4) ON CONFLICT (order_id) DO NOTHING RETURNING id,status`,
      [orderId, productId, rating, body])
      if (!inserted.rowCount) return { error: [409, 'A review has already been submitted for this order.'] }
      await recordOrderEvent(client, orderId, 'review_submitted', 'customer')
      return { data: inserted.rows[0] }
    })
    if (result.error) return res.status(result.error[0]).json({ status: 'error', message: result.error[1] })
    res.status(201).json({ status: 'success', data: result.data, message: 'Thank you. Your review will appear after moderation.' })
  } catch (error) { next(error) }
})

router.get('/reviews/moderation', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const result = await query(`SELECT r.id,r.order_id AS "orderId",r.product_id AS "productId",r.rating,r.body,
      r.status,r.created_at AS "createdAt",o.order_number AS "orderNumber",p.name AS "productName"
      FROM reviews r JOIN orders o ON o.id=r.order_id JOIN products p ON p.id=r.product_id
      WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`)
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.patch('/reviews/:reviewId', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    if (!UUID.test(req.params.reviewId)) return res.status(400).json({ status: 'error', message: 'Invalid review ID.' })
    const status = req.body?.status
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ status: 'error', message: 'Review status must be approved or rejected.' })
    const result = await query(`UPDATE reviews SET status=$1,moderated_at=now()
      WHERE id=$2 AND status='pending' RETURNING id,status`, [status, req.params.reviewId])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Pending review not found.' })
    res.json({ status: 'success', data: result.rows[0] })
  } catch (error) { next(error) }
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

router.get('/assigned', async (req, res, next) => {
  try {
    if (!requireDeliveryStaff(req, res)) return
    const result = await query(`SELECT * FROM orders WHERE assigned_delivery_person=$1
      AND status IN ('out_for_delivery','delivered') ORDER BY created_at DESC LIMIT $2`,
    [req.deliveryStaffId, config.maxLimit])
    res.json({ status: 'success', data: await getOrders(result.rows) })
  } catch (error) { next(error) }
})

router.post('/:id/assign-delivery', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    if (!config.deliveryStaffId || !config.deliveryStaffKey) {
      return res.status(503).json({ status: 'error', message: 'Configure delivery staff access before assigning orders.' })
    }
    const data = await withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = result.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      if (!['confirmed', 'preparing', 'out_for_delivery'].includes(order.status)) {
        return { error: [409, 'Only active orders can be assigned for delivery.'] }
      }
      const previous = order.assigned_delivery_name || order.assigned_delivery_person
      await client.query(`UPDATE orders SET assigned_delivery_person=$1,assigned_delivery_name=$2,updated_at=now() WHERE id=$3`,
      [config.deliveryStaffId, config.deliveryStaffName || config.deliveryStaffId, order.id])
      await recordOrderEvent(client, order.id, 'delivery_assigned', 'admin', {
        assignedTo: config.deliveryStaffName || config.deliveryStaffId,
        previousAssignment: previous,
      })
      return { data: await fetchOrder(order.id, { client }) }
    })
    if (data.error) return res.status(data.error[0]).json({ status: 'error', message: data.error[1] })
    res.json({ status: 'success', data: data.data })
  } catch (error) { next(error) }
})

router.post('/:id/location', async (req, res, next) => {
  try {
    if (!requireDeliveryStaff(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const latitude = Number(req.body?.latitude)
    const longitude = Number(req.body?.longitude)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ status: 'error', message: 'Provide valid latitude and longitude coordinates.' })
    }
    const data = await withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = result.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      if (order.assigned_delivery_person !== req.deliveryStaffId || order.status !== 'out_for_delivery') {
        return { error: [403, 'Location sharing is only available for your assigned active deliveries.'] }
      }
      const location = { latitude, longitude, updatedAt: new Date().toISOString() }
      await client.query(`UPDATE orders SET delivery_location=$1,delivery_location_expires_at=now()+interval '15 minutes',updated_at=now() WHERE id=$2`,
      [JSON.stringify(location), order.id])
      await recordOrderEvent(client, order.id, 'delivery_location_updated', 'delivery')
      return { location: { ...location, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } }
    })
    if (data.error) return res.status(data.error[0]).json({ status: 'error', message: data.error[1] })
    res.json({ status: 'success', data: data.location })
  } catch (error) { next(error) }
})

router.patch('/:id/delivery-status', async (req, res, next) => {
  try {
    if (!requireDeliveryStaff(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    if (req.body?.status !== 'delivered') return res.status(400).json({ status: 'error', message: 'Delivery staff can only mark assigned orders delivered.' })
    const data = await withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = result.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      if (order.assigned_delivery_person !== req.deliveryStaffId || order.status !== 'out_for_delivery') {
        return { error: [409, 'Only your assigned orders that are out for delivery can be marked delivered.'] }
      }
      await client.query(`UPDATE orders SET status='delivered',delivered_at=now(),inventory_reserved=false,
        inventory_expires_at=NULL,delivery_location=NULL,
        delivery_location_expires_at=NULL,updated_at=now() WHERE id=$1`, [order.id])
      await recordOrderEvent(client, order.id, 'status_changed', 'delivery', { from: order.status, to: 'delivered' })
      return { data: await fetchOrder(order.id, { client }) }
    })
    if (data.error) return res.status(data.error[0]).json({ status: 'error', message: data.error[1] })
    res.json({ status: 'success', data: data.data })
  } catch (error) { next(error) }
})

router.get('/blocked-phones', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const result = await query('SELECT phone,reason,created_at AS "createdAt" FROM blocked_phones ORDER BY created_at DESC')
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.post('/blocked-phones', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const phone = normalizePhone(req.body?.phone || '')
    if (!/^254[17]\d{8}$/.test(phone)) return res.status(400).json({ status: 'error', message: 'Enter a valid Kenyan mobile phone number.' })
    const reason = sanitizeText(req.body?.reason || '')
    if (reason.length > 300) return res.status(400).json({ status: 'error', message: 'The block reason must be 300 characters or fewer.' })
    const result = await query(`INSERT INTO blocked_phones (phone,reason) VALUES ($1,$2)
      ON CONFLICT (phone) DO UPDATE SET reason=EXCLUDED.reason
      RETURNING phone,reason,created_at AS "createdAt"`, [phone, reason])
    res.status(201).json({ status: 'success', data: result.rows[0] })
  } catch (error) { next(error) }
})

router.delete('/blocked-phones/:phone', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return
    const phone = normalizePhone(req.params.phone)
    if (!/^254[17]\d{8}$/.test(phone)) return res.status(400).json({ status: 'error', message: 'Invalid Kenyan mobile phone number.' })
    await query('DELETE FROM blocked_phones WHERE phone=$1', [phone])
    res.json({ status: 'success', message: 'Phone number removed from the block list.' })
  } catch (error) { next(error) }
})

router.post('/quote', optionalCustomer, async (req, res, next) => {
  try {
    const isGuest = !req.customer
    const itemLimit = isGuest ? MAX_GUEST_ITEMS : 50
    const unitLimit = isGuest ? MAX_GUEST_UNITS : 100
    const county = requiredText(req.body?.county, 'County', 100)
    const town = requiredText(req.body?.town, 'Town or city', 100)
    if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > itemLimit) {
      return res.status(400).json({ status: 'error', message: `Add between 1 and ${itemLimit} different products.` })
    }
    const quantities = new Map()
    const expectedPrices = new Map()
    let unitCount = 0
    for (const item of req.body.items) {
      if (!item || !UUID.test(String(item.productId))) return res.status(400).json({ status: 'error', message: 'Each cart item must use a valid product ID.' })
      const quantity = Number(item.quantity)
      const expectedPrice = Number(item.expectedPrice)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > unitLimit
        || !Number.isFinite(expectedPrice) || expectedPrice < 0) {
        return res.status(400).json({ status: 'error', message: 'Refresh your cart and verify product quantities and prices.' })
      }
      const total = (quantities.get(item.productId) || 0) + quantity
      if (total > unitLimit) return res.status(400).json({ status: 'error', message: `An order may contain no more than ${unitLimit} units.` })
      quantities.set(item.productId, total)
      expectedPrices.set(item.productId, expectedPrice)
      unitCount += quantity
    }
    if (unitCount > unitLimit) return res.status(400).json({ status: 'error', message: `An order may contain no more than ${unitLimit} units.` })
    const products = await query('SELECT * FROM products WHERE id=ANY($1::uuid[])', [[...quantities.keys()]])
    const productById = new Map(products.rows.map((product) => [product.id, product]))
    let subtotalCents = 0
    const items = []
    for (const [productId, quantity] of quantities) {
      const product = productById.get(productId)
      if (!product || !product.price_confirmed || !product.active || !product.in_stock || product.quantity < quantity) {
        return res.status(409).json({ status: 'error', message: `${product?.name || 'A selected product'} is unavailable in the requested quantity. Review your cart before ordering.` })
      }
      const priceCents = Math.round(Number(product.price) * 100)
      if (priceCents !== Math.round(expectedPrices.get(productId) * 100)) {
        return res.status(409).json({ status: 'error', message: `${product.name}'s price has changed. Review the updated cart before ordering.` })
      }
      subtotalCents += priceCents * quantity
      items.push({ productId, quantity, price: priceCents / 100, lineTotal: priceCents * quantity / 100 })
    }
    const deliveryZone = await findDeliveryZone(county, town)
    if (!deliveryZone) {
      return res.status(422).json({ status: 'error', message: 'Delivery coverage is not confirmed for this county and town.' })
    }
    const subtotal = subtotalCents / 100
    if (subtotal < deliveryZone.minimumOrder) {
      return res.status(400).json({ status: 'error', message: `The current delivery minimum is KES ${deliveryZone.minimumOrder.toLocaleString()}.` })
    }
    const shippingFee = calculateShippingFee(deliveryZone)
    const totalPrice = subtotal + shippingFee
    if (isGuest && totalPrice > MAX_GUEST_ORDER_VALUE) {
      return res.status(400).json({ status: 'error', message: `Guest orders are limited to KES ${MAX_GUEST_ORDER_VALUE.toLocaleString()}.` })
    }
    res.json({ status: 'success', data: {
      items,
      subtotal,
      shippingFee,
      totalPrice,
      deliveryZone: {
        name: deliveryZone.name,
        minimumOrder: deliveryZone.minimumOrder,
        deliveryWindows: deliveryZone.deliveryWindows,
        cutoffAt: deliveryZone.cutoffAt,
      },
    } })
  } catch (error) { next(error) }
})

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

router.post('/:id/payment/mpesa', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const token = req.get('x-order-token') || ''
    const started = await withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = result.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      if (token !== order.tracking_token) return { error: [401, 'Order tracking token required'] }
      if (order.status !== 'delivered') return { error: [409, 'M-Pesa payment can only be requested after delivery.'] }
      if (order.payment_method !== 'mpesa_after_delivery') return { error: [409, 'This order was not placed with M-Pesa after delivery.'] }
      if (order.payment_status === 'paid') return { error: [409, 'This order has already been paid.'] }
      if (order.payment_status === 'initiated') return { error: [409, 'An M-Pesa request is already pending for this order. Check your phone or contact support before retrying.'] }
      await client.query(`INSERT INTO payments (order_id,method,amount,status,phone)
        VALUES ($1,'mpesa',$2,'initiated',$3)`, [order.id, Number(order.total_price), order.mpesa.phone || order.customer.phone])
      await client.query(`UPDATE orders SET payment_status='initiated',updated_at=now() WHERE id=$1`, [order.id])
      await recordOrderEvent(client, order.id, 'payment_initiated', 'customer', { method: 'mpesa' })
      return { order }
    })
    if (started.error) return res.status(started.error[0]).json({ status: 'error', message: started.error[1] })
    let request
    try {
      request = await initiateStkPush({
        phone: started.order.mpesa.phone || started.order.customer.phone,
        amount: Number(started.order.total_price),
        orderNumber: started.order.order_number,
        description: `Payment for ${started.order.order_number}`,
      })
    } catch (error) {
      if (!error.paymentOutcomeUnknown) {
        await withTransaction(async (client) => {
          await client.query(`UPDATE orders SET payment_status='failed',updated_at=now()
            WHERE id=$1 AND payment_status='initiated'`, [started.order.id])
          await client.query(`UPDATE payments SET status='failed',details=$1,updated_at=now()
            WHERE order_id=$2 AND method='mpesa' AND status='initiated'`,
          [JSON.stringify({ error: error.message }), started.order.id])
          await recordOrderEvent(client, started.order.id, 'payment_failed', 'system', { method: 'mpesa' })
        })
      }
      throw error
    }
    await withTransaction(async (client) => {
      await client.query(`UPDATE orders SET mpesa=mpesa || $1::jsonb,updated_at=now() WHERE id=$2`,
      [JSON.stringify({ checkoutRequestID: request.CheckoutRequestID, merchantRequestID: request.MerchantRequestID, phone: request.normalizedPhone, requestedAt: request.requestedAt }), started.order.id])
      await client.query(`UPDATE payments SET provider_request_id=$1,phone=$2,details=$3,updated_at=now()
        WHERE order_id=$4 AND method='mpesa' AND status='initiated'`,
      [request.CheckoutRequestID, request.normalizedPhone, JSON.stringify({ merchantRequestId: request.MerchantRequestID }), started.order.id])
    })
    res.status(202).json({ status: 'success', message: 'M-Pesa prompt sent. Complete the payment on your phone.', data: { orderId: started.order.id, checkoutRequestId: request.CheckoutRequestID } })
  } catch (error) { next(error) }
})

router.post('/:id/payment/cash', async (req, res, next) => {
  try {
    if (!requireDeliveryStaff(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])
      const order = found.rows[0]
      if (!order) return { error: [404, 'Order not found'] }
      if (order.assigned_delivery_person !== req.deliveryStaffId
        || order.status !== 'delivered'
        || order.payment_method !== 'cash_on_delivery') {
        return { error: [403, 'Cash can only be recorded by the assigned delivery person for a delivered cash-on-delivery order.'] }
      }
      if (order.payment_status === 'paid') {
        const existing = await client.query(`SELECT receipt_number AS "receiptNumber" FROM payments
          WHERE order_id=$1 AND method='cash' AND status='paid' ORDER BY created_at LIMIT 1`, [order.id])
        return { receiptNumber: existing.rows[0]?.receiptNumber || null, alreadyPaid: true }
      }
      const receiptNumber = `CASH-${order.order_number}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      await client.query(`INSERT INTO payments (order_id,method,amount,status,receipt_number,paid_at,details)
        VALUES ($1,'cash',$2,'paid',$3,now(),$4)`,
      [order.id, Number(order.total_price), receiptNumber, JSON.stringify({ receivedBy: req.deliveryStaffId })])
      await client.query(`UPDATE orders SET payment_status='paid',updated_at=now() WHERE id=$1`, [order.id])
      await recordOrderEvent(client, order.id, 'payment_received', 'delivery', { method: 'cash', receiptNumber })
      return { receiptNumber, alreadyPaid: false }
    })
    if (result.error) return res.status(result.error[0]).json({ status: 'error', message: result.error[1] })
    res.json({ status: 'success', data: result })
  } catch (error) { next(error) }
})

router.post('/checkout', checkoutPhoneLimiter, optionalCustomer, async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ status: 'error', message: 'Checkout details must be provided as a JSON object.' })
    const checkoutKey = req.get('x-checkout-key') || ''
    if (!UUID.test(checkoutKey)) return res.status(400).json({ status: 'error', message: 'A valid checkout attempt key is required. Refresh checkout and try again.' })
    if (sanitizeText(req.body.website || '')) return res.status(400).json({ status: 'error', message: 'Unable to accept this checkout request.' })
    const customerName = requiredText(req.body.customerName || req.customer?.customerName, 'Customer name', 120, 2)
    const phone = normalizePhone(requiredText(req.body.phone || req.customer?.phone, 'Phone number', 20, 9))
    if (!/^254[17]\d{8}$/.test(phone)) return res.status(400).json({ status: 'error', message: 'Enter a valid Kenyan mobile phone number.' })
    const email = sanitizeText(req.body.email || req.customer?.email || '')
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid email address or leave it blank.' })
    }
    const county = requiredText(req.body.county, 'County', 100)
    const town = requiredText(req.body.town, 'Town or city', 100)
    const addressLine = requiredText(req.body.addressLine, 'Delivery address', 300)
    const landmark = sanitizeText(req.body.landmark || '')
    const notes = sanitizeText(req.body.notes || '')
    if (landmark.length > 200 || notes.length > 1000) return res.status(400).json({ status: 'error', message: 'Delivery instructions exceed the allowed length.' })
    const paymentMethod = String(req.body.paymentMethod || 'cash_on_delivery')
    if (!['cash_on_delivery', 'mpesa_after_delivery'].includes(paymentMethod)) {
      return res.status(400).json({ status: 'error', message: 'Choose cash on delivery or M-Pesa after delivery.' })
    }
    const isGuest = !req.customer
    const itemLimit = isGuest ? MAX_GUEST_ITEMS : 50
    const unitLimit = isGuest ? MAX_GUEST_UNITS : 100
    const items = req.body.items
    if (!Array.isArray(items) || !items.length || items.length > itemLimit) {
      return res.status(400).json({ status: 'error', message: `Add between 1 and ${itemLimit} cart items before checkout.` })
    }
    const quantities = new Map()
    const expectedPrices = new Map()
    let unitCount = 0
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return res.status(400).json({ status: 'error', message: 'Each cart item must be a valid object.' })
      if (!UUID.test(String(item.productId))) return res.status(400).json({ status: 'error', message: 'Each cart item must use a valid product ID.' })
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > unitLimit) return res.status(400).json({ status: 'error', message: `Each cart quantity must be an integer between 1 and ${unitLimit}.` })
      const expectedPrice = Number(item.expectedPrice)
      if (!Number.isFinite(expectedPrice) || expectedPrice < 0) return res.status(400).json({ status: 'error', message: 'Refresh your cart to confirm current product prices before checkout.' })
      const priorPrice = expectedPrices.get(item.productId)
      if (priorPrice !== undefined && priorPrice !== expectedPrice) return res.status(400).json({ status: 'error', message: 'A product has conflicting prices in the cart. Refresh your cart and try again.' })
      const total = (quantities.get(item.productId) || 0) + quantity
      if (total > unitLimit) return res.status(400).json({ status: 'error', message: `The total quantity for a product cannot exceed ${unitLimit}.` })
      quantities.set(item.productId, total)
      expectedPrices.set(item.productId, expectedPrice)
      unitCount += quantity
    }
    if (unitCount > unitLimit) return res.status(400).json({ status: 'error', message: `An order may contain no more than ${unitLimit} total units.` })
    const fingerprint = createCheckoutFingerprint({
      customerId: req.customer?.id || null,
      customerName,
      phone,
      paymentPhone: phone,
      paymentMethod,
      county,
      town,
      addressLine,
      landmark,
      notes,
      items: [...quantities].map(([productId, quantity]) => ({ productId, quantity, expectedPrice: expectedPrices.get(productId) })),
    })
    const trackingToken = crypto.randomBytes(24).toString('hex')
    const reservation = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [checkoutKey])
      const prior = await client.query('SELECT * FROM orders WHERE checkout_key=$1', [checkoutKey])
      if (prior.rows[0]) {
        const order = prior.rows[0]
        if ((order.customer_id || null) !== (req.customer?.id || null) || order.checkout_fingerprint !== fingerprint) {
          const error = new Error('This checkout attempt was already used. Refresh checkout to place a new order.')
          error.status = 409
          throw error
        }
        return { order, reused: true }
      }
      const blocked = await client.query('SELECT 1 FROM blocked_phones WHERE phone=$1', [phone])
      if (blocked.rowCount) {
        const error = new Error('This phone number cannot place an order online. Please contact customer support.')
        error.status = 403
        throw error
      }
      const deliveryZone = await findDeliveryZone(county, town, client)
      if (!deliveryZone) {
        const error = new Error('Delivery coverage is not confirmed for this county and town.')
        error.status = 422
        throw error
      }
      const orderItems = []
      let subtotalCents = 0
      for (const [productId, quantity] of quantities) {
        const found = await client.query('SELECT * FROM products WHERE id=$1 AND active=true AND in_stock=true AND price_confirmed=true FOR UPDATE', [productId])
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
        const priceCents = Math.round(Number(product.price) * 100)
        const price = priceCents / 100
        const lineTotal = priceCents * quantity / 100
        subtotalCents += priceCents * quantity
        orderItems.push({ productId, sku: product.sku, name: product.name, unit: product.unit, price, quantity, lineTotal, image: product.image })
      }
      const subtotal = subtotalCents / 100
      if (subtotal < deliveryZone.minimumOrder) {
        const error = new Error(`The current delivery minimum is KES ${deliveryZone.minimumOrder.toLocaleString()}.`)
        error.status = 400
        throw error
      }
      const shippingFee = calculateShippingFee(deliveryZone)
      const totalPrice = subtotal + shippingFee
      if (isGuest && totalPrice > MAX_GUEST_ORDER_VALUE) {
        const error = new Error(`Guest orders are limited to KES ${MAX_GUEST_ORDER_VALUE.toLocaleString()}.`)
        error.status = 400
        throw error
      }
      const orderResult = await client.query(`INSERT INTO orders
        (order_number,user_id,customer_id,tracking_token,inventory_reserved,inventory_expires_at,customer,delivery,subtotal,shipping_fee,total_price,payment_method,checkout_key,checkout_fingerprint,mpesa)
        VALUES ($1,$2,$2,$3,true,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [createOrderNumber(), req.customer?.id || null, trackingToken, JSON.stringify({ name: customerName, email, phone }), JSON.stringify({
        county,
        town,
        addressLine,
        landmark,
        notes,
        deliveryZone: {
          id: deliveryZone.id,
          name: deliveryZone.name,
          fee: shippingFee,
          minimumOrder: deliveryZone.minimumOrder,
          deliveryWindows: deliveryZone.deliveryWindows,
          cutoffAt: deliveryZone.cutoffAt,
        },
      }), subtotal, shippingFee, totalPrice, paymentMethod, checkoutKey, fingerprint, JSON.stringify({ phone })])
      const order = orderResult.rows[0]
      for (const item of orderItems) await client.query(`INSERT INTO order_items (order_id,product_id,sku,name,unit,price,quantity,line_total,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [order.id, item.productId, item.sku, item.name, item.unit, item.price, item.quantity, item.lineTotal, item.image])
      await recordOrderEvent(client, order.id, 'order_placed', req.customer ? 'customer' : 'guest')
      return { order, reused: false }
    })
    if (reservation.reused) {
      const data = await fetchOrder(reservation.order.id)
      return res.json({
        status: 'success',
        message: 'Recovered the existing order for this checkout attempt.',
        data,
        payment: { configured: paymentMethod === 'cash_on_delivery' || getMpesaConfigurationStatus().configured, status: reservation.order.payment_status, trackingToken: reservation.order.tracking_token, cartMatchesOrder: true },
      })
    }
    const data = await fetchOrder(reservation.order.id)
    const configured = paymentMethod === 'cash_on_delivery' || getMpesaConfigurationStatus().configured
    const customerMessage = paymentMethod === 'cash_on_delivery'
      ? 'No payment has been collected. Pay cash to the delivery team after your order arrives.'
      : 'No payment has happened yet. M-Pesa payment can be requested after delivery; ordering remains available if M-Pesa is temporarily unavailable.'
    return res.status(201).json({
      status: 'success',
      message: 'Order received. Payment is due after delivery.',
      data,
      payment: { configured, status: reservation.order.payment_status, trackingToken, cartMatchesOrder: true, customerMessage },
    })
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
        const postDeliveryPayment = current.status === 'delivered' && current.payment_method === 'mpesa_after_delivery'
        const reservationValidAtPayment = postDeliveryPayment
          || Boolean(current.inventory_reserved && expiry && paidAt <= expiry && paidAt <= new Date())
        const reviewRequired = !reservationValidAtPayment
        const updatedStatus = reviewRequired || current.status !== 'awaiting_payment' ? current.status : 'confirmed'
        const resultDescription = reviewRequired
          ? 'Payment was received after its stock reservation expired. Fulfillment or refund review is required.'
          : callback.ResultDesc || ''
        await client.query(`UPDATE orders SET payment_status='paid',status=$1,inventory_expires_at=NULL,
          confirmed_at=CASE WHEN $1='confirmed' AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
          mpesa=mpesa || $2::jsonb,updated_at=now() WHERE id=$3`, [updatedStatus, JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription, receiptNumber: receipt.receiptNumber, paidAt, phone: receipt.phone || current.mpesa.phone, ...(reviewRequired ? { paymentReviewRequired: true } : {}) }), order.id])
        const paymentUpdate = await client.query(`UPDATE payments SET status='paid',amount=$1,receipt_number=$2,
          phone=$3,paid_at=$4,details=details || $5::jsonb,updated_at=now()
          WHERE provider_request_id=$6 AND order_id=$7`,
        [Number(order.total_price), receipt.receiptNumber || null, receipt.phone || current.mpesa.phone || '',
          paidAt, JSON.stringify({ resultCode: callback.ResultCode }), callback.CheckoutRequestID, order.id])
        if (!paymentUpdate.rowCount) {
          await client.query(`INSERT INTO payments (order_id,method,amount,status,provider_request_id,receipt_number,phone,paid_at,details)
            VALUES ($1,'mpesa',$2,'paid',$3,$4,$5,$6,$7) ON CONFLICT (provider_request_id) DO NOTHING`,
          [order.id, Number(order.total_price), callback.CheckoutRequestID, receipt.receiptNumber || null,
            receipt.phone || current.mpesa.phone || '', paidAt, JSON.stringify({ resultCode: callback.ResultCode })])
        }
        await recordOrderEvent(client, order.id, 'payment_received', 'system', { method: 'mpesa', receiptNumber: receipt.receiptNumber })
        if (!reviewRequired && current.status !== updatedStatus) {
          await recordOrderEvent(client, order.id, 'status_changed', 'system', { from: current.status, to: updatedStatus })
        }
        return { accepted: true, reviewRequired }
      })
      return res.status(paid.accepted ? 200 : 409).json({ ResultCode: paid.accepted ? 0 : 1, ResultDesc: paid.reviewRequired ? 'Payment accepted for manual fulfillment review' : paid.accepted ? 'Accepted' : 'Order payment is already being processed' })
    }
    await withTransaction(async (client) => {
      const currentResult = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [order.id])
      const current = currentResult.rows[0]
      if (!current || current.payment_status === 'paid') return
      await releaseOrderInventory(order.id, 'failed', client)
      await client.query(`UPDATE orders SET payment_status='failed',mpesa=mpesa || $1::jsonb,updated_at=now()
        WHERE id=$2 AND payment_status <> 'paid'`,
      [JSON.stringify({ callbackPayload: callback, resultCode: callback.ResultCode, resultDescription: callback.ResultDesc || '' }), order.id])
      await client.query(`UPDATE payments SET status='failed',details=details || $1::jsonb,updated_at=now()
        WHERE provider_request_id=$2 AND order_id=$3 AND status='initiated'`,
      [JSON.stringify({ resultCode: callback.ResultCode }), callback.CheckoutRequestID, order.id])
      await recordOrderEvent(client, order.id, 'payment_failed', 'system', { method: 'mpesa', resultCode: callback.ResultCode })
    })
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
      if (status === 'confirmed' && !['cash_on_delivery', 'mpesa_after_delivery'].includes(order.payment_method) && order.payment_status !== 'paid') return { error: [409, 'This payment method requires payment confirmation before the order can be confirmed'] }
      if (status === 'confirmed' && order.mpesa?.paymentReviewRequired) return { error: [409, 'This late payment requires fulfillment review before the order can be confirmed.'] }
      if (status === 'cancelled' && order.payment_status === 'paid') return { error: [409, 'Paid orders require an explicit refund process before cancellation.'] }
      if (status === 'cancelled' && order.payment_status !== 'paid') await releaseOrderInventory(order.id, 'failed', client)
      const timestampColumn = {
        confirmed: 'confirmed_at',
        preparing: 'preparing_at',
        out_for_delivery: 'dispatched_at',
        delivered: 'delivered_at',
        cancelled: 'cancelled_at',
      }[status]
      await client.query(`UPDATE orders SET status=$1,
        ${timestampColumn ? `${timestampColumn}=COALESCE(${timestampColumn},now()),` : ''}
        ${status === 'delivered' ? 'inventory_reserved=false,inventory_expires_at=NULL,delivery_location=NULL,delivery_location_expires_at=NULL,' : ''}
        updated_at=now() WHERE id=$2`, [status, order.id])
      if (status !== order.status) {
        await recordOrderEvent(client, order.id, 'status_changed', 'admin', { from: order.status, to: status })
      }
      return { data: await fetchOrder(order.id, { client }) }
    })
    if (data.error) return res.status(data.error[0]).json({ status: 'error', message: data.error[1] })
    res.json({ status: 'success', data: data.data })
  } catch (error) { next(error) }
})

export default router
