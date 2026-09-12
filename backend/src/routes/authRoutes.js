import jwt from 'jsonwebtoken'
import express from 'express'
import { config } from '../config/index.js'
import { canResendOtp, generateOtpCode, getOtpRuntimePhone, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, sendOtpMessage, verifyOtpHash } from '../services/otp.js'
import { requireCustomer, toSafeCustomerProfile } from '../middleware/auth.js'
import { isDatabaseReady, query, withTransaction } from '../lib/db.js'

const router = express.Router()

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
  if (digits.length === 9 && digits.startsWith('7')) return `+254${digits}`
  return ''
}

function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email) }
function validKenyanPhone(phone) { return /^\+2547\d{8}$/.test(phone) }

function toUser(row) {
  if (!row) return null
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    googleId: row.google_id,
    county: row.county,
    town: row.town,
    addressLine: row.address_line,
    landmark: row.landmark,
    preferredPayment: row.preferred_payment,
    verifiedPhone: row.verified_phone,
    otp: {
      hash: row.otp_hash,
      expiresAt: row.otp_expires_at,
      attempts: row.otp_attempts,
      sentAt: row.otp_sent_at,
      verifiedAt: row.otp_verified_at,
    },
  }
}

function buildUserProfile(payload = {}) {
  return {
    customerName: String(payload.customerName || payload.name || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: normalizePhone(payload.phone || payload.mobile || payload.paymentPhone || ''),
    county: String(payload.county || '').trim(),
    town: String(payload.town || '').trim(),
    addressLine: String(payload.addressLine || '').trim(),
    landmark: String(payload.landmark || '').trim(),
    preferredPayment: ['mpesa', 'fuliza', 'both'].includes(payload.preferredPayment) ? payload.preferredPayment : 'mpesa',
  }
}

async function clearOtp(id, verifiedAt = null) {
  await query(`UPDATE users SET otp_hash='', otp_expires_at=NULL, otp_attempts=0,
    otp_sent_at=NULL, otp_verified_at=$1, updated_at=now() WHERE id=$2`, [verifiedAt, id])
}

async function issueOtp(user) {
  if (!canResendOtp(user.otp.sentAt)) {
    const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(user.otp.sentAt).getTime())) / 1000)
    const error = new Error(`Please wait ${remaining} seconds before requesting another code.`)
    error.status = 429
    throw error
  }
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + (config.otpExpiryMinutes || 10) * 60 * 1000)
  const sentAt = new Date()
  await query(`UPDATE users SET otp_hash=$1, otp_expires_at=$2, otp_attempts=0,
    otp_sent_at=$3, otp_verified_at=NULL, updated_at=now() WHERE id=$4`,
  [hashOtp(code), expiresAt, sentAt, user.id])
  const delivery = await sendOtpMessage(getOtpRuntimePhone(user.phone), code)
  if (!delivery.delivered) {
    await clearOtp(user.id)
    const error = new Error(delivery.message || 'Verification code delivery failed.')
    error.status = 503
    throw error
  }
  return { delivery, expiresAt }
}

async function findUserForOtp({ phone, email } = {}) {
  const normalizedPhone = phone ? normalizePhone(phone) : ''
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (normalizedPhone && !validKenyanPhone(normalizedPhone)) return null
  if (!normalizedPhone && !validEmail(normalizedEmail)) return null
  const result = await query(`SELECT * FROM users WHERE ${normalizedPhone ? 'phone' : 'email'} = $1`, [normalizedPhone || normalizedEmail])
  return toUser(result.rows[0])
}

router.get('/health', (_req, res) => {
  res.json({ status: 'success', data: { otpEnabled: true, smsProvider: config.smsProvider || 'demo', googleEnabled: false, fulizaEnabled: Boolean(config.fulizaApiKey || config.fulizaClientId) } })
})

router.get('/me', requireCustomer, (req, res) => {
  res.json({ status: 'success', data: { user: toSafeCustomerProfile(req.customer) } })
})

router.post('/signup', async (req, res, next) => {
  try {
    const profile = buildUserProfile(req.body)
    if (!profile.customerName || !validEmail(profile.email) || !validKenyanPhone(profile.phone)) {
      return res.status(400).json({ status: 'error', message: 'Enter a name, valid email, and Kenyan mobile number.' })
    }
    const existingResult = await query('SELECT * FROM users WHERE email=$1 OR phone=$2', [profile.email, profile.phone])
    const emailUser = existingResult.rows.find((row) => row.email === profile.email)
    const phoneUser = existingResult.rows.find((row) => row.phone === profile.phone)
    if (emailUser && phoneUser && emailUser.id !== phoneUser.id) return res.status(409).json({ status: 'error', message: 'That email and phone number belong to different accounts.' })
    const existing = emailUser || phoneUser
    if (existing?.verified_phone) return res.status(409).json({ status: 'error', message: 'This account is already verified. Please sign in.' })
    const result = existing
      ? await query(`UPDATE users SET customer_name=$1,email=$2,phone=$3,county=$4,town=$5,address_line=$6,landmark=$7,preferred_payment=$8,updated_at=now() WHERE id=$9 RETURNING *`,
        [profile.customerName, profile.email, profile.phone, profile.county, profile.town, profile.addressLine, profile.landmark, profile.preferredPayment, existing.id])
      : await query(`INSERT INTO users (customer_name,email,phone,county,town,address_line,landmark,preferred_payment)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [profile.customerName, profile.email, profile.phone, profile.county, profile.town, profile.addressLine, profile.landmark, profile.preferredPayment])
    const user = toUser(result.rows[0])
    const { delivery, expiresAt } = await issueOtp(user)
    res.status(existing ? 200 : 201).json({ status: 'success', message: 'Your account is ready. Enter the OTP sent to your phone.', data: { user: toSafeCustomerProfile({ ...user }), otp: { expiresAt, delivered: delivery.delivered, provider: delivery.provider } } })
  } catch (error) { next(error) }
})

router.post('/send-otp', async (req, res, next) => {
  try {
    const user = await findUserForOtp(req.body)
    if (!user) return res.status(404).json({ status: 'error', message: 'No customer account matches those details.' })
    const { delivery, expiresAt } = await issueOtp(user)
    res.json({ status: 'success', message: 'OTP sent successfully.', data: { phone: user.phone, delivered: delivery.delivered, provider: delivery.provider, expiresAt } })
  } catch (error) { next(error) }
})

router.post('/verify-otp', async (req, res, next) => {
  try {
    const normalizedPhone = normalizePhone(req.body.phone)
    const code = String(req.body.code || '')
    if (!validKenyanPhone(normalizedPhone) || !/^\d{6}$/.test(code)) return res.status(400).json({ status: 'error', message: 'Enter a valid Kenyan phone number and six-digit OTP.' })
    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM users WHERE phone=$1 FOR UPDATE', [normalizedPhone])
      const row = found.rows[0]
      if (!row) return { error: [404, 'No customer account matches this phone number.'] }
      const user = toUser(row)
      if (!user.otp.hash || !user.otp.expiresAt || new Date(user.otp.expiresAt).getTime() <= Date.now()) {
        await client.query(`UPDATE users SET otp_hash='',otp_expires_at=NULL,otp_attempts=0,otp_sent_at=NULL,updated_at=now() WHERE id=$1`, [row.id])
        return { error: [401, 'That OTP has expired. Request a new code.'] }
      }
      if (user.otp.attempts >= OTP_MAX_ATTEMPTS) return { error: [429, 'Too many attempts. Request a new code.'] }
      if (!verifyOtpHash(code, user.otp.hash)) {
        const attempts = user.otp.attempts + 1
        await client.query('UPDATE users SET otp_attempts=$1,updated_at=now() WHERE id=$2', [attempts, row.id])
        return { error: [401, attempts >= OTP_MAX_ATTEMPTS ? 'Too many attempts. Request a new code.' : 'The OTP is invalid.'] }
      }
      const verifiedAt = new Date()
      const updated = await client.query(`UPDATE users SET verified_phone=true,last_login_at=$1,otp_hash='',otp_expires_at=NULL,otp_attempts=0,otp_sent_at=NULL,otp_verified_at=$1,updated_at=now() WHERE id=$2 RETURNING *`, [verifiedAt, row.id])
      return { user: toUser(updated.rows[0]) }
    })
    if (result.error) return res.status(result.error[0]).json({ status: 'error', message: result.error[1] })
    if (!config.authSecret) return res.status(503).json({ status: 'error', message: 'Customer sessions are not configured on this server.' })
    const token = jwt.sign({ sub: result.user.id, phone: result.user.phone }, config.authSecret, { expiresIn: '30d' })
    res.json({ status: 'success', message: 'Phone number verified successfully.', data: { token, user: toSafeCustomerProfile(result.user) } })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const user = await findUserForOtp(req.body)
    if (!user) return res.status(404).json({ status: 'error', message: 'No account found. Please sign up first.' })
    if (!user.verifiedPhone) return res.status(403).json({ status: 'error', message: 'Verify your phone before signing in.' })
    const { delivery } = await issueOtp(user)
    res.json({ status: 'success', message: 'OTP sent to your registered phone number.', data: { userId: user.id, phone: user.phone, delivered: delivery.delivered, provider: delivery.provider } })
  } catch (error) { next(error) }
})

export default router
