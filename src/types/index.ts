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
  rating?: { average: number; count: number }
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
  paymentMethod: 'cash_on_delivery' | 'mpesa_after_delivery'
  website: string
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
  paymentMethod: 'mpesa' | 'cash_on_delivery' | 'mpesa_after_delivery'
  paymentStatus: 'pending' | 'initiated' | 'paid' | 'failed'
  mpesa: {
    phone: string
    receiptNumber: string
    resultDescription: string
    paidAt: string | null
    paymentReviewRequired?: boolean
    paymentOutcomeUnknown?: boolean
    checkoutRequestID?: string
  }
  assignedDeliveryPerson: string | null
  assignedDeliveryName: string | null
  deliveryLocation: { latitude: number; longitude: number; updatedAt: string; expiresAt: string } | null
  timestamps: {
    confirmedAt: string | null
    preparingAt: string | null
    dispatchedAt: string | null
    deliveredAt: string | null
    cancelledAt: string | null
  }
  history: Array<{ type: string; actorRole: string; details: Record<string, string>; createdAt: string }>
  payments: Array<{ method: 'cash' | 'mpesa'; amount: number; status: string; receiptNumber: string | null; phone: string; paidAt: string | null; createdAt: string }>
  createdAt: string
}

export interface ApiResponse<T> {
  status: 'success' | 'error'
  message?: string
  data: T
}
