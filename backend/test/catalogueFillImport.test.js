import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { catalogImportHeaders } from '../src/lib/catalogImport.js'
import { parseFilledCatalogueCsv } from '../src/lib/catalogueFillImport.js'

function csvFor(row) {
  return [catalogImportHeaders.join(','), catalogImportHeaders.map((header) => row[header] || '').join(',')].join('\n')
}

const validRow = {
  sku: 'FILL-001',
  name: 'Fresh whole tilapia',
  description: 'Whole fish.',
  price: '850',
  priceConfirmed: '',
  unit: 'kg',
  sizeLabel: '',
  photos: '/images/products/pexels-tilapia.jpg',
  category: 'fresh-whole',
  species: 'Tilapia',
  preparation: 'Fresh',
  quantity: '4',
  active: 'true',
  inStock: '',
  featured: 'false',
  priceUpdatedAt: '',
}

test('filled catalogue imports confirm entered prices and set availability from entered quantity', () => {
  const result = parseFilledCatalogueCsv(csvFor(validRow))
  assert.equal(result.rejected.length, 0)
  assert.equal(result.accepted.length, 1)
  assert.equal(result.accepted[0].product.priceConfirmed, true)
  assert.equal(result.accepted[0].product.quantity, 4)
  assert.equal(result.accepted[0].product.inStock, true)
})

test('filled catalogue imports reject blank price or stock and invalid categories or photos', () => {
  const rows = [validRow, { ...validRow, sku: 'FILL-002', price: '' },
    { ...validRow, sku: 'FILL-003', quantity: '' },
    { ...validRow, sku: 'FILL-004', category: 'frames' },
    { ...validRow, sku: 'FILL-005', photos: '/images/products/missing.jpg' }]
  const csv = [catalogImportHeaders.join(','), ...rows.map((row) => (
    catalogImportHeaders.map((header) => row[header] || '').join(',')
  ))].join('\n')
  const result = parseFilledCatalogueCsv(csv)
  assert.equal(result.accepted.length, 1)
  assert.equal(result.rejected.length, 4)
  assert.match(result.rejected[0].reason, /price and quantity/)
  assert.match(result.rejected[1].reason, /price and quantity/)
  assert.match(result.rejected[2].reason, /Unknown category/)
  assert.match(result.rejected[3].reason, /approved local photo inventory/)
})

test('catalogue-to-fill is the existing import template with price and quantity left blank', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const csv = readFileSync(path.join(root, 'docs', 'catalogue-to-fill.csv'), 'utf8')
  const result = parseFilledCatalogueCsv(csv)
  assert.equal(result.accepted.length, 0)
  assert.ok(result.rejected.length > 0)
  assert.ok(result.rejected.every(({ reason }) => /price and quantity/.test(reason)))
})
