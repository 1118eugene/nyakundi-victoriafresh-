export const INVENTORY_RESERVATION_MS = 15 * 60 * 1000

export function getInventoryExpiry(now = Date.now()) {
  return new Date(now + INVENTORY_RESERVATION_MS)
}

export function isInventoryExpired(expiresAt, now = Date.now()) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= now)
}
