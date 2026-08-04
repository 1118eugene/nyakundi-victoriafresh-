import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { config } from './config/index.js'
import { connectToDatabase, seedVerifiedProducts } from './lib/db.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import userRoutes from './routes/userRoutes.js'

dotenv.config()

const app = express()

const allowedOrigins = [
  config.clientUrl,
  'http://127.0.0.1:3000',
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

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'Victoria Fresh Fish API is running',
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
    message: err.message || 'Internal server error',
  })
})

async function startServer() {
  await connectToDatabase()
  await seedVerifiedProducts()

  app.listen(config.port, () => {
    console.log(`Victoria Fresh Fish API running on http://localhost:${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})

export default app
