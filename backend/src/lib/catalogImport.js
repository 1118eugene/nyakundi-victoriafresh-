import { categoryLabels } from '../data/catalog.js'
import { productPhotoPaths } from '../data/productPhotoPaths.js'

export const catalogImportHeaders = [
  'sku',
  'name',
  'description',
  'price',
  'priceConfirmed',
  'unit',
  'sizeLabel',
  'photos',
  'category',
  'species',
  'preparation',
  'quantity',
  'active',
  'inStock',
  'featured',
  'priceUpdatedAt',
]

export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Choose a non-empty CSV file.')
  const records = []
  let record = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field === '') {
      quoted = true
    } else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      field = ''
      if (record.some((value) => value.trim())) records.push(record)
      record = []
    } else {
      field += character
    }
  }
  if (quoted) throw new Error('CSV contains a quoted field that was not closed.')
  record.push(field)
  if (record.some((value) => value.trim())) records.push(record)
  if (records.length < 2) throw new Error('CSV must include the template header and at least one product row.')
  const headers = records[0].map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim()
  ))
  if (new Set(headers).size !== headers.length
    || headers.length !== catalogImportHeaders.length
    || catalogImportHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error(`CSV header must exactly match the template: ${catalogImportHeaders.join(',')}`)
  }
  return records.slice(1).map((values, index) => ({
    line: index + 2,
    values,
  }))
}

function parseBoolean(value, label) {
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${label} must be true or false.`)
}

function parsePhotoList(value) {
  if (!value.trim()) return []
  const photos = value.split('|').map((photo) => photo.trim()).filter(Boolean)
  if (photos.length > 8) throw new Error('Provide no more than 8 photo paths.')
  for (const photo of photos) {
    if (!productPhotoPaths.has(photo)) {
      throw new Error(`Product photo path does not exist in the approved asset inventory: ${photo}`)
    }
  }
  return photos
}

export function parseCatalogImport(text, productPayload) {
  const records = parseCsv(text)
  const seenSkus = new Set()
  const accepted = []
  const rejected = []
  for (const { line, values } of records) {
    if (values.length !== catalogImportHeaders.length) {
      rejected.push({ line, sku: values[0]?.trim() || '', reason: `Expected ${catalogImportHeaders.length} columns but found ${values.length}.` })
      continue
    }
    const row = Object.fromEntries(catalogImportHeaders.map((header, index) => [header, values[index].trim()]))
    const sku = row.sku
    try {
      if (seenSkus.has(sku)) throw new Error(`Duplicate SKU ${sku} in this import.`)
      seenSkus.add(sku)
      const category = row.category
      if (!Object.hasOwn(categoryLabels, category)) {
        throw new Error(`Unknown category "${category}". Choose a category defined in the catalogue.`)
      }
      const priceConfirmed = parseBoolean(row.priceConfirmed, 'priceConfirmed')
      const price = row.price === '' ? null : Number(row.price)
      const quantity = row.quantity === '' ? NaN : Number(row.quantity)
      const photos = parsePhotoList(row.photos)
      if (!photos.length) throw new Error('Choose at least one existing product photo.')
      const product = productPayload({
        ...row,
        price,
        priceConfirmed,
        photos,
        quantity,
        active: parseBoolean(row.active, 'active'),
        inStock: parseBoolean(row.inStock, 'inStock'),
        featured: parseBoolean(row.featured, 'featured'),
      })
      accepted.push({ line, product })
    } catch (error) {
      rejected.push({ line, sku, reason: error instanceof Error ? error.message : 'Invalid product row.' })
    }
  }
  return { accepted, rejected }
}
