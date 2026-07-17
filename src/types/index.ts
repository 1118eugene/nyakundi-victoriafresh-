export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: 'tilapia' | 'samaki' | 'nduma' | 'omena' | 'other'
  inStock: boolean
  quantity?: number
}

export interface CartItem extends Product {
  cartQuantity: number
}

export interface Order {
  id: string
  customerName: string
  email: string
  phone: string
  items: CartItem[]
  totalPrice: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered'
  createdAt: Date
}

export interface ContactForm {
  name: string
  email: string
  phone: string
  message: string
}
