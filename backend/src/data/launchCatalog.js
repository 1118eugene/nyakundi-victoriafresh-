import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalogImportHeaders, parseCsv } from '../lib/catalogImport.js'
import { productPhotoPaths } from './productPhotoPaths.js'

const csvPath = fileURLToPath(new URL('../../../docs/catalogue-launch.csv', import.meta.url))
const publicDirectory = fileURLToPath(new URL('../../../public/', import.meta.url))
const priceSource = 'owner-approved-starting-price-2026-10-23'
const expectedCategories = [
  'fresh-whole',
  'fillet',
  'dried',
  'smoked',
  'small-fish',
  'coastal-seafood',
  'ready-to-eat',
  'fish-processing',
]

function parseBoolean(value, field, sku) {
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${field} must be true or false for ${sku}.`)
}

function parseLaunchCatalogue(text) {
  const records = parseCsv(text)
  const seenSkus = new Set()
  const seenNames = new Set()
  const categories = new Map(expectedCategories.map((category) => [category, 0]))
  const products = []

  for (const { line, values } of records) {
    if (values.length !== catalogImportHeaders.length) {
      throw new Error(`Launch catalogue line ${line} has ${values.length} columns; expected ${catalogImportHeaders.length}.`)
    }
    const row = Object.fromEntries(catalogImportHeaders.map((header, index) => [header, values[index].trim()]))
    if (!/^VFF-(FW|FL|DR|SM|SF|CS|RE|FP)-\d{3}$/.test(row.sku)) {
      throw new Error(`Invalid launch SKU on line ${line}: ${row.sku || '(blank)'}.`)
    }
    if (seenSkus.has(row.sku)) throw new Error(`Duplicate launch SKU: ${row.sku}.`)
    if (!row.name || seenNames.has(row.name.toLowerCase())) throw new Error(`Missing or duplicate launch product name on line ${line}.`)
    seenSkus.add(row.sku)
    seenNames.add(row.name.toLowerCase())

    if (!categories.has(row.category)) throw new Error(`Invalid launch category "${row.category}" for ${row.sku}.`)
    categories.set(row.category, categories.get(row.category) + 1)
    const priceConfirmed = parseBoolean(row.priceConfirmed, 'priceConfirmed', row.sku)
    const price = row.price === '' ? null : Number(row.price)
    if (priceConfirmed !== (price !== null) || (price !== null && (!Number.isFinite(price) || price <= 0))) {
      throw new Error(`Price and confirmation do not agree for ${row.sku}.`)
    }
    const quantity = Number(row.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Invalid placeholder quantity for ${row.sku}.`)
    const photos = row.photos ? row.photos.split('|').map((photo) => photo.trim()) : []
    if (photos.length > 1 || photos.some((photo) => !productPhotoPaths.has(photo))) {
      throw new Error(`Unapproved launch photo for ${row.sku}.`)
    }
    for (const photo of photos) {
      if (!existsSync(path.resolve(publicDirectory, decodeURIComponent(photo.slice(1))))) {
        throw new Error(`Launch photo file is missing for ${row.sku}: ${photo}.`)
      }
    }
    const active = parseBoolean(row.active, 'active', row.sku)
    const inStock = parseBoolean(row.inStock, 'inStock', row.sku)
    if (!active || !inStock) throw new Error(`${row.sku} must be active with its placeholder stock.`)
    const expectedPhoto = `/images/products/${row.sku.toLowerCase()}.jpg`
    const expectedPhotoFile = path.resolve(publicDirectory, decodeURIComponent(expectedPhoto.slice(1)))
    const assignedPhotos = photos.length
      ? photos
      : existsSync(expectedPhotoFile) && productPhotoPaths.has(expectedPhoto)
        ? [expectedPhoto]
        : []

    products.push({
      sku: row.sku,
      name: row.name,
      description: row.description,
      price,
      priceConfirmed,
      priceSource: priceConfirmed ? priceSource : null,
      unit: row.unit,
      sizeLabel: row.sizeLabel,
      photos: assignedPhotos,
      category: row.category,
      species: row.species,
      preparation: row.preparation,
      quantity,
      active,
      inStock,
      featured: parseBoolean(row.featured, 'featured', row.sku),
    })
  }

  if (products.length !== 40) throw new Error(`Launch catalogue must contain exactly 40 products; found ${products.length}.`)
  for (const category of expectedCategories) {
    if (categories.get(category) !== 5) {
      throw new Error(`Launch category ${category} must contain 5 products; found ${categories.get(category)}.`)
    }
  }
  return products
}

export const launchProducts = parseLaunchCatalogue(readFileSync(csvPath, 'utf8'))
export const launchPriceSource = priceSource
