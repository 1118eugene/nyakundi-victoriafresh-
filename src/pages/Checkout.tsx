import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { createCheckoutOrder, fetchOrder } from '../services/api'
import { CheckoutFormValues, Order } from '../types'
import './Checkout.css'

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

const landmarkOptions = [
  'Next to KFC',
  'Opposite Main Post Office',
  'Near Umoja Shopping Center',
  'Beside City Market',
  'Near Shell Petrol Station',
  'Other',
]

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

const defaultPaymentMessage = 'If M-Pesa is configured, confirm the STK prompt on your phone.'

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart()
  const [values, setValues] = useState(initialValues)
  const [landmarkSelection, setLandmarkSelection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [paymentMessage, setPaymentMessage] = useState('')

  useEffect(() => {
    if (!placedOrder || placedOrder.paymentStatus !== 'initiated') return undefined

    let active = true
    let attempts = 0
    const pollPaymentStatus = async () => {
      attempts += 1
      try {
        const response = await fetchOrder(placedOrder.id)
        if (!active) return

        setPlacedOrder(response.data)
        if (response.data.paymentStatus === 'paid') {
          setPaymentMessage('Payment received. We will now prepare your delivery.')
        } else if (response.data.paymentStatus === 'failed') {
          setPaymentMessage(response.data.mpesa.resultDescription || 'The M-Pesa payment was not completed.')
        }
      } catch {
        // The initial order confirmation remains visible if a status refresh fails.
      }
    }

    const interval = window.setInterval(() => {
      if (attempts >= 40) {
        window.clearInterval(interval)
        return
      }
      void pollPaymentStatus()
    }, 3000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [placedOrder])

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

      if (!response.payment.configured) {
        setPaymentMessage('M-Pesa is not configured on this server yet. Please contact support or try again later.')
      } else {
        setPaymentMessage(response.payment.customerMessage || defaultPaymentMessage)
      }

      clearCart()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Checkout failed')
      const responseData = (error as any).responseData

      if (responseData?.data) {
        setPlacedOrder(responseData.data)
        setPaymentMessage(responseData.payment?.customerMessage || error.message)
        clearCart()
      } else {
        setError(error.message)
      }
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
            <div className="confirmation-header">
              <div>
                <h2>Payment and delivery status</h2>
                <p>{paymentMessage || defaultPaymentMessage}</p>
              </div>
              <span className={`payment-badge status-${placedOrder.paymentStatus}`}>
                M-PESA STATUS: {placedOrder.paymentStatus.toUpperCase()}
              </span>
            </div>
            {placedOrder.mpesa.resultDescription ? (
              <p className="payment-description">{placedOrder.mpesa.resultDescription}</p>
            ) : null}
            {placedOrder.paymentStatus === 'failed' ? (
              <p className="payment-help-note">
                Need help? The payment did not complete. Please check your M-Pesa details and try again, or contact support for assistance.
              </p>
            ) : null}
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
                <span className="input-hint">Use 07XXXXXXXX or +2547XXXXXXXX format for M-Pesa prompt delivery.</span>
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
              <select
                value={landmarkSelection || 'select'}
                onChange={(event) => {
                  const selected = event.target.value
                  setLandmarkSelection(selected)

                  if (selected === 'Other' || selected === 'select') {
                    setValues({ ...values, landmark: '' })
                  } else {
                    setValues({ ...values, landmark: selected })
                  }
                }}
              >
                <option value="select">Select a landmark</option>
                {landmarkOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            {landmarkSelection === 'Other' ? (
              <label>
                Other landmark
                <input
                  value={values.landmark}
                  onChange={(event) => setValues({ ...values, landmark: event.target.value })}
                  placeholder="Enter a nearby landmark"
                  required
                />
              </label>
            ) : null}
            <label>
              Order notes
              <textarea rows={5} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
            </label>
            {error ? <p className="status-message error">{error}</p> : null}
            <p className="status-message info">We will send the M-Pesa prompt to the phone number provided. If no prompt appears, check your phone number format and confirm the backend has active M-Pesa credentials.</p>
            <button className="btn btn-secondary btn-lg checkout-button" type="submit" disabled={submitting}>
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
