import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogImportHeaders, parseCatalogImport } from '../src/lib/catalogImport.js'

function csvRow(overrides = {}) {
  const row = {
    sku: 'IMPORT-1',
    name: 'Import Test Fish',
    description: 'Test row',
    price: '450',
    priceConfirmed: 'false',
    unit: 'kg',
    sizeLabel: '',
    photos: '/images/products/pexels-tilapia.jpg',
    category: 'fresh-whole',
    species: 'Tilapia',
    preparation: 'Fresh',
    quantity: '0',
    active: 'true',
    inStock: 'false',
    featured: 'false',
    priceUpdatedAt: '',
    ...overrides,
  }
  return catalogImportHeaders.map((header) => row[header]).join(',')
}

function parseRows(rows) {
  const csv = [catalogImportHeaders.join(','), ...rows].join('\n')
  return parseCatalogImport(csv, (product) => product)
}

test('parses a valid unconfirmed product without changing its price or stock fields', () => {
  const result = parseRows([csvRow()])
  assert.equal(result.accepted.length, 1)
  assert.equal(result.rejected.length, 0)
  assert.equal(result.accepted[0].product.price, 450)
  assert.equal(result.accepted[0].product.priceConfirmed, false)
  assert.equal(result.accepted[0].product.quantity, 0)
  assert.deepEqual(result.accepted[0].product.photos, ['/images/products/pexels-tilapia.jpg'])
})

test('rejects duplicate SKUs, unsupported categories, missing photos, and unapproved image paths', () => {
  const result = parseRows([
    csvRow(),
    csvRow(),
    csvRow({ sku: 'IMPORT-2', category: 'not-a-category' }),
    csvRow({ sku: 'IMPORT-3', photos: '' }),
    csvRow({ sku: 'IMPORT-4', photos: '/images/products/missing.jpg' }),
    csvRow({ sku: 'IMPORT-5', photos: 'https://example.com/fish.jpg' }),
  ])
  assert.equal(result.accepted.length, 1)
  assert.equal(result.rejected.length, 5)
  assert.match(result.rejected[0].reason, /Duplicate SKU/)
  assert.match(result.rejected[1].reason, /Unknown category/)
  assert.match(result.rejected[2].reason, /at least one existing product photo/)
  assert.match(result.rejected[3].reason, /does not exist in the approved asset inventory/)
  assert.match(result.rejected[4].reason, /does not exist in the approved asset inventory/)
})

test('rejects a malformed or unclosed CSV template', () => {
  assert.throws(() => parseCatalogImport('sku,name\nA,B', (product) => product), /header must exactly match/)
  assert.throws(() => parseCatalogImport(`${catalogImportHeaders.join(',')}\n"unclosed`, (product) => product), /not closed/)
})
