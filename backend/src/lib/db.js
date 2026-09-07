import mongoose from 'mongoose'
import { config } from '../config/index.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import { verifiedCatalog } from '../data/catalog.js'

let cachedConnection = null

export async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection
  }

  cachedConnection = await mongoose.connect(config.mongoUri, {
    dbName: config.dbName,
  })

  return cachedConnection
}

export async function seedVerifiedProducts() {
  const publishedSkus = verifiedCatalog.map((product) => product.sku)
  await Promise.all(verifiedCatalog.map((product) => {
    const { quantity, inStock, ...catalogFields } = product
    return Product.findOneAndUpdate(
      { sku: product.sku },
      { $set: catalogFields, $setOnInsert: { quantity, inStock } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  }))

  // Remove retired generated entries only when no historic order references them.
  const retired = await Product.find({ sku: { $nin: publishedSkus } }).select('_id')
  const referenced = new Set((await Order.distinct('items.productId', {
    'items.productId': { $in: retired.map((product) => product._id) },
  })).map(String))
  const removable = retired.filter((product) => !referenced.has(product.id)).map((product) => product._id)
  if (removable.length) await Product.deleteMany({ _id: { $in: removable } })

  // A referenced retired product stays available to historic orders but is
  // never returned to the storefront or sold again.
  const retained = retired.filter((product) => referenced.has(product.id)).map((product) => product._id)
  if (retained.length) await Product.updateMany({ _id: { $in: retained } }, { $set: { inStock: false } })
}
