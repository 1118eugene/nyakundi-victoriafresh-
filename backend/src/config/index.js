import dotenv from 'dotenv'

dotenv.config()

function isConfiguredValue(value) {
  return Boolean(value && !/(your-|change-me|example|placeholder)/i.test(value))
}

function isPublicCallbackUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

// Database and environment configuration
export const config = {
  port: process.env.PORT || 5000,
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://localhost:27017/victoria-fresh-fish'),
  dbName: process.env.DB_NAME || 'victoria_fish',
  defaultLimit: 10,
  maxLimit: 100,
  adminDashboardKey: process.env.ADMIN_DASHBOARD_KEY || '',
  authSecret: process.env.AUTH_SECRET || '',
  mpesaBaseUrl: process.env.MPESA_BASE_URL || process.env.MPESA_API_URL || (isProduction ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'),
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  mpesaShortcode: process.env.MPESA_SHORTCODE || process.env.MPESA_BUSINESS_SHORTCODE || '',
  mpesaPasskey: process.env.MPESA_PASSKEY || '',
  mpesaCallbackSecret: process.env.MPESA_CALLBACK_SECRET || '',
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || process.env.MPESA_PAYMENT_CALLBACK_URL || process.env.MPESA_LOCAL_CALLBACK_URL || 'http://localhost:5000/api/orders/mpesa/callback',
  mpesaTransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  smsProvider: process.env.SMS_PROVIDER || 'demo',
  smsApiKey: process.env.SMS_API_KEY || '',
  smsUsername: process.env.SMS_USERNAME || '',
  smsSenderId: process.env.SMS_SENDER_ID || '',
  smsAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  smsAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  smsFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  fulizaApiKey: process.env.FULIZA_API_KEY || '',
  fulizaClientId: process.env.FULIZA_CLIENT_ID || '',
  fulizaBaseUrl: process.env.FULIZA_BASE_URL || '',
}

export function getMpesaConfigurationStatus() {
  const required = ['mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaShortcode', 'mpesaPasskey', 'mpesaCallbackSecret']
  const missing = required.filter((key) => !isConfiguredValue(config[key]))
  const callbackReady = isPublicCallbackUrl(config.mpesaCallbackUrl)
  return { configured: missing.length === 0 && callbackReady, missing, callbackReady }
}

export function getMpesaCallbackUrl() {
  const separator = config.mpesaCallbackUrl.includes('?') ? '&' : '?'
  return `${config.mpesaCallbackUrl}${separator}secret=${encodeURIComponent(config.mpesaCallbackSecret)}`
}

export function assertProductionConfiguration() {
  if (!isProduction) return

  const missing = []
  if (!isConfiguredValue(config.mongoUri)) missing.push('MONGODB_URI')
  if (!isConfiguredValue(config.clientUrl)) missing.push('CLIENT_URL')

  if (missing.length) {
    throw new Error(`Production configuration is incomplete: ${missing.join(', ')}`)
  }
}

export default config
