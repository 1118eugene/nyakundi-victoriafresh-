import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import { assertProductionConfiguration, config } from './config/index.js'
import { connectToDatabase, releaseExpiredInventory, seedVerifiedProducts } from './lib/db.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import userRoutes from './routes/userRoutes.js'

dotenv.config()

const app = express()

app.disable('x-powered-by')
app.use(helmet())

const allowedOrigins = [
  config.clientUrl,
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    callback(new Error(`CORS policy does not allow access from origin ${origin}`))
  },
  credentials: true,
  optionsSuccessStatus: 200,
}))

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/orders/checkout', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }))

app.get('/api/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'OK' : 'DEGRADED',
    message: 'Victoria Fresh Fish API is running',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)

app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
  })
})

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    status: 'error',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  })
})

export async function startServer() {
  assertProductionConfiguration()
  await connectToDatabase()
  await seedVerifiedProducts()
  const inventoryCleanup = setInterval(() => {
    releaseExpiredInventory().catch((error) => console.error('Inventory cleanup failed:', error))
  }, 60 * 1000)
  inventoryCleanup.unref()

  app.listen(config.port, () => {
    console.log(`Victoria Fresh Fish API running on http://localhost:${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
  })
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
}

export default app
