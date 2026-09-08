import mongoose from 'mongoose'
import { config } from '../config/index.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import { verifiedCatalog } from '../data/catalog.js'

let cachedConnection = null
let connectionPromise = null

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1
}

export async function connectToDatabase() {
  if (isDatabaseReady() && cachedConnection) {
    return cachedConnection
  }

  if (connectionPromise) return connectionPromise

  connectionPromise = mongoose.connect(config.mongoUri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 1,
  })

  try {
    cachedConnection = await connectionPromise
    return cachedConnection
  } finally {
    connectionPromise = null
  }
}

export async function initializeDatabase() {
  while (!isDatabaseReady()) {
    try {
      await connectToDatabase()
      await seedVerifiedProducts()
      console.log('MongoDB connection is ready')
      return
    } catch (error) {
      cachedConnection = null
      console.error(`MongoDB connection attempt failed: ${error.message}. Retrying in 10 seconds.`)
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }
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

export async function releaseExpiredInventory() {
  const expiredOrders = await Order.find({
    inventoryReserved: true,
    paymentStatus: 'initiated',
    inventoryExpiresAt: { $lt: new Date() },
  })

  for (const order of expiredOrders) {
    const claimedOrder = await Order.findOneAndUpdate(
      { _id: order._id, inventoryReserved: true, paymentStatus: 'initiated' },
      {
        $set: {
          inventoryReserved: false,
          inventoryExpiresAt: null,
          paymentStatus: 'failed',
          'mpesa.resultDescription': 'Payment window expired before confirmation.',
        },
      },
      { new: true },
    )

    if (!claimedOrder) continue

    await Promise.all(claimedOrder.items.map((item) => Product.updateOne(
      { _id: item.productId },
      { $inc: { quantity: item.quantity } },
    )))
  }

  return expiredOrders.length
}
