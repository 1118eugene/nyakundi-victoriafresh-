// Database and environment configuration
export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/victoria-fresh-fish',
  dbName: process.env.DB_NAME || 'victoria-fresh-fish',
  defaultLimit: 10,
  maxLimit: 100,
  adminDashboardKey: process.env.ADMIN_DASHBOARD_KEY || '',
  mpesaBaseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  mpesaShortcode: process.env.MPESA_SHORTCODE || '',
  mpesaPasskey: process.env.MPESA_PASSKEY || '',
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || '',
  mpesaTransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
}

export default config
