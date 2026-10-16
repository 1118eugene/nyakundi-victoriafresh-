import test from 'node:test'
import assert from 'node:assert/strict'
import supertest from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''

const [{ default: app }, { config }] = await Promise.all([
  import('../src/index.js'),
  import('../src/config/index.js'),
])

config.databaseUrl = ''

test('health reports a missing database URL without exposing configuration values', async () => {
  const response = await supertest(app).get('/api/health')

  assert.equal(response.status, 503)
  assert.equal(response.body.status, 'DEGRADED')
  assert.equal(response.body.database, 'unavailable')
  assert.equal(response.body.reason, 'DATABASE_URL not set')
  assert.equal(JSON.stringify(response.body).includes('postgres'), false)
})

test('readiness reports the specific database configuration failure', async () => {
  const response = await supertest(app).get('/api/readiness')

  assert.equal(response.status, 503)
  assert.equal(response.body.status, 'NOT_READY')
  assert.equal(response.body.database, 'unavailable')
  assert.equal(response.body.reason, 'DATABASE_URL not set')
})
