import type { CartItem, Product } from '../types'

export const MAX_CART_QUANTITY = 100
export const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type CartAvailability = 'unknown' | 'available' | 'unavailable'

export interface StoredCartItem extends CartItem {
  availabilityStatus?: CartAvailability
  previousPrice?: number | null
}

export interface CartReadResult {
  items: StoredCartItem[]
  expired: boolean
  invalid: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeItems(value: unknown): { items: StoredCartItem[]; invalid: boolean } {
  if (!Array.isArray(value)) return { items: [], invalid: true }
  const items: StoredCartItem[] = []
  const seen = new Set<string>()
  let invalid = false

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id || seen.has(entry.id)) {
      invalid = true
      continue
    }
    const price = Number(entry.price)
    const quantity = Number(entry.quantity)
    const cartQuantity = Number(entry.cartQuantity)
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(cartQuantity) || cartQuantity < 1) {
      invalid = true
      continue
    }

    if (cartQuantity > MAX_CART_QUANTITY) invalid = true
    seen.add(entry.id)
    items.push({
      ...(entry as unknown as CartItem),
      price,
      quantity,
      cartQuantity: Math.min(cartQuantity, MAX_CART_QUANTITY),
      availabilityStatus: entry.availabilityStatus === 'available' || entry.availabilityStatus === 'unavailable' ? entry.availabilityStatus : 'unknown',
      previousPrice: typeof entry.previousPrice === 'number' && Number.isFinite(entry.previousPrice) && entry.previousPrice >= 0 ? entry.previousPrice : null,
    })
  }

  return { items, invalid }
}

export function readCart(raw: string | null, now = Date.now()): CartReadResult {
  if (!raw) return { items: [], expired: false, invalid: false }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const result = sanitizeItems(parsed)
      return { ...result, expired: false }
    }
    if (!isRecord(parsed) || parsed.version !== 2 || typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)) {
      return { items: [], expired: false, invalid: true }
    }
    const savedAt = Number(parsed.savedAt)
    const expired = savedAt > now + 5 * 60 * 1000 || now - savedAt > CART_TTL_MS
    if (expired) return { items: [], expired: true, invalid: false }
    const result = sanitizeItems(parsed.items)
    return { ...result, expired: false }
  } catch {
    return { items: [], expired: false, invalid: true }
  }
}

export function validateCartQuantity(quantity: number, availableQuantity?: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Choose a whole-number quantity of at least 1.'
  if (quantity > MAX_CART_QUANTITY) return `You can order up to ${MAX_CART_QUANTITY} units of one product.`
  if (availableQuantity !== undefined && availableQuantity > 0 && quantity > availableQuantity) {
    return `Only ${availableQuantity} unit${availableQuantity === 1 ? '' : 's'} are currently available.`
  }
  return null
}

export function addCartProduct(items: StoredCartItem[], product: Product, quantity = 1) {
  const validationError = validateCartQuantity(quantity, product.quantity)
  if (validationError) return { items, error: validationError }
  if (product.active === false || !product.inStock || product.quantity < 1) {
    return { items, error: 'This product is no longer available. Refresh the catalogue and try again.' }
  }
  const existing = items.find((item) => item.id === product.id)
  if (existing?.availabilityStatus === 'unavailable') return { items, error: 'This product is no longer available. Refresh the catalogue and try again.' }
  const nextQuantity = (existing?.cartQuantity || 0) + quantity
  const quantityError = validateCartQuantity(nextQuantity, product.quantity)
  if (quantityError) return { items, error: quantityError }
  const previousPrice = existing?.price !== undefined && existing.price !== product.price
    ? existing.previousPrice ?? existing.price
    : existing?.previousPrice ?? null
  const updated: StoredCartItem = { ...product, cartQuantity: nextQuantity, availabilityStatus: 'available', previousPrice }
  return {
    items: existing ? items.map((item) => item.id === product.id ? updated : item) : [...items, updated],
    error: null,
  }
}

export function updateCartProductQuantity(items: StoredCartItem[], productId: string, quantity: number) {
  const current = items.find((item) => item.id === productId)
  if (!current) return { items, error: 'That product is no longer in your cart.' }
  const validationError = validateCartQuantity(quantity, current.availabilityStatus === 'unavailable' ? undefined : current.quantity)
  if (validationError) return { items, error: validationError }
  return { items: items.map((item) => item.id === productId ? { ...item, cartQuantity: quantity } : item), error: null }
}