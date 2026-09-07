import { CartItem, CheckoutFormValues, Order, Product } from '../types'

// A dedicated development backend avoids stale local Node processes while the
// production build continues to use the same-origin /api endpoint.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')

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
    const error = new Error(data.message || 'Request failed')
    ;(error as any).responseData = data
    throw error
  }

  return data as T
}

export async function fetchProducts(category = 'all') {
  const parameters = new URLSearchParams({ limit: '100' })
  if (category !== 'all') parameters.set('category', category)
  const query = `?${parameters.toString()}`
  return request<{ data: Product[]; filters?: { categories: Record<string, string> } }>(`/products${query}`)
}

export async function fetchFeaturedProducts() {
  return request<{ data: Product[] }>(`/products?featured=true&limit=4`)
}

export async function createCheckoutOrder(payload: CheckoutFormValues, items: CartItem[]) {
  return request<{ data: Order; payment: { configured: boolean; status: string; trackingToken?: string; customerMessage?: string } }>(`/orders/checkout`, {
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

export async function fetchOrder(id: string, trackingToken: string) {
  return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(trackingToken)}`)
}

export async function fetchOrders(adminKey?: string) {
  return request<{ data: Order[] }>('/orders', {
    headers: adminKey ? { 'x-admin-key': adminKey } : {},
  })
}

export async function updateOrderStatus(id: string, status: Order['status'], adminKey: string) {
  return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'x-admin-key': adminKey },
    body: JSON.stringify({ status }),
  })
}
