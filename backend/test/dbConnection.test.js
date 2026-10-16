import test from 'node:test'
import assert from 'node:assert/strict'
import { getDatabaseFailureReason, getDatabaseStatus, isDatabaseConnectionError } from '../src/lib/db.js'
import { config } from '../src/config/index.js'

test('recognizes PostgreSQL connectivity, availability, and authentication failures', () => {
  for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '08006', '28P01', '3D000', '53300', '57P03']) {
    assert.equal(isDatabaseConnectionError({ code }), true, `${code} should mark the database unavailable`)
  }
})

test('does not treat ordinary query errors as database connection failures', () => {
  assert.equal(isDatabaseConnectionError({ code: '23505', message: 'duplicate key' }), false)
})

test('reports database failures with specific non-secret reasons', () => {
  const originalDatabaseUrl = config.databaseUrl
  try {
    config.databaseUrl = 'postgresql://user:password@db.example.invalid:5432/fish'
    assert.equal(getDatabaseFailureReason({ code: 'ENOTFOUND' }), 'database host lookup failed')
    assert.equal(getDatabaseFailureReason({ code: 'ECONNREFUSED' }), 'database connection refused')
    assert.equal(getDatabaseFailureReason({ code: 'ETIMEDOUT' }), 'database connection timed out')
    assert.equal(getDatabaseFailureReason({ code: '28P01' }), 'database authentication failed')
    assert.equal(getDatabaseFailureReason({ message: 'no pg_hba.conf entry for host; no encryption' }), 'database requires SSL')
    assert.equal(getDatabaseFailureReason({ message: 'self-signed certificate' }), 'database SSL connection failed')
  } finally {
    config.databaseUrl = originalDatabaseUrl
  }
})

test('reports a missing database URL without exposing any connection details', () => {
  const originalDatabaseUrl = config.databaseUrl
  try {
    config.databaseUrl = ''
    assert.equal(getDatabaseStatus().database, 'unavailable')
    assert.equal(getDatabaseStatus().reason, 'DATABASE_URL not set')
    assert.equal(getDatabaseFailureReason(new Error('connection failed')), 'DATABASE_URL not set')
  } finally {
    config.databaseUrl = originalDatabaseUrl
  }
})
