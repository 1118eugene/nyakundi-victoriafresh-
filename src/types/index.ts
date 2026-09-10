export interface Product {
  id: string
  sku: string
  name: string
  description: string
  price: number
  unit: string
  image: string
  category: string
  species: string
  preparation: string
  quantity: number
  inStock: boolean
  featured: boolean
  active?: boolean
  priceUpdatedAt?: string | null
}

export interface FishPreparation {
  type: string
  price: number
  product: Product
}

export interface CartItem extends Product {
  cartQuantity: number
}

export interface CheckoutFormValues {
  customerName: string
  email: string
  phone: string
  paymentPhone: string
  county: string
  town: string
  addressLine: string
  landmark: string
  notes: string
}

export interface OrderItem {
  productId: string
  sku: string
  name: string
  unit: string
  price: number
  quantity: number
  lineTotal: number
  image: string
}

export interface Order {
  id: string
  orderNumber: string
  customer: {
    name: string
    email: string
    phone: string
  }
  delivery: {
    county: string
    town: string
    addressLine: string
    landmark: string
    notes: string
  }
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  totalPrice: number
  status: 'awaiting_payment' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'
  paymentMethod: 'mpesa'
  paymentStatus: 'pending' | 'initiated' | 'paid' | 'failed'
  mpesa: {
    phone: string
    receiptNumber: string
    resultDescription: string
    paidAt: string | null
  }
  createdAt: string
}

export interface ApiResponse<T> {
  status: 'success' | 'error'
  message?: string
  data: T
}
