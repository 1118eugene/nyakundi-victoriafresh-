import test from 'node:test'
import assert from 'node:assert/strict'
import { addCartProduct, CART_TTL_MS, MAX_CART_QUANTITY, readCart, updateCartProductQuantity, validateCartQuantity } from './cartUtils.ts'

const item = { id: 'fish-1', name: 'Tilapia', price: 500, quantity: 8, cartQuantity: 2 }

test('restores the previous array format without losing a valid cart', () => {
  const result = readCart(JSON.stringify([item]))
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].cartQuantity, 2)
  assert.equal(result.items[0].availabilityStatus, 'unknown')
  assert.equal(result.items[0].previousPrice, null)
})

test('discards expired carts and malformed stored data', () => {
  const now = 2_000_000_000_000
  const expired = readCart(JSON.stringify({ version: 2, savedAt: now - CART_TTL_MS - 1, items: [item] }), now)
  assert.equal(expired.expired, true)
  assert.deepEqual(expired.items, [])
  assert.equal(readCart('{broken').invalid, true)
})

test('filters invalid entries and caps corrupted quantities', () => {
  const result = readCart(JSON.stringify([item, { ...item, id: 'invalid', price: -1 }, { ...item, id: 'large', cartQuantity: MAX_CART_QUANTITY + 20 }]))
  assert.equal(result.items.length, 2)
  assert.equal(result.invalid, true)
  assert.equal(result.items[1].cartQuantity, MAX_CART_QUANTITY)
})

test('validates whole numbers, order limits, and current stock', () => {
  assert.match(validateCartQuantity(0) || '', /at least 1/)
  assert.match(validateCartQuantity(1.5) || '', /whole-number/)
  assert.match(validateCartQuantity(MAX_CART_QUANTITY + 1) || '', /up to/)
  assert.match(validateCartQuantity(4, 3) || '', /Only 3 units/)
  assert.equal(validateCartQuantity(3, 3), null)
})

test('adds products atomically and leaves the cart unchanged when stock is insufficient', () => {
  const product = { id: 'fish-1', name: 'Tilapia', price: 500, quantity: 3, inStock: true, active: true }
  const first = addCartProduct([], product, 2)
  assert.equal(first.error, null)
  assert.equal(first.items[0].cartQuantity, 2)
  const rejected = addCartProduct(first.items, product, 2)
  assert.match(rejected.error || '', /Only 3 units/)
  assert.equal(rejected.items[0].cartQuantity, 2)
  assert.match(addCartProduct([], { ...product, active: false }).error || '', /no longer available/)
})

test('flags a changed price when adding more of an existing cart product', () => {
  const product = { id: item.id, name: item.name, price: 550, quantity: 8, inStock: true, active: true }
  const result = addCartProduct([{ ...item, availabilityStatus: 'available', previousPrice: null }], product)
  assert.equal(result.items[0].price, 550)
  assert.equal(result.items[0].previousPrice, 500)
})

test('quantity updates reject malformed values without mutating the cart', () => {
  const stored = [{ ...item, availabilityStatus: 'available' }]
  const rejected = updateCartProductQuantity(stored, item.id, 1.25)
  assert.match(rejected.error || '', /whole-number/)
  assert.equal(rejected.items[0].cartQuantity, 2)
  const updated = updateCartProductQuantity(stored, item.id, 3)
  assert.equal(updated.error, null)
  assert.equal(updated.items[0].cartQuantity, 3)
})