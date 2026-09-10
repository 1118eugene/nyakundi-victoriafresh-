import jwt from 'jsonwebtoken'
import express from 'express'
import User from '../models/User.js'
import { config } from '../config/index.js'
import { canResendOtp, generateOtpCode, getOtpRuntimePhone, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, sendOtpMessage, verifyOtpHash } from '../services/otp.js'
import { requireCustomer, toSafeCustomerProfile } from '../middleware/auth.js'

const router = express.Router()

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith('7')) return `+254${digits}`
  return ''
}

function validEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email)
}

function validKenyanPhone(phone) {
  return /^\+2547\d{8}$/.test(phone)
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

function clearOtp(user) {
  user.otp = { hash: '', expiresAt: null, attempts: 0, sentAt: null, verifiedAt: null }
}

async function issueOtp(user) {
  if (!canResendOtp(user.otp?.sentAt)) {
    const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(user.otp.sentAt).getTime())) / 1000)
    const error = new Error(`Please wait ${remaining} seconds before requesting another code.`)
    error.status = 429
    throw error
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + (config.otpExpiryMinutes || 10) * 60 * 1000)
  user.otp = { hash: hashOtp(code), expiresAt, attempts: 0, sentAt: new Date(), verifiedAt: null }
  await user.save()

  const delivery = await sendOtpMessage(getOtpRuntimePhone(user.phone), code)
  if (!delivery.delivered) {
    clearOtp(user)
    await user.save()
    const error = new Error(delivery.message || 'Verification code delivery failed.')
    error.status = 503
    throw error
  }

  return { delivery, expiresAt }
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

    const [emailUser, phoneUser] = await Promise.all([User.findOne({ email: profile.email }), User.findOne({ phone: profile.phone })])
    if (emailUser && phoneUser && emailUser.id !== phoneUser.id) return res.status(409).json({ status: 'error', message: 'That email and phone number belong to different accounts.' })
    const existing = emailUser || phoneUser
    if (existing?.verifiedPhone) return res.status(409).json({ status: 'error', message: 'This account is already verified. Please sign in.' })

    const user = existing
      ? await User.findByIdAndUpdate(existing._id, { $set: profile }, { new: true, runValidators: true })
      : await User.create(profile)
    const { delivery, expiresAt } = await issueOtp(user)

    res.status(existing ? 200 : 201).json({ status: 'success', message: 'Your account is ready. Enter the OTP sent to your phone.', data: { user: toSafeCustomerProfile(user), otp: { expiresAt, delivered: delivery.delivered, provider: delivery.provider } } })
  } catch (error) { next(error) }
})

async function findUserForOtp({ phone, email }) {
  const normalizedPhone = phone ? normalizePhone(phone) : ''
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (normalizedPhone && !validKenyanPhone(normalizedPhone)) return null
  if (!normalizedPhone && !validEmail(normalizedEmail)) return null
  return User.findOne(normalizedPhone ? { phone: normalizedPhone } : { email: normalizedEmail })
}

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

    const user = await User.findOne({ phone: normalizedPhone }).select('+otp')
    if (!user) return res.status(404).json({ status: 'error', message: 'No customer account matches this phone number.' })
    if (!user.otp?.hash || !user.otp.expiresAt || new Date(user.otp.expiresAt).getTime() <= Date.now()) {
      clearOtp(user); await user.save()
      return res.status(401).json({ status: 'error', message: 'That OTP has expired. Request a new code.' })
    }
    if (user.otp.attempts >= OTP_MAX_ATTEMPTS) {
      clearOtp(user); await user.save()
      return res.status(429).json({ status: 'error', message: 'Too many attempts. Request a new code.' })
    }
    if (!verifyOtpHash(code, user.otp.hash)) {
      user.otp.attempts += 1
      await user.save()
      return res.status(401).json({ status: 'error', message: user.otp.attempts >= OTP_MAX_ATTEMPTS ? 'Too many attempts. Request a new code.' : 'The OTP is invalid.' })
    }

    user.verifiedPhone = true
    user.lastLoginAt = new Date()
    user.otp = { hash: '', expiresAt: null, attempts: 0, sentAt: null, verifiedAt: new Date() }
    await user.save()
    if (!config.authSecret) return res.status(503).json({ status: 'error', message: 'Customer sessions are not configured on this server.' })
    const token = jwt.sign({ sub: user.id, phone: user.phone }, config.authSecret, { expiresIn: '30d' })
    res.json({ status: 'success', message: 'Phone number verified successfully.', data: { token, user: toSafeCustomerProfile(user) } })
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
