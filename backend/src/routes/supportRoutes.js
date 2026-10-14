import crypto from 'node:crypto'
import express from 'express'
import { config } from '../config/index.js'
import { query } from '../lib/db.js'
import { normalizePhone } from '../lib/paymentUtils.js'

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

function supportPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Support request details must be provided as a JSON object.')
    error.status = 400
    throw error
  }
  const name = String(body.name || '').trim()
  const phone = normalizePhone(String(body.phone || ''))
  const email = String(body.email || '').trim()
  const orderNumber = String(body.orderNumber || '').trim()
  const message = String(body.message || '').trim()
  const type = body.type
  if (typeof body.contactConsent !== 'boolean' || body.contactConsent !== true) {
    const error = new Error('Confirm that the team may use these details to respond to your request.')
    error.status = 400
    throw error
  }
  if (name.length < 2 || name.length > 120 || !/^254[17]\d{8}$/.test(phone)
    || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    || orderNumber.length > 60 || message.length < 10 || message.length > 4000
    || !['question', 'complaint', 'refund'].includes(type)) {
    const error = new Error('Provide a valid name, Kenyan phone, optional email and order number, request type, and message.')
    error.status = 400
    throw error
  }
  return { name, phone, email, orderNumber, message, type }
}

router.post('/', async (req, res, next) => {
  try {
    const payload = supportPayload(req.body)
    const result = await query(`INSERT INTO support_requests
      (request_type,customer_name,phone,email,order_number,message,contact_consent)
      VALUES ($1,$2,$3,$4,$5,$6,true)
      RETURNING id,request_type AS "requestType",status,created_at AS "createdAt"`,
    [payload.type, payload.name, payload.phone, payload.email, payload.orderNumber, payload.message])
    res.status(201).json({ status: 'success', data: result.rows[0] })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    const status = String(req.query.status || '')
    if (status && !['new', 'in_review', 'resolved'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Choose a valid support request status.' })
    }
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100)
    const result = await query(`SELECT id,request_type AS "requestType",customer_name AS "customerName",
      phone,email,order_number AS "orderNumber",message,contact_consent AS "contactConsent",status,
      staff_response AS "staffResponse",resolution_outcome AS "resolutionOutcome",
      created_at AS "createdAt",updated_at AS "updatedAt",responded_at AS "respondedAt"
      FROM support_requests WHERE ($1='' OR status=$1) ORDER BY created_at DESC LIMIT $2`, [status, limit])
    res.json({ status: 'success', data: result.rows })
  } catch (error) { next(error) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return
    if (!UUID.test(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid support request ID.' })
    const status = req.body?.status
    const staffResponse = String(req.body?.staffResponse || '').trim()
    const resolutionOutcome = String(req.body?.resolutionOutcome || '').trim()
    if (!['new', 'in_review', 'resolved'].includes(status)
      || staffResponse.length > 2000 || resolutionOutcome.length > 1000
      || (status === 'resolved' && (!staffResponse || !resolutionOutcome))) {
      return res.status(400).json({ status: 'error', message: 'Provide a valid status, staff response, and outcome when resolving a request.' })
    }
    const result = await query(`UPDATE support_requests SET status=$1,staff_response=$2,resolution_outcome=$3,
      responded_at=CASE WHEN $2<>'' THEN COALESCE(responded_at,now()) ELSE responded_at END,updated_at=now()
      WHERE id=$4 RETURNING id,status,staff_response AS "staffResponse",
      resolution_outcome AS "resolutionOutcome",responded_at AS "respondedAt"`,
    [status, staffResponse, resolutionOutcome, req.params.id])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Support request not found.' })
    res.json({ status: 'success', data: result.rows[0] })
  } catch (error) { next(error) }
})

export default router
