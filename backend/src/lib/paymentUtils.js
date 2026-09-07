export function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')

  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  return digits
}

export function validateSuccessfulPayment({ receipt, expectedAmount, expectedPhone }) {
  return Boolean(
    receipt?.receiptNumber
    && receipt.amount === expectedAmount
    && normalizePhone(receipt.phone) === normalizePhone(expectedPhone),
  )
}
