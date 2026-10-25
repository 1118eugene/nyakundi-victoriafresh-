import test from 'node:test'
import assert from 'node:assert/strict'
import { getDatabaseConnection, getPgToolEnvironment } from '../src/scripts/databaseCli.js'

function withDatabaseEnvironment(databaseUrl, databaseSsl, run) {
  const previousUrl = process.env.DATABASE_URL
  const previousSsl = process.env.DATABASE_SSL
  const previousCa = process.env.NODE_EXTRA_CA_CERTS
  process.env.DATABASE_URL = databaseUrl
  if (databaseSsl === undefined) delete process.env.DATABASE_SSL
  else process.env.DATABASE_SSL = databaseSsl
  try {
    run()
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
    if (previousSsl === undefined) delete process.env.DATABASE_SSL
    else process.env.DATABASE_SSL = previousSsl
    if (previousCa === undefined) delete process.env.NODE_EXTRA_CA_CERTS
    else process.env.NODE_EXTRA_CA_CERTS = previousCa
  }
}

test('database CLI maps a local PostgreSQL URL without enabling remote TLS', () => {
  withDatabaseEnvironment('postgresql://test-user:test-password@127.0.0.1:5433/test_database', undefined, () => {
    const connection = getDatabaseConnection()
    assert.equal(connection.host, '127.0.0.1')
    assert.equal(connection.port, 5433)
    assert.equal(connection.database, 'test_database')
    assert.equal(connection.ssl, undefined)
  })
})

test('database CLI preserves explicitly configured PostgreSQL SSL requirements', () => {
  withDatabaseEnvironment('postgresql://test-user:test-password@db.example.invalid/test_database', 'require', () => {
    const connection = getDatabaseConnection()
    assert.equal(connection.ssl?.rejectUnauthorized, false)
    assert.equal(getPgToolEnvironment().PGSSLMODE, 'require')
  })
})

test('database CLI uses a supplied CA file with verified PostgreSQL TLS', () => {
  withDatabaseEnvironment('postgresql://db.example.invalid/test_database', 'verify', () => {
    process.env.NODE_EXTRA_CA_CERTS = 'C:\\render\\postgres-ca.pem'
    const connection = getDatabaseConnection()
    assert.equal(connection.ssl?.rejectUnauthorized, true)
    assert.equal(getPgToolEnvironment().PGSSLMODE, 'verify-full')
    assert.equal(getPgToolEnvironment().PGSSLROOTCERT, 'C:\\render\\postgres-ca.pem')
  })
})

test('database CLI uses the application TLS default for remote database hosts', () => {
  withDatabaseEnvironment('postgresql://test-user:test-password@db.example.invalid/test_database?sslmode=require', undefined, () => {
    const connection = getDatabaseConnection()
    assert.equal(connection.ssl?.rejectUnauthorized, true)
    assert.equal(getPgToolEnvironment().PGSSLMODE, 'verify-full')
  })
})

test('database client tools receive only required connection variables', () => {
  withDatabaseEnvironment('postgresql://test-user:test-password@127.0.0.1:5433/test_database', 'disable', () => {
    const environment = getPgToolEnvironment()
    assert.equal(environment.PGHOST, '127.0.0.1')
    assert.equal(environment.PGPORT, '5433')
    assert.equal(environment.PGDATABASE, 'test_database')
    assert.equal(environment.PGUSER, 'test-user')
    assert.equal(environment.PGPASSWORD === 'test-password', true)
    assert.equal(environment.PGSSLMODE, 'disable')
    assert.equal(Object.hasOwn(environment, 'DATABASE_URL'), false)
    assert.equal(Object.hasOwn(environment, 'TEST_DATABASE_URL'), false)
    assert.equal(Object.hasOwn(environment, 'ADMIN_DASHBOARD_KEY'), false)
  })
})

test('database CLI rejects missing or invalid connection URLs', () => {
  withDatabaseEnvironment('', undefined, () => {
    assert.throws(() => getDatabaseConnection(), { message: 'DATABASE_URL is required.' })
  })
  withDatabaseEnvironment('not-a-database-url', undefined, () => {
    assert.throws(() => getDatabaseConnection(), { message: 'DATABASE_URL is invalid.' })
  })
})
