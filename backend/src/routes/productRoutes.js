import crypto from 'node:crypto'
import express from 'express'
import { categoryLabels } from '../data/catalog.js'
import { config } from '../config/index.js'
import { isDatabaseReady, productFromRow, query, withTransaction } from '../lib/db.js'

const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function productPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Product details must be provided as a JSON object.')
    error.status = 400
    throw error
  }

  const text = (value, label, maxLength) => {
    if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maxLength) {
      const error = new Error(`${label} must be a non-empty string of at most ${maxLength} characters.`)
      error.status = 400
      throw error
    }
    return value.trim()
  }

  const sku = text(body.sku, 'SKU', 64)
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(sku)) {
    const error = new Error('SKU must use 3–64 uppercase letters, numbers, hyphens, or underscores.')
    error.status = 400
    throw error
  }

  const category = text(body.category, 'Category', 80)
  if (!Object.hasOwn(categoryLabels, category)) {
    const error = new Error('Choose a category defined in the editable catalogue.')
    error.status = 400
    throw error
  }

  if (typeof body.priceConfirmed !== 'boolean') {
    const error = new Error('Confirm whether the current product price has been owner-approved.')
    error.status = 400
    throw error
  }
  const price = body.price === null || body.price === undefined ? 0 : Number(body.price)
  if (!Number.isFinite(price) || price < 0 || price > 100000000) {
    const error = new Error('Price must be a non-negative number.')
    error.status = 400
    throw error
  }
  if (body.priceConfirmed && price <= 0) {
    const error = new Error('A confirmed product price must be greater than zero.')
    error.status = 400
    throw error
  }

  const quantity = body.quantity === undefined ? 0 : Number(body.quantity)
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
    const error = new Error('Quantity must be a whole number from 0 to 1,000,000.')
    error.status = 400
    throw error
  }
  for (const field of ['active', 'inStock', 'featured']) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      const error = new Error(`${field} must be a boolean.`)
      error.status = 400
      throw error
    }
  }

  const sizeLabel = body.sizeLabel === undefined ? '' : String(body.sizeLabel).trim()
  if (sizeLabel.length > 80) {
    const error = new Error('Size label must be at most 80 characters.')
    error.status = 400
    throw error
  }
  const photos = body.photos === undefined ? [] : body.photos
  if (!Array.isArray(photos) || photos.length > 8 || photos.some((photo) => {
    if (typeof photo !== 'string' || photo.length > 500) return true
    if (/^\/images\/(?!.*\.\.)[A-Za-z0-9/_-]+\.(avif|webp|png|jpe?g)$/i.test(photo)) return false
    try {
      const url = new URL(photo)
      return url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== ''
    } catch {
      return true
    }
  })) {
    const error = new Error('Photos must be up to 8 safe local image paths or HTTPS URLs.')
    error.status = 400
    throw error
  }
  const description = body.description === undefined ? '' : body.description
  if (typeof description !== 'string' || description.length > 2000) {
    const error = new Error('Description must be a string of at most 2,000 characters.')
    error.status = 400
    throw error
  }

  const priceConfirmed = body.priceConfirmed
  const quantityToSave = priceConfirmed ? quantity : 0
  return {
    sku,
    name: text(body.name, 'Name', 120),
    description: description.trim(),
    price: priceConfirmed ? price : 0,
    priceConfirmed,
    unit: text(body.unit, 'Unit', 40),
    sizeLabel,
    image: photos[0] || '',
    photos,
    category,
    species: text(body.species, 'Species', 80),
    preparation: text(body.preparation, 'Preparation', 80),
    quantity: quantityToSave,
    active: priceConfirmed && body.active === true,
    inStock: priceConfirmed && quantityToSave > 0 && body.inStock === true,
    featured: priceConfirmed && body.featured === true,
  }
}

router.get('/inventory', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const result = await query('SELECT * FROM products ORDER BY name')
    res.json({ status: 'success', data: result.rows.map(productFromRow) })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const product = productPayload(req.body)
    const created = await withTransaction(async (client) => {
      const result = await client.query(`INSERT INTO products
        (sku,name,description,price,unit,size_label,image,photos,category,species,preparation,
          quantity,active,in_stock,featured,price_confirmed,price_updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          CASE WHEN $16 THEN now() ELSE NULL END)
        RETURNING *`, [product.sku, product.name, product.description || '', product.price, product.unit,
        product.sizeLabel, product.image, JSON.stringify(product.photos), product.category, product.species,
        product.preparation, product.quantity, product.active, product.inStock, product.featured, product.priceConfirmed])
      if (product.priceConfirmed) {
        await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price)
          VALUES ($1,NULL,$2)`, [result.rows[0].id, product.price])
      }
      return result.rows[0]
    })
    res.status(201).json({ status: 'success', data: productFromRow(created) })
  } catch (error) { next(error) }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const product = productPayload(req.body)
    const updated = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [req.params.id])
      if (!current.rowCount) return null
      const old = current.rows[0]
      const priceChanged = product.priceConfirmed
        && (!old.price_confirmed || Math.round(Number(old.price) * 100) !== Math.round(product.price * 100))
      const result = await client.query(`UPDATE products SET sku=$1,name=$2,description=$3,price=$4,unit=$5,
        size_label=$6,image=$7,photos=$8,category=$9,species=$10,preparation=$11,quantity=$12,active=$13,
        in_stock=$14,featured=$15,price_confirmed=$16,price_updated_at=CASE WHEN $17 THEN now()
          ELSE price_updated_at END,updated_at=now() WHERE id=$18 RETURNING *`,
      [product.sku, product.name, product.description || '', product.price, product.unit, product.sizeLabel,
        product.image, JSON.stringify(product.photos), product.category, product.species, product.preparation,
        product.quantity, product.active, product.inStock, product.featured, product.priceConfirmed,
        priceChanged, req.params.id])
      if (priceChanged) {
        await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price)
          VALUES ($1,$2,$3)`, [req.params.id, old.price_confirmed ? old.price : null, product.price])
      }
      return result.rows[0]
    })
    if (!updated) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    res.json({ status: 'success', data: productFromRow(updated) })
  } catch (error) { next(error) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const result = await query(`UPDATE products SET active=false,in_stock=false,featured=false,updated_at=now()
      WHERE id=$1 RETURNING *`, [req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    res.json({ status: 'success', data: productFromRow(result.rows[0]) })
  } catch (error) { next(error) }
})

router.get('/:id/price-history', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const result = await query(`SELECT previous_price AS "previousPrice",new_price AS "newPrice",
      changed_at AS "changedAt",changed_by AS "changedBy"
      FROM product_price_history WHERE product_id=$1 ORDER BY changed_at DESC,id DESC`, [req.params.id])
    res.json({ status: 'success', data: result.rows.map((row) => ({
      ...row,
      previousPrice: row.previousPrice === null ? null : Number(row.previousPrice),
      newPrice: Number(row.newPrice),
    })) })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) return res.status(503).json({ status: 'error', message: 'The fish catalogue is temporarily unavailable while the database reconnects.' })
    const { category, featured, search, skip = 0, limit = config.defaultLimit } = req.query
    const conditions = ['active=true', 'in_stock=true', 'quantity>0', 'price_confirmed=true']
    const values = []
    if (category && category !== 'all') { values.push(category); conditions.push(`category=$${values.length}`) }
    if (featured === 'true') conditions.push('featured=true')
    if (search) {
      values.push(`%${String(search).slice(0, 80)}%`)
      conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length} OR species ILIKE $${values.length} OR preparation ILIKE $${values.length})`)
    }
    const safeLimit = Math.min(Math.max(Number(limit) || config.defaultLimit, 1), config.maxLimit)
    const safeSkip = Math.max(Number(skip) || 0, 0)
    const where = conditions.join(' AND ')
    const [dataResult, countResult] = await Promise.all([
      query(`SELECT p.*,
        coalesce((SELECT round(avg(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.status='approved'),0)::float AS rating_average,
        (SELECT count(*)::int FROM reviews r WHERE r.product_id=p.id AND r.status='approved') AS rating_count
        FROM products p WHERE ${where} ORDER BY featured DESC,name ASC OFFSET $${values.length + 1} LIMIT $${values.length + 2}`, [...values, safeSkip, safeLimit]),
      query(`SELECT count(*)::int AS total FROM products WHERE ${where}`, values),
    ])
    const data = dataResult.rows.map(productFromRow)
    const total = countResult.rows[0].total
    res.json({ status: 'success', data, filters: { categories: categoryLabels }, pagination: { total, skip: safeSkip, limit: safeLimit, returned: data.length } })
  } catch (error) { next(error) }
})

router.patch('/:id/availability', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const { active, inStock, quantity } = req.body || {}
    if (typeof active !== 'boolean' || typeof inStock !== 'boolean'
      || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
      return res.status(400).json({ status: 'error', message: 'Set active and in-stock states and a whole-number quantity from 0 to 1,000,000.' })
    }
    const current = await query('SELECT price_confirmed FROM products WHERE id=$1', [req.params.id])
    if (!current.rowCount) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    if (!current.rows[0].price_confirmed && (active || inStock)) {
      return res.status(409).json({ status: 'error', message: 'Confirm a current product price before making it available.' })
    }
    const result = await query(`UPDATE products SET active=$1,in_stock=$2,quantity=$3,updated_at=now()
      WHERE id=$4 RETURNING *`, [active, inStock, quantity, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    res.json({ status: 'success', data: productFromRow(result.rows[0]) })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) return res.status(503).json({ status: 'error', message: 'The fish catalogue is temporarily unavailable while the database reconnects.' })
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const result = await query(`SELECT p.*,
      coalesce((SELECT round(avg(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.status='approved'),0)::float AS rating_average,
      (SELECT count(*)::int FROM reviews r WHERE r.product_id=p.id AND r.status='approved') AS rating_count
      FROM products p WHERE p.id=$1 AND p.active=true AND p.in_stock=true AND p.quantity>0
        AND p.price_confirmed=true`, [req.params.id])
    if (!result.rows[0]) return res.status(404).json({ status: 'error', message: 'Product not found' })
    res.json({ status: 'success', data: productFromRow(result.rows[0]) })
  } catch (error) { next(error) }
})

export default router
