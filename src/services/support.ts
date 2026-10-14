export function getWhatsAppSupportUrl(message: string) {
  const configuredNumber = import.meta.env.VITE_WHATSAPP_NUMBER || ''
  const digits = configuredNumber.replace(/\D/g, '')
  const number = digits.startsWith('0') ? `254${digits.slice(1)}` : digits

  if (!/^254[17]\d{8}$/.test(number)) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
