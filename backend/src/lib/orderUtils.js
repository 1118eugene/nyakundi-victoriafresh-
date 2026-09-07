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
