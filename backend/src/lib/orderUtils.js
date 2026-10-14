import { createHash } from 'node:crypto'

export function createCheckoutFingerprint({ customerId = null, customerName = '', phone = '', paymentPhone = '', paymentMethod = '', county, town, addressLine, landmark = '', notes = '', items }) {
  const normalizedItems = [...items]
    .map(({ productId, quantity, expectedPrice }) => ({ productId, quantity, expectedPrice: Number(expectedPrice).toFixed(2) }))
    .sort((first, second) => first.productId.localeCompare(second.productId))
  const payload = {
    customerId,
    customerName: customerName.trim(),
    phone,
    paymentPhone,
    paymentMethod,
    county: county.trim(),
    town: town.trim(),
    addressLine: addressLine.trim(),
    landmark: landmark.trim(),
    notes: notes.trim(),
    items: normalizedItems,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
