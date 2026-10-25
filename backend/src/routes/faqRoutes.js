import crypto from 'node:crypto'
import express from 'express'
import { config } from '../config/index.js'
import { query } from '../lib/db.js'

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

function sanitizeText(value) {
  return String(value || '').normalize('NFKC')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseFaqInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'FAQ details must be provided as a JSON object.' }
  }
  const result = {}
  for (const [field, max] of [['category', 80], ['question', 240], ['answer', 2000]]) {
    if (partial && body[field] === undefined) continue
    const value = sanitizeText(body[field])
    if (!value || value.length > max) return { error: `${field} must be between 1 and ${max} characters.` }
    result[field] = value
  }
  if (!partial || body.sortOrder !== undefined) {
    const sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
      return { error: 'Sort order must be a whole number from 0 to 100,000.' }
    }
    result.sortOrder = sortOrder
  }
  if (!partial || body.active !== undefined) {
    if (body.active !== undefined && typeof body.active !== 'boolean') {
      return { error: 'Active must be true or false.' }
    }
    result.active = body.active === undefined ? true : body.active
  }
  if (partial && !Object.keys(result).length) return { error: 'Change at least one FAQ field.' }
  return { value: result }
}

router.get('/', async (req, res, next) => {
  try {
    const category = String(req.query.category || '')
    const result = category
      ? await query(`SELECT id,category,question,answer,sort_order AS "sortOrder"
        FROM faqs WHERE active=true AND category=$1 ORDER BY sort_order,category,question`, [category])
      : await query(`SELECT id,category,question,answer,sort_order AS "sortOrder"
        FROM faqs WHERE active=true ORDER BY sort_order,category,question`)
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.get('/admin', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const result = await query(`SELECT id,category,question,answer,sort_order AS "sortOrder",active,
      created_at AS "createdAt",updated_at AS "updatedAt" FROM faqs ORDER BY sort_order,category,question`)
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.post('/admin', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const parsed = parseFaqInput(req.body)
    if (parsed.error) return res.status(400).json({ status: 'error', message: parsed.error })
    const { category, question, answer, sortOrder, active } = parsed.value
    const result = await query(`INSERT INTO faqs(category,question,answer,sort_order,active)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id,category,question,answer,sort_order AS "sortOrder",active`,
    [category, question, answer, sortOrder, active])
    res.status(201).json({ status: 'success', data: result.rows[0], message: 'FAQ added.' })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ status: 'error', message: 'That FAQ already exists in this category.' })
    next(error)
  }
})

router.patch('/admin/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid FAQ ID.' })
    const parsed = parseFaqInput(req.body, true)
    if (parsed.error) return res.status(400).json({ status: 'error', message: parsed.error })
    const { category, question, answer, sortOrder, active } = parsed.value
    const result = await query(`UPDATE faqs SET category=COALESCE($1,category),
      question=COALESCE($2,question),answer=COALESCE($3,answer),
      sort_order=COALESCE($4,sort_order),active=COALESCE($5,active),updated_at=now()
      WHERE id=$6 RETURNING id,category,question,answer,sort_order AS "sortOrder",active`,
    [category ?? null, question ?? null, answer ?? null, sortOrder ?? null, active ?? null, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'FAQ not found.' })
    res.json({ status: 'success', data: result.rows[0], message: 'FAQ updated.' })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ status: 'error', message: 'That FAQ already exists in this category.' })
    next(error)
  }
})

router.delete('/admin/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid FAQ ID.' })
    const result = await query(`UPDATE faqs SET active=false,updated_at=now()
      WHERE id=$1 AND active=true RETURNING id`, [req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Active FAQ not found.' })
    res.json({ status: 'success', message: 'FAQ hidden. Its record was retained.' })
  } catch (error) { next(error) }
})

export default router
