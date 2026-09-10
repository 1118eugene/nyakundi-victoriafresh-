import crypto from 'node:crypto'
import { config } from '../config/index.js'

export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith('7')) return `+254${digits}`
  return `+${digits}`
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export function hashOtp(code) {
  return crypto.createHmac('sha256', config.authSecret || 'development-otp-secret').update(String(code)).digest('hex')
}

export function verifyOtpHash(code, expectedHash) {
  if (!/^\d{6}$/.test(String(code)) || !expectedHash) return false
  const actual = Buffer.from(hashOtp(code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export function getOtpRuntimePhone(phone) {
  return normalizePhone(phone)
}

export function canResendOtp(sentAt, now = Date.now()) {
  return !sentAt || now - new Date(sentAt).getTime() >= OTP_RESEND_COOLDOWN_MS
}

export async function sendOtpMessage(phone, code) {
  const normalizedPhone = normalizePhone(phone)
  const provider = (config.smsProvider || 'demo').toLowerCase()

  if (config.nodeEnv === 'production' && provider === 'demo') {
    return { delivered: false, provider, message: 'A production SMS provider is required.' }
  }

  if (provider === 'twilio') {
    const { smsAccountSid: accountSid, smsAuthToken: authToken, smsFromNumber: from } = config
    if (!accountSid || !authToken || !from) return { delivered: false, provider, message: 'Twilio credentials are not configured.' }
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalizedPhone, From: from, Body: `Your Victoria Fresh Fish OTP is ${code}. Valid for ${config.otpExpiryMinutes} minutes.` }),
    })
    if (!response.ok) return { delivered: false, provider, message: 'Twilio could not deliver the verification code.' }
    return { delivered: true, provider, message: 'OTP sent via Twilio' }
  }

  if (provider === 'africas_talking') {
    const { smsApiKey: apiKey, smsUsername: username } = config
    const sender = config.smsSenderId || 'VICTORIA'
    if (!apiKey || !username) return { delivered: false, provider, message: 'Africa’s Talking credentials are not configured.' }
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey },
      body: new URLSearchParams({
        username,
        to: normalizedPhone,
        message: `Your Victoria Fresh Fish OTP is ${code}. Valid for ${config.otpExpiryMinutes} minutes.`,
        from: sender,
      }),
    })
    if (!response.ok) return { delivered: false, provider, message: 'Africa’s Talking could not deliver the verification code.' }
    return { delivered: true, provider, message: 'OTP sent via Africa’s Talking' }
  }

  if (config.nodeEnv !== 'production') {
    console.info(`OTP delivery is in development mode for ${normalizedPhone}.`)
    return { delivered: true, provider: 'demo', message: 'Development OTP generated successfully.' }
  }

  return { delivered: false, provider, message: 'A supported SMS provider is required.' }
}

export default { generateOtpCode, hashOtp, verifyOtpHash, getOtpRuntimePhone, canResendOtp, sendOtpMessage }
