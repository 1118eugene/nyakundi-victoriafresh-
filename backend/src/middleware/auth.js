import jwt from 'jsonwebtoken'
import { findUserById } from '../models/User.js'
import { config } from '../config/index.js'

export function getBearerToken(req) {
  const header = req.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
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
  const token = getBearerToken(req)

  if (!token || !config.authSecret) {
    return res.status(401).json({ status: 'error', message: 'Verified customer login is required.' })
  }

  try {
    const payload = jwt.verify(token, config.authSecret)
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
      verifiedPhone: row.verified_phone,
    }
    if (!user || !user.verifiedPhone) {
      return res.status(401).json({ status: 'error', message: 'Customer session is no longer valid.' })
    }
    req.customer = user
    next()
  } catch {
    res.status(401).json({ status: 'error', message: 'Customer session is invalid or expired.' })
  }
}
