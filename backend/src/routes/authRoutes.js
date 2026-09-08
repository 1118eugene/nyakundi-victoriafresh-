import crypto from 'node:crypto'
import express from 'express'
import User from '../models/User.js'
import { config } from '../config/index.js'
import { generateOtpCode, getOtpRuntimePhone, sendOtpMessage, storeOtp, validateOtp } from '../services/otp.js'

const router = express.Router()

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  return `+${digits}`
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
    preferredPayment: payload.preferredPayment || 'mpesa',
  }
}

router.get('/health', (_req, res) => {
  res.json({
    status: 'success',
    data: {
      otpEnabled: true,
      smsProvider: config.smsProvider || 'demo',
      googleEnabled: Boolean(config.googleClientId),
      fulizaEnabled: Boolean(config.fulizaApiKey || config.fulizaClientId),
    },
  })
})

router.post('/signup', async (req, res, next) => {
  try {
    const profile = buildUserProfile(req.body)

    if (!profile.customerName || !profile.email || !profile.phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer name, email, and phone number are required.',
      })
    }

    const user = await User.findOneAndUpdate(
      { $or: [{ email: profile.email }, { phone: profile.phone }] },
      {
        $set: {
          ...profile,
          googleId: req.body.googleId || '',
          verifiedPhone: false,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + (config.otpExpiryMinutes || 10) * 60 * 1000)
    const runtimePhone = getOtpRuntimePhone(user.phone)

    user.otp = {
      code: String(code),
      expiresAt,
      verifiedAt: null,
    }
    await user.save()
    storeOtp(runtimePhone, code, expiresAt)

    const delivery = await sendOtpMessage(runtimePhone, code)

    res.status(201).json({
      status: 'success',
      message: 'Account created. Please verify your phone number with the OTP sent to you.',
      data: {
        user: { id: user.id, customerName: user.customerName, phone: user.phone, email: user.email },
        otp: { expiresAt, delivered: delivery.delivered, provider: delivery.provider },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, email } = req.body
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required.' })
    }

    const user = await User.findOne({ $or: [{ phone: normalizedPhone }, { email: String(email || '').trim().toLowerCase() }] })
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Create an account before requesting an OTP.' })
    }

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + (config.otpExpiryMinutes || 10) * 60 * 1000)
    user.otp = { code: String(code), expiresAt, verifiedAt: null }
    await user.save()
    storeOtp(normalizedPhone, code, expiresAt)

    const delivery = await sendOtpMessage(normalizedPhone, code)

    res.json({
      status: 'success',
      message: 'OTP sent successfully.',
      data: {
        phone: normalizedPhone,
        delivered: delivery.delivered,
        provider: delivery.provider,
        expiresAt,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, code } = req.body
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone || !code) {
      return res.status(400).json({ status: 'error', message: 'Phone number and OTP code are required.' })
    }

    const user = await User.findOne({ phone: normalizedPhone })
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'No customer account matches this phone number.' })
    }

    const valid = validateOtp(normalizedPhone, String(code))
    if (!valid) {
      return res.status(401).json({ status: 'error', message: 'The OTP is invalid or has expired.' })
    }

    user.verifiedPhone = true
    user.lastLoginAt = new Date()
    user.otp = { code: '', expiresAt: null, verifiedAt: new Date() }
    await user.save()

    const sessionToken = crypto.randomBytes(24).toString('hex')

    res.json({
      status: 'success',
      message: 'Phone number verified successfully.',
      data: {
        token: sessionToken,
        user: {
          id: user.id,
          customerName: user.customerName,
          email: user.email,
          phone: user.phone,
          county: user.county,
          town: user.town,
          addressLine: user.addressLine,
          landmark: user.landmark,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, phone } = req.body
    const lookup = email ? { email: String(email).trim().toLowerCase() } : { phone: normalizePhone(phone || '') }

    if (!lookup.email && !lookup.phone) {
      return res.status(400).json({ status: 'error', message: 'Email or phone is required.' })
    }

    const user = await User.findOne(lookup)
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'No account found. Please sign up first.' })
    }

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + (config.otpExpiryMinutes || 10) * 60 * 1000)
    const runtimePhone = getOtpRuntimePhone(user.phone)

    user.otp = { code: String(code), expiresAt, verifiedAt: null }
    await user.save()
    storeOtp(runtimePhone, code, expiresAt)

    const delivery = await sendOtpMessage(runtimePhone, code)

    res.json({
      status: 'success',
      message: 'OTP sent to your registered phone number.',
      data: {
        userId: user.id,
        phone: runtimePhone,
        delivered: delivery.delivered,
        provider: delivery.provider,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/google', async (req, res) => {
  const { email, name, googleId, phone, county, town, addressLine, landmark } = req.body

  if (!email || !name) {
    return res.status(400).json({ status: 'error', message: 'Google profile email and name are required.' })
  }

  const profile = {
    customerName: name,
    email: String(email).trim().toLowerCase(),
    phone: normalizePhone(phone || ''),
    county: county || '',
    town: town || '',
    addressLine: addressLine || '',
    landmark: landmark || '',
    preferredPayment: 'mpesa',
  }

  const existing = await User.findOne({ email: profile.email })
  const user = existing
    ? await User.findOneAndUpdate({ _id: existing._id }, { $set: { ...profile, googleId: googleId || existing.googleId || '' } }, { new: true })
    : await User.create({ ...profile, googleId: googleId || '', verifiedPhone: Boolean(profile.phone) })

  res.json({
    status: 'success',
    message: 'Google profile imported. Complete phone verification to continue checkout.',
    data: { user: { id: user.id, customerName: user.customerName, email: user.email, phone: user.phone } },
  })
})

export default router
