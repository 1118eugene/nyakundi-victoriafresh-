import jwt from 'jsonwebtoken'
import { findUserById } from '../models/User.js'
import { config } from '../config/index.js'

export const CUSTOMER_SESSION_COOKIE = 'vff_customer_session'

export function getCustomerSessionToken(req) {
  const prefix = `${CUSTOMER_SESSION_COOKIE}=`
  const cookie = (req.get('cookie') || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (cookie) return cookie.slice(prefix.length)
  const header = req.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export function hasCustomerSessionCookie(req) {
  const prefix = `${CUSTOMER_SESSION_COOKIE}=`
  return (req.get('cookie') || '').split(';').some((part) => part.trim().startsWith(prefix))
}

function hasValidSessionLifetime(payload) {
  const maxLifetimeSeconds = 7 * 24 * 60 * 60
  return Number.isInteger(payload.iat)
    && Number.isInteger(payload.exp)
    && payload.exp > payload.iat
    && payload.exp - payload.iat <= maxLifetimeSeconds
}

export function toSafeCustomerProfile(user) {
  return {
    id: user.id,
    customerName: user.customerName,
    email: user.email,
    phone: user.phone,
    county: user.county,
    town: user.town,
    addressLine: user.addressLine,
    landmark: user.landmark,
    preferredPayment: user.preferredPayment,
  }
}

export async function requireCustomer(req, res, next) {
  const token = getCustomerSessionToken(req)

  if (!token || !config.authSecret) {
    return res.status(401).json({ status: 'error', message: 'Verified customer login is required.' })
  }

  try {
    const payload = jwt.verify(token, config.authSecret)
    if (!hasValidSessionLifetime(payload)) {
      return res.status(401).json({ status: 'error', message: 'Customer session is invalid or expired.' })
    }
    const row = await findUserById(payload.sub)
    const user = row && {
      id: row.id,
      customerName: row.customer_name,
      email: row.email,
      phone: row.phone,
      county: row.county,
      town: row.town,
      addressLine: row.address_line,
      landmark: row.landmark,
      preferredPayment: row.preferred_payment,
      sessionVersion: row.session_version,
    }
    if (!user || payload.ver !== user.sessionVersion) {
      return res.status(401).json({ status: 'error', message: 'Customer session is no longer valid.' })
    }
    req.customer = user
    next()
  } catch {
    res.status(401).json({ status: 'error', message: 'Customer session is invalid or expired.' })
  }
}

export async function optionalCustomer(req, _res, next) {
  const token = getCustomerSessionToken(req)
  if (!token || !config.authSecret) return next()

  let payload
  try {
    payload = jwt.verify(token, config.authSecret)
  } catch {
    return next()
  }
  if (!hasValidSessionLifetime(payload)) return next()

  try {
    const row = await findUserById(payload.sub)
    if (row && payload.ver === row.session_version) {
      req.customer = {
        id: row.id,
        customerName: row.customer_name,
        email: row.email,
        phone: row.phone,
        county: row.county,
        town: row.town,
        addressLine: row.address_line,
        landmark: row.landmark,
        preferredPayment: row.preferred_payment,
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}
