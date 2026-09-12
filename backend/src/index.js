import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { assertProductionConfiguration, config, getMpesaConfigurationStatus } from './config/index.js'
import { initializeDatabase, isDatabaseReady, releaseExpiredInventory } from './lib/db.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import userRoutes from './routes/userRoutes.js'
import authRoutes from './routes/authRoutes.js'

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
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/auth/verify-otp', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/orders/checkout', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }))

app.get('/api/health', (_req, res) => {
  const databaseReady = isDatabaseReady()
  res.status(200).json({
    status: databaseReady ? 'OK' : 'DEGRADED',
    message: 'Victoria Fresh Fish API is running',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/readiness', (_req, res) => {
  const databaseReady = isDatabaseReady()
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'READY' : 'NOT_READY',
    database: databaseReady ? 'connected' : 'reconnecting',
  })
})

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)

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
  if (!config.adminDashboardKey) {
    console.warn('ADMIN_DASHBOARD_KEY is not configured; admin order endpoints are disabled.')
  }
  if (!config.authSecret) {
    console.warn('AUTH_SECRET is not configured; customer checkout sessions are disabled.')
  }
  if (!getMpesaConfigurationStatus().configured) {
    console.warn('M-Pesa is not configured; catalogue and customer browsing remain available, but checkout is disabled.')
  }
  const server = app.listen(config.port, () => {
    console.log(`Victoria Fresh Fish API running on http://localhost:${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
  })

  initializeDatabase().catch((error) => {
    console.error('Database initialization stopped unexpectedly:', error)
  })

  const inventoryCleanup = setInterval(() => {
    if (isDatabaseReady()) {
      releaseExpiredInventory().catch((error) => console.error('Inventory cleanup failed:', error))
    }
  }, 60 * 1000)
  inventoryCleanup.unref()

  return server
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
}

export default app
