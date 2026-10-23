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
export interface CustomerAuthUser {
  id: string
  customerName: string
  email: string
  phone: string
  county: string
  town: string
  addressLine: string
  landmark: string
  preferredPayment: string
}
export interface CustomerAuthResponse { message?: string; data: { token: string; user: CustomerAuthUser } }
export function signupCustomer(payload: Record<string, string>) { return request<CustomerAuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }) }
export function loginCustomer(payload: { identifier: string; password: string }) { return request<CustomerAuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ [payload.identifier.includes('@') ? 'email' : 'phone']: payload.identifier, password: payload.password }) }) }
export function setCustomerTemporaryPassword(adminKey: string, identifier: string, temporaryPassword: string) { return request<{ message: string }>('/auth/admin/set-password', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ identifier, temporaryPassword }) }) }
export function fetchProducts(category = 'all') { const params = new URLSearchParams({ limit: '100' }); if (category !== 'all') params.set('category', category); return request<{ data: Product[]; filters?: { categories: Record<string, string> } }>(`/products?${params}`) }
export function fetchAdminInventory(adminKey: string) { return request<{ data: Product[] }>('/products/inventory', { headers: { 'x-admin-key': adminKey } }) }
export function updateProductAvailability(id: string, adminKey: string, values: { active: boolean; inStock: boolean; quantity: number }) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}/availability`, { method: 'PATCH', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(values) }) }
export interface AdminProductInput {
  sku: string
  name: string
  description: string
  price: number | null
  priceConfirmed: boolean
  unit: string
  sizeLabel: string
  photos: string[]
  category: string
  species: string
  preparation: string
  quantity: number
  active: boolean
  inStock: boolean
  featured: boolean
}
export function createAdminProduct(adminKey: string, product: AdminProductInput) { return request<{ data: Product }>('/products', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(product) }) }
export function updateAdminProduct(id: string, adminKey: string, product: AdminProductInput) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(product) }) }
export function deactivateAdminProduct(id: string, adminKey: string) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }) }
export function confirmAdminProductPrice(id: string, adminKey: string) { return request<{ data: Product; message: string }>(`/products/${encodeURIComponent(id)}/confirm-price`, { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({}) }) }
export function confirmAllAdminPrices(adminKey: string) { return request<{ data: { confirmed: number }; message: string }>('/products/confirm-prices', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({}) }) }
export function importAdminProducts(adminKey: string, csv: string, dryRun: boolean) { return request<{ data: { dryRun: boolean; accepted: Array<{ line: number; sku: string; name?: string }>; rejected: Array<{ line: number; sku: string; reason: string }> } }>('/products/import', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify({ csv, dryRun }) }) }
export function fetchProductById(id: string) { return request<{ data: Product }>(`/products/${encodeURIComponent(id)}`) }
export function fetchFeaturedProducts() { return request<{ data: Product[] }>('/products?featured=true&limit=4') }
export interface CheckoutQuote { items: Array<{ productId: string; quantity: number; price: number; lineTotal: number }>; subtotal: number; shippingFee: number; totalPrice: number; deliveryZone: { name: string; minimumOrder: number; deliveryWindows: string[]; cutoffAt: string | null } }
export function fetchCheckoutQuote(county: string, town: string, items: CartItem[]) { return request<{ data: CheckoutQuote }>('/orders/quote', { method: 'POST', body: JSON.stringify({ county, town, items: items.map(item => ({ productId: item.id, quantity: item.cartQuantity })) }) }) }
export function createCheckoutOrder(payload: CheckoutFormValues, items: CartItem[], checkoutKey: string) { return request<{ data: Order; payment: { configured: boolean; status: string; trackingToken?: string; customerMessage?: string; cartMatchesOrder?: boolean } }>('/orders/checkout', { method: 'POST', headers: { 'x-checkout-key': checkoutKey }, body: JSON.stringify({ ...payload, items: items.map(item => ({ productId: item.id, quantity: item.cartQuantity })) }) }) }
export function fetchOrder(id: string, trackingToken: string) { return request<{ data: Order }>(`/orders/${encodeURIComponent(id)}`, { headers: { 'x-order-token': trackingToken } }) }
export interface DeliveryZoneInput {
  name: string
  county: string
  towns: string[]
  fee: number
  minimumOrder: number
  deliveryWindows: string[]
  cutoffAt: string | null
  priority: number
  active: boolean
}
export interface DeliveryZone extends DeliveryZoneInput { id: string; updatedAt: string }
export function fetchAdminDeliveryZones(adminKey: string) { return request<{ data: DeliveryZone[] }>('/delivery-zones', { headers: { 'x-admin-key': adminKey } }) }
export function createAdminDeliveryZone(adminKey: string, zone: DeliveryZoneInput) { return request<{ data: DeliveryZone }>('/delivery-zones', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(zone) }) }
export function updateAdminDeliveryZone(id: string, adminKey: string, zone: DeliveryZoneInput) { return request<{ data: DeliveryZone }>(`/delivery-zones/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'x-admin-key': adminKey }, body: JSON.stringify(zone) }) }
export function deactivateAdminDeliveryZone(id: string, adminKey: string) { return request<{ data: DeliveryZone }>(`/delivery-zones/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }) }
export interface DeliveryCoverage { covered: boolean; name?: string; fee?: number; minimumOrder?: number; deliveryWindows?: string[]; cutoffAt?: string | null }
export function checkDeliveryCoverage(county: string, town: string) { const params = new URLSearchParams({ county, town }); return request<{ data: DeliveryCoverage }>(`/delivery-zones/check?${params}`) }
export type SupportRequestType = 'question' | 'complaint' | 'refund'
export function submitSupportRequest(payload: { type: SupportRequestType; name: string; phone: string; email: string; orderNumber: string; message: string; contactConsent: boolean }) {
  return request<{ data: { id: string; requestType: SupportRequestType; status: 'new'; createdAt: string } }>('/support-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
export interface SupportRequest {
  id: string
  requestType: SupportRequestType
  customerName: string
  phone: string
  email: string
  orderNumber: string
  message: string
  contactConsent: boolean
  status: 'new' | 'in_review' | 'resolved'
  staffResponse: string
  resolutionOutcome: string
  createdAt: string
}
export function fetchSupportRequests(adminKey: string) { return request<{ data: SupportRequest[] }>('/support-requests', { headers: { 'x-admin-key': adminKey } }) }
export function updateSupportRequest(id: string, adminKey: string, values: Pick<SupportRequest, 'status' | 'staffResponse' | 'resolutionOutcome'>) {
  return request<{ data: Pick<SupportRequest, 'id' | 'status' | 'staffResponse' | 'resolutionOutcome'> }>(`/support-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'x-admin-key': adminKey },
    body: JSON.stringify(values),
  })
}
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
