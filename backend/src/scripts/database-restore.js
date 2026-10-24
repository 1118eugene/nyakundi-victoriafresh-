import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { assertDatabaseIsEmpty, getPgToolEnvironment } from './databaseCli.js'

const [backupPath, confirmation] = process.argv.slice(2)

function runPgRestore(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('pg_restore', [
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
      filePath,
    ], {
      env: getPgToolEnvironment(),
      stdio: 'ignore',
      windowsHide: true,
    })
    child.once('error', () => reject(new Error('Could not start pg_restore. Install PostgreSQL client tools and confirm pg_restore is on PATH.')))
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pg_restore failed with exit code ${code ?? 'unknown'}. Check the isolated target database before retrying.`))
    })
  })
}

try {
  if (!backupPath || confirmation !== '--confirm-empty-target') {
    throw new Error('Usage: npm run db:restore -- <custom-format-backup-file> --confirm-empty-target')
  }
  const filePath = path.resolve(backupPath)
  const backup = await stat(filePath)
  if (!backup.isFile() || backup.size === 0) throw new Error('Backup file is missing or empty.')
  await assertDatabaseIsEmpty()
  await runPgRestore(filePath)
  console.log('Restore completed to the verified empty target database.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database restore failed.')
  process.exitCode = 1
}
