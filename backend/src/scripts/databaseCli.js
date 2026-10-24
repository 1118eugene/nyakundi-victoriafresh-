import { Client } from 'pg'

export function getDatabaseConnection() {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error('DATABASE_URL is required.')

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('DATABASE_URL is invalid.')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new Error('DATABASE_URL is invalid.')
  }

  const mode = String(process.env.DATABASE_SSL || '').trim().toLowerCase()
  let ssl
  if (mode === 'disable') ssl = false
  else if (mode === 'require') ssl = { rejectUnauthorized: false }
  else if (mode === 'verify' || mode === 'verify-full') ssl = { rejectUnauthorized: true }
  else if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) ssl = { rejectUnauthorized: true }

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl,
  }
}

export function getPgToolEnvironment() {
  const connection = getDatabaseConnection()
  const allowedEnvironment = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'PATHEXT', 'COMSPEC'])
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => allowedEnvironment.has(key.toUpperCase())),
  )
  environment.PGHOST = connection.host
  environment.PGPORT = String(connection.port)
  environment.PGDATABASE = connection.database
  environment.PGUSER = connection.user
  if (connection.password) environment.PGPASSWORD = connection.password

  const mode = String(process.env.DATABASE_SSL || '').trim().toLowerCase()
  if (mode === 'disable') environment.PGSSLMODE = 'disable'
  else if (mode === 'require') environment.PGSSLMODE = 'require'
  else if (mode === 'verify') environment.PGSSLMODE = 'verify-full'
  else if (mode === 'verify-full') environment.PGSSLMODE = 'verify-full'
  else if (connection.ssl) environment.PGSSLMODE = 'verify-full'
  else if (mode === 'prefer' || mode === 'allow') environment.PGSSLMODE = mode
  else delete environment.PGSSLMODE
  return environment
}

export async function assertDatabaseIsEmpty() {
  const client = new Client(getDatabaseConnection())
  await client.connect()
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ) AS has_user_tables
    `)
    if (result.rows[0]?.has_user_tables) {
      throw new Error('Restore refused: target database is not empty. No data was changed.')
    }
  } finally {
    await client.end()
  }
}
