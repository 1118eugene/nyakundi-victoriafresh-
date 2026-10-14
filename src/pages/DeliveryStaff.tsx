import { FormEvent, useEffect, useState } from 'react'
import {
  fetchAssignedDeliveryOrders,
  markDeliveryOrderDelivered,
  recordCashPayment,
  updateDeliveryLocation,
} from '../services/api'
import { Order } from '../types'

export default function DeliveryStaff() {
  const [deliveryKey, setDeliveryKey] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [hasAccess, setHasAccess] = useState(false)
  const [busyOrderId, setBusyOrderId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadOrders(key = deliveryKey) {
    setError('')
    try {
      const response = await fetchAssignedDeliveryOrders(key)
      setOrders(response.data)
      setHasAccess(true)
    } catch (err) {
      setHasAccess(false)
      setOrders([])
      setError(err instanceof Error ? err.message : 'Unable to load assigned deliveries.')
    }
  }

  useEffect(() => {
    if (!hasAccess || !deliveryKey) return
    const interval = window.setInterval(() => { void loadOrders() }, 30000)
    return () => window.clearInterval(interval)
  }, [hasAccess, deliveryKey])

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadOrders(deliveryKey)
  }

  async function shareLocation(order: Order) {
    if (!navigator.geolocation) {
      setError('Location sharing is not supported by this browser.')
      return
    }
    setBusyOrderId(order.id)
    setError('')
    setNotice('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        await updateDeliveryLocation(order.id, deliveryKey, coords.latitude, coords.longitude)
        setNotice(`Location shared for ${order.orderNumber}. It will expire automatically.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to share delivery location.')
      } finally {
        setBusyOrderId('')
      }
    }, (err) => {
      setBusyOrderId('')
      setError(`Location was not shared: ${err.message}`)
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  async function markDelivered(order: Order) {
    setBusyOrderId(order.id)
    setError('')
    setNotice('')
    try {
      const response = await markDeliveryOrderDelivered(order.id, deliveryKey)
      setOrders((current) => current.map((item) => item.id === order.id ? response.data : item))
      setNotice(`${order.orderNumber} marked delivered.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update delivery status.')
    } finally {
      setBusyOrderId('')
    }
  }

  async function collectCash(order: Order) {
    if (!window.confirm(`Confirm receipt of KES ${order.totalPrice.toLocaleString()} cash for ${order.orderNumber}?`)) return
    setBusyOrderId(order.id)
    setError('')
    setNotice('')
    try {
      const response = await recordCashPayment(order.id, deliveryKey)
      setNotice(`${response.data.alreadyPaid ? 'Payment already recorded' : 'Cash received'}. Receipt: ${response.data.receiptNumber || 'available in the order record'}.`)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record cash payment.')
    } finally {
      setBusyOrderId('')
    }
  }

  return (
    <div className="checkout-page">
      <section className="checkout-hero">
        <div className="container">
          <h1>Delivery workspace</h1>
          <p>Access only orders assigned to your delivery account. Location sharing expires after 15 minutes.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {!hasAccess ? (
            <form className="checkout-form" onSubmit={(event) => void connect(event)}>
              <label htmlFor="delivery-access-key">Delivery staff key</label>
              <input id="delivery-access-key" type="password" value={deliveryKey} onChange={(event) => setDeliveryKey(event.target.value)} required autoComplete="current-password" />
              <button className="btn btn-primary" type="submit">Load assigned deliveries</button>
            </form>
          ) : (
            <>
              <div className="confirmation-header">
                <h2>Assigned deliveries</h2>
                <button className="btn btn-outline" type="button" onClick={() => void loadOrders()}>Refresh</button>
              </div>
              {orders.length === 0 ? <p className="status-message info">There are no assigned deliveries right now.</p> : null}
              {orders.map((order) => (
                <article className="confirmation-card" key={order.id}>
                  <h3>{order.orderNumber} · {order.status.replace(/_/g, ' ')}</h3>
                  <p>{order.customer.name} · <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></p>
                  <p>{order.delivery.addressLine}{order.delivery.landmark ? `, ${order.delivery.landmark}` : ''}, {order.delivery.town}, {order.delivery.county}</p>
                  <p>{order.delivery.notes || 'No delivery instructions'}</p>
                  <p>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</p>
                  <p>Total: KES {order.totalPrice.toLocaleString()} · {order.paymentMethod.replace(/_/g, ' ')}</p>
                  <div className="product-actions">
                    {order.status === 'out_for_delivery' ? (
                      <>
                        <button className="btn btn-outline" type="button" disabled={busyOrderId === order.id} onClick={() => void shareLocation(order)}>Share current location</button>
                        <button className="btn btn-primary" type="button" disabled={busyOrderId === order.id} onClick={() => void markDelivered(order)}>Mark delivered</button>
                      </>
                    ) : null}
                    {order.status === 'delivered' && order.paymentMethod === 'cash_on_delivery' && order.paymentStatus !== 'paid' ? (
                      <button className="btn btn-primary" type="button" disabled={busyOrderId === order.id} onClick={() => void collectCash(order)}>Record cash received</button>
                    ) : null}
                    {order.paymentStatus === 'paid' ? <p>Payment recorded.</p> : null}
                  </div>
                </article>
              ))}
            </>
          )}
          {error ? <p className="status-message error" role="alert">{error}</p> : null}
          {notice ? <p className="status-message success" role="status">{notice}</p> : null}
        </div>
      </section>
    </div>
  )
}
