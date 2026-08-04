import { Buffer } from 'node:buffer'
import { config } from '../config/index.js'

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('254')) {
    return digits
  }

  if (digits.startsWith('0')) {
    return `254${digits.slice(1)}`
  }

  if (digits.length === 9) {
    return `254${digits}`
  }

  return digits
}

function createTimestamp() {
  const now = new Date()
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function assertMpesaConfig() {
  const required = [
    'mpesaConsumerKey',
    'mpesaConsumerSecret',
    'mpesaShortcode',
    'mpesaPasskey',
    'mpesaCallbackUrl',
  ]

  const missing = required.filter((key) => !config[key])
  if (missing.length > 0) {
    const error = new Error(`Missing M-Pesa configuration: ${missing.join(', ')}`)
    error.status = 503
    throw error
  }
}

export function isMpesaConfigured() {
  return Boolean(
    config.mpesaConsumerKey &&
      config.mpesaConsumerSecret &&
      config.mpesaShortcode &&
      config.mpesaPasskey &&
      config.mpesaCallbackUrl,
  )
}

async function getAccessToken() {
  assertMpesaConfig()

  const auth = Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')
  const response = await fetch(`${config.mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to get M-Pesa token: ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function initiateStkPush({ phone, amount, orderNumber, description }) {
  const accessToken = await getAccessToken()
  const timestamp = createTimestamp()
  const normalizedPhone = normalizePhone(phone)
  const password = Buffer.from(`${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`).toString('base64')

  const response = await fetch(`${config.mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.mpesaTransactionType,
      Amount: Math.round(amount),
      PartyA: normalizedPhone,
      PartyB: config.mpesaShortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: config.mpesaCallbackUrl,
      AccountReference: orderNumber,
      TransactionDesc: description,
    }),
  })

  const data = await response.json()
  if (!response.ok || data.errorCode) {
    const message = data.errorMessage || data.ResponseDescription || 'Unable to start M-Pesa payment'
    const error = new Error(message)
    error.status = 502
    throw error
  }

  return {
    ...data,
    normalizedPhone,
    requestedAt: new Date(),
  }
}

export function extractMpesaReceipt(callbackMetadata = []) {
  const values = Object.fromEntries(
    callbackMetadata
      .filter((entry) => entry?.Name)
      .map((entry) => [entry.Name, entry.Value]),
  )

  return {
    receiptNumber: values.MpesaReceiptNumber || '',
    paidAt: values.TransactionDate ? new Date(String(values.TransactionDate)) : null,
    phone: values.PhoneNumber ? String(values.PhoneNumber) : '',
  }
}
