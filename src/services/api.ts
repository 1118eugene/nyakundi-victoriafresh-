import { CartItem, CheckoutFormValues, Order, Product } from '../types'

const configuredApiUrl = import.meta.env.VITE_API_URL
const API_BASE_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://nyakundi-victoriafresh-2.onrender.com/api')).replace(/\/+$/, '')

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem('victoria-customer-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    } catch {
      throw new Error('We could not connect to the Victoria Fresh Fish service. Please confirm the backend is running and try again shortly.')
    }
  }
  let data: { status?: string; message?: string; [key: string]: unknown }
  try { data = await response.json() } catch { throw new Error('The service returned an unexpected response. Please try again shortly.') }
  if (!response.ok || data.status === 'error') {
    if (response.status === 401 && (path.startsWith('/orders/') || path === '/auth/me')) window.dispatchEvent(new Event('victoria-session-invalidated'))
    const error = new Error(data.message || 'Request failed')
    ;(error as Error & { responseData?: unknown }).responseData = data
    throw error
  }
  return data as T
}

export function fetchCurrentCustomer() {
  return request<{ data: { user: { id: string; customerName: string; email: string; phone: string; county: string; town: string; addressLine: string; landmark: string } } }>('/auth/me')
}
export function signupCustomer(payload: Record<string, string>) { return request<{ message?: string; data: { user: Record<string, string>; otp: { expiresAt: string; delivered: boolean; provider: string } } }>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }) }
export function sendOtp(payload: { phone?: string; email?: string }) { return request<{ message?: string; data: { phone: string; delivered: boolean; provider: string; expiresAt: string } }>('/auth/send-otp', { method: 'POST', body: JSON.stringify(payload) }) }
export function requestLoginOtp(payload: { phone?: string; email?: string }) { return request<{ message?: string; data: { userId: string; phone: string; delivered: boolean; provider: string } }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }) }
export function verifyOtp(payload: { phone: string; code: string }) { return request<{ message?: string; data: { token: string; user: Record<string, string> } }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify(payload) }) }
export function fetchProducts(category = 'all') { const params = new URLSearchParams({ limit: '100' }); if (category !== 'all') params.set('category', category); return request<{ data: Product[]; filters?: { categories: Record<string, string> } }>(`/products?${params}`) }
export function fetchFeaturedProducts() { return request<{ data: Product[] }>('/products?featured=true&limit=4') }
export function createCheckoutOrder(payload: CheckoutFormValues, items: CartItem[]) { return request<{ data: Order; payment: { configured: boolean; status: string; trackingToken?: string; customerMessage?: string } }>('/orders/checkout', { method: 'POST', body: JSON.stringify({ ...payload, items: items.map(item => ({ productId: item.id, quantity: item.cartQuantity })) }) }) }
export function fetchOrder(id: string, trackingToken: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}`, { headers: { 'x-order-token': trackingToken } }) }
export function fetchMyOrders(limit = 20) { return request<{ data: Order[]; pagination: { limit: number; returned: number } }>(`/orders/mine?limit=${Math.min(Math.max(limit, 1), 100)}`) }
export function fetchOrders(adminKey?: string, skip = 0, limit = 20) { const query = new URLSearchParams({ skip: String(skip), limit: String(limit) }); return request<{ data: Order[]; pagination: { total: number; skip: number; limit: number; returned: number } }>(`/orders?${query}`, { headers: adminKey ? { 'x-admin-key': adminKey } : {} }) }
export function updateOrderStatus(id: string, status: Order['status'], adminKey: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ status }) }) }
