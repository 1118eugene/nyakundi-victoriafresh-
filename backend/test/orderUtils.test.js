import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateShippingFee } from '../src/lib/orderUtils.js'

test('calculates the lowest delivery fee for western counties', () => {
  assert.equal(calculateShippingFee(' Kisumu '), 250)
  assert.equal(calculateShippingFee('Kisii'), 250)
})

test('calculates the standard delivery fee for major cities', () => {
  assert.equal(calculateShippingFee('Nairobi'), 450)
  assert.equal(calculateShippingFee('Mombasa'), 450)
})

test('uses the nationwide fallback delivery fee', () => {
  assert.equal(calculateShippingFee('Turkana'), 650)
})
