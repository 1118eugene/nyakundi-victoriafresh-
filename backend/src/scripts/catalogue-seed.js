const originalInfo = console.info
console.info = () => {}

let closeDatabase
try {
  const db = await import('../lib/db.js')
  closeDatabase = db.closeDatabase
  await db.initializeDatabase({ retry: false })
  const result = await db.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE active)::int AS active,
    COUNT(*) FILTER (WHERE sku ~ '^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-[0-9]{3}$')::int AS launch
    FROM products`)
  const categories = await db.query(`SELECT category,COUNT(*)::int AS count
    FROM products WHERE sku ~ '^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-[0-9]{3}$'
    GROUP BY category ORDER BY category`)
  console.log(JSON.stringify({
    totalProducts: result.rows[0].total,
    activeProducts: result.rows[0].active,
    launchProducts: result.rows[0].launch,
    launchByCategory: Object.fromEntries(categories.rows.map(({ category, count }) => [category, count])),
  }))
} catch (error) {
  console.error(`catalogue_seed_failed=${error.message}`)
  process.exitCode = 1
} finally {
  console.info = originalInfo
  if (closeDatabase) await closeDatabase()
}
