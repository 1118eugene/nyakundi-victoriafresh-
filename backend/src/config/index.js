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

function isHttpUrl(value, requireHttps = false) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (!requireHttps || url.protocol === 'https:')
      && url.origin === value
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
  clientUrl: process.env.CLIENT_URL || (isProduction ? '' : 'http://localhost:3000'),
  databaseUrl: process.env.DATABASE_URL || '',
  defaultLimit: 10,
  maxLimit: 100,
  adminDashboardKey: process.env.ADMIN_DASHBOARD_KEY || '',
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
    return { configured: !isProduction, callbackReady: false, missing: [], mode: 'mock' }
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

export function assertRuntimeConfiguration() {
  const missing = []
  if (!['development', 'test', 'production'].includes(config.nodeEnv)) {
    missing.push('NODE_ENV (development, test, or production)')
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
  if (!databaseUrlIsValid) missing.push('DATABASE_URL (valid PostgreSQL connection URL)')
  if (!isStrongSecret(config.authSecret)) missing.push('AUTH_SECRET (32+ characters)')
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) missing.push('PORT (integer from 1 to 65535)')
  if (!Number.isInteger(config.otpExpiryMinutes) || config.otpExpiryMinutes < 5 || config.otpExpiryMinutes > 10) {
    missing.push('OTP_EXPIRY_MINUTES (integer from 5 to 10)')
  }
  if (!['africastalking', 'email', 'console'].includes(config.otpProvider)) {
    missing.push('OTP_PROVIDER (africastalking, email, or console)')
  } else {
    const otpProviderStatus = getOtpProviderConfigurationStatus()
    missing.push(...otpProviderStatus.missing)
  }

  if (isProduction) {
    if (config.mpesaMode !== 'daraja') {
      missing.push('MPESA_MODE=daraja and real Daraja credentials')
    }
    if (!isHttpUrl(config.clientUrl, true)) missing.push('CLIENT_URL (public HTTPS origin)')
    if (!isStrongSecret(config.adminDashboardKey)) missing.push('ADMIN_DASHBOARD_KEY (32+ characters)')
    if (!isConfiguredValue(config.mpesaConsumerKey) || !isConfiguredValue(config.mpesaConsumerSecret) || !isConfiguredValue(config.mpesaShortcode) || !isConfiguredValue(config.mpesaPasskey)) missing.push('Daraja credentials')
    if (!isPublicCallbackUrl(config.mpesaCallbackUrl)) missing.push('public HTTPS MPESA_CALLBACK_URL')
    if (!isStrongSecret(config.mpesaCallbackSecret)) missing.push('MPESA_CALLBACK_SECRET (32+ characters)')
  } else if (!isHttpUrl(config.clientUrl)) {
    missing.push('CLIENT_URL (HTTP(S) origin)')
  }

  if (missing.length) {
    throw new Error(`${isProduction ? 'Production' : 'Runtime'} configuration is incomplete: ${missing.join(', ')}`)
  }
}

export default config
