import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'development'

const { assertRuntimeConfiguration, config, getMpesaConfigurationStatus } = await import('../src/config/index.js')

test('missing optional payment, admin, and customer-auth settings do not block API startup', () => {
  const original = {
    nodeEnv: config.nodeEnv,
    databaseUrl: config.databaseUrl,
    port: config.port,
    authSecret: config.authSecret,
    adminDashboardKey: config.adminDashboardKey,
    deliveryStaffId: config.deliveryStaffId,
    deliveryStaffKey: config.deliveryStaffKey,
    mpesaMode: config.mpesaMode,
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
    assert.doesNotThrow(assertRuntimeConfiguration)
    assert.equal(getMpesaConfigurationStatus().configured, false)
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

test('DATABASE_SSL accepts only disable, require, or verify', () => {
  const original = config.databaseSsl
  try {
    config.databaseSsl = 'verify'
    assert.doesNotThrow(() => assertRuntimeConfiguration({ allowDatabaseUnavailable: true }))
    config.databaseSsl = 'disable'
    assert.doesNotThrow(() => assertRuntimeConfiguration({ allowDatabaseUnavailable: true }))
    config.databaseSsl = 'require'
    assert.doesNotThrow(() => assertRuntimeConfiguration({ allowDatabaseUnavailable: true }))
    config.databaseSsl = 'invalid'
    assert.throws(() => assertRuntimeConfiguration({ allowDatabaseUnavailable: true }), {
      message: 'Runtime configuration is incomplete. Missing or invalid variables: DATABASE_SSL',
    })
  } finally {
    config.databaseSsl = original
  }
})
