import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'development'
process.env.OTP_PROVIDER = 'africastalking'
process.env.SMS_API_KEY = ''
process.env.SMS_USERNAME = ''
process.env.SMS_SENDER_ID = ''
process.env.RESEND_API_KEY = ''
process.env.OTP_EMAIL_FROM = ''

const { assertRuntimeConfiguration, config, getMpesaConfigurationStatus, getOtpProviderConfigurationStatus } = await import('../src/config/index.js')

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

test('missing optional payment, OTP, admin, and customer-auth settings do not block API startup', () => {
  const original = {
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl,
    port: config.port,
    authSecret: config.authSecret,
    adminDashboardKey: config.adminDashboardKey,
    deliveryStaffId: config.deliveryStaffId,
    deliveryStaffKey: config.deliveryStaffKey,
    mpesaMode: config.mpesaMode,
    otpProvider: config.otpProvider,
  }
  try {
    config.nodeEnv = 'production'
    config.databaseUrl = 'postgresql://db.example/victoria_fish'
    config.port = 5000
    config.authSecret = ''
    config.adminDashboardKey = ''
    config.deliveryStaffId = ''
    config.deliveryStaffKey = ''
    config.mpesaMode = 'mock'
    config.otpProvider = 'console'
    assert.doesNotThrow(assertRuntimeConfiguration)
    assert.equal(getMpesaConfigurationStatus().configured, false)
    assert.equal(getOtpProviderConfigurationStatus().configured, false)
  } finally {
    Object.assign(config, original)
  }
})

test('delivery staff credentials must be configured as a pair with a strong key', () => {
  const original = {
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl,
    port: config.port,
    deliveryStaffId: config.deliveryStaffId,
    deliveryStaffKey: config.deliveryStaffKey,
  }
  try {
    config.nodeEnv = 'production'
    config.databaseUrl = 'postgresql://db.example/victoria_fish'
    config.port = 5000
    config.deliveryStaffId = 'driver-one'
    config.deliveryStaffKey = ''
    assert.throws(assertRuntimeConfiguration, {
      message: 'Runtime configuration is incomplete. Missing or invalid variables: DELIVERY_STAFF_ID, DELIVERY_STAFF_KEY',
    })
    config.deliveryStaffKey = 'short'
    assert.throws(assertRuntimeConfiguration, {
      message: 'Runtime configuration is incomplete. Missing or invalid variables: DELIVERY_STAFF_KEY',
    })
    config.deliveryStaffKey = 'a'.repeat(32)
    assert.doesNotThrow(assertRuntimeConfiguration)
  } finally {
    Object.assign(config, original)
  }
})

test('runtime configuration errors list variable names only', () => {
  const original = {
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl,
    port: config.port,
    deliveryStaffId: config.deliveryStaffId,
    deliveryStaffKey: config.deliveryStaffKey,
  }
  try {
    config.nodeEnv = 'production'
    config.databaseUrl = ''
    config.port = 5000
    config.deliveryStaffId = ''
    config.deliveryStaffKey = ''
    assert.throws(assertRuntimeConfiguration, {
      message: 'Runtime configuration is incomplete. Missing or invalid variables: DATABASE_URL',
    })

    config.databaseUrl = 'postgresql://db.example/victoria_fish'
    config.port = 70000
    assert.throws(assertRuntimeConfiguration, {
      message: 'Runtime configuration is incomplete. Missing or invalid variables: PORT',
    })
  } finally {
    Object.assign(config, original)
  }
})

test('API startup can remain available while database configuration is unavailable', () => {
  const original = {
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl,
    port: config.port,
    deliveryStaffId: config.deliveryStaffId,
    deliveryStaffKey: config.deliveryStaffKey,
  }
  try {
    config.nodeEnv = 'production'
    config.databaseUrl = ''
    config.port = 5000
    config.deliveryStaffId = ''
    config.deliveryStaffKey = ''
    assert.throws(assertRuntimeConfiguration, /DATABASE_URL/)
    assert.doesNotThrow(() => assertRuntimeConfiguration({ allowDatabaseUnavailable: true }))
  } finally {
    Object.assign(config, original)
  }
})
