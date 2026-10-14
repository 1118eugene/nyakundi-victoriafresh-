import { query } from './db.js'

export async function findDeliveryZone(county, town, runner = query) {
  const normalizedCounty = String(county || '').trim()
  const normalizedTown = String(town || '').trim()
  if (!normalizedCounty || !normalizedTown) return null

  const execute = typeof runner === 'function' ? runner : runner.query.bind(runner)
  const result = await execute(`SELECT id,name,county,towns,fee,minimum_order,delivery_windows,cutoff_at
    FROM delivery_zones
    WHERE active=true AND lower(county)=lower($1)
      AND (cardinality(towns)=0 OR EXISTS (
        SELECT 1 FROM unnest(towns) AS allowed(town) WHERE lower(allowed.town)=lower($2)
      ))
    ORDER BY priority DESC,cardinality(towns) DESC,updated_at DESC
    LIMIT 1`, [normalizedCounty, normalizedTown])
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    county: row.county,
    towns: row.towns,
    fee: Number(row.fee),
    minimumOrder: Number(row.minimum_order),
    deliveryWindows: row.delivery_windows,
    cutoffAt: row.cutoff_at,
  }
}

export function calculateShippingFee(zone) {
  if (!zone || !Number.isFinite(Number(zone.fee)) || Number(zone.fee) < 0) return null
  return Number(zone.fee)
}
