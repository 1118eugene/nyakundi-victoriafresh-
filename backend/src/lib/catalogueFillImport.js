import { catalogProducts, categoryLabels } from '../data/catalog.js'
import { productPhotoPaths } from '../data/productPhotoPaths.js'
import { catalogImportHeaders, parseCsv } from './catalogImport.js'

export function parseFilledCatalogueCsv(text) {
  const records = parseCsv(text)
  const seenSkus = new Set()
  const accepted = []
  const rejected = []

  for (const { line, values } of records) {
    const row = Object.fromEntries(catalogImportHeaders.map((header, index) => [
      header,
      values[index]?.trim() || '',
    ]))
    const sku = row.sku
    try {
      if (values.length !== catalogImportHeaders.length) {
        throw new Error(`Expected ${catalogImportHeaders.length} columns but found ${values.length}.`)
      }
      if (seenSkus.has(sku)) throw new Error(`Duplicate SKU ${sku} in this import.`)
      seenSkus.add(sku)
      if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(sku)) throw new Error('SKU is missing or invalid.')
      if (!row.name || row.name.length > 120) throw new Error('Name is required and must be at most 120 characters.')
      if (!Object.hasOwn(categoryLabels, row.category)) throw new Error(`Unknown category "${row.category}".`)
      if (!row.unit || row.unit.length > 40 || !row.species || row.species.length > 80
        || !row.preparation || row.preparation.length > 80) {
        throw new Error('Unit, species, and preparation are required.')
      }
      if (row.description.length > 2000 || row.sizeLabel.length > 80) {
        throw new Error('Description or size label exceeds its maximum length.')
      }
      if (!row.price || !row.quantity) {
        throw new Error('Fill in both price and quantity before importing a confirmed product.')
      }
      const price = Number(row.price)
      const quantity = Number(row.quantity)
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
        throw new Error('Price must be a positive number no greater than 100,000,000.')
      }
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
        throw new Error('Quantity must be a whole number from 0 to 1,000,000.')
      }
      const photos = row.photos.split('|').map((photo) => photo.trim()).filter(Boolean)
      if (!photos.length || photos.length > 8 || photos.some((photo) => !productPhotoPaths.has(photo))) {
        throw new Error('Choose 1–8 image paths from the approved local photo inventory.')
      }
      accepted.push({
        line,
        product: {
          sku,
          name: row.name,
          description: row.description,
          price,
          priceConfirmed: true,
          unit: row.unit,
          sizeLabel: row.sizeLabel,
          photos,
          category: row.category,
          species: row.species,
          preparation: row.preparation,
          quantity,
          active: true,
          inStock: quantity > 0,
          featured: row.featured === 'true',
        },
      })
    } catch (error) {
      rejected.push({
        line,
        sku,
        reason: error instanceof Error ? error.message : 'Invalid catalogue row.',
      })
    }
  }

  return { accepted, rejected }
}

export async function importFilledCatalogueRows(client, rows) {
  const accepted = []
  const rejected = []

  for (const { line, product } of rows) {
    const result = await client.query(`INSERT INTO products
      (sku,name,description,price,unit,size_label,image,photos,category,species,preparation,
        quantity,active,in_stock,featured,price_confirmed,price_updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,true,$13,$14,true,now())
      ON CONFLICT (sku) DO NOTHING RETURNING id,NULL::numeric AS previous_price`,
    [product.sku, product.name, product.description, product.price, product.unit,
      product.sizeLabel, product.photos[0], JSON.stringify(product.photos), product.category,
      product.species, product.preparation, product.quantity, product.inStock, product.featured])
    let saved = result.rows[0]
    let action = 'inserted'
    if (!saved) {
      const seedProduct = catalogProducts.find(({ sku }) => sku === product.sku)
      if (!seedProduct) {
        rejected.push({ line, sku: product.sku, reason: 'SKU already exists; existing product was left unchanged.' })
        continue
      }
      const recovered = await client.query(`WITH eligible AS (
        SELECT id,price FROM products WHERE sku=$1 AND name=$2 AND description=$3
          AND unit=$4 AND size_label=$5 AND (image=$6 OR image='') AND photos=$7::jsonb
          AND category=$8 AND species=$9 AND preparation=$10 AND active=true
          AND quantity=0 AND in_stock=false AND price_confirmed=false
          AND price IS NOT DISTINCT FROM $11 AND price_updated_at IS NULL
        FOR UPDATE
      )
      UPDATE products AS product SET price=$12,quantity=$13,active=true,in_stock=$14,
        price_confirmed=true,price_updated_at=now(),updated_at=now()
      FROM eligible WHERE product.id=eligible.id
      RETURNING product.id,eligible.price AS previous_price`,
      [product.sku, product.name, product.description, product.unit, product.sizeLabel,
        product.photos[0], JSON.stringify(product.photos), product.category, product.species,
        product.preparation, seedProduct.price, product.price, product.quantity, product.inStock])
      saved = recovered.rows[0]
      action = 'updated'
    }
    if (!saved) {
      rejected.push({
        line,
        sku: product.sku,
        reason: 'SKU already exists with owner changes or a prior confirmation; existing product was left unchanged.',
      })
      continue
    }
    await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price)
      VALUES ($1,$2,$3)`, [saved.id, saved.previous_price, product.price])
    accepted.push({ line, sku: product.sku, action })
  }

  return { accepted, rejected }
}
