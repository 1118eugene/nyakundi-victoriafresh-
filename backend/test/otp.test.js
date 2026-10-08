import test from 'node:test'
import assert from 'node:assert/strict'

process.env.OTP_PROVIDER = 'africastalking'
process.env.SMS_API_KEY = ''
process.env.SMS_USERNAME = ''

const {
  canResendOtp,
  generateOtpCode,
  getOtpRuntimePhone,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  sendOtpMessage,
  verifyOtpHash,
} = await import('../src/services/otp.js')

test('generates six-digit OTPs and validates only the matching hash', () => {
  const code = generateOtpCode()
  assert.match(code, /^\d{6}$/)
  assert.equal(verifyOtpHash(code, hashOtp(code)), true)
  assert.equal(verifyOtpHash('00000', hashOtp(code)), false)
  assert.equal(verifyOtpHash('abcdef', hashOtp(code)), false)
})

test('enforces OTP resend cooldown and attempt policy constants', () => {
  const sentAt = new Date()
  assert.equal(canResendOtp(sentAt, sentAt.getTime() + OTP_RESEND_COOLDOWN_MS - 1), false)
  assert.equal(canResendOtp(sentAt, sentAt.getTime() + OTP_RESEND_COOLDOWN_MS), true)
  assert.equal(OTP_MAX_ATTEMPTS, 5)
})

test('normalizes Kenyan 07 and 01 mobile numbers for OTP delivery', () => {
  assert.equal(getOtpRuntimePhone('0712345678'), '+254712345678')
  assert.equal(getOtpRuntimePhone('0112345678'), '+254112345678')
  assert.equal(getOtpRuntimePhone('+254112345678'), '+254112345678')
})

test('refuses to send OTP through an unconfigured provider and lists missing credentials', async () => {
  await assert.rejects(
    sendOtpMessage({ phone: '+254712345678', email: 'customer@example.com' }, '123456'),
    /OTP provider "africastalking" is not configured\. Missing: SMS_API_KEY, SMS_USERNAME/,
  )
})
