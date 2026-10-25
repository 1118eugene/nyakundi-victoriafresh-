import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import express from 'express'
import { config } from '../config/index.js'
import { CUSTOMER_SESSION_COOKIE, requireCustomer, toSafeCustomerProfile } from '../middleware/auth.js'
import { isDatabaseReady, query } from '../lib/db.js'

const router = express.Router()
const PASSWORD_ROUNDS = 12
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function customerCookieSameSite(req) {
  if (config.nodeEnv !== 'production') return 'lax'
  const origin = req.get('origin')
  if (!origin) return 'none'
  try {
    return new URL(origin).host === req.hostname ? 'lax' : 'none'
  } catch {
    return 'none'
  }
}

function setCustomerSessionCookie(req, res, token) {
  const sameSite = customerCookieSameSite(req)
  res.cookie(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/api',
  })
}

function clearCustomerSessionCookie(req, res) {
  const sameSite = customerCookieSameSite(req)
  res.clearCookie(CUSTOMER_SESSION_COOKIE, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite,
    path: '/api',
  })
}

router.use((req, res, next) => {
  if (req.method !== 'GET' && !isDatabaseReady()) {
    return res.status(503).json({ status: 'error', message: 'Customer accounts are temporarily unavailable while the database reconnects. Please try again shortly.' })
  }
  next()
})

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9 && /^[17]/.test(digits)) return `+254${digits}`
  return ''
}

function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email) }
function validKenyanPhone(phone) { return /^\+254[17]\d{8}$/.test(phone) }

function buildUserProfile(payload = {}) {
  return {
    customerName: String(payload.customerName || payload.name || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: normalizePhone(payload.phone || payload.mobile || ''),
    county: String(payload.county || '').trim(),
    town: String(payload.town || '').trim(),
    addressLine: String(payload.addressLine || '').trim(),
    landmark: String(payload.landmark || '').trim(),
    preferredPayment: ['mpesa', 'fuliza', 'both'].includes(payload.preferredPayment) ? payload.preferredPayment : 'mpesa',
  }
}

function issueSession(user) {
  if (!config.authSecret) {
    const error = new Error('Customer sessions are not configured on this server.')
    error.status = 503
    throw error
  }
  const token = jwt.sign(
    { sub: user.id, phone: user.phone, ver: user.session_version },
    config.authSecret,
    { expiresIn: '7d' },
  )
  return { token, user: toSafeCustomerProfile({
    id: user.id,
    customerName: user.customer_name,
    email: user.email,
    phone: user.phone,
    county: user.county,
    town: user.town,
    addressLine: user.address_line,
    landmark: user.landmark,
    preferredPayment: user.preferred_payment,
  }) }
}

function requireAdminKey(req, res) {
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

router.get('/health', (_req, res) => {
  res.json({ status: 'success', data: { googleEnabled: false, fulizaEnabled: Boolean(config.fulizaApiKey || config.fulizaClientId) } })
})

router.get('/me', requireCustomer, (req, res) => {
  res.json({ status: 'success', data: { user: toSafeCustomerProfile(req.customer) } })
})

router.post('/logout', requireCustomer, async (req, res, next) => {
  try {
    await query('UPDATE users SET session_version=session_version+1,updated_at=now() WHERE id=$1', [req.customer.id])
    clearCustomerSessionCookie(req, res)
    res.json({ status: 'success', message: 'Customer session ended.' })
  } catch (error) { next(error) }
})

router.post('/admin/set-password', async (req, res, next) => {
  try {
    if (!requireAdminKey(req, res)) return
    const identifier = String(req.body?.identifier || '').trim()
    const password = typeof req.body?.temporaryPassword === 'string' ? req.body.temporaryPassword : ''
    const isEmail = identifier.includes('@')
    const normalizedEmail = identifier.toLowerCase()
    const normalizedPhone = normalizePhone(identifier)
    if (identifier.length > 254
      || (isEmail ? !validEmail(normalizedEmail) : !validKenyanPhone(normalizedPhone))) {
      return res.status(400).json({ status: 'error', message: 'Enter the customer’s registered email or Kenyan phone number.' })
    }
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ status: 'error', message: 'Temporary password must be between 12 and 72 bytes.' })
    }
    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS)
    const result = await query(`UPDATE users SET password_hash=$1,session_version=session_version+1,updated_at=now()
      WHERE ${isEmail ? 'email' : 'phone'}=$2 RETURNING id`, [passwordHash, isEmail ? normalizedEmail : normalizedPhone])
    if (!result.rowCount) return res.status(404).json({ status: 'error', message: 'Customer account not found.' })
    res.json({ status: 'success', message: 'Temporary password set. Existing customer sessions were revoked.' })
  } catch (error) { next(error) }
})

router.post('/signup', async (req, res, next) => {
  try {
    const profile = buildUserProfile(req.body)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!profile.customerName || profile.customerName.length > 120
      || !validEmail(profile.email) || profile.email.length > 254
      || !validKenyanPhone(profile.phone)) {
      return res.status(400).json({ status: 'error', message: 'Enter a name, valid email, and Kenyan mobile number.' })
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ status: 'error', message: 'Password must be between 8 and 72 bytes.' })
    }
    if (!config.authSecret) return res.status(503).json({ status: 'error', message: 'Customer sessions are not configured on this server.' })

    const existing = await query('SELECT id FROM users WHERE email=$1 OR phone=$2', [profile.email, profile.phone])
    if (existing.rowCount) {
      return res.status(409).json({ status: 'error', message: 'An account already uses that email or phone. Sign in or contact support.' })
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS)
    const result = await query(`INSERT INTO users
      (customer_name,email,phone,county,town,address_line,landmark,preferred_payment,password_hash,
        session_version,last_login_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,now()) RETURNING *`,
    [profile.customerName, profile.email, profile.phone, profile.county, profile.town,
      profile.addressLine, profile.landmark, profile.preferredPayment, passwordHash])
    const session = issueSession(result.rows[0])
    setCustomerSessionCookie(req, res, session.token)
    res.status(201).json({
      status: 'success',
      message: 'Your account has been created.',
      data: { user: session.user },
    })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body?.email || req.body?.phone || '').trim()
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const isEmail = identifier.includes('@')
    const normalizedEmail = identifier.toLowerCase()
    const normalizedPhone = normalizePhone(identifier)
    if ((!isEmail && !validKenyanPhone(normalizedPhone)) || (isEmail && !validEmail(normalizedEmail)) || !password) {
      return res.status(400).json({ status: 'error', message: 'Enter your registered email or Kenyan phone number and password.' })
    }
    const result = await query(`SELECT * FROM users WHERE ${isEmail ? 'email' : 'phone'}=$1`,
      [isEmail ? normalizedEmail : normalizedPhone])
    const user = result.rows[0]
    if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ status: 'error', message: 'Invalid email/phone or password.' })
    }
    await query('UPDATE users SET last_login_at=now(),updated_at=now() WHERE id=$1', [user.id])
    const session = issueSession(user)
    setCustomerSessionCookie(req, res, session.token)
    res.json({ status: 'success', message: 'Signed in successfully.', data: { user: session.user } })
  } catch (error) { next(error) }
})

export default router
