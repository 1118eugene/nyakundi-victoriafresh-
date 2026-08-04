import { CartItem, CheckoutFormValues, Order, Product } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const data = await response.json()

  if (!response.ok || data.status === 'error') {
    throw new Error(data.message || 'Request failed')
  }

  return data as T
}

export async function fetchProducts(category = 'all') {
  const query = category === 'all' ? '' : `?category=${encodeURIComponent(category)}`
  return request<{ data: Product[]; filters?: { categories: Record<string, string> } }>(`/products${query}`)
}

export async function fetchFeaturedProducts() {
  return request<{ data: Product[] }>(`/products?featured=true&limit=4`)
}

export async function createCheckoutOrder(payload: CheckoutFormValues, items: CartItem[]) {
  return request<{ data: Order; payment: { configured: boolean; status: string; customerMessage?: string } }>(`/orders/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.cartQuantity,
      })),
    }),
  })
}

export async function fetchOrders(adminKey?: string) {
  const query = adminKey ? `?key=${encodeURIComponent(adminKey)}` : ''
  return request<{ data: Order[] }>(`/orders${query}`)
}
