import { FormEvent, useState } from 'react'
import { fetchOrders, updateOrderStatus } from '../services/api'
import { Order } from '../types'
import './AdminOrders.css'

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminOrders() {
  const [adminKey, setAdminKey] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await fetchOrders(adminKey)
      setOrders(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(order: Order, status: Order['status']) {
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

  const awaitingPayment = orders.filter((order) => order.paymentStatus !== 'paid').length
  const activeDeliveries = orders.filter((order) => ['confirmed', 'preparing', 'out_for_delivery'].includes(order.status)).length
  const paidRevenue = orders.filter((order) => order.paymentStatus === 'paid').reduce((total, order) => total + order.totalPrice, 0)

  return (
    <div className="admin-orders-page">
      <section className="admin-hero">
        <div className="container admin-hero-inner">
          <div>
            <span className="admin-eyebrow">Victoria Fresh Fish / Operations</span>
            <h1>Order command centre</h1>
            <p>Keep today&apos;s customer orders moving from payment to delivery.</p>
          </div>
          <div className="admin-hero-mark" aria-hidden="true">VFF</div>
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
                <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Enter access key" required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Connecting...' : 'Load live orders'}
              </button>
            </form>
          </div>

          {error ? <p className="status-message error">{error}</p> : null}
          {notice ? <p className="status-message success">{notice}</p> : null}

          {orders.length > 0 ? (
            <>
              <div className="dashboard-heading">
                <div>
                  <span className="panel-kicker">Live overview</span>
                  <h2>Today&apos;s operation</h2>
                </div>
                <span className="last-updated">{orders.length} orders loaded</span>
              </div>
              <div className="metric-grid">
                <article className="metric-card metric-card-blue">
                  <span>Total orders</span>
                  <strong>{orders.length}</strong>
                  <small>All loaded orders</small>
                </article>
                <article className="metric-card metric-card-amber">
                  <span>Needs attention</span>
                  <strong>{awaitingPayment}</strong>
                  <small>Awaiting payment or review</small>
                </article>
                <article className="metric-card metric-card-green">
                  <span>In fulfilment</span>
                  <strong>{activeDeliveries}</strong>
                  <small>Confirmed through delivery</small>
                </article>
                <article className="metric-card metric-card-ink">
                  <span>Paid revenue</span>
                  <strong>KES {paidRevenue.toLocaleString()}</strong>
                  <small>Confirmed payments</small>
                </article>
              </div>
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
              </article>
            ))}
              </div>
              {visibleOrders.length === 0 ? <div className="empty-state"><strong>No matching orders</strong><span>Try clearing a filter or searching another customer.</span></div> : null}
            </>
          ) : (
            <div className="empty-state empty-state-large"><strong>Your order queue is ready</strong><span>Load live orders above to see payments, delivery details, and fulfilment progress.</span></div>
          )}
        </div>
      </section>
    </div>
  )
}
