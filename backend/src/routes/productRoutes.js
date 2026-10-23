import crypto from 'node:crypto'
import express from 'express'
import { categoryLabels } from '../data/catalog.js'
import { productPhotoPaths } from '../data/productPhotoPaths.js'
import { config } from '../config/index.js'
import { isDatabaseReady, productFromRow, query, withTransaction } from '../lib/db.js'
import { parseCatalogImport } from '../lib/catalogImport.js'

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
  const price = body.price === null || body.price === undefined || body.price === '' ? null : Number(body.price)
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000000)) {
    const error = new Error('Price must be blank or a non-negative number.')
    error.status = 400
    throw error
  }
  if (body.priceConfirmed && (price === null || price <= 0)) {
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
  const photos = body.photos === undefined || (Array.isArray(body.photos) && body.photos.length === 0)
    ? ['/images/products/fresh-pexels-a.jpg']
    : body.photos
  if (!Array.isArray(photos) || photos.length > 8 || photos.some((photo) => {
    if (typeof photo !== 'string' || photo.length > 500) return true
    if (productPhotoPaths.has(photo)) return false
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
  return {
    sku,
    name: text(body.name, 'Name', 120),
    description: description.trim(),
    price,
    priceConfirmed,
    unit: text(body.unit, 'Unit', 40),
    sizeLabel,
    image: photos[0] || '',
    photos,
    category,
    species: text(body.species, 'Species', 80),
    preparation: text(body.preparation, 'Preparation', 80),
    quantity,
    active: body.active === true,
    inStock: body.inStock === true,
    featured: body.featured === true,
  }
}

router.get('/inventory', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const result = await query('SELECT * FROM products ORDER BY name')
    res.json({ status: 'success', data: result.rows.map(productFromRow) })
  } catch (error) { next(error) }
})

router.post('/import', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (typeof req.body?.csv !== 'string' || req.body.csv.length > 90000) {
      return res.status(400).json({ status: 'error', message: 'Choose a CSV file smaller than 90 KB.' })
    }
    if (req.body.dryRun !== undefined && typeof req.body.dryRun !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'dryRun must be true or false.' })
    }
    const parsed = parseCatalogImport(req.body.csv, productPayload)
    if (req.body.dryRun === true) {
      return res.json({
        status: 'success',
        data: {
          dryRun: true,
          accepted: parsed.accepted.map(({ line, product }) => ({ line, sku: product.sku, name: product.name })),
          rejected: parsed.rejected,
        },
      })
    }

    const imported = []
    const rejected = [...parsed.rejected]
    await withTransaction(async (client) => {
      for (const { line, product } of parsed.accepted) {
        const result = await client.query(`INSERT INTO products
          (sku,name,description,price,unit,size_label,image,photos,category,species,preparation,
            quantity,active,in_stock,featured,price_confirmed,price_updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
            CASE WHEN $16 THEN now() ELSE NULL END)
          ON CONFLICT (sku) DO NOTHING RETURNING *`, [
          product.sku, product.name, product.description || '', product.price, product.unit,
          product.sizeLabel, product.image, JSON.stringify(product.photos), product.category,
          product.species, product.preparation, product.quantity, product.active,
          product.inStock, product.featured, product.priceConfirmed,
        ])
        if (!result.rowCount) {
          rejected.push({ line, sku: product.sku, reason: 'SKU already exists; existing inventory was left unchanged.' })
          continue
        }
        if (product.priceConfirmed) {
          await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price)
            VALUES ($1,NULL,$2)`, [result.rows[0].id, product.price])
        }
        imported.push({ line, sku: product.sku, name: product.name })
      }
    })
    res.status(201).json({
      status: 'success',
      data: { dryRun: false, accepted: imported, rejected },
    })
  } catch (error) { next(error) }
})

router.post('/confirm-prices', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const confirmed = await withTransaction(async (client) => {
      const changed = await client.query(`UPDATE products SET price_confirmed=true,price_updated_at=now(),
        updated_at=now() WHERE price_confirmed=false AND price IS NOT NULL AND price>0 RETURNING id,price`)
      for (const product of changed.rows) {
        await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price,changed_by)
          VALUES ($1,NULL,$2,'admin')`, [product.id, product.price])
      }
      return changed.rowCount
    })
    res.json({ status: 'success', data: { confirmed }, message: `${confirmed} stored price(s) confirmed.` })
  } catch (error) { next(error) }
})

router.post('/:id/confirm-price', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const updated = await withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [req.params.id])
      const product = found.rows[0]
      if (!product) return { error: 'Product not found.', status: 404 }
      if (product.price === null || Number(product.price) <= 0) {
        return { error: 'Enter a positive stored price before confirming it.', status: 409 }
      }
      if (product.price_confirmed) return { product }
      const result = await client.query(`UPDATE products SET price_confirmed=true,price_updated_at=now(),
        updated_at=now() WHERE id=$1 RETURNING *`, [req.params.id])
      await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price,changed_by)
        VALUES ($1,NULL,$2,'admin')`, [req.params.id, product.price])
      return { product: result.rows[0] }
    })
    if (updated.error) return res.status(updated.status).json({ status: 'error', message: updated.error })
    res.json({ status: 'success', data: productFromRow(updated.product), message: 'Product price confirmed.' })
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
    const conditions = []
    const values = []
    if (category && category !== 'all') { values.push(category); conditions.push(`category=$${values.length}`) }
    if (featured === 'true') conditions.push('featured=true')
    if (search) {
      values.push(`%${String(search).slice(0, 80)}%`)
      conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length} OR species ILIKE $${values.length} OR preparation ILIKE $${values.length})`)
    }
    const safeLimit = Math.min(Math.max(Number(limit) || config.defaultLimit, 1), config.maxLimit)
    const safeSkip = Math.max(Number(skip) || 0, 0)
    conditions.push('active=true')
    const where = conditions.join(' AND ')
    const [dataResult, countResult] = await Promise.all([
      query(`SELECT p.*,
        coalesce((SELECT round(avg(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.status='approved'),0)::float AS rating_average,
        (SELECT count(*)::int FROM reviews r WHERE r.product_id=p.id AND r.status='approved') AS rating_count
        FROM products p WHERE ${where} ORDER BY featured DESC,name ASC OFFSET $${values.length + 1} LIMIT $${values.length + 2}`, [...values, safeSkip, safeLimit]),
      query(`SELECT count(*)::int AS total FROM products WHERE ${where}`, values),
    ])
    const data = dataResult.rows.map((row) => productFromRow(row, { hideUnconfirmedPrice: true }))
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
    const result = await query(`UPDATE products SET active=$1,in_stock=$2,quantity=$3,updated_at=now()
      WHERE id=$4 RETURNING *`, [active, inStock, quantity, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Product not found.' })
    res.json({ status: 'success', data: productFromRow(result.rows[0], { hideUnconfirmedPrice: true }) })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) return res.status(503).json({ status: 'error', message: 'The fish catalogue is temporarily unavailable while the database reconnects.' })
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const result = await query(`SELECT p.*,
      coalesce((SELECT round(avg(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.status='approved'),0)::float AS rating_average,
      (SELECT count(*)::int FROM reviews r WHERE r.product_id=p.id AND r.status='approved') AS rating_count
      FROM products p WHERE p.id=$1 AND p.active=true`, [req.params.id])
    if (!result.rows[0]) return res.status(404).json({ status: 'error', message: 'Product not found' })
    res.json({ status: 'success', data: productFromRow(result.rows[0], { hideUnconfirmedPrice: true }) })
  } catch (error) { next(error) }
})

export default router
