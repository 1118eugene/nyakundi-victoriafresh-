import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { verifiedCatalog } from '../src/data/catalog.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

test('catalogue uses photos that match each product species and preparation', () => {
  for (const product of verifiedCatalog) {
    if (product.category === 'fresh-whole') {
      const expectedImages = {
        Tilapia: '/images/products/pexels-tilapia.jpg',
        'Nile Perch (Mbuta)': '/images/products/nile-perch-wikimedia.jpg',
        'Catfish (Nduma)': '/images/products/catfish-wikimedia.jpg',
        Omena: '',
      }
      assert.equal(product.image, expectedImages[product.species], product.sku)
    } else if (product.category === 'fillet') {
      assert.equal(product.image, '/images/products/pexels-fillet.jpg', product.sku)
    } else if (product.category === 'smoked') {
      assert.equal(product.image, '/images/products/pexels-smoked.jpg', product.sku)
    } else if (product.species === 'Omena' && ['dried', 'omena-packets'].includes(product.category)) {
      assert.equal(product.image, '/images/products/omena-dried-wikimedia.jpg', product.sku)
    } else {
      assert.equal(product.image, '', `${product.sku} should not show an unverified photo`)
    }

    if (product.image) {
      assert.ok(
        existsSync(resolve(projectRoot, 'public', product.image.slice(1))),
        `${product.sku} references a missing image`,
      )
    }
  }
})
