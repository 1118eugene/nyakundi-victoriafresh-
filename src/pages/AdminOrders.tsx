import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignDeliveryOrder, blockPhone, fetchAdminInventory, fetchBlockedPhones, fetchOrderAnalytics, fetchOrders, fetchPendingReviews, moderateReview, OrderAnalytics, unblockPhone, updateOrderStatus, updateProductAvailability } from '../services/api'
import { Order, Product } from '../types'
import './AdminOrders.css'

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(value))
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export default function AdminOrders() {
  const [adminKey, setAdminKey] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [assigningOrderId, setAssigningOrderId] = useState('')
  const [notice, setNotice] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [orderTotal, setOrderTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [hasAccess, setHasAccess] = useState(false)
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [toDate, setToDate] = useState(() => formatDateInput(new Date()))
  const [fromDate, setFromDate] = useState(() => formatDateInput(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)))
  const [analyticsRetry, setAnalyticsRetry] = useState(0)
  const analyticsRequest = useRef(0)
  const [pendingReviews, setPendingReviews] = useState<Array<{ id: string; orderNumber: string; productName: string; rating: number; body: string; createdAt: string }>>([])
  const [reviewError, setReviewError] = useState('')
  const [moderatingReviewId, setModeratingReviewId] = useState('')
  const [inventory, setInventory] = useState<Product[]>([])
  const [inventoryError, setInventoryError] = useState('')
  const [savingProductId, setSavingProductId] = useState('')
  const [blockedPhones, setBlockedPhones] = useState<Array<{ phone: string; reason: string; createdAt: string }>>([])
  const [blockedPhonesError, setBlockedPhonesError] = useState('')
  const [phone, setPhone] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [phoneBlockLoading, setPhoneBlockLoading] = useState(false)

  useEffect(() => {
    if (!hasAccess || !adminKey) return
    fetchPendingReviews(adminKey)
      .then((response) => {
        setPendingReviews(response.data)
        setReviewError('')
      })
      .catch((err: Error) => setReviewError(err.message || 'Unable to load pending reviews.'))
  }, [hasAccess, adminKey])

  useEffect(() => {
    if (!hasAccess || !adminKey) return
    fetchAdminInventory(adminKey)
      .then((response) => { setInventory(response.data); setInventoryError('') })
      .catch((err: Error) => setInventoryError(err.message || 'Unable to load inventory.'))
    fetchBlockedPhones(adminKey)
      .then((response) => { setBlockedPhones(response.data); setBlockedPhonesError('') })
      .catch((err: Error) => setBlockedPhonesError(err.message || 'Unable to load phone blocks.'))
  }, [hasAccess, adminKey])

  useEffect(() => {
    if (!hasAccess || !adminKey) return
    const requestId = ++analyticsRequest.current
    setAnalyticsLoading(true)
    setAnalyticsError('')
    setAnalytics(null)
    fetchOrderAnalytics(adminKey, fromDate, toDate)
      .then((response) => {
        if (analyticsRequest.current === requestId) setAnalytics(response.data)
      })
      .catch((err: Error) => {
        if (analyticsRequest.current === requestId) setAnalyticsError(err.message || 'Unable to load analytics.')
      })
      .finally(() => {
        if (analyticsRequest.current === requestId) setAnalyticsLoading(false)
      })
    return () => { analyticsRequest.current += 1 }
  }, [hasAccess, adminKey, fromDate, toDate, analyticsRetry])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await fetchOrders(adminKey, 0)
      setOrders(response.data)
      setOrderTotal(response.pagination.total)
      setHasMore(response.pagination.skip + response.pagination.returned < response.pagination.total)
      setHasAccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setError('')

    try {
      const response = await fetchOrders(adminKey, orders.length)
      setOrders((current) => [...current, ...response.data])
      setOrderTotal(response.pagination.total)
      setHasMore(response.pagination.skip + response.pagination.returned < response.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more orders')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleStatusChange(order: Order, status: Order['status']) {
    if (status === 'cancelled' && !window.confirm(`Cancel ${order.orderNumber}? Any successful payment requires a separate refund review.`)) return
    setUpdatingOrderId(order.id)
    setError('')
    setNotice('')

    try {
      const response = await updateOrderStatus(order.id, status, adminKey)
      setOrders((current) => current.map((item) => item.id === order.id ? response.data : item))
      setNotice(`${order.orderNumber} updated successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update order')
    } finally {
      setUpdatingOrderId('')
    }
  }

  async function handleAssignDelivery(order: Order) {
    setAssigningOrderId(order.id)
    setError('')
    setNotice('')
    try {
      const response = await assignDeliveryOrder(order.id, adminKey)
      setOrders((current) => current.map((item) => item.id === order.id ? response.data : item))
      setNotice(`${order.orderNumber} assigned to the configured delivery worker.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign delivery.')
    } finally {
      setAssigningOrderId('')
    }
  }

  async function handleReviewModeration(id: string, status: 'approved' | 'rejected') {
    setModeratingReviewId(id)
    setReviewError('')
    try {
      await moderateReview(id, status, adminKey)
      setPendingReviews((current) => current.filter((review) => review.id !== id))
      setNotice(`Review ${status}.`)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to moderate review.')
    } finally {
      setModeratingReviewId('')
    }
  }

  async function handleInventorySave(product: Product) {
    setSavingProductId(product.id)
    setInventoryError('')
    try {
      const response = await updateProductAvailability(product.id, adminKey, {
        active: Boolean(product.active),
        inStock: product.inStock,
        quantity: product.quantity,
      })
      setInventory((current) => current.map((item) => item.id === product.id ? response.data : item))
      setNotice(`${product.name} availability updated.`)
    } catch (err) {
      setInventoryError(err instanceof Error ? err.message : 'Unable to update product availability.')
    } finally {
      setSavingProductId('')
    }
  }

  async function handlePhoneBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPhoneBlockLoading(true)
    setBlockedPhonesError('')
    try {
      const response = await blockPhone(adminKey, phone, blockReason)
      setBlockedPhones((current) => [response.data, ...current.filter((item) => item.phone !== response.data.phone)])
      setPhone('')
      setBlockReason('')
    } catch (err) {
      setBlockedPhonesError(err instanceof Error ? err.message : 'Unable to block phone number.')
    } finally {
      setPhoneBlockLoading(false)
    }
  }

  async function handlePhoneUnblock(value: string) {
    setBlockedPhonesError('')
    try {
      await unblockPhone(adminKey, value)
      setBlockedPhones((current) => current.filter((item) => item.phone !== value))
    } catch (err) {
      setBlockedPhonesError(err instanceof Error ? err.message : 'Unable to remove phone block.')
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const visibleOrders = orders.filter((order) => {
    const matchesSearch = !normalizedSearch || [
      order.orderNumber,
      order.customer.name,
      order.customer.phone,
      order.delivery.town,
    ].some((value) => value.toLowerCase().includes(normalizedSearch))
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const matchesPayment = paymentFilter === 'all' || order.paymentStatus === paymentFilter
    return matchesSearch && matchesStatus && matchesPayment
  })

  const chartValues = analytics?.daily.map((day) => day.paidRevenue) || []
  const chartMaximum = Math.max(...chartValues, 1)
  const chartPlotHeight = 184
  const chartStep = analytics?.daily.length ? 920 / analytics.daily.length : 920
  const tickInterval = Math.max(1, Math.ceil((analytics?.daily.length || 1) / 7))

  return (
    <div className="admin-orders-page">
      <section className="admin-hero">
        <div className="container admin-hero-inner">
          <div>
            <span className="admin-eyebrow">Victoria Fresh Fish / Operations</span>
            <h1>Order command centre</h1>
            <p>Keep today&apos;s customer orders moving from payment to delivery.</p>
          </div>
          <Link className="btn btn-outline" to="/admin/products">Manage catalogue</Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="admin-access-panel">
            <div>
              <span className="panel-kicker">Secure workspace</span>
              <h2>Connect to live orders</h2>
              <p>Enter the operations key to load the latest customer activity.</p>
            </div>
            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Admin dashboard key
                <input type="password" value={adminKey} onChange={(event) => { setAdminKey(event.target.value); setHasAccess(false); setOrders([]); setAnalytics(null) }} placeholder="Enter access key" required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Connecting...' : 'Load live orders'}
              </button>
            </form>
          </div>

          {error ? <p className="status-message error">{error}</p> : null}
          {notice ? <p className="status-message success">{notice}</p> : null}

          {hasAccess ? (
            <>
              <div className="dashboard-heading">
                <div>
                  <span className="panel-kicker">Live overview</span>
                  <h2>Operations and sales</h2>
                </div>
                <span className="last-updated">Order queue: {orderTotal.toLocaleString('en-KE')} records</span>
              </div>
              <section className="analytics-section" aria-labelledby="analytics-title">
                <div className="analytics-heading">
                  <div><span className="panel-kicker">Database-backed report</span><h2 id="analytics-title">Sales analytics</h2><p>Paid revenue is grouped by order creation date, in Kenya shillings.</p></div>
                  <div className="analytics-filters">
                    <label>From<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
                    <label>To<input type="date" value={toDate} min={fromDate} max={formatDateInput(new Date())} onChange={(event) => setToDate(event.target.value)} /></label>
                  </div>
                </div>
                {analyticsLoading ? <p className="analytics-message" role="status">Loading analytics for {fromDate} to {toDate}...</p> : null}
                {analyticsError ? <div className="analytics-error" role="alert"><span>{analyticsError}</span><button className="btn btn-outline btn-sm" type="button" onClick={() => setAnalyticsRetry((current) => current + 1)}>Retry analytics</button></div> : null}
                {!analyticsLoading && analytics ? (
                  <>
                    <div className="metric-grid analytics-metrics">
                      <article className="metric-card metric-card-blue"><span>Orders in range</span><strong>{analytics.summary.orders.toLocaleString('en-KE')}</strong><small>{analytics.range.from} to {analytics.range.to}</small></article>
                      <article className="metric-card metric-card-green"><span>Paid orders</span><strong>{analytics.summary.paidOrders.toLocaleString('en-KE')}</strong><small>Payment confirmed</small></article>
                      <article className="metric-card metric-card-amber"><span>Needs attention</span><strong>{analytics.summary.awaitingPayment.toLocaleString('en-KE')}</strong><small>Not yet paid</small></article>
                      <article className="metric-card metric-card-ink"><span>Active fulfilment</span><strong>{analytics.summary.activeDeliveries.toLocaleString('en-KE')}</strong><small>Confirmed through delivery</small></article>
                    </div>
                    <div className="revenue-chart-panel">
                      <div className="revenue-chart-header"><h3>Paid revenue by day</h3><strong>KES {analytics.summary.paidRevenue.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</strong></div>
                      {analytics.summary.orders === 0 ? <p className="analytics-message">No orders were created in this date range.</p> : null}
                      <div className="revenue-chart-scroll">
                        <svg className="revenue-chart" viewBox="0 0 1000 240" role="img" aria-labelledby="revenue-chart-title revenue-chart-description" preserveAspectRatio="none">
                          <title id="revenue-chart-title">Paid revenue by order date</title>
                          <desc id="revenue-chart-description">Daily paid revenue from {analytics.range.from} to {analytics.range.to}, in Kenyan shillings.</desc>
                          {[0, 1, 2, 3].map((line) => <line key={line} x1="50" x2="990" y1={20 + line * 58} y2={20 + line * 58} className="chart-grid-line" />)}
                          {analytics.daily.map((day, index) => {
                            const barHeight = day.paidRevenue > 0 ? Math.max(2, day.paidRevenue / chartMaximum * chartPlotHeight) : 0
                            const barWidth = Math.max(1, Math.min(18, chartStep * 0.62))
                            const x = 60 + index * chartStep + (chartStep - barWidth) / 2
                            const y = 204 - barHeight
                            return <rect key={day.date} x={x} y={y} width={barWidth} height={barHeight} rx="2" className="chart-revenue-bar"><title>{formatChartDate(day.date)}: KES {day.paidRevenue.toLocaleString('en-KE', { maximumFractionDigits: 2 })}; {day.paidOrders} paid orders</title></rect>
                          })}
                          {analytics.daily.filter((_day, index) => index % tickInterval === 0 || index === analytics.daily.length - 1).map((day, index, ticks) => {
                            const dayIndex = analytics.daily.indexOf(day)
                            const x = 60 + dayIndex * chartStep
                            const anchor = dayIndex === 0 ? 'start' : dayIndex === analytics.daily.length - 1 ? 'end' : 'middle'
                            return <text key={day.date} x={x} y="230" textAnchor={anchor} className="chart-axis-label">{formatChartDate(day.date)}</text>
                          })}
                        </svg>
                      </div>
                      <details className="analytics-data-table">
                        <summary>View daily chart data</summary>
                        <div className="analytics-table-scroll"><table><thead><tr><th>Date</th><th>Orders</th><th>Paid orders</th><th>Paid revenue</th></tr></thead><tbody>{analytics.daily.map((day) => <tr key={day.date}><td>{formatChartDate(day.date)}</td><td>{day.orders.toLocaleString('en-KE')}</td><td>{day.paidOrders.toLocaleString('en-KE')}</td><td>KES {day.paidRevenue.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>
                      </details>
                    </div>
                  </>
                ) : null}
              </section>
              <section className="analytics-section" aria-labelledby="reviews-moderation-title">
                <div className="analytics-heading">
                  <div><span className="panel-kicker">Customer feedback</span><h2 id="reviews-moderation-title">Review moderation</h2><p>Only approved, verified-order reviews appear on product listings.</p></div>
                  <span>{pendingReviews.length} pending</span>
                </div>
                {reviewError ? <p className="status-message error" role="alert">{reviewError}</p> : null}
                {pendingReviews.map((review) => (
                  <article className="order-card" key={review.id}>
                    <h3>{review.productName} · {review.rating} / 5</h3>
                    <p>Order {review.orderNumber} · {formatOrderDate(review.createdAt)}</p>
                    <p>{review.body || 'No written comment.'}</p>
                    <div className="product-actions">
                      <button className="btn btn-primary btn-sm" type="button" disabled={moderatingReviewId === review.id} onClick={() => void handleReviewModeration(review.id, 'approved')}>Approve</button>
                      <button className="btn btn-outline btn-sm" type="button" disabled={moderatingReviewId === review.id} onClick={() => void handleReviewModeration(review.id, 'rejected')}>Reject</button>
                    </div>
                  </article>
                ))}
                {!reviewError && pendingReviews.length === 0 ? <p className="status-message info">No reviews are waiting for moderation.</p> : null}
              </section>
              <section className="analytics-section" aria-labelledby="inventory-title">
                <div className="analytics-heading">
                  <div><span className="panel-kicker">Stock management</span><h2 id="inventory-title">Product availability</h2><p>Update catalogue visibility and stock counts.</p></div>
                </div>
                {inventoryError ? <p className="status-message error" role="alert">{inventoryError}</p> : null}
                <div className="analytics-table-scroll">
                  <table>
                    <thead><tr><th>Product</th><th>Active</th><th>In stock</th><th>Quantity</th><th>Action</th></tr></thead>
                    <tbody>{inventory.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td><input aria-label={`${product.name} active`} type="checkbox" checked={Boolean(product.active)} onChange={(event) => setInventory((items) => items.map((item) => item.id === product.id ? { ...item, active: event.target.checked } : item))} /></td>
                        <td><input aria-label={`${product.name} in stock`} type="checkbox" checked={product.inStock} onChange={(event) => setInventory((items) => items.map((item) => item.id === product.id ? { ...item, inStock: event.target.checked } : item))} /></td>
                        <td><input aria-label={`${product.name} quantity`} type="number" min="0" max="1000000" value={product.quantity} onChange={(event) => setInventory((items) => items.map((item) => item.id === product.id ? { ...item, quantity: Number(event.target.value) } : item))} /></td>
                        <td><button className="btn btn-outline btn-sm" type="button" disabled={savingProductId === product.id} onClick={() => void handleInventorySave(product)}>{savingProductId === product.id ? 'Saving...' : 'Save stock'}</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
              <section className="analytics-section" aria-labelledby="blocked-phones-title">
                <div className="analytics-heading">
                  <div><span className="panel-kicker">Checkout controls</span><h2 id="blocked-phones-title">Blocked phone numbers</h2><p>Blocked numbers cannot place online orders.</p></div>
                </div>
                {blockedPhonesError ? <p className="status-message error" role="alert">{blockedPhonesError}</p> : null}
                <form className="admin-form" onSubmit={(event) => void handlePhoneBlock(event)}>
                  <label>Kenyan phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0712 345 678" required /></label>
                  <label>Reason (optional)<input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} maxLength={300} /></label>
                  <button className="btn btn-primary" type="submit" disabled={phoneBlockLoading}>{phoneBlockLoading ? 'Saving...' : 'Block number'}</button>
                </form>
                <ul>{blockedPhones.map((item) => <li key={item.phone}>{item.phone}{item.reason ? ` — ${item.reason}` : ''} <button className="btn btn-outline btn-sm" type="button" onClick={() => void handlePhoneUnblock(item.phone)}>Unblock</button></li>)}</ul>
              </section>
              <div className="orders-queue-heading"><h2>Order queue</h2><span>Showing {orders.length.toLocaleString('en-KE')} of {orderTotal.toLocaleString('en-KE')}</span></div>
              <div className="orders-toolbar">
                <label>
                  Search orders
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, phone, town" />
                </label>
                <label>
                  Fulfilment
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="awaiting_payment">Awaiting payment</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing</option>
                    <option value="out_for_delivery">Out for delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label>
                  Payment
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                    <option value="all">All payments</option>
                    <option value="paid">Paid</option>
                    <option value="initiated">Initiated</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>
              <div className="orders-list">
            {visibleOrders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <div className="order-title-row">
                      <h3>{order.orderNumber}</h3>
                      <span className={`payment-pill payment-${order.paymentStatus}`}>{formatStatusLabel(order.paymentStatus)}</span>
                    </div>
                    <p>{order.customer.name} <span className="muted-divider">/</span> {order.customer.phone}</p>
                  </div>
                  <div className="order-badges">
                    <span className={`status-pill status-${order.status}`}>{formatStatusLabel(order.status)}</span>
                  </div>
                </div>
                <div className="order-meta"><span>{formatOrderDate(order.createdAt)}</span><span>{order.delivery.town}, {order.delivery.county}</span></div>
                {['confirmed', 'preparing', 'out_for_delivery'].includes(order.status) ? (
                  <div className="delivery-strip">
                    <div>
                      <span>Delivery assignment</span>
                      <strong>{order.assignedDeliveryName || order.assignedDeliveryPerson || 'Not assigned'}</strong>
                    </div>
                    <button className="btn btn-outline btn-sm" type="button" disabled={assigningOrderId === order.id} onClick={() => void handleAssignDelivery(order)}>
                      {assigningOrderId === order.id ? 'Assigning...' : 'Assign delivery'}
                    </button>
                  </div>
                ) : null}
                <label className="order-status-control">
                  Fulfilment status
                  <select
                    value={order.status}
                    disabled={updatingOrderId === order.id}
                    onChange={(event) => void handleStatusChange(order, event.target.value as Order['status'])}
                  >
                    <option value="awaiting_payment">Awaiting payment</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing</option>
                    <option value="out_for_delivery">Out for delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <div className="delivery-strip">
                  <div><span>Delivery address</span><strong>{order.delivery.addressLine}</strong><small>{order.delivery.landmark || 'No landmark provided'}</small></div>
                  <div><span>Customer note</span><strong>{order.delivery.notes || 'No special instructions'}</strong></div>
                </div>
                <div className="order-items">
                  {order.items.map((item) => (
                    <div className="order-item-row" key={`${order.id}-${item.sku}`}>
                      <img src={item.image} alt="" />
                      <span>{item.name}<small>{item.quantity} x {item.unit}</small></span>
                      <strong>KES {item.lineTotal.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <div className="order-total">
                  <span>Total</span>
                  <strong>KES {order.totalPrice.toLocaleString()}</strong>
                </div>
                <details className="order-history-details">
                  <summary>Order history and payment records</summary>
                  <ul>
                    {order.history.map((event, index) => (
                      <li key={`${event.type}-${event.createdAt}-${index}`}>{formatStatusLabel(event.type)} · {formatOrderDate(event.createdAt)}</li>
                    ))}
                  </ul>
                  {order.payments.map((payment) => (
                    <p key={`${payment.method}-${payment.receiptNumber || payment.createdAt}`}>
                      {formatStatusLabel(payment.method)} · {formatStatusLabel(payment.status)} · KES {payment.amount.toLocaleString()}
                      {payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ''}
                    </p>
                  ))}
                </details>
              </article>
            ))}
              </div>
              {visibleOrders.length === 0 ? <div className="empty-state"><strong>No matching orders</strong><span>Try clearing a filter or searching another customer.</span></div> : null}
              {hasMore ? <button className="btn btn-outline load-more" type="button" onClick={() => void handleLoadMore()} disabled={loadingMore}>{loadingMore ? 'Loading more...' : 'Load more orders'}</button> : null}
            </>
          ) : (
            <div className="empty-state empty-state-large"><strong>Your order queue is ready</strong><span>Load live orders above to see payments, delivery details, and fulfilment progress.</span></div>
          )}
        </div>
      </section>
    </div>
  )
}
