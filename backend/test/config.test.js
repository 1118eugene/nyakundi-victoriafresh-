import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'development'
process.env.OTP_PROVIDER = 'africastalking'
process.env.SMS_API_KEY = ''
process.env.SMS_USERNAME = ''
process.env.SMS_SENDER_ID = ''
process.env.RESEND_API_KEY = ''
process.env.OTP_EMAIL_FROM = ''

const { config, getOtpProviderConfigurationStatus } = await import('../src/config/index.js')

test('Africa’s Talking requires its API key and username but not a sender ID', () => {
  const status = getOtpProviderConfigurationStatus()
  assert.deepEqual(status.missing, ['SMS_API_KEY', 'SMS_USERNAME'])
  assert.equal(status.configured, false)
  config.smsApiKey = 'configured-api-key'
  config.smsUsername = 'configured-username'
  assert.deepEqual(getOtpProviderConfigurationStatus(), {
    configured: true,
    missing: [],
    provider: 'africastalking',
  })
})

test('email OTP requires a Resend API key and a sender address', () => {
  config.otpProvider = 'email'
  assert.deepEqual(getOtpProviderConfigurationStatus().missing, ['RESEND_API_KEY', 'OTP_EMAIL_FROM'])
  config.resendApiKey = 'configured-resend-api-key'
  config.otpEmailFrom = 'Victoria Fresh Fish <auth@verified-domain.test>'
  assert.equal(getOtpProviderConfigurationStatus().configured, true)
})

test('console OTP is available outside production and rejected in production', () => {
  config.otpProvider = 'console'
  config.nodeEnv = 'development'
  assert.equal(getOtpProviderConfigurationStatus().configured, true)
  config.nodeEnv = 'production'
  assert.deepEqual(getOtpProviderConfigurationStatus().missing, ['OTP_PROVIDER=africastalking or email'])
})
