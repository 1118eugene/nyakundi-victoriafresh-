import test from 'node:test'
import assert from 'node:assert/strict'
import { createCheckoutFingerprint } from '../src/lib/orderUtils.js'
import { calculateShippingFee } from '../src/lib/deliveryZones.js'
import { isInventoryExpired } from '../src/lib/inventoryUtils.js'
import { normalizePhone, validateSuccessfulPayment } from '../src/lib/paymentUtils.js'

test('uses only the fee from an explicitly configured delivery zone', () => {
  assert.equal(calculateShippingFee({ fee: '275.00' }), 275)
  assert.equal(calculateShippingFee({ fee: 0 }), 0)
  assert.equal(calculateShippingFee(null), null)
})

test('checkout fingerprints are stable for item order but change with checkout details', () => {
  const base = {
    customerId: 'customer-1',
    paymentPhone: '254712345678',
    county: ' Kisumu ',
    town: 'Kisumu',
    addressLine: 'Market Street',
    items: [
      { productId: 'fish-2', quantity: 1, expectedPrice: 1200 },
      { productId: 'fish-1', quantity: 2, expectedPrice: 500 },
    ],
  }
  const fingerprint = createCheckoutFingerprint(base)
  assert.equal(createCheckoutFingerprint({ ...base, items: [...base.items].reverse() }), fingerprint)
  assert.notEqual(createCheckoutFingerprint({ ...base, items: [{ ...base.items[0], quantity: 2 }, base.items[1]] }), fingerprint)
  assert.notEqual(createCheckoutFingerprint({ ...base, addressLine: 'Another Street' }), fingerprint)
  assert.notEqual(createCheckoutFingerprint({ ...base, customerId: 'customer-2' }), fingerprint)
})

test('normalizes Kenyan phone numbers before payment comparison', () => {
  assert.equal(normalizePhone('0712 345 678'), '254712345678')
  assert.equal(normalizePhone('+254712345678'), '254712345678')
})

test('accepts only a matching M-Pesa receipt, amount, and phone', () => {
  const receipt = { receiptNumber: 'QAB123', amount: 1500, phone: '0712345678' }
  assert.equal(validateSuccessfulPayment({ receipt, expectedAmount: 1500, expectedPhone: '254712345678' }), true)
  assert.equal(validateSuccessfulPayment({ receipt: { ...receipt, amount: 1400 }, expectedAmount: 1500, expectedPhone: '0712345678' }), false)
  assert.equal(validateSuccessfulPayment({ receipt: { ...receipt, receiptNumber: '' }, expectedAmount: 1500, expectedPhone: '0712345678' }), false)
})

test('expires inventory at the reservation boundary', () => {
  const expiry = new Date('2026-09-07T10:15:00.000Z')
  assert.equal(isInventoryExpired(expiry, Date.parse('2026-09-07T10:14:59.999Z')), false)
  assert.equal(isInventoryExpired(expiry, Date.parse('2026-09-07T10:15:00.000Z')), true)
})
