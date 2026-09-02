// Product photos are reused only where they match the listed preparation.
const speciesProfiles = [
  { name: 'Tilapia', basePrice: 700, image: '/images/products/pexels-tilapia.jpg' },
  { name: 'Nile Perch (Mbuta)', basePrice: 850, image: '/images/products/fresh-nile-perch.jpg' },
  { name: 'Catfish (Nduma)', basePrice: 850, image: '/images/products/fresh-pexels-c.jpg' },
  { name: 'Omena', basePrice: 500, image: '/images/products/fish fresh.jpg' },
]

const sectionProfiles = [
  { category: 'fresh-whole', preparation: 'Fresh whole fish', unit: 'kg', image: null, priceAdjustment: 0 },
  { category: 'fillet', preparation: 'Fresh fillet', unit: 'kg', image: '/images/products/pexels-fillet.jpg', priceAdjustment: 400 },
  { category: 'ready-to-eat', preparation: 'Ready to eat', unit: 'plate', image: '/images/products/pexels-grilled.jpg', priceAdjustment: 250 },
  { category: 'smoked', preparation: 'Smoked fish', unit: 'kg', image: '/images/products/pexels-smoked.jpg', priceAdjustment: 350 },
]

export const verifiedCatalog = speciesProfiles.flatMap((species) => (
  Array.from({ length: 15 }, (_, productIndex) => {
    const section = sectionProfiles[productIndex % sectionProfiles.length]
    const variant = String(productIndex + 1).padStart(2, '0')
    const image = section.image || species.image

    return {
      sku: `${species.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}-${section.category.toUpperCase()}-${variant}`,
      name: `${species.name} ${section.preparation} ${variant}`,
      description: `${species.name} prepared as ${section.preparation.toLowerCase()}, packed fresh for your order.`,
      price: species.basePrice + section.priceAdjustment + productIndex * 20,
      unit: section.unit,
      image,
      category: section.category,
      species: species.name,
      preparation: section.preparation,
      quantity: 15,
      inStock: true,
      featured: productIndex === 0,
    }
  })
))

export const categoryLabels = {
  'fresh-whole': 'Fresh Whole Fish',
  fillet: 'Fish Fillets',
  'ready-to-eat': 'Cooked & Ready to Eat',
  smoked: 'Smoked Fish',
}
