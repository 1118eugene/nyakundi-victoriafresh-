import { Buffer } from 'node:buffer'
import { config, getMpesaCallbackUrl, getMpesaConfigurationStatus } from '../config/index.js'
import { normalizePhone } from '../lib/paymentUtils.js'

function createTimestamp() {
  const now = new Date()
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function parseTransactionDate(value) {
  const digits = String(value || '')
  if (!/^\d{14}$/.test(digits)) return null

  return new Date(Date.UTC(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)) - 1,
    Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14)),
  ))
}

function assertMpesaConfig() {
  const readiness = getMpesaConfigurationStatus()
  if (!readiness.configured) {
    const missing = [...readiness.missing, ...(readiness.callbackReady ? [] : ['a public HTTPS MPESA_CALLBACK_URL'])]
    const error = new Error(`M-Pesa is not ready: configure ${missing.join(', ')}`)
    error.status = 503
    throw error
  }
}

export function isMpesaConfigured() {
  return getMpesaConfigurationStatus().configured
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
  if (config.mpesaMode === 'mock') {
    return {
      MerchantRequestID: `MOCK-MERCHANT-${orderNumber}`,
      CheckoutRequestID: `MOCK-CHECKOUT-${orderNumber}`,
      ResponseDescription: 'Development payment approved automatically.',
      CustomerMessage: 'Development payment approved automatically.',
      normalizedPhone: normalizePhone(phone),
      requestedAt: new Date(),
      mockReceiptNumber: `MOCK${Date.now()}`,
      mockAmount: Math.round(amount),
    }
  }

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
      CallBackURL: getMpesaCallbackUrl(),
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
    amount: values.Amount === undefined ? null : Number(values.Amount),
    paidAt: parseTransactionDate(values.TransactionDate),
    phone: values.PhoneNumber ? String(values.PhoneNumber) : '',
  }
}
