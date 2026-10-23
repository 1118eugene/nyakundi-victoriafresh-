import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { assertRuntimeConfiguration, config, getMpesaConfigurationStatus } from './config/index.js'
import { getDatabaseFailureReason, getDatabaseStatus, isDatabaseConnectionError, isDatabaseReady, query, releaseExpiredInventory, startDatabaseMonitor } from './lib/db.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import deliveryZoneRoutes from './routes/deliveryZoneRoutes.js'
import supportRoutes from './routes/supportRoutes.js'
import userRoutes from './routes/userRoutes.js'
import authRoutes from './routes/authRoutes.js'
import faqRoutes from './routes/faqRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet())

const configuredAllowedOrigins = [
  config.clientUrl,
  process.env.CORS_ALLOWED_ORIGINS,
  process.env.VERCEL_URL,
  process.env.VERCEL_PRODUCTION_URL,
  process.env.FRONTEND_URL,
  process.env.APP_URL,
].flatMap((value) => String(value || '').split(',').map((entry) => entry.trim())).filter(Boolean)
  .map((value) => {
    try {
      const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`
      const url = new URL(candidate)
      return ['http:', 'https:'].includes(url.protocol) ? url.origin : ''
    } catch {
      return ''
    }
  }).filter(Boolean)

const allowedOrigins = [...new Set([
  ...configuredAllowedOrigins,
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
])]

app.use((req, res, next) => {
  const origin = req.get('origin')
  if (!origin || allowedOrigins.includes(origin)) return next()

  console.warn('Rejected CORS origin', {
    origin,
    allowedOriginCount: allowedOrigins.length,
  })
  return res.status(403).json({
    status: 'error',
    message: 'Origin not allowed',
  })
})

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(null, false)
  },
  credentials: true,
  optionsSuccessStatus: 200,
}))

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/readiness',
}))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }))

async function healthHandler(_req, res) {
  const databaseStatus = getDatabaseStatus()
  if (databaseStatus.database !== 'connected') {
    return res.status(503).json({
      status: 'DEGRADED',
      message: 'Victoria Fresh Fish API is running but the database is unavailable',
      ...databaseStatus,
      corsAllowedOriginCount: allowedOrigins.length,
      timestamp: new Date().toISOString(),
    })
  }
  try {
    await query('SELECT 1')
    return res.status(200).json({
      status: 'OK',
      message: 'Victoria Fresh Fish API and database are ready',
      database: 'connected',
      corsAllowedOriginCount: allowedOrigins.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return res.status(503).json({
      status: 'DEGRADED',
      message: 'Victoria Fresh Fish API is running but the database is unavailable',
      database: 'unavailable',
      reason: getDatabaseFailureReason(error),
      corsAllowedOriginCount: allowedOrigins.length,
      timestamp: new Date().toISOString(),
    })
  }
}

app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

app.get('/api/version', (_req, res) => {
  res.json({
    status: 'success',
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
  })
})

app.get('/api/readiness', (_req, res) => {
  const databaseStatus = getDatabaseStatus()
  const databaseReady = databaseStatus.database === 'connected'
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'READY' : 'NOT_READY',
    ...databaseStatus,
  })
})

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/delivery-zones', deliveryZoneRoutes)
app.post('/api/support-requests', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/support-requests', supportRoutes)
app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/faqs', faqRoutes)
app.use('/api/reviews', reviewRoutes)

app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
  })
})

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  const databaseUnavailable = isDatabaseConnectionError(err)
  res.status(err.status || 500).json({
    status: 'error',
    message: databaseUnavailable
      ? 'The database is temporarily unavailable. Please try again shortly.'
      : err.status && err.status < 500 ? err.message || 'Invalid request'
        : config.nodeEnv === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  })
})

export async function startServer() {
  assertRuntimeConfiguration({ allowDatabaseUnavailable: true })
  if (!config.adminDashboardKey) {
    console.warn('ADMIN_DASHBOARD_KEY is not configured; admin order endpoints are disabled.')
  }
  if (!config.authSecret) {
    console.warn('AUTH_SECRET is not configured; customer checkout sessions are disabled.')
  }
  if (!getMpesaConfigurationStatus().configured) {
    console.warn('M-Pesa is not configured; customers can still order and choose cash on delivery.')
  }
  const server = app.listen(config.port, () => {
    console.log(`Victoria Fresh Fish API running on http://localhost:${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
    startDatabaseMonitor()

    const inventoryCleanup = setInterval(() => {
      if (isDatabaseReady()) {
        releaseExpiredInventory().catch((error) => console.error('Inventory cleanup failed:', error))
      }
    }, 60 * 1000)
    inventoryCleanup.unref()
  })
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('Port 5000 is already in use. Stop the other backend or run npm run dev:fresh')
      process.exitCode = 1
      return
    }
    throw error
  })

  return server
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
}

export default app
