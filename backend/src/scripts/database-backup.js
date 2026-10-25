import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPgToolEnvironment } from './databaseCli.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(scriptDirectory, '..', '..')
const configuredDirectory = process.env.BACKUP_DIR
const backupDirectory = configuredDirectory ? path.resolve(configuredDirectory) : path.join(backendDirectory, 'backups')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputFile = path.join(backupDirectory, `victoria-fresh-${timestamp}.dump`)

function runPgDump() {
  return new Promise((resolve, reject) => {
    const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${outputFile}`], {
      env: getPgToolEnvironment(),
      stdio: 'ignore',
      windowsHide: true,
    })
    child.once('error', () => reject(new Error('Could not start pg_dump. Install PostgreSQL client tools and confirm pg_dump is on PATH.')))
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pg_dump failed with exit code ${code ?? 'unknown'}. No backup was reported as successful.`))
    })
  })
}

try {
  await mkdir(backupDirectory, { recursive: true })
  await runPgDump()
  console.log(`Database backup created: ${outputFile}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database backup failed.')
  process.exitCode = 1
}
