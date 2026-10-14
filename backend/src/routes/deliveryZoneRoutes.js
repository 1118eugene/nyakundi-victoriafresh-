import crypto from 'node:crypto'
import express from 'express'
import { config } from '../config/index.js'
import { findDeliveryZone } from '../lib/deliveryZones.js'
import { query } from '../lib/db.js'

const router = express.Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WINDOW = /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/

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

function zonePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Delivery zone details must be provided as a JSON object.')
    error.status = 400
    throw error
  }
  const text = (value, label, max) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
      const error = new Error(`${label} must be a non-empty string of at most ${max} characters.`)
      error.status = 400
      throw error
    }
    return value.trim()
  }
  const towns = body.towns
  if (!Array.isArray(towns) || towns.length > 100 || towns.some((town) => typeof town !== 'string' || !town.trim() || town.trim().length > 100)) {
    const error = new Error('Towns must be an array of at most 100 non-empty names.')
    error.status = 400
    throw error
  }
  const fee = Number(body.fee)
  const minimumOrder = Number(body.minimumOrder)
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000000
    || !Number.isFinite(minimumOrder) || minimumOrder < 0 || minimumOrder > 100000000) {
    const error = new Error('Fee and minimum order must be non-negative valid KES amounts.')
    error.status = 400
    throw error
  }
  if (typeof body.active !== 'boolean') {
    const error = new Error('Active must be a boolean.')
    error.status = 400
    throw error
  }
  const windows = body.deliveryWindows
  if (!Array.isArray(windows) || windows.length > 8 || windows.some((window) => typeof window !== 'string' || !WINDOW.test(window))) {
    const error = new Error('Delivery windows must use 24-hour HH:MM-HH:MM format (up to 8).')
    error.status = 400
    throw error
  }
  if (body.active && windows.length === 0) {
    const error = new Error('At least one confirmed delivery window is required for an active zone.')
    error.status = 400
    throw error
  }
  const cutoffAt = body.cutoffAt === null || body.cutoffAt === undefined || body.cutoffAt === ''
    ? null
    : String(body.cutoffAt)
  if (cutoffAt && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(cutoffAt)) {
    const error = new Error('Cut-off must use 24-hour HH:MM format or be empty.')
    error.status = 400
    throw error
  }
  const priority = body.priority === undefined ? 0 : Number(body.priority)
  if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) {
    const error = new Error('Priority must be a whole number from -1,000 to 1,000.')
    error.status = 400
    throw error
  }
  return {
    name: text(body.name, 'Name', 120),
    county: text(body.county, 'County', 100),
    towns: [...new Set(towns.map((town) => town.trim()))],
    fee,
    minimumOrder,
    deliveryWindows: windows,
    cutoffAt,
    priority,
    active: body.active,
  }
}

function mapZone(row) {
  return {
    id: row.id,
    name: row.name,
    county: row.county,
    towns: row.towns,
    fee: Number(row.fee),
    minimumOrder: Number(row.minimum_order),
    deliveryWindows: row.delivery_windows,
    cutoffAt: row.cutoff_at,
    priority: row.priority,
    active: row.active,
    updatedAt: row.updated_at,
  }
}

router.get('/check', async (req, res, next) => {
  try {
    const county = String(req.query.county || '').trim()
    const town = String(req.query.town || '').trim()
    if (!county || !town || county.length > 100 || town.length > 100) {
      return res.status(400).json({ status: 'error', message: 'Provide a valid county and town to check delivery coverage.' })
    }
    const zone = await findDeliveryZone(county, town)
    if (!zone) return res.json({ status: 'success', data: { covered: false } })
    res.json({ status: 'success', data: {
      covered: true,
      name: zone.name,
      fee: zone.fee,
      minimumOrder: zone.minimumOrder,
      deliveryWindows: zone.deliveryWindows,
      cutoffAt: zone.cutoffAt,
    } })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const result = await query('SELECT * FROM delivery_zones ORDER BY county,name')
    res.json({ status: 'success', data: result.rows.map(mapZone) })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const zone = zonePayload(req.body)
    const result = await query(`INSERT INTO delivery_zones
      (name,county,towns,fee,minimum_order,delivery_windows,cutoff_at,priority,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [zone.name, zone.county, zone.towns, zone.fee, zone.minimumOrder,
      JSON.stringify(zone.deliveryWindows), zone.cutoffAt, zone.priority, zone.active])
    res.status(201).json({ status: 'success', data: mapZone(result.rows[0]) })
  } catch (error) { next(error) }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid delivery-zone ID.' })
    const zone = zonePayload(req.body)
    const result = await query(`UPDATE delivery_zones SET name=$1,county=$2,towns=$3,fee=$4,minimum_order=$5,
      delivery_windows=$6,cutoff_at=$7,priority=$8,active=$9,updated_at=now() WHERE id=$10 RETURNING *`,
    [zone.name, zone.county, zone.towns, zone.fee, zone.minimumOrder,
      JSON.stringify(zone.deliveryWindows), zone.cutoffAt, zone.priority, zone.active, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Delivery zone not found.' })
    res.json({ status: 'success', data: mapZone(result.rows[0]) })
  } catch (error) { next(error) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid delivery-zone ID.' })
    const result = await query('UPDATE delivery_zones SET active=false,updated_at=now() WHERE id=$1 RETURNING *', [req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Delivery zone not found.' })
    res.json({ status: 'success', data: mapZone(result.rows[0]) })
  } catch (error) { next(error) }
})

export default router
