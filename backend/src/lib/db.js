import mongoose from 'mongoose'
import { config } from '../config/index.js'
import Product from '../models/Product.js'
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
  const existingCount = await Product.countDocuments()
  if (existingCount > 0) {
    return
  }

  await Product.insertMany(verifiedCatalog)
}
