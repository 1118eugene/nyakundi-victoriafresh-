import { CartItem, CheckoutFormValues, Order, Product } from '../types'

// A dedicated development backend avoids stale local Node processes while the
// production build continues to use the same-origin /api endpoint.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')

async function request<T>(path: string, init?: RequestInit) {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
    })
  } catch {
    throw new Error('We could not connect to the Victoria Fresh Fish service. Please try again shortly.')
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    throw new Error('The service returned an unexpected response. Please try again shortly.')
  }

  if (!response.ok || data.status === 'error') {
    const error = new Error(data.message || 'Request failed')
    ;(error as any).responseData = data
    throw error
  }

  return data as T
}

export async function signupCustomer(payload: Record<string, string>) {
  return request<{ message?: string; data: { user: { id: string; customerName: string; phone: string; email: string }; otp: { expiresAt: string; delivered: boolean; provider: string } } }>(`/auth/signup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendOtp(payload: { phone: string; email?: string }) {
  return request<{ message?: string; data: { phone: string; delivered: boolean; provider: string; expiresAt: string } }>(`/auth/send-otp`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function verifyOtp(payload: { phone: string; code: string }) {
  return request<{ message?: string; data: { token: string; user: Record<string, string> } }>(`/auth/verify-otp`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
  return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}`, {
    headers: { 'x-order-token': trackingToken },
  })
}

export async function fetchOrders(adminKey?: string, skip = 0, limit = 20) {
  const query = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  return request<{ data: Order[]; pagination: { total: number; skip: number; limit: number; returned: number } }>(`/orders?${query.toString()}`, {
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
