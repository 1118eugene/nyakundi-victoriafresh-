import { FormEvent, useState } from 'react'
import { fetchOrders } from '../services/api'
import { Order } from '../types'
import './AdminOrders.css'

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export default function AdminOrders() {
  const [adminKey, setAdminKey] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetchOrders(adminKey)
      setOrders(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-orders-page">
      <section className="admin-hero">
        <div className="container">
          <h1>Operations Order View</h1>
          <p>Use the admin access key from the backend environment to load live customer orders.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              Admin dashboard key
              <input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Load Orders'}
            </button>
          </form>

          {error ? <p className="status-message error">{error}</p> : null}

          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <h2>{order.orderNumber}</h2>
                    <p>{order.customer.name} • {order.customer.phone}</p>
                  </div>
                  <div className="order-badges">
                    <span>{formatStatusLabel(order.status)}</span>
                    <span>{order.paymentStatus}</span>
                  </div>
                </div>
                <p><strong>Delivery:</strong> {order.delivery.addressLine}, {order.delivery.town}, {order.delivery.county}</p>
                <p><strong>Landmark:</strong> {order.delivery.landmark || 'Not provided'}</p>
                <p><strong>Notes:</strong> {order.delivery.notes || 'None'}</p>
                <div className="order-items">
                  {order.items.map((item) => (
                    <div className="summary-row" key={`${order.id}-${item.sku}`}>
                      <span>{item.name} x {item.quantity}</span>
                      <strong>KES {item.lineTotal.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <div className="summary-row total">
                  <span>Total</span>
                  <strong>KES {order.totalPrice.toLocaleString()}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
