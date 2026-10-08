import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyAnalytics, parseAnalyticsRange } from '../src/lib/analyticsUtils.js'

test('defaults analytics to a bounded 30-day UTC range', () => {
  assert.deepEqual(parseAnalyticsRange({}, new Date('2026-09-29T23:30:00-07:00')), {
    from: '2026-09-01',
    to: '2026-09-30',
    dayCount: 30,
  })
})

test('rejects malformed, impossible, reversed, and oversized date ranges', () => {
  assert.match(parseAnalyticsRange({ from: '2026-02-30', to: '2026-03-01' }).error, /valid dates/)
  assert.match(parseAnalyticsRange({ from: '2026-03-02', to: '2026-03-01' }).error, /on or before/)
  assert.match(parseAnalyticsRange({ from: '2025-01-01', to: '2026-01-02' }).error, /366 days/)
})

test('fills missing days with zero and aggregates only date-keyed payment totals', () => {
  const range = parseAnalyticsRange({ from: '2026-09-01', to: '2026-09-03' })
  const result = buildDailyAnalytics(range, [
    { date: '2026-09-01', orders: '3', paidOrders: '2', paidRevenue: '1250.50' },
    { date: '2026-09-03', orders: '1', paidOrders: '1', paidRevenue: '800' },
    { date: '2026-10-01', orders: '99', paidOrders: '99', paidRevenue: '99999' },
  ])
  assert.deepEqual(result.daily.map(({ date, orders }) => ({ date, orders })), [
    { date: '2026-09-01', orders: 3 },
    { date: '2026-09-02', orders: 0 },
    { date: '2026-09-03', orders: 1 },
  ])
  assert.deepEqual(result.summary, { orders: 4, paidOrders: 3, paidRevenue: 2050.5, awaitingPayment: 0, activeDeliveries: 0 })
})