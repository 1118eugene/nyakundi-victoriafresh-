import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDatabase, initializeDatabase, withTransaction } from '../lib/db.js'
import { importFilledCatalogueRows, parseFilledCatalogueCsv } from '../lib/catalogueFillImport.js'

const defaultCsv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/catalogue-to-fill.csv')
const csvPath = path.resolve(process.argv[2] || defaultCsv)

try {
  const csv = readFileSync(csvPath, 'utf8')
  const parsed = parseFilledCatalogueCsv(csv)
  await initializeDatabase({ retry: false })
  let imported = { accepted: [], rejected: [] }

  await withTransaction(async (client) => {
    imported = await importFilledCatalogueRows(client, parsed.accepted)
  })

  const rejected = [...parsed.rejected, ...imported.rejected]
  console.log(JSON.stringify({
    file: path.relative(process.cwd(), csvPath),
    acceptedCount: imported.accepted.length,
    accepted: imported.accepted,
    rejectedCount: rejected.length,
    rejected,
  }, null, 2))
} finally {
  await closeDatabase()
}
