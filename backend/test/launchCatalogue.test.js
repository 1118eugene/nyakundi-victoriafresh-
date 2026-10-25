import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { launchProducts } from '../src/data/launchCatalog.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const photoDirectory = path.join(root, 'public', 'images', 'products')
const fallbackPhoto = '/images/products/fresh-pexels-a.jpg'
const verifiedPhotoAssignments = new Map([
  ['/images/products/pexels-tilapia.jpg', ['fresh-whole', 'Tilapia', 'Whole']],
  ['/images/products/nile-perch-wikimedia.jpg', ['fresh-whole', 'Nile Perch', 'Whole']],
  ['/images/products/catfish-wikimedia.jpg', ['fresh-whole', 'Catfish', 'Whole']],
  ['/images/products/pexels-fried.jpg', ['ready-to-eat', 'Tilapia', 'Fried']],
])

test('launch seed contains 40 distinct products with five per launch category', () => {
  assert.equal(launchProducts.length, 40)
  assert.equal(new Set(launchProducts.map(({ sku }) => sku)).size, 40)
  assert.equal(new Set(launchProducts.map(({ name }) => name.toLowerCase())).size, 40)
  const counts = Object.groupBy(launchProducts, ({ category }) => category)
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([category, products]) => [category, products.length])), {
    'fresh-whole': 5,
    fillet: 5,
    dried: 5,
    smoked: 5,
    'small-fish': 5,
    'coastal-seafood': 5,
    'ready-to-eat': 5,
    'fish-processing': 5,
  })
})

test('launch photos are unique genuine matches or use the neutral fallback', () => {
  const assignedPhotos = launchProducts.flatMap((product) => product.photos)
  assert.equal(new Set(assignedPhotos).size, assignedPhotos.length)
  for (const product of launchProducts) {
    assert.ok(product.photos.length <= 1, `${product.sku} has at most one assigned photo`)
    if (product.photos.length === 0) continue
    const photo = product.photos[0]
    assert.ok(verifiedPhotoAssignments.has(photo), `${product.sku} uses a verified filename match`)
    assert.deepEqual(
      [product.category, product.species, product.preparation],
      verifiedPhotoAssignments.get(photo),
      `${product.sku} photo must not cross species or preparation`,
    )
    assert.ok(existsSync(path.join(photoDirectory, decodeURIComponent(photo.split('/').pop()))))
  }
  assert.equal(launchProducts.filter((product) => product.photos.length === 1).length, 4)
  assert.equal(launchProducts.filter((product) => product.photos.length === 0).length, 36)
  assert.ok(existsSync(path.join(photoDirectory, decodeURIComponent(fallbackPhoto.split('/').pop()))))
})

test('launch prices and placeholder stock match the owner-approved catalogue', () => {
  assert.equal(launchProducts.filter(({ priceConfirmed }) => priceConfirmed).length, 33)
  assert.equal(launchProducts.filter(({ price }) => price === null).length, 7)
  assert.ok(launchProducts.filter(({ priceConfirmed }) => priceConfirmed)
    .every(({ priceSource }) => priceSource === 'owner-approved-starting-price-2026-10-23'))
  assert.ok(launchProducts.filter(({ price }) => price === null)
    .every(({ priceConfirmed, priceSource }) => !priceConfirmed && priceSource === null))
  assert.ok(launchProducts.every(({ quantity, category }) => quantity === (category === 'ready-to-eat' ? 50 : 10)))
})

test('photos-needed file covers every launch item without a verified product photo', () => {
  const rows = readFileSync(path.join(root, 'docs', 'photos-needed.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  const missingSkus = launchProducts.filter(({ photos }) => photos.length === 0).map(({ sku }) => sku)
  assert.equal(rows.length, missingSkus.length)
  for (const row of rows) {
    const columns = []
    let value = ''
    let quoted = false
    for (let index = 0; index < row.length; index += 1) {
      const character = row[index]
      if (character === '"' && quoted && row[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = !quoted
      } else if (character === ',' && !quoted) {
        columns.push(value)
        value = ''
      } else {
        value += character
      }
    }
    columns.push(value)
    const [sku, name, category, saveAs] = columns
    const product = launchProducts.find((item) => item.sku === sku)
    const filename = `${sku.toLowerCase()}.jpg`
    assert.ok(missingSkus.includes(sku), `${sku} needs a photo`)
    assert.equal(product?.name, name)
    assert.equal(product?.category, category)
    assert.equal(saveAs, `public/images/products/${filename}`)
  }
})
