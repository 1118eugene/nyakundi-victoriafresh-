import test from 'node:test'
import assert from 'node:assert/strict'
import { isDatabaseConnectionError } from '../src/lib/db.js'

test('recognizes PostgreSQL connectivity, availability, and authentication failures', () => {
  for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '08006', '28P01', '3D000', '53300', '57P03']) {
    assert.equal(isDatabaseConnectionError({ code }), true, `${code} should mark the database unavailable`)
  }
})

test('does not treat ordinary query errors as database connection failures', () => {
  assert.equal(isDatabaseConnectionError({ code: '23505', message: 'duplicate key' }), false)
})
