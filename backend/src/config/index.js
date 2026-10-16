import dotenv from 'dotenv'

dotenv.config()

function isConfiguredValue(value) {
  return Boolean(value && !/(your-|change-me|example|placeholder|replace-with|\.\.\.)/i.test(value))
}

function isStrongSecret(value) {
  return isConfiguredValue(value) && String(value).length >= 32
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
const mpesaMode = process.env.MPESA_MODE || (isProduction ? 'daraja' : 'mock')
const otpProvider = (process.env.OTP_PROVIDER || 'africastalking').toLowerCase()

// Database and environment configuration
export const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || (isProduction ? 'https://nyakundi-victoriafresh.vercel.app' : 'http://localhost:3000'),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: String(process.env.DATABASE_SSL || '').trim().toLowerCase(),
  defaultLimit: 10,
  maxLimit: 100,
  adminDashboardKey: process.env.ADMIN_DASHBOARD_KEY || '',
  deliveryStaffId: process.env.DELIVERY_STAFF_ID || '',
  deliveryStaffName: process.env.DELIVERY_STAFF_NAME || '',
  deliveryStaffKey: process.env.DELIVERY_STAFF_KEY || '',
  authSecret: process.env.AUTH_SECRET || '',
  mpesaBaseUrl: process.env.MPESA_BASE_URL || process.env.MPESA_API_URL || (isProduction ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'),
  mpesaMode,
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  mpesaShortcode: process.env.MPESA_SHORTCODE || process.env.MPESA_BUSINESS_SHORTCODE || '',
  mpesaPasskey: process.env.MPESA_PASSKEY || '',
  mpesaCallbackSecret: process.env.MPESA_CALLBACK_SECRET || '',
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || process.env.MPESA_PAYMENT_CALLBACK_URL || process.env.MPESA_LOCAL_CALLBACK_URL || 'http://localhost:5000/api/orders/mpesa/callback',
  mpesaTransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  otpProvider,
  smsApiKey: process.env.SMS_API_KEY || '',
  smsUsername: process.env.SMS_USERNAME || '',
  smsSenderId: process.env.SMS_SENDER_ID || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  otpEmailFrom: process.env.OTP_EMAIL_FROM || '',
  fulizaApiKey: process.env.FULIZA_API_KEY || '',
  fulizaClientId: process.env.FULIZA_CLIENT_ID || '',
  fulizaBaseUrl: process.env.FULIZA_BASE_URL || '',
}

export function getMpesaConfigurationStatus() {
  if (config.mpesaMode === 'mock') {
    return { configured: false, callbackReady: false, missing: ['MPESA_MODE=daraja with real Daraja credentials'], mode: 'mock' }
  }

  const required = [
    ['mpesaConsumerKey', 'MPESA_CONSUMER_KEY'],
    ['mpesaConsumerSecret', 'MPESA_CONSUMER_SECRET'],
    ['mpesaShortcode', 'MPESA_SHORTCODE'],
    ['mpesaPasskey', 'MPESA_PASSKEY'],
    ['mpesaCallbackSecret', 'MPESA_CALLBACK_SECRET'],
  ]
  const missing = required
    .filter(([key]) => !isConfiguredValue(config[key]))
    .map(([, envName]) => envName)
  const callbackReady = isPublicCallbackUrl(config.mpesaCallbackUrl)
  if (!callbackReady) missing.push('MPESA_CALLBACK_URL (public HTTPS URL)')
  return { configured: missing.length === 0 && callbackReady, missing, callbackReady, mode: 'daraja' }
}

export function getOtpProviderConfigurationStatus() {
  if (config.otpProvider === 'africastalking') {
    const missing = []
    if (!isConfiguredValue(config.smsApiKey)) missing.push('SMS_API_KEY')
    if (!isConfiguredValue(config.smsUsername)) missing.push('SMS_USERNAME')
    return { configured: missing.length === 0, missing, provider: config.otpProvider }
  }
  if (config.otpProvider === 'email') {
    const missing = []
    if (!isConfiguredValue(config.resendApiKey)) missing.push('RESEND_API_KEY')
    if (!isConfiguredValue(config.otpEmailFrom)) missing.push('OTP_EMAIL_FROM')
    return { configured: missing.length === 0, missing, provider: config.otpProvider }
  }
  if (config.otpProvider === 'console') {
    const allowed = config.nodeEnv !== 'production'
    return { configured: allowed, missing: allowed ? [] : ['OTP_PROVIDER=africastalking or email'], provider: config.otpProvider }
  }
  return { configured: false, missing: ['OTP_PROVIDER (africastalking, email, or console)'], provider: config.otpProvider }
}

export function getMpesaCallbackUrl() {
  const separator = config.mpesaCallbackUrl.includes('?') ? '&' : '?'
  return `${config.mpesaCallbackUrl}${separator}secret=${encodeURIComponent(config.mpesaCallbackSecret)}`
}

export function assertRuntimeConfiguration({ allowDatabaseUnavailable = false } = {}) {
  const missing = []
  if (!['development', 'test', 'production'].includes(config.nodeEnv)) {
    missing.push('NODE_ENV')
  }
  let databaseUrlIsValid = false
  try {
    const databaseUrl = new URL(config.databaseUrl)
    databaseUrlIsValid = ['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
      && Boolean(databaseUrl.hostname)
      && databaseUrl.pathname.length > 1
  } catch {
    databaseUrlIsValid = false
  }
  if (!allowDatabaseUnavailable && !databaseUrlIsValid) missing.push('DATABASE_URL')
  if (config.databaseSsl && !['disable', 'require', 'verify'].includes(config.databaseSsl)) {
    missing.push('DATABASE_SSL')
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) missing.push('PORT')
  if (Boolean(config.deliveryStaffId) !== Boolean(config.deliveryStaffKey)) {
    missing.push('DELIVERY_STAFF_ID', 'DELIVERY_STAFF_KEY')
  } else if (config.deliveryStaffKey && !isStrongSecret(config.deliveryStaffKey)) {
    missing.push('DELIVERY_STAFF_KEY')
  }

  if (missing.length) {
    throw new Error(`Runtime configuration is incomplete. Missing or invalid variables: ${missing.join(', ')}`)
  }
}

export default config
