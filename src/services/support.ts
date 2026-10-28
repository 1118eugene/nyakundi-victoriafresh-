export const socialSupportLinks = [
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/victoriafreshfishke/',
    contactLabel: 'Message us on Instagram',
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@victoriafreshfishke',
    contactLabel: 'Visit our TikTok profile',
  },
] as const

const DEFAULT_SUPPORT_PHONE = '254117224696'
const DEFAULT_SUPPORT_EMAIL = 'info@victoriafreshfish.ke'

export function getWhatsAppSupportUrl(message: string) {
  const configuredNumber = import.meta.env.VITE_WHATSAPP_NUMBER
    || import.meta.env.VITE_SUPPORT_PHONE
    || DEFAULT_SUPPORT_PHONE
  const digits = configuredNumber.replace(/\D/g, '')
  const number = digits.startsWith('0') ? `254${digits.slice(1)}` : digits

  if (!/^254[17]\d{8}$/.test(number)) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function getSupportPhone() {
  const configuredPhone = (import.meta.env.VITE_SUPPORT_PHONE || DEFAULT_SUPPORT_PHONE).replace(/\D/g, '')
  const number = configuredPhone.startsWith('0') ? `254${configuredPhone.slice(1)}` : configuredPhone
  return /^254[17]\d{8}$/.test(number) ? `+${number}` : null
}

export function getSupportEmail() {
  const email = String(import.meta.env.VITE_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
