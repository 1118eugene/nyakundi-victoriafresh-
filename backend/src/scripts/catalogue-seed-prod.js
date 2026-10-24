if (!process.argv.includes('--confirm-production')) {
  console.error('Refusing production catalogue seed without --confirm-production.')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be supplied by the environment.')
  process.exit(1)
}

try {
  const databaseUrl = new URL(process.env.DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !databaseUrl.hostname) {
    throw new Error()
  }
  if (['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname.toLowerCase())) {
    console.error('Production catalogue seed requires a remote PostgreSQL host.')
    process.exit(1)
  }
  if (databaseUrl.searchParams.get('sslmode')?.toLowerCase() === 'disable'
    || process.env.DATABASE_SSL?.trim().toLowerCase() === 'disable') {
    console.error('Production catalogue seed requires PostgreSQL SSL.')
    process.exit(1)
  }
  if (!process.env.DATABASE_SSL) process.env.DATABASE_SSL = 'verify'
} catch {
  console.error('DATABASE_URL must be a valid PostgreSQL URL with SSL enabled.')
  process.exit(1)
}

await import('./catalogue-seed.js')
