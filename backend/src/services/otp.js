import crypto from 'node:crypto'
import { config, getOtpProviderConfigurationStatus } from '../config/index.js'

export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9 && /^[17]/.test(digits)) return `+254${digits}`
  return `+${digits}`
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export function hashOtp(code) {
  if (!config.authSecret) throw new Error('AUTH_SECRET must be configured before OTPs can be issued.')
  return crypto.createHmac('sha256', config.authSecret).update(String(code)).digest('hex')
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

async function providerFailure(response, providerName) {
  const body = await response.text()
  let detail = body
  try {
    const parsed = body ? JSON.parse(body) : {}
    detail = parsed.message || parsed.error || parsed.detail || body
  } catch {
    detail = body
  }
  const error = new Error(
    `${providerName} API returned HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 500)}` : ` ${response.statusText}`}`,
  )
  error.status = 502
  return error
}

function deliveryResult(provider, channel, target) {
  return { delivered: true, provider, channel, target }
}

export async function sendOtpMessage({ phone, email }, code) {
  const provider = config.otpProvider
  const providerStatus = getOtpProviderConfigurationStatus()
  if (!providerStatus.configured) {
    const error = new Error(`OTP provider "${provider}" is not configured. Missing: ${providerStatus.missing.join(', ')}`)
    error.status = 503
    throw error
  }

  if (provider === 'africastalking') {
    const target = normalizePhone(phone)
    const body = new URLSearchParams({
      username: config.smsUsername,
      to: target,
      message: `Your Victoria Fresh Fish OTP is ${code}. Valid for ${config.otpExpiryMinutes} minutes.`,
    })
    if (config.smsSenderId) body.set('from', config.smsSenderId)

    let response
    try {
      response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey: config.smsApiKey,
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
    } catch (error) {
      const failure = new Error(`Africa's Talking request failed: ${error.message}`)
      failure.status = 503
      throw failure
    }
    if (!response.ok) throw await providerFailure(response, "Africa's Talking")

    const responseText = await response.text()
    let result
    try {
      result = responseText ? JSON.parse(responseText) : {}
    } catch {
      const failure = new Error(`Africa's Talking returned invalid JSON: ${responseText.slice(0, 500)}`)
      failure.status = 502
      throw failure
    }
    const recipients = result.SMSMessageData?.Recipients
    const recipient = Array.isArray(recipients)
      ? recipients.find((entry) => normalizePhone(entry.number) === target)
      : null
    if (!recipient || !['100', '101', '102'].includes(String(recipient.statusCode))) {
      const detail = recipient
        ? `statusCode=${recipient.statusCode}${recipient.status ? `, status=${recipient.status}` : ''}`
        : result.SMSMessageData?.Message || responseText || 'No delivery result for the requested phone number.'
      const failure = new Error(`Africa's Talking did not accept the OTP SMS: ${String(detail).slice(0, 500)}`)
      failure.status = 502
      throw failure
    }
    return deliveryResult(provider, 'sms', target)
  }

  if (provider === 'email') {
    const target = String(email || '').trim().toLowerCase()
    if (!target) {
      const failure = new Error('Email OTP delivery requires an email address on the customer account.')
      failure.status = 400
      throw failure
    }

    let response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.otpEmailFrom,
          to: [target],
          subject: 'Your Victoria Fresh Fish verification code',
          text: `Your Victoria Fresh Fish OTP is ${code}. It expires in ${config.otpExpiryMinutes} minutes. If you did not request this code, you can ignore this email.`,
        }),
        signal: AbortSignal.timeout(10000),
      })
    } catch (error) {
      const failure = new Error(`Resend email request failed: ${error.message}`)
      failure.status = 503
      throw failure
    }
    if (!response.ok) throw await providerFailure(response, 'Resend')
    await response.text()
    return deliveryResult(provider, 'email', target)
  }

  if (provider === 'console' && config.nodeEnv !== 'production') {
    const target = normalizePhone(phone) || String(email || '')
    console.warn('*** DEVELOPMENT ONLY: OTP_PROVIDER=console is not a real SMS or email delivery provider. ***')
    console.warn(`Development OTP for ${target}: ${code}`)
    return deliveryResult(provider, 'console', target)
  }

  const failure = new Error('OTP_PROVIDER=console is disabled in production.')
  failure.status = 503
  throw failure
}

export default { generateOtpCode, hashOtp, verifyOtpHash, getOtpRuntimePhone, canResendOtp, sendOtpMessage }
