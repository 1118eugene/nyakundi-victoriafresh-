// Database and environment configuration
export const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // Database
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/victoria-fresh-fish',
  dbName: 'victoria-fresh-fish',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiration: '7d',
  
  // API
  apiPrefix: '/api',
  apiVersion: 'v1',
  
  // File uploads
  maxFileSize: 5 * 1024 * 1024, // 5MB
  uploadDir: './uploads',
  
  // Pagination
  defaultLimit: 10,
  maxLimit: 100,
  
  // Cache
  cacheTTL: 60 * 60 * 24, // 24 hours
}

export default config
