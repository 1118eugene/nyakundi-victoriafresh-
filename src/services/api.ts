import { CartItem, CheckoutFormValues, Order, Product } from '../types'

const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''
const API_BASE_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')).replace(/\/+$/, '')
const safeGetRetryDelays = [500, 1000]

const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem('victoria-customer-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const isSafeGet = (init?.method || 'GET').toUpperCase() === 'GET'
  const maxAttempts = isSafeGet ? safeGetRetryDelays.length + 1 : 1
  let response: Response | undefined
  let responseText = ''

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
      responseText = await response.text()
    } catch {
      if (isSafeGet && attempt < safeGetRetryDelays.length) {
        await wait(safeGetRetryDelays[attempt])
        continue
      }
      throw new Error('We could not connect to the Victoria Fresh Fish service. Please try again shortly.')
    }

    const retryableStatus = response.status === 408 || response.status === 425
      || response.status === 429 || response.status >= 500
    if (isSafeGet && retryableStatus && attempt < safeGetRetryDelays.length) {
      await wait(safeGetRetryDelays[attempt])
      continue
    }
    break
  }
  if (!response) throw new Error('We could not connect to the Victoria Fresh Fish service. Please try again shortly.')

  let data: { status?: string; message?: string; [key: string]: unknown }
  try {
    data = responseText ? JSON.parse(responseText) : {}
  } catch {
    const detail = responseText.trim().replace(/\s+/g, ' ').slice(0, 160)
    throw new Error(detail
      ? `The service returned an invalid response (${response.status}). Please try again shortly.`
      : `The service returned an empty response (${response.status}). Please try again shortly.`)
  }
  if (!response.ok || data.status === 'error') {
    if (response.status === 401 && (path === '/auth/me' || path === '/orders/checkout' || path === '/orders/mine' || path === '/orders/my-orders')) window.dispatchEvent(new Event('victoria-session-invalidated'))
    const error = new Error(data.message || `Request failed (${response.status})`) as Error & { responseData?: unknown; statusCode?: number }
    error.responseData = data
    error.statusCode = response.status
    throw error
  }
  return data as T
}

export function fetchCurrentCustomer() {
  return request<{ data: { user: { id: string; customerName: string; email: string; phone: string; county: string; town: string; addressLine: string; landmark: string } } }>('/auth/me')
}
export function logoutCustomer() { return request<{ message: string }>('/auth/logout', { method: 'POST' }) }
export type OtpDeliveryChannel = 'sms' | 'email' | 'console'
export function signupCustomer(payload: Record<string, string>) { return request<{ message?: string; data: { user: Record<string, string>; otp: { expiresAt: string; delivered: boolean; provider: string; channel: OtpDeliveryChannel; target: string } } }>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }) }
export function sendOtp(payload: { phone?: string; email?: string }) { return request<{ message?: string; data: { phone: string; delivered: boolean; provider: string; channel: OtpDeliveryChannel; target: string; expiresAt: string } }>('/auth/send-otp', { method: 'POST', body: JSON.stringify(payload) }) }
export function requestLoginOtp(payload: { phone?: string; email?: string }) { return request<{ message?: string; data: { userId: string; phone: string; delivered: boolean; provider: string; channel: OtpDeliveryChannel; target: string } }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }) }
export function verifyOtp(payload: { phone?: string; email?: string; code: string }) { return request<{ message?: string; data: { token: string; user: Record<string, string> } }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify(payload) }) }
export function fetchProducts(category = 'all') { const params = new URLSearchParams({ limit: '100' }); if (category !== 'all') params.set('category', category); return request<{ data: Product[]; filters?: { categories: Record<string, string> } }>(`/products?${params}`) }
export function fetchAdminInventory(adminKey: string) { return request<{ data: Product[] }>('/products/inventory', { headers: { 'x-admin-key': adminKey } }) }
export function updateProductAvailability(id: string, adminKey: string, values: { active: boolean; inStock: boolean; quantity: number }) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}/availability`, { method: 'PATCH', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(values) }) }
export function fetchProductById(id: string) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}`) }
export function fetchFeaturedProducts() { return request<{ data: Product[] }>('/products?featured=true&limit=4') }
export interface CheckoutQuote { items: Array<{ productId: string; quantity: number; price: number; lineTotal: number }>; subtotal: number; shippingFee: number; totalPrice: number }
export function fetchCheckoutQuote(county: string, items: CartItem[]) { return request<{ data: CheckoutQuote }>('/orders/quote', { method: 'POST', body: JSON.stringify({ county, items: items.map(item => ({ productId: item.id, quantity: item.cartQuantity, expectedPrice: item.price })) }) }) }
export function createCheckoutOrder(payload: CheckoutFormValues, items: CartItem[], checkoutKey: string) { return request<{ data: Order; payment: { configured: boolean; status: string; trackingToken?: string; customerMessage?: string; cartMatchesOrder?: boolean } }>('/orders/checkout', { method: 'POST', headers: { 'x-checkout-key': checkoutKey }, body: JSON.stringify({ ...payload, items: items.map(item => ({ productId: item.id, quantity: item.cartQuantity, expectedPrice: item.price })) }) }) }
export function fetchOrder(id: string, trackingToken: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}`, { headers: { 'x-order-token': trackingToken } }) }
export function fetchMyOrders(limit = 20) { return request<{ data: Order[]; pagination: { limit: number; returned: number } }>(`/orders/mine?limit=${Math.min(Math.max(limit, 1), 100)}`) }
export function fetchOrders(adminKey?: string, skip = 0, limit = 20) { const query = new URLSearchParams({ skip: String(skip), limit: String(limit) }); return request<{ data: Order[]; pagination: { total: number; skip: number; limit: number; returned: number } }>(`/orders?${query}`, { headers: adminKey ? { 'x-admin-key': adminKey } : {} }) }
export interface OrderAnalytics { range: { from: string; to: string }; summary: { orders: number; paidOrders: number; paidRevenue: number; awaitingPayment: number; activeDeliveries: number }; daily: Array<{ date: string; orders: number; paidOrders: number; paidRevenue: number; awaitingPayment: number; activeDeliveries: number }> }
export function fetchOrderAnalytics(adminKey: string, from: string, to: string) { const params = new URLSearchParams({ from, to }); return request<{ data: OrderAnalytics }>(`/orders/analytics?${params}`, { headers: { 'x-admin-key': adminKey } }) }
export function updateOrderStatus(id: string, status: Order['status'], adminKey: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ status }) }) }
export function assignDeliveryOrder(id: string, adminKey: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}/assign-delivery`, { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({}) }) }
export function requestOrderMpesaPayment(id: string, trackingToken: string) { return request<{ data: { orderId: string; checkoutRequestId: string }; message: string }>(`/orders/${encodeURIComponent(id)}/payment/mpesa`, { method: 'POST', headers: { 'x-order-token': trackingToken }, body: JSON.stringify({}) }) }
export function fetchProductReviews(productId: string) { return request<{ data: { reviews: Array<{ rating: number; body: string; createdAt: string; productName: string }>; summary: { count: number; average: number } } }>(`/orders/reviews?productId=${encodeURIComponent(productId)}`) }
export function submitOrderReview(payload: { orderId: string; productId: string; rating: number; body: string }, trackingToken: string) { return request<{ data: { id: string; status: string }; message: string }>('/orders/reviews', { method: 'POST', headers: { 'x-order-token': trackingToken }, body: JSON.stringify(payload) }) }
export function fetchPendingReviews(adminKey: string) { return request<{ data: Array<{ id: string; orderNumber: string; productName: string; rating: number; body: string; createdAt: string }> }>('/orders/reviews/moderation', { headers: { 'x-admin-key': adminKey } }) }
export function moderateReview(id: string, status: 'approved' | 'rejected', adminKey: string) { return request<{ data: { id: string; status: string } }>(`/orders/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ status }) }) }
export function fetchAssignedDeliveryOrders(deliveryKey: string) { return request<{ data: Order[] }>('/orders/assigned', { headers: { 'x-delivery-key': deliveryKey } }) }
export function updateDeliveryLocation(id: string, deliveryKey: string, latitude: number, longitude: number) { return request<{ data: { latitude: number; longitude: number; expiresAt: string } }>(`/orders/${encodeURIComponent(id)}/location`, { method: 'POST', headers: { 'x-delivery-key': deliveryKey }, body: JSON.stringify({ latitude, longitude }) }) }
export function markDeliveryOrderDelivered(id: string, deliveryKey: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}/delivery-status`, { method: 'PATCH', headers: { 'x-delivery-key': deliveryKey }, body: JSON.stringify({ status: 'delivered' }) }) }
export function recordCashPayment(id: string, deliveryKey: string) { return request<{ data: { receiptNumber: string; alreadyPaid: boolean } }>(`/orders/${encodeURIComponent(id)}/payment/cash`, { method: 'POST', headers: { 'x-delivery-key': deliveryKey }, body: JSON.stringify({}) }) }
export function fetchBlockedPhones(adminKey: string) { return request<{ data: Array<{ phone: string; reason: string; createdAt: string }> }>('/orders/blocked-phones', { headers: { 'x-admin-key': adminKey } }) }
export function blockPhone(adminKey: string, phone: string, reason: string) { return request<{ data: { phone: string; reason: string; createdAt: string } }>('/orders/blocked-phones', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ phone, reason }) }) }
export function unblockPhone(adminKey: string, phone: string) { return request<{ message: string }>(`/orders/blocked-phones/${encodeURIComponent(phone)}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }) }
