import { Product } from '../types'

// Fresh whole fish from the lake
export const freshWholeFish: Product[] = [
  {
    id: 'fw-1',
    name: 'Fresh Whole Tilapia',
    description: 'Premium fresh tilapia fish on ice, straight from Lake Victoria. Ready to cook.',
    price: 850,
    image: '/images/products/fw-1.jpg',
    category: 'tilapia',
    inStock: true,
  },
  {
    id: 'fw-2',
    name: 'Fresh Whole Nile Perch (Mbuta)',
    description: 'Large, fresh Nile perch with tender white flesh. Perfect for family meals.',
    price: 1500,
    image: '/images/products/fw-2.jpg',
    category: 'samaki',
    inStock: true,
  },
  {
    id: 'fw-3',
    name: 'Fresh Whole Catfish (Nduma)',
    description: 'Fresh catfish on ice, rich flavor perfect for soups and traditional dishes.',
    price: 950,
    image: '/images/products/fw-3.jpg',
    category: 'nduma',
    inStock: true,
  },
  {
    id: 'fw-4',
    name: 'Fresh Whole Omena (Sardines)',
    description: 'Fresh small fish packed with nutrition. Perfect for everyday meals.',
    price: 450,
    image: '/images/products/fw-4.jpg',
    category: 'omena',
    inStock: true,
  },
]

// Fish fillets - processed but fresh
export const fishFillets: Product[] = [
  {
    id: 'ff-1',
    name: 'Tilapia Fillets (1kg)',
    description: 'Boneless, skinless tilapia fillets. Ready to cook. Fresh and tender.',
    price: 1200,
    image: '/images/products/ff-1.jpg',
    category: 'tilapia',
    inStock: true,
  },
  {
    id: 'ff-2',
    name: 'Nile Perch Fillets (1kg)',
    description: 'Premium perch fillets with delicate white flesh. Perfect for frying.',
    price: 1800,
    image: '/images/products/ff-2.jpg',
    category: 'samaki',
    inStock: true,
  },
  {
    id: 'ff-3',
    name: 'Catfish Fillets (1kg)',
    description: 'Fresh catfish fillets, perfect for grilling or pan-frying.',
    price: 1400,
    image: '/images/products/ff-3.jpg',
    category: 'nduma',
    inStock: true,
  },
]

// Smoked fish - traditional preparation
export const smokedFish: Product[] = [
  {
    id: 'sf-1',
    name: 'Smoked Whole Tilapia',
    description: 'Traditionally smoked fresh tilapia. Ready to eat or reheat. Rich, smoky flavor.',
    price: 1100,
    image: '/images/products/sf-1.jpg',
    category: 'tilapia',
    inStock: true,
  },
  {
    id: 'sf-2',
    name: 'Smoked Catfish (Nduma)',
    description: 'Slow-smoked catfish with authentic traditional flavor.',
    price: 1300,
    image: '/images/products/sf-2.jpg',
    category: 'nduma',
    inStock: true,
  },
  {
    id: 'sf-3',
    name: 'Smoked Omena Pack',
    description: 'Smoked sardines - traditional delicacy rich in flavor and nutrition.',
    price: 650,
    image: '/images/products/sf-3.jpg',
    category: 'omena',
    inStock: true,
  },
]

// Fried fish - ready to eat
export const friedFish: Product[] = [
  {
    id: 'frd-1',
    name: 'Fried Tilapia (Ready to Eat)',
    description: 'Crispy fried tilapia, golden brown and delicious. Perfect for lunch or dinner.',
    price: 950,
    image: '/images/products/frd-1.jpg',
    category: 'tilapia',
    inStock: true,
  },
  {
    id: 'frd-2',
    name: 'Fried Perch Fillets (Ready to Eat)',
    description: 'Crispy fried perch fillets with tender white meat inside.',
    price: 1300,
    image: '/images/products/frd-2.jpg',
    category: 'samaki',
    inStock: true,
  },
  {
    id: 'frd-3',
    name: 'Fried Catfish (Ready to Eat)',
    description: 'Crispy exterior, tender inside. A favorite ready-to-eat option.',
    price: 1100,
    image: '/images/products/frd-3.jpg',
    category: 'nduma',
    inStock: true,
  },
  {
    id: 'frd-4',
    name: 'Fried Omena (Ready to Eat)',
    description: 'Crispy fried sardines. Perfect as a snack or side dish.',
    price: 550,
    image: '/images/products/frd-4.jpg',
    category: 'omena',
    inStock: true,
  },
]

// Cooked fish - fully prepared
export const cookedFish: Product[] = [
  {
    id: 'ck-1',
    name: 'Whole Cooked Tilapia',
    description: 'Perfectly seasoned and cooked tilapia. Just heat and eat.',
    price: 1050,
    image: '/images/products/ck-1.jpg',
    category: 'tilapia',
    inStock: true,
  },
  {
    id: 'ck-2',
    name: 'Cooked Perch Fillets with Sauce',
    description: 'Tender perch fillets in savory sauce. Ready to serve.',
    price: 1400,
    image: '/images/products/ck-2.jpg',
    category: 'samaki',
    inStock: true,
  },
  {
    id: 'ck-3',
    name: 'Cooked Catfish Stew',
    description: 'Traditional catfish stew with authentic seasoning. Comfort food at its best.',
    price: 1200,
    image: '/images/products/ck-3.jpg',
    category: 'nduma',
    inStock: true,
  },
]

// Specialty products
export const specialtyProducts: Product[] = [
  {
    id: 'sp-1',
    name: 'Mixed Fresh Fish Pack (3kg)',
    description: 'Assorted selection of fresh tilapia, perch, and catfish. Great variety for families.',
    price: 3500,
    image: '/images/products/sp-1.jpg',
    category: 'other',
    inStock: true,
  },
  {
    id: 'sp-2',
    name: 'Premium Whole Fish on Ice (5kg)',
    description: 'Fresh whole fish on crushed ice. Perfect for restaurants and bulk orders.',
    price: 5200,
    image: '/images/products/sp-2.jpg',
    category: 'other',
    inStock: true,
  },
  {
    id: 'sp-3',
    name: 'Fish Processing Package',
    description: 'Bring your catch or order fresh fish for custom processing and packaging.',
    price: 0,
    image: '/images/products/sp-3.jpg',
    category: 'other',
    inStock: true,
  },
]

// All products combined
export const allProducts = [
  ...freshWholeFish,
  ...fishFillets,
  ...smokedFish,
  ...friedFish,
  ...cookedFish,
  ...specialtyProducts,
]

// Product categories metadata
export const productCategories = [
  { id: 'fresh', label: 'Fresh Whole Fish', products: freshWholeFish },
  { id: 'fillets', label: 'Fish Fillets', products: fishFillets },
  { id: 'smoked', label: 'Smoked Fish', products: smokedFish },
  { id: 'fried', label: 'Fried Fish (Ready to Eat)', products: friedFish },
  { id: 'cooked', label: 'Cooked Fish', products: cookedFish },
  { id: 'specialty', label: 'Specialty & Bulk', products: specialtyProducts },
]
