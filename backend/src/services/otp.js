import crypto from 'node:crypto'
import { config } from '../config/index.js'

const otpStore = new Map()

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  return `+${digits}`
}

export function generateOtpCode() {
  return Math.floor(100000 + (Math.random() * 900000)).toString()
}

export function storeOtp(phone, code, expiresAt) {
  otpStore.set(phone, { code, expiresAt: new Date(expiresAt) })
}

export function validateOtp(phone, code) {
  const record = otpStore.get(phone)
  if (!record) return false

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    otpStore.delete(phone)
    return false
  }

  const expected = String(record.code)
  const candidate = String(code)

  if (expected.length !== candidate.length) {
    return false
  }

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))
    if (valid) {
      otpStore.delete(phone)
      return true
    }
  } catch {
    return false
  }

  return false
}

export function otpStatus(phone) {
  const record = otpStore.get(phone)
  if (!record) return { active: false }

  const expired = new Date(record.expiresAt).getTime() < Date.now()
  if (expired) {
    otpStore.delete(phone)
    return { active: false }
  }

  return { active: true, expiresAt: record.expiresAt }
}

export async function sendOtpMessage(phone, code) {
  const normalizedPhone = normalizePhone(phone)
  const provider = (config.smsProvider || 'demo').toLowerCase()

  if (provider === 'twilio') {
    const accountSid = config.smsAccountSid
    const authToken = config.smsAuthToken
    const from = config.smsFromNumber

    if (!accountSid || !authToken || !from) {
      console.warn('Twilio SMS credentials are missing; OTP was not sent via Twilio.')
      return { delivered: false, provider, message: 'Twilio credentials not configured' }
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        From: from,
        Body: `Your Victoria Fresh Fish OTP is ${code}. Valid for ${config.otpExpiryMinutes} minutes.`,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Twilio OTP delivery failed: ${body}`)
    }

    return { delivered: true, provider, message: 'OTP sent via Twilio' }
  }

  if (provider === 'africas_talking') {
    const apiKey = config.smsApiKey
    const username = config.smsUsername
    const sender = config.smsSenderId || 'VICTORIA'

    if (!apiKey || !username) {
      console.warn('Africa\'s Talking credentials are missing; OTP was not delivered.')
      return { delivered: false, provider, message: 'Africa\'s Talking credentials not configured' }
    }

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'username': username,
      },
      body: JSON.stringify({
        username,
        to: [normalizedPhone],
        message: `Your Victoria Fresh Fish OTP is ${code}. Valid for ${config.otpExpiryMinutes} minutes.`,
        from: sender,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Africa's Talking OTP delivery failed: ${body}`)
    }

    return { delivered: true, provider, message: 'OTP sent via Africa\'s Talking' }
  }

  console.log(`OTP demo delivery for ${normalizedPhone}: ${code}`)
  return {
    delivered: true,
    provider: 'demo',
    message: 'Development OTP generated successfully. Configure a real SMS provider for production deployment.',
  }
}

export function getOtpRuntimePhone(phone) {
  return normalizePhone(phone)
}

export default { generateOtpCode, storeOtp, validateOtp, otpStatus, sendOtpMessage, getOtpRuntimePhone }
