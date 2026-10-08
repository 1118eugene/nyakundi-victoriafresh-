import { closeDatabase, initializeDatabase } from '../lib/db.js'

try {
  await initializeDatabase({ retry: false })
} catch (error) {
  console.error(`Database setup failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
