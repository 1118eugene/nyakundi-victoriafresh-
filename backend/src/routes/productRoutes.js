import express from 'express'
import { categoryLabels } from '../data/catalog.js'
import { config } from '../config/index.js'
import { isDatabaseReady, productFromRow, query } from '../lib/db.js'

const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

router.get('/', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) return res.status(503).json({ status: 'error', message: 'The fish catalogue is temporarily unavailable while the database reconnects.' })
    const { category, featured, search, skip = 0, limit = config.defaultLimit } = req.query
    const conditions = ['active=true', 'in_stock=true', 'quantity>0']
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
      query(`SELECT * FROM products WHERE ${where} ORDER BY featured DESC,name ASC OFFSET $${values.length + 1} LIMIT $${values.length + 2}`, [...values, safeSkip, safeLimit]),
      query(`SELECT count(*)::int AS total FROM products WHERE ${where}`, values),
    ])
    const data = dataResult.rows.map(productFromRow)
    const total = countResult.rows[0].total
    res.json({ status: 'success', data, filters: { categories: categoryLabels }, pagination: { total, skip: safeSkip, limit: safeLimit, returned: data.length } })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) return res.status(503).json({ status: 'error', message: 'The fish catalogue is temporarily unavailable while the database reconnects.' })
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    const result = await query('SELECT * FROM products WHERE id=$1 AND active=true AND in_stock=true AND quantity>0', [req.params.id])
    if (!result.rows[0]) return res.status(404).json({ status: 'error', message: 'Product not found' })
    res.json({ status: 'success', data: productFromRow(result.rows[0]) })
  } catch (error) { next(error) }
})

export default router
