import crypto from 'node:crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'
import { normalizePhone } from '../lib/paymentUtils.js'
import { query, withTransaction } from '../lib/db.js'

const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KENYAN_PHONE = /^(?:0[17]\d{8}|\+?254[17]\d{8})$/
const phoneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 4,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => normalizePhone(req.body?.phone || ''),
  skip: (req) => !KENYAN_PHONE.test(String(req.body?.phone || '')),
  handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many feedback submissions for this phone number. Please try again later.' }),
})
const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many feedback submissions from this network. Please try again later.' }),
})

function requireAdmin(req, res) {
  const candidate = Buffer.from(req.get('x-admin-key') || '')
  const expected = Buffer.from(config.adminDashboardKey || '')
  if (!expected.length) {
    res.status(503).json({ status: 'error', message: 'Admin access is not configured on this server.' })
    return false
  }
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    res.status(401).json({ status: 'error', message: 'Admin access key required.' })
    return false
  }
  return true
}

function cleanText(value) {
  return String(value || '').normalize('NFKC')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function boundedText(value, label, maxLength, { required = true } = {}) {
  const text = cleanText(value)
  if ((required && !text) || text.length > maxLength) {
    const error = new Error(`${label} is required and must be no more than ${maxLength} characters.`)
    error.status = 400
    throw error
  }
  return text
}

function rating(value, label) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    const error = new Error(`${label} must be a whole number from 1 to 5.`)
    error.status = 400
    throw error
  }
  return parsed
}

function customerPhone(value) {
  const phone = String(value || '').trim()
  if (!KENYAN_PHONE.test(phone)) {
    const error = new Error('Enter a valid Kenyan mobile number to help prevent duplicate submissions.')
    error.status = 400
    throw error
  }
  return normalizePhone(phone)
}

function phoneHash(phone) {
  const hashingKey = config.authSecret || config.adminDashboardKey
  if (!hashingKey) {
    const error = new Error('Feedback submission is temporarily unavailable. Please contact the team.')
    error.status = 503
    throw error
  }
  return crypto.createHmac('sha256', hashingKey).update(phone).digest('hex')
}

function csvCell(value) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ')
  const safe = /^[=+\-@\t]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function reviewErrorResponse(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ status: 'error', message: 'Feedback has already been submitted for this product or order.' })
  }
  if (error.status) {
    return res.status(error.status).json({ status: 'error', message: error.message })
  }
  return next(error)
}

async function publicReviewRows(productId, limit, skip) {
  return query(`SELECT id,"customerName",rating,title,comment,"verifiedPurchase","adminReply","createdAt"
    FROM (
      SELECT r.id,r.customer_name AS "customerName",r.rating,r.title,r.comment,
        r.verified_purchase AS "verifiedPurchase",r.admin_reply AS "adminReply",r.created_at AS "createdAt"
      FROM product_reviews r WHERE r.product_id=$1 AND r.status='approved'
      UNION ALL
      SELECT legacy.id,'Verified customer',legacy.rating,'',legacy.body,true,'',legacy.created_at
      FROM reviews legacy WHERE legacy.product_id=$1 AND legacy.status='approved'
    ) approved_reviews ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, [productId, limit, skip])
}

router.get('/', async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 8
    const result = await query(`SELECT * FROM (
      SELECT r.id,r.customer_name AS "customerName",p.name AS "productName",r.rating,
        r.title,r.comment,r.verified_purchase AS "verifiedPurchase",r.created_at AS "createdAt"
      FROM product_reviews r JOIN products p ON p.id=r.product_id
      WHERE r.status='approved'
      UNION ALL
      SELECT r.id,'Verified customer',p.name,r.rating,'',r.body,true,r.created_at
      FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.status='approved'
    ) approved_reviews ORDER BY "createdAt" DESC LIMIT $1`, [limit])
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.get('/products/:productId', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.productId)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const product = await query('SELECT id FROM products WHERE id=$1 AND active=true', [req.params.productId])
    if (!product.rowCount) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 10
    const requestedSkip = Number(req.query.skip)
    const skip = Number.isInteger(requestedSkip) ? Math.max(requestedSkip, 0) : 0
    const [allReviews, summary] = await Promise.all([
      publicReviewRows(req.params.productId, limit, skip),
      query(`SELECT count(*)::int AS count,coalesce(round(avg(rating),1),0)::float AS average,
        count(*) FILTER (WHERE rating=1)::int AS "oneStar",
        count(*) FILTER (WHERE rating=2)::int AS "twoStar",
        count(*) FILTER (WHERE rating=3)::int AS "threeStar",
        count(*) FILTER (WHERE rating=4)::int AS "fourStar",
        count(*) FILTER (WHERE rating=5)::int AS "fiveStar"
        FROM (
          SELECT rating FROM product_reviews WHERE product_id=$1 AND status='approved'
          UNION ALL SELECT rating FROM reviews WHERE product_id=$1 AND status='approved'
        ) ratings`, [req.params.productId]),
    ])
    res.json({
      status: 'success',
      data: {
        reviews: allReviews.rows,
        pagination: { total: summary.rows[0].count, skip, limit, returned: allReviews.rowCount },
        summary: summary.rows[0],
      },
    })
  } catch (error) { next(error) }
})

router.get('/products/:productId/orders/:orderId', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.productId) || !UUID.test(req.params.orderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product or order ID.' })
    }
    const result = await query(`SELECT o.tracking_token,o.status,
      EXISTS(SELECT 1 FROM product_reviews r WHERE r.product_id=$1 AND r.order_id=o.id)
        OR EXISTS(SELECT 1 FROM reviews r WHERE r.product_id=$1 AND r.order_id=o.id) AS submitted,
      EXISTS(SELECT 1 FROM order_items i WHERE i.product_id=$1 AND i.order_id=o.id) AS purchased
      FROM orders o WHERE o.id=$2`, [req.params.productId, req.params.orderId])
    const order = result.rows[0]
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found.' })
    if (req.get('x-order-token') !== order.tracking_token) return res.status(401).json({ status: 'error', message: 'A valid private order-tracking link is required.' })
    res.json({ status: 'success', data: { delivered: order.status === 'delivered', purchased: order.purchased, submitted: order.submitted } })
  } catch (error) { next(error) }
})

router.post('/products', ipLimiter, phoneLimiter, async (req, res, next) => {
  try {
    const productId = String(req.body?.productId || '')
    if (!UUID.test(productId)) return res.status(400).json({ status: 'error', message: 'A valid product is required.' })
    const name = boundedText(req.body?.customerName, 'Name', 100)
    const phone = customerPhone(req.body?.phone)
    const title = boundedText(req.body?.title, 'Review title', 120)
    const comment = boundedText(req.body?.comment, 'Review comment', 2000)
    const score = rating(req.body?.rating, 'Rating')
    const orderId = req.body?.orderId ? String(req.body.orderId) : null
    if (orderId && !UUID.test(orderId)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const result = await withTransaction(async (client) => {
      const activeProduct = await client.query('SELECT id FROM products WHERE id=$1 AND active=true', [productId])
      if (!activeProduct.rowCount) return { error: [404, 'Product not found.'] }
      let verifiedPurchase = false
      if (orderId) {
        const orderResult = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId])
        const order = orderResult.rows[0]
        if (!order) return { error: [404, 'Order not found.'] }
        if (req.get('x-order-token') !== order.tracking_token) return { error: [401, 'A valid private order-tracking link is required.'] }
        if (normalizePhone(order.customer?.phone || '') !== phone) return { error: [403, 'Use the phone number associated with this order.'] }
        if (order.status !== 'delivered') return { error: [409, 'A verified-purchase review can be submitted after delivery.'] }
        const purchased = await client.query('SELECT 1 FROM order_items WHERE order_id=$1 AND product_id=$2', [orderId, productId])
        if (!purchased.rowCount) return { error: [400, 'This product was not included in the order.'] }
        const legacyReview = await client.query('SELECT 1 FROM reviews WHERE order_id=$1 AND product_id=$2', [orderId, productId])
        if (legacyReview.rowCount) return { error: [409, 'A review has already been submitted for this product in the order.'] }
        verifiedPurchase = true
      }
      const inserted = await client.query(`INSERT INTO product_reviews
        (product_id,order_id,customer_name,customer_phone_hash,rating,title,comment,verified_purchase)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,verified_purchase AS "verifiedPurchase"`,
      [productId, orderId, name, phoneHash(phone), score, title, comment, verifiedPurchase])
      return { data: inserted.rows[0] }
    })
    if (result.error) return res.status(result.error[0]).json({ status: 'error', message: result.error[1] })
    res.status(201).json({ status: 'success', data: result.data, message: 'Thank you. Your review is awaiting moderation.' })
  } catch (error) { reviewErrorResponse(error, res, next) }
})

router.post('/service', ipLimiter, phoneLimiter, async (req, res, next) => {
  try {
    const orderId = String(req.body?.orderId || '')
    if (!UUID.test(orderId)) return res.status(400).json({ status: 'error', message: 'A valid delivered order is required.' })
    const phone = customerPhone(req.body?.phone)
    const result = await withTransaction(async (client) => {
      const orderResult = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId])
      const order = orderResult.rows[0]
      if (!order) return { error: [404, 'Order not found.'] }
      if (req.get('x-order-token') !== order.tracking_token) return { error: [401, 'A valid private order-tracking link is required.'] }
      if (normalizePhone(order.customer?.phone || '') !== phone) return { error: [403, 'Use the phone number associated with this order.'] }
      if (order.status !== 'delivered') return { error: [409, 'Service feedback can be submitted after delivery.'] }
      const delivery = rating(req.body?.deliveryRating, 'Delivery rating')
      const productQuality = rating(req.body?.productQualityRating, 'Product quality rating')
      const customerService = rating(req.body?.customerServiceRating, 'Customer service rating')
      if (typeof req.body?.wouldRecommend !== 'boolean') {
        return { error: [400, 'Choose whether you would recommend the service.'] }
      }
      const name = boundedText(req.body?.customerName || order.customer?.name, 'Name', 100)
      const comment = boundedText(req.body?.comment || '', 'Comment', 2000, { required: false })
      const overall = Math.round((delivery + productQuality + customerService) / 3)
      const inserted = await client.query(`INSERT INTO service_feedback(order_id,customer_name,overall_rating,
        delivery_rating,product_quality_rating,customer_service_rating,comment,would_recommend)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status`,
      [orderId, name, overall, delivery, productQuality, customerService, comment, req.body.wouldRecommend])
      return { data: inserted.rows[0] }
    })
    if (result.error) return res.status(result.error[0]).json({ status: 'error', message: result.error[1] })
    res.status(201).json({ status: 'success', data: result.data, message: 'Thank you for sharing feedback about your order.' })
  } catch (error) { reviewErrorResponse(error, res, next) }
})

router.get('/service/:orderId', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.orderId)) return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    const result = await query(`SELECT o.tracking_token,o.status,f.id IS NOT NULL AS submitted
      FROM orders o LEFT JOIN service_feedback f ON f.order_id=o.id WHERE o.id=$1`, [req.params.orderId])
    const order = result.rows[0]
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found.' })
    if (req.get('x-order-token') !== order.tracking_token) return res.status(401).json({ status: 'error', message: 'A valid private order-tracking link is required.' })
    res.json({ status: 'success', data: { delivered: order.status === 'delivered', submitted: order.submitted } })
  } catch (error) { next(error) }
})

router.get('/admin/summary', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const [category, stars, mostReviewed, lowestRated, service] = await Promise.all([
      query(`SELECT p.category,count(*)::int AS count,round(avg(r.rating),1)::float AS average
        FROM (
          SELECT product_id,rating FROM product_reviews WHERE status='approved'
          UNION ALL SELECT product_id,rating FROM reviews WHERE status='approved'
        ) r JOIN products p ON p.id=r.product_id GROUP BY p.category ORDER BY p.category`),
      query(`SELECT rating,count(*)::int AS count FROM (
        SELECT rating FROM product_reviews WHERE status='approved'
        UNION ALL SELECT rating FROM reviews WHERE status='approved'
      ) ratings GROUP BY rating ORDER BY rating`),
      query(`SELECT p.id,p.name,count(*)::int AS count,round(avg(r.rating),1)::float AS average
        FROM (SELECT product_id,rating FROM product_reviews WHERE status='approved'
          UNION ALL SELECT product_id,rating FROM reviews WHERE status='approved') r
        JOIN products p ON p.id=r.product_id GROUP BY p.id ORDER BY count DESC,p.name LIMIT 5`),
      query(`SELECT p.id,p.name,count(*)::int AS count,round(avg(r.rating),1)::float AS average
        FROM (SELECT product_id,rating FROM product_reviews WHERE status='approved'
          UNION ALL SELECT product_id,rating FROM reviews WHERE status='approved') r
        JOIN products p ON p.id=r.product_id GROUP BY p.id HAVING count(*) >= 1
        ORDER BY average ASC,count DESC,p.name LIMIT 5`),
      query(`SELECT count(*)::int AS count,coalesce(round(avg(overall_rating),1),0)::float AS average
        FROM service_feedback WHERE status='approved'`),
    ])
    res.json({ status: 'success', data: { categories: category.rows, stars: stars.rows, mostReviewed: mostReviewed.rows, lowestRated: lowestRated.rows, service: service.rows[0] } })
  } catch (error) { next(error) }
})

router.get('/admin', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const type = String(req.query.type || 'all')
    const status = String(req.query.status || '')
    const search = cleanText(req.query.search || '').slice(0, 100)
    if (!['all', 'products', 'service'].includes(type)) return res.status(400).json({ status: 'error', message: 'Choose products, service, or all feedback.' })
    if (status && !['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ status: 'error', message: 'Invalid feedback status filter.' })
    const searchLike = `%${search}%`
    const results = []
    if (type !== 'service') {
      const conditions = []
      const values = []
      if (status) { values.push(status); conditions.push(`r.status=$${values.length}`) }
      if (search) { values.push(searchLike); conditions.push(`(r.customer_name ILIKE $${values.length} OR r.title ILIKE $${values.length} OR r.comment ILIKE $${values.length} OR p.name ILIKE $${values.length})`) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const rows = await query(`SELECT r.id,'products' AS type,r.product_id AS "productId",p.name AS "productName",
        r.order_id AS "orderId",r.customer_name AS "customerName",r.rating,r.title,r.comment,
        r.status,r.verified_purchase AS "verifiedPurchase",r.admin_reply AS "adminReply",
        r.created_at AS "createdAt",r.updated_at AS "updatedAt"
        FROM product_reviews r JOIN products p ON p.id=r.product_id ${where}
        ORDER BY r.created_at DESC LIMIT 300`, values)
      results.push(...rows.rows)
      if (!status || status === 'pending' || status === 'approved' || status === 'rejected') {
        const legacyConditions = ["r.status IN ('pending','approved','rejected')"]
        const legacyValues = []
        if (status) { legacyValues.push(status); legacyConditions.push(`r.status=$${legacyValues.length}`) }
        if (search) { legacyValues.push(searchLike); legacyConditions.push(`(o.order_number ILIKE $${legacyValues.length} OR p.name ILIKE $${legacyValues.length} OR r.body ILIKE $${legacyValues.length})`) }
        const legacyRows = await query(`SELECT r.id,'legacy' AS type,r.product_id AS "productId",p.name AS "productName",
          r.order_id AS "orderId",o.order_number AS "orderNumber",o.customer->>'name' AS "customerName",
          r.rating,'' AS title,r.body AS comment,r.status,true AS "verifiedPurchase",'' AS "adminReply",
          r.created_at AS "createdAt",r.moderated_at AS "updatedAt"
          FROM reviews r JOIN products p ON p.id=r.product_id JOIN orders o ON o.id=r.order_id
          WHERE ${legacyConditions.join(' AND ')} ORDER BY r.created_at DESC LIMIT 300`, legacyValues)
        results.push(...legacyRows.rows)
      }
    }
    if (type !== 'products') {
      const conditions = []
      const values = []
      if (status) { values.push(status); conditions.push(`status=$${values.length}`) }
      if (search) { values.push(searchLike); conditions.push(`(customer_name ILIKE $${values.length} OR comment ILIKE $${values.length})`) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const rows = await query(`SELECT id,'service' AS type,order_id AS "orderId",customer_name AS "customerName",
        overall_rating AS rating,delivery_rating AS "deliveryRating",
        product_quality_rating AS "productQualityRating",customer_service_rating AS "customerServiceRating",
        comment,would_recommend AS "wouldRecommend",status,admin_reply AS "adminReply",
        created_at AS "createdAt",updated_at AS "updatedAt"
        FROM service_feedback ${where} ORDER BY created_at DESC LIMIT 300`, values)
      results.push(...rows.rows)
    }
    results.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    res.json({ status: 'success', data: results.slice(0, 300) })
  } catch (error) { next(error) }
})

router.get('/admin/export.csv', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const type = String(req.query.type || 'all')
    if (!['all', 'products', 'service'].includes(type)) return res.status(400).json({ status: 'error', message: 'Choose products, service, or all feedback.' })
    const lines = []
    if (type !== 'service') {
      const result = await query(`SELECT r.id,'product' AS type,p.sku,p.name AS product_name,r.customer_name,
        r.rating,r.title,r.comment,r.status,r.verified_purchase,r.admin_reply,r.created_at
        FROM product_reviews r JOIN products p ON p.id=r.product_id
        UNION ALL
        SELECT r.id,'legacy_product' AS type,p.sku,p.name,o.customer->>'name',r.rating,'',r.body,
          r.status,true,'',r.created_at
        FROM reviews r JOIN products p ON p.id=r.product_id JOIN orders o ON o.id=r.order_id
        ORDER BY created_at DESC LIMIT 5000`)
      lines.push(...result.rows.map((row) => Object.values(row).map(csvCell).join(',')))
    }
    if (type !== 'products') {
      const result = await query(`SELECT id,'service' AS type,'' AS sku,'' AS product_name,customer_name,
        overall_rating AS rating,'',comment,status,false,admin_reply,created_at
        FROM service_feedback ORDER BY created_at DESC LIMIT 5000`)
      lines.push(...result.rows.map((row) => Object.values(row).map(csvCell).join(',')))
    }
    res.type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="customer-feedback.csv"')
      .send(['id,type,sku,product_name,customer_name,rating,title,comment,status,verified_purchase,admin_reply,created_at', ...lines].join('\r\n'))
  } catch (error) { next(error) }
})

async function moderate(req, res, next, table) {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid feedback ID.' })
    const status = req.body?.status
    const hasReply = req.body?.adminReply !== undefined
    if (status !== undefined && !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status must be approved or rejected.' })
    }
    if (!hasReply && status === undefined) return res.status(400).json({ status: 'error', message: 'Choose a moderation action or provide an admin reply.' })
    let reply
    if (hasReply) {
      reply = cleanText(req.body.adminReply)
      if (reply.length > 2000) return res.status(400).json({ status: 'error', message: 'Admin replies must be 2,000 characters or fewer.' })
    }
    const result = await query(`UPDATE ${table} SET
      status=COALESCE($1,status),admin_reply=COALESCE($2,admin_reply),updated_at=now()
      WHERE id=$3 RETURNING id,status,admin_reply AS "adminReply"`, [status || null, hasReply ? reply : null, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Feedback not found.' })
    res.json({ status: 'success', data: result.rows[0], message: 'Feedback updated.' })
  } catch (error) { next(error) }
}

router.patch('/admin/products/:id', (req, res, next) => moderate(req, res, next, 'product_reviews'))
router.patch('/admin/service/:id', (req, res, next) => moderate(req, res, next, 'service_feedback'))
router.patch('/admin/legacy/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid feedback ID.' })
    if (!['approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ status: 'error', message: 'Status must be approved or rejected.' })
    const result = await query(`UPDATE reviews SET status=$1,moderated_at=now()
      WHERE id=$2 RETURNING id,status,moderated_at AS "updatedAt"`, [req.body.status, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Legacy review not found.' })
    res.json({ status: 'success', data: result.rows[0], message: 'Legacy review updated.' })
  } catch (error) { next(error) }
})

export default router
