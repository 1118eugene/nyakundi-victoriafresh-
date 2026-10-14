import { readFileSync } from 'node:fs'

const catalogData = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))

if (!catalogData || typeof catalogData !== 'object'
  || !catalogData.categoryLabels || typeof catalogData.categoryLabels !== 'object'
  || !Array.isArray(catalogData.products)) {
  throw new Error('The editable catalogue must define categoryLabels and a products array.')
}

for (const [category, label] of Object.entries(catalogData.categoryLabels)) {
  if (!category || typeof label !== 'string' || !label.trim()) {
    throw new Error('Each catalogue category must have a non-empty display label.')
  }
}

const seenSkus = new Set()
for (const product of catalogData.products) {
  const requiredTextFields = ['sku', 'name', 'unit', 'category', 'species', 'preparation']
  if (!product || typeof product !== 'object' || requiredTextFields.some((field) => (
    typeof product[field] !== 'string' || !product[field].trim()
  ))) {
    throw new Error('Each catalogue product must define its SKU, name, unit, category, species, and preparation.')
  }
  if (seenSkus.has(product.sku)) throw new Error(`Duplicate catalogue SKU: ${product.sku}`)
  seenSkus.add(product.sku)
  if (!Object.hasOwn(catalogData.categoryLabels, product.category)) {
    throw new Error(`Catalogue product ${product.sku} uses an undefined category.`)
  }
  if (typeof product.priceConfirmed !== 'boolean'
    || (product.priceConfirmed && (!Number.isFinite(product.price) || product.price <= 0))
    || (!product.priceConfirmed && product.price !== null && product.price !== undefined
      && (!Number.isFinite(product.price) || product.price < 0))) {
    throw new Error(`Catalogue product ${product.sku} has an invalid price confirmation or price.`)
  }
  if (product.photos !== undefined && (!Array.isArray(product.photos)
    || product.photos.length > 8 || product.photos.some((photo) => typeof photo !== 'string'))) {
    throw new Error(`Catalogue product ${product.sku} must have at most 8 photo paths.`)
  }
}

export const catalogProducts = catalogData.products.map((product) => ({
  ...product,
  price: product.priceConfirmed ? product.price : 0,
  sizeLabel: product.sizeLabel || '',
  photos: product.photos || (product.image ? [product.image] : []),
  active: product.priceConfirmed && product.active === true,
  inStock: product.priceConfirmed && product.inStock === true,
  quantity: product.priceConfirmed ? (product.quantity || 0) : 0,
  featured: product.priceConfirmed && product.featured === true,
  priceUpdatedAt: product.priceConfirmed ? (product.priceUpdatedAt || new Date().toISOString()) : null,
}))
export const categoryLabels = catalogData.categoryLabels
