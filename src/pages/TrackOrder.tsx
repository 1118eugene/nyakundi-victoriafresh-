import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchOrder, requestOrderMpesaPayment, submitOrderReview } from '../services/api'
import { Order } from '../types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(value))
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPaymentMethod(value: Order['paymentMethod']) {
  if (value === 'cash_on_delivery') return 'Cash on delivery'
  if (value === 'mpesa_after_delivery') return 'M-Pesa after delivery'
  return 'M-Pesa'
}

export default function TrackOrder() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [reviewRating, setReviewRating] = useState('5')
  const [reviewBody, setReviewBody] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')

  const refresh = useCallback(async (showSpinner = false) => {
    if (!id || !token) {
      setError('This tracking link is incomplete. Open the original link from your order confirmation.')
      setLoading(false)
      return
    }
    if (showSpinner) setRefreshing(true)
    try {
      const response = await fetchOrder(id, token)
      setOrder(response.data)
      setLastUpdated(new Date().toISOString())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load this order. Try again shortly.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, token])

  async function requestPayment() {
    if (!order) return
    setPaymentLoading(true)
    setPaymentMessage('')
    try {
      const response = await requestOrderMpesaPayment(order.id, token)
      setPaymentMessage(response.message)
      await refresh()
    } catch (err) {
      setPaymentMessage(err instanceof Error ? err.message : 'Unable to request M-Pesa payment.')
    } finally {
      setPaymentLoading(false)
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order) return
    setReviewSubmitting(true)
    setReviewMessage('')
    try {
      const response = await submitOrderReview({
        orderId: order.id,
        productId: order.items[0].productId,
        rating: Number(reviewRating),
        body: reviewBody,
      }, token)
      setReviewMessage(response.message)
      setReviewBody('')
      await refresh()
    } catch (err) {
      setReviewMessage(err instanceof Error ? err.message : 'Unable to submit your review.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 15000)
    return () => window.clearInterval(interval)
  }, [refresh])

  return (
    <div className="checkout-page">
      <section className="checkout-hero">
        <div className="container">
          <h1>Track your order</h1>
          <p>Order status and payment information are retrieved from the live order record.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {loading ? <p className="status-message info" role="status">Loading your order...</p> : null}
          {error ? <div className="status-message error" role="alert"><p>{error}</p><button className="btn btn-outline" type="button" onClick={() => void refresh(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Retry'}</button></div> : null}
          {order ? (
            <article className="confirmation-card">
              <div className="confirmation-header">
                <div>
                  <h2>Order {order.orderNumber}</h2>
                  <p>Received {formatDate(order.createdAt)}</p>
                </div>
                <button className="btn btn-outline" type="button" onClick={() => void refresh(true)} disabled={refreshing}>
                  {refreshing ? 'Refreshing...' : 'Refresh status'}
                </button>
              </div>
              <div className="confirmation-grid">
                <div><span>Order status</span><strong>{formatStatus(order.status)}</strong></div>
                <div><span>Payment method</span><strong>{formatPaymentMethod(order.paymentMethod)}</strong></div>
                <div><span>Payment status</span><strong>{order.paymentStatus === 'paid' ? 'Payment confirmed' : order.paymentStatus === 'failed' ? 'Payment not completed' : 'Awaiting customer payment'}</strong></div>
                <div><span>Total</span><strong>KES {order.totalPrice.toLocaleString()}</strong></div>
              </div>
              <section aria-labelledby="track-items-title">
                <h3 id="track-items-title">Your items</h3>
                {order.items.map((item) => (
                  <div className="summary-row" key={`${item.productId}-${item.sku}`}>
                    <span>{item.name} — {item.quantity} {item.unit}</span>
                    <strong>KES {item.lineTotal.toLocaleString()}</strong>
                  </div>
                ))}
                <div className="summary-row"><span>Delivery charge</span><strong>KES {order.shippingFee.toLocaleString()}</strong></div>
              </section>
              <section aria-labelledby="track-address-title">
                <h3 id="track-address-title">Delivery details</h3>
                <p>{order.customer.name} · {order.customer.phone}</p>
                <p>{order.delivery.addressLine}{order.delivery.landmark ? `, ${order.delivery.landmark}` : ''}, {order.delivery.town}, {order.delivery.county}</p>
                {order.delivery.notes ? <p>Instructions: {order.delivery.notes}</p> : null}
              </section>
              {order.deliveryLocation ? (
                <section aria-labelledby="track-location-title">
                  <h3 id="track-location-title">Live delivery location</h3>
                  <p>Updated {formatDate(order.deliveryLocation.updatedAt)}. Location sharing expires automatically.</p>
                  <a className="btn btn-outline" href={`https://www.google.com/maps?q=${order.deliveryLocation.latitude},${order.deliveryLocation.longitude}`} target="_blank" rel="noreferrer">Open delivery location in maps</a>
                </section>
              ) : null}
              {order.paymentMethod === 'mpesa_after_delivery' && order.status === 'delivered' && order.paymentStatus !== 'paid' ? (
                <section aria-labelledby="track-payment-title">
                  <h3 id="track-payment-title">Complete payment</h3>
                  <p>Request an M-Pesa prompt to pay KES {order.totalPrice.toLocaleString()} after delivery.</p>
                  <button className="btn btn-primary" type="button" onClick={() => void requestPayment()} disabled={paymentLoading || order.paymentStatus === 'initiated'}>
                    {paymentLoading ? 'Requesting prompt...' : order.paymentStatus === 'initiated' ? 'M-Pesa prompt pending' : 'Request M-Pesa prompt'}
                  </button>
                  {paymentMessage ? <p className="status-message info" role="status">{paymentMessage}</p> : null}
                </section>
              ) : null}
              {order.payments.some((payment) => payment.status === 'paid') ? (
                <section aria-labelledby="track-receipt-title">
                  <h3 id="track-receipt-title">Payment receipt</h3>
                  {order.payments.filter((payment) => payment.status === 'paid').map((payment) => (
                    <p key={`${payment.method}-${payment.receiptNumber || payment.createdAt}`}>
                      {payment.method === 'cash' ? 'Cash received' : 'M-Pesa receipt'} · KES {payment.amount.toLocaleString()}
                      {payment.receiptNumber ? ` · ${payment.receiptNumber}` : ''}
                      {payment.paidAt ? ` · ${formatDate(payment.paidAt)}` : ''}
                    </p>
                  ))}
                </section>
              ) : null}
              {order.status === 'delivered' && order.paymentStatus === 'paid' && !order.history.some((event) => event.type === 'review_submitted') ? (
                <section aria-labelledby="order-review-title">
                  <h3 id="order-review-title">How was your order?</h3>
                  <form onSubmit={(event) => void submitReview(event)}>
                    <label htmlFor="order-review-rating">Rating</label>
                    <select id="order-review-rating" value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Okay</option>
                      <option value="2">2 - Poor</option>
                      <option value="1">1 - Very poor</option>
                    </select>
                    <label htmlFor="order-review-body">Review (optional)</label>
                    <textarea id="order-review-body" value={reviewBody} maxLength={1000} onChange={(event) => setReviewBody(event.target.value)} />
                    <button className="btn btn-primary" type="submit" disabled={reviewSubmitting}>{reviewSubmitting ? 'Submitting...' : 'Submit review'}</button>
                  </form>
                  {reviewMessage ? <p className="status-message info" role="status">{reviewMessage}</p> : null}
                </section>
              ) : null}
              {order.history.length ? (
                <section aria-labelledby="track-history-title">
                  <h3 id="track-history-title">Order updates</h3>
                  <ol>
                    {order.history.filter((event) => event.type !== 'delivery_location_updated').map((event, index) => (
                      <li key={`${event.type}-${event.createdAt}-${index}`}>{formatStatus(event.type)} · {formatDate(event.createdAt)}</li>
                    ))}
                  </ol>
                </section>
              ) : null}
              <p className="input-hint" role="status">Last checked: {lastUpdated ? formatDate(lastUpdated) : 'Not yet refreshed'}. This page refreshes the order record automatically.</p>
              <p className="status-message info">Keep this private tracking link safe. Anyone with it can view this order.</p>
            </article>
          ) : null}
          {!order && !loading && !error ? <p className="status-message info">No order data is available for this link.</p> : null}
          <p className="section-action"><Link className="btn btn-primary" to="/products">Continue shopping</Link></p>
        </div>
      </section>
    </div>
  )
}
