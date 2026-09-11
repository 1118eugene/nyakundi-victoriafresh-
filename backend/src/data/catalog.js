// Keep the fish catalogue within five canonical product images.
const speciesProfiles = [
  { name: 'Tilapia', basePrice: 650, image: '/images/products/pexels-tilapia.jpg', preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fillet', 'fillet', 150, 'kg'], ['Steak', 'steak', 125, 'kg'], ['Head', 'heads', -250, 'kg'], ['Frame', 'frames', -300, 'kg'], ['Smoked', 'smoked', 150, 'kg']] },
  { name: 'Nile Perch (Mbuta)', basePrice: 850, image: '/images/products/fresh-nile-perch.jpg', preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fillet', 'fillet', 150, 'kg'], ['Steak', 'steak', 125, 'kg'], ['Head', 'heads', -300, 'kg'], ['Frame', 'frames', -350, 'kg'], ['Smoked', 'smoked', 150, 'kg']] },
  { name: 'Catfish (Nduma)', basePrice: 750, image: '/images/products/fresh-pexels-c.jpg', preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fillet', 'fillet', 125, 'kg'], ['Steak', 'steak', 100, 'kg'], ['Head', 'heads', -250, 'kg'], ['Frame', 'frames', -300, 'kg'], ['Smoked', 'smoked', 150, 'kg']] },
  { name: 'Omena', basePrice: 500, image: '/images/products/fish fresh.jpg', preparations: [['Fresh', 'fresh-whole', 0, '500g pack'], ['Dried', 'dried', 100, '500g pack'], ['Packet', 'omena-packets', 75, '500g pack'], ['Fried', 'ready-to-eat', 50, '500g pack']] },
]

export const verifiedCatalog = speciesProfiles.flatMap((species) => (
  Array.from({ length: 15 }, (_, productIndex) => {
    const [preparation, category, priceAdjustment, unit] = species.preparations[productIndex % species.preparations.length]
    const variant = String(productIndex + 1).padStart(2, '0')
    const image = category === 'fillet' || category === 'steak' ? '/images/products/pexels-fillet.jpg' : species.image

    return {
      sku: `${species.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}-${category.toUpperCase()}-${preparation.toUpperCase()}-${variant}`,
      name: `${species.name} ${preparation} ${variant}`,
      description: `${species.name} prepared ${preparation.toLowerCase()} and packed carefully for your order.`,
      price: species.basePrice + priceAdjustment,
      unit,
      image,
      category,
      species: species.name,
      preparation,
      quantity: 15,
      active: true,
      inStock: true,
      priceUpdatedAt: new Date().toISOString(),
      featured: productIndex === 0,
    }
  })
))

export const categoryLabels = {
  'fresh-whole': 'Fresh Whole Fish',
  fillet: 'Fish Fillets',
  'ready-to-eat': 'Cooked & Ready to Eat',
  smoked: 'Smoked Fish',
  heads: 'Fish Heads',
  frames: 'Fish Frames',
  steak: 'Fish Steaks',
  dried: 'Dried Omena',
  'omena-packets': 'Omena Packets',
}
