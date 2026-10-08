import { createHash } from 'node:crypto'

export function calculateShippingFee(county) {
  const normalized = county.trim().toLowerCase()

  if (['kisumu', 'siaya', 'homa bay', 'migori', 'kisii'].includes(normalized)) {
    return 250
  }

  if (['nairobi', 'nakuru', 'uasin gishu', 'mombasa'].includes(normalized)) {
    return 450
  }

  return 650
}

export function createCheckoutFingerprint({ customerId, paymentPhone, county, town, addressLine, landmark = '', notes = '', items }) {
  const normalizedItems = [...items]
    .map(({ productId, quantity, expectedPrice }) => ({ productId, quantity, expectedPrice: Number(expectedPrice).toFixed(2) }))
    .sort((first, second) => first.productId.localeCompare(second.productId))
  const payload = {
    customerId,
    paymentPhone,
    county: county.trim(),
    town: town.trim(),
    addressLine: addressLine.trim(),
    landmark: landmark.trim(),
    notes: notes.trim(),
    items: normalizedItems,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
