import test from 'node:test'
import assert from 'node:assert/strict'
import { canResendOtp, generateOtpCode, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, verifyOtpHash } from '../src/services/otp.js'

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
