import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { createCheckoutOrder } from '../services/api'
import { CheckoutFormValues, Order } from '../types'
import './Checkout.css'

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

const initialValues: CheckoutFormValues = {
  customerName: '',
  email: '',
  phone: '',
  paymentPhone: '',
  county: '',
  town: '',
  addressLine: '',
  landmark: '',
  notes: '',
}

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart()
  const [values, setValues] = useState(initialValues)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [paymentMessage, setPaymentMessage] = useState('')

  if (items.length === 0 && !placedOrder) {
    return <Navigate to="/cart" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await createCheckoutOrder(values, items)
      setPlacedOrder(response.data)
      setPaymentMessage(response.payment.customerMessage || 'If M-Pesa is configured, confirm the STK prompt on your phone.')
      clearCart()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (placedOrder) {
    return (
      <div className="checkout-page">
        <section className="checkout-hero">
          <div className="container">
            <h1>Order received</h1>
            <p>Your order number is {placedOrder.orderNumber}. Keep this for follow-up.</p>
          </div>
        </section>
        <section className="section">
          <div className="container confirmation-card">
            <h2>Payment and delivery status</h2>
            <p>{paymentMessage || 'If M-Pesa is configured, confirm the STK prompt on your phone.'}</p>
            <div className="confirmation-grid">
              <div>
                <span>Status</span>
                <strong>{formatStatusLabel(placedOrder.status)}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{placedOrder.paymentStatus}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>KES {placedOrder.totalPrice.toLocaleString()}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{placedOrder.delivery.town}, {placedOrder.delivery.county}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <section className="checkout-hero">
        <div className="container">
          <h1>Checkout</h1>
          <p>Enter customer, delivery, and M-Pesa details for this order.</p>
        </div>
      </section>

      <section className="section">
        <div className="container checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Customer name
                <input value={values.customerName} onChange={(event) => setValues({ ...values, customerName: event.target.value })} required />
              </label>
              <label>
                Email
                <input type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} required />
              </label>
              <label>
                Phone
                <input value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} required />
              </label>
              <label>
                M-Pesa phone
                <input value={values.paymentPhone} onChange={(event) => setValues({ ...values, paymentPhone: event.target.value })} placeholder="Optional if same as customer phone" />
              </label>
              <label>
                County
                <input value={values.county} onChange={(event) => setValues({ ...values, county: event.target.value })} required />
              </label>
              <label>
                Town / city
                <input value={values.town} onChange={(event) => setValues({ ...values, town: event.target.value })} required />
              </label>
            </div>
            <label>
              Address line
              <input value={values.addressLine} onChange={(event) => setValues({ ...values, addressLine: event.target.value })} required />
            </label>
            <label>
              Landmark
              <input value={values.landmark} onChange={(event) => setValues({ ...values, landmark: event.target.value })} />
            </label>
            <label>
              Order notes
              <textarea rows={5} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
            </label>
            {error ? <p className="status-message error">{error}</p> : null}
            <button className="btn btn-secondary btn-lg" type="submit" disabled={submitting}>
              {submitting ? 'Submitting order...' : 'Place Order and Request M-Pesa Payment'}
            </button>
          </form>

          <aside className="checkout-summary">
            <h2>Order summary</h2>
            {items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>{item.name} x {item.cartQuantity}</span>
                <strong>KES {(item.price * item.cartQuantity).toLocaleString()}</strong>
              </div>
            ))}
            <div className="summary-row total">
              <span>Subtotal</span>
              <strong>KES {subtotal.toLocaleString()}</strong>
            </div>
            <p className="checkout-note">Shipping fee is calculated by the backend from the delivery county.</p>
          </aside>
        </div>
      </section>
    </div>
  )
}
