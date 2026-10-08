const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null
  return timestamp
}

export function parseAnalyticsRange({ from, to } = {}, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const toTimestamp = to === undefined ? today.getTime() : parseDate(to)
  const fromTimestamp = from === undefined
    ? (toTimestamp ?? today.getTime()) - 29 * DAY_MS
    : parseDate(from)
  if (fromTimestamp === null || toTimestamp === null) return { error: 'Use valid dates in YYYY-MM-DD format.' }
  if (fromTimestamp > toTimestamp) return { error: 'The start date must be on or before the end date.' }
  const dayCount = Math.floor((toTimestamp - fromTimestamp) / DAY_MS) + 1
  if (dayCount > 366) return { error: 'Analytics ranges cannot exceed 366 days.' }
  return {
    from: new Date(fromTimestamp).toISOString().slice(0, 10),
    to: new Date(toTimestamp).toISOString().slice(0, 10),
    dayCount,
  }
}

export function buildDailyAnalytics(range, rows = []) {
  const fromTimestamp = parseDate(range.from)
  const totals = { orders: 0, paidOrders: 0, paidRevenue: 0, awaitingPayment: 0, activeDeliveries: 0 }
  const daily = Array.from({ length: range.dayCount }, (_value, index) => {
    const date = new Date(fromTimestamp + index * DAY_MS).toISOString().slice(0, 10)
    return { date, orders: 0, paidOrders: 0, paidRevenue: 0, awaitingPayment: 0, activeDeliveries: 0 }
  })
  const byDate = new Map(daily.map((entry) => [entry.date, entry]))

  for (const row of rows) {
    const day = byDate.get(String(row.date).slice(0, 10))
    if (!day) continue
    const orders = Number(row.orders) || 0
    const paidOrders = Number(row.paidOrders) || 0
    const paidRevenue = Number(row.paidRevenue) || 0
    day.orders += orders
    day.paidOrders += paidOrders
    day.paidRevenue += paidRevenue
    day.awaitingPayment += Number(row.awaitingPayment) || 0
    day.activeDeliveries += Number(row.activeDeliveries) || 0
    totals.orders += orders
    totals.paidOrders += paidOrders
    totals.paidRevenue += paidRevenue
    totals.awaitingPayment += Number(row.awaitingPayment) || 0
    totals.activeDeliveries += Number(row.activeDeliveries) || 0
  }

  return { range: { from: range.from, to: range.to }, summary: totals, daily }
}