import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { catalogProducts, categoryLabels } from '../src/data/catalog.js'
import { productPhotoPaths } from '../src/data/productPhotoPaths.js'

const publicDirectory = fileURLToPath(new URL('../../public/', import.meta.url))

test('editable seed contains recovered catalogue entries with unconfirmed prices and no stock', () => {
  assert.equal(catalogProducts.length, 31)
  const recoveredPrices = {
    'FW-1': 850,
    'FW-2': 1500,
    'FW-3': 950,
    'FW-4': 450,
    'FF-1': 1200,
    'FF-2': 1800,
    'FF-3': 1400,
    'SF-1': 1100,
    'SF-2': 1300,
    'SF-3': 650,
    'FRD-1': 950,
    'FRD-2': 1300,
    'FRD-3': 1100,
    'FRD-4': 550,
    'CK-1': 1050,
    'CK-2': 1400,
    'CK-3': 1200,
    'SP-1': 3500,
    'SP-2': 5200,
  }
  assert.ok(catalogProducts.every((product) => product.price === (recoveredPrices[product.sku] ?? null)
    && product.priceConfirmed === false
    && product.quantity === 0
    && product.active === true
    && product.inStock === false))
  assert.equal(catalogProducts.filter((product) => product.sku.startsWith('PHOTO-')).length, 10)
  assert.ok(catalogProducts.filter((product) => product.sku.startsWith('PHOTO-'))
    .every((product) => /confirm/.test(product.name)
      && /not been confirmed/.test(product.description)
      && product.price === null))
  assert.deepEqual(categoryLabels, {
    'fresh-whole': 'Whole Fresh Fish',
    fillet: 'Fish Fillets',
    dried: 'Dried Fish',
    smoked: 'Smoked Fish',
    'small-fish': 'Small Fish',
    'coastal-seafood': 'Coastal Seafood',
    'ready-to-eat': 'Cooked & Ready to Eat',
    'fish-processing': 'Fish Processing',
  })
})

test('seed SKUs are unique and every assigned photo exists in the repository', () => {
  assert.equal(new Set(catalogProducts.map((product) => product.sku)).size, catalogProducts.length)
  for (const photo of productPhotoPaths) {
    const filePath = path.resolve(publicDirectory, decodeURIComponent(photo.slice(1)))
    assert.ok(existsSync(filePath), `${photo} exists in the admin photo picker`)
  }
  for (const product of catalogProducts) {
    assert.ok(product.photos.length > 0, `${product.sku} has a neutral image fallback`)
    assert.ok(product.photos.every((photo) => productPhotoPaths.has(photo)))
  }
})
