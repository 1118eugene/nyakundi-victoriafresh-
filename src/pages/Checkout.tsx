import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useCustomer } from '../contexts/CustomerContext'
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
const CHECKOUT_KEY_STORAGE = 'victoria-checkout-attempt'

function getCheckoutKey(customerEmail: string) {
  const storageKey = `${CHECKOUT_KEY_STORAGE}:${customerEmail.toLowerCase()}`
  try {
    const existing = window.sessionStorage.getItem(storageKey)
    if (existing) return existing
    const key = window.crypto.randomUUID()
    window.sessionStorage.setItem(storageKey, key)
    return key
  } catch {
    return window.crypto.randomUUID()
  }
}

function clearCheckoutKey(customerEmail: string) {
  try { window.sessionStorage.removeItem(`${CHECKOUT_KEY_STORAGE}:${customerEmail.toLowerCase()}`) } catch { /* Storage can be unavailable in private browsing. */ }
}

export default function Checkout() {
  const { items, subtotal, clearCart, refreshCart, acknowledgePriceChanges, catalogStatus, catalogError } = useCart()
  const { profile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [landmarkSelection, setLandmarkSelection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [cartMatchesOrder, setCartMatchesOrder] = useState(true)
  const [trackingToken, setTrackingToken] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [pollingStopped, setPollingStopped] = useState(false)
  const [refreshingPayment, setRefreshingPayment] = useState(false)
  const [reviewCartError, setReviewCartError] = useState(false)
  const pollAttempts = useRef(0)
  const submitLock = useRef(false)
  const checkoutKey = useRef<string | null>(null)
  if (!checkoutKey.current) checkoutKey.current = getCheckoutKey(profile?.email || 'guest')
  const hasPriceChanges = items.some((item) => item.previousPrice !== null && item.previousPrice !== undefined)
  const hasUnavailableItems = items.some((item) => item.availabilityStatus === 'unavailable' || item.quantity < item.cartQuantity)

  useEffect(() => {
    void refreshCart()
  }, [])

  useEffect(() => {
    if (!profile) return
    setValues((current) => ({
      ...current,
      customerName: profile.customerName,
      email: profile.email,
      phone: profile.phone,
      county: current.county || profile.county,
      town: current.town || profile.town,
      addressLine: current.addressLine || profile.addressLine,
      landmark: current.landmark || profile.landmark,
    }))
    setLandmarkSelection(profile.landmark ? landmarkOptions.includes(profile.landmark) ? profile.landmark : 'Other' : '')
  }, [profile])

  useEffect(() => {
    if (!placedOrder || !['pending', 'initiated'].includes(placedOrder.paymentStatus) || !trackingToken || pollingStopped) return undefined

    let active = true
    let inFlight = false
    const pollPaymentStatus = async () => {
      if (inFlight || !active) return
      if (pollAttempts.current >= 60) {
        setPollingStopped(true)
        setPaymentMessage('Payment status is taking longer than expected. Refresh the status below before trying anything else.')
        return
      }
      inFlight = true
      pollAttempts.current += 1
      try {
        const response = await fetchOrder(placedOrder.id, trackingToken)
        if (!active) return

        setPlacedOrder(response.data)
        if (response.data.paymentStatus === 'paid') {
          setPaymentMessage(response.data.mpesa.paymentReviewRequired
            ? 'Payment received after the stock reservation expired. Our team must confirm availability before preparing the delivery.'
            : 'Payment received. We will now prepare your delivery.')
          if (cartMatchesOrder) clearCart()
          clearCheckoutKey(profile?.email || 'guest')
          window.clearInterval(interval)
        } else if (response.data.paymentStatus === 'failed') {
          setPaymentMessage(response.data.mpesa.resultDescription || 'The M-Pesa payment was not completed.')
          window.clearInterval(interval)
        }
      } catch {
        setPaymentMessage('We could not refresh payment status. Your order details are saved; try refreshing again shortly.')
      } finally {
        inFlight = false
      }
    }

    const interval = window.setInterval(() => { void pollPaymentStatus() }, 3000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [placedOrder?.id, placedOrder?.paymentStatus, trackingToken, pollingStopped, profile?.email, cartMatchesOrder])

  if (items.length === 0 && !placedOrder) {
    return <Navigate to="/cart" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current || catalogStatus !== 'ready' || hasUnavailableItems || hasPriceChanges) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    setReviewCartError(false)

    try {
      const response = await createCheckoutOrder(values, items, checkoutKey.current || getCheckoutKey(profile?.email || 'guest'))
      setPlacedOrder(response.data)
      const matchesCurrentCart = response.payment.cartMatchesOrder !== false
      setCartMatchesOrder(matchesCurrentCart)
      setTrackingToken(response.payment.trackingToken || '')
      pollAttempts.current = 0
      setPollingStopped(false)

      if (!response.payment.configured) {
        setPaymentMessage('M-Pesa is not configured on this server yet. Please contact support or try again later.')
      } else {
        setPaymentMessage(response.payment.customerMessage || defaultPaymentMessage)
      }

      if (response.data.paymentStatus === 'paid') {
        if (matchesCurrentCart) clearCart()
        clearCheckoutKey(profile?.email || 'guest')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Checkout failed')
      const responseData = (error as Error & { responseData?: { data?: Order; payment?: { trackingToken?: string; customerMessage?: string; cartMatchesOrder?: boolean } } }).responseData

      if (responseData?.data) {
        setPlacedOrder(responseData.data)
        const matchesCurrentCart = responseData.payment?.cartMatchesOrder !== false
        setCartMatchesOrder(matchesCurrentCart)
        setTrackingToken(responseData.payment?.trackingToken || '')
        setPaymentMessage(responseData.payment?.customerMessage || error.message)
        if (responseData.data.paymentStatus === 'paid') {
          if (matchesCurrentCart) clearCart()
          clearCheckoutKey(profile?.email || 'guest')
        }
      } else {
        const statusCode = (error as Error & { statusCode?: number }).statusCode
        setError(error.message)
        setReviewCartError([400, 404, 409].includes(statusCode || 0))
      }
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  async function refreshPaymentStatus() {
    if (!placedOrder || !trackingToken || submitLock.current) return
    submitLock.current = true
    setRefreshingPayment(true)
    try {
      const response = await fetchOrder(placedOrder.id, trackingToken)
      setPlacedOrder(response.data)
      setPollingStopped(false)
      pollAttempts.current = 0
      setPaymentMessage(response.data.paymentStatus === 'paid'
        ? response.data.mpesa.paymentReviewRequired ? 'Payment received after the stock reservation expired. Our team must confirm availability before preparing the delivery.' : 'Payment received. We will now prepare your delivery.'
        : response.data.mpesa.resultDescription || 'Payment is still being confirmed. Do not submit another payment request.')
      if (response.data.paymentStatus === 'paid') {
        if (cartMatchesOrder) clearCart()
        clearCheckoutKey(profile?.email || 'guest')
      }
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Payment status could not be refreshed.')
    } finally {
      submitLock.current = false
      setRefreshingPayment(false)
    }
  }

  function retryFailedPayment() {
    if (!placedOrder || placedOrder.paymentStatus !== 'failed') return
    checkoutKey.current = window.crypto.randomUUID()
    try { window.sessionStorage.setItem(`${CHECKOUT_KEY_STORAGE}:${(profile?.email || 'guest').toLowerCase()}`, checkoutKey.current) } catch { /* The in-memory key still protects this page session. */ }
    setPlacedOrder(null)
    setCartMatchesOrder(true)
    setTrackingToken('')
    setPollingStopped(false)
    setPaymentMessage('')
    setError('')
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
            {!cartMatchesOrder ? <p className="status-message info" role="status">This is a recovered earlier checkout. Your current cart has not been changed.</p> : null}
            {placedOrder.paymentStatus === 'paid' && placedOrder.mpesa.paymentReviewRequired ? <p className="payment-help-note">The payment was matched, but stock was released before confirmation. Do not place another order; our team must review fulfillment or refund options.</p> : null}
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
            {['pending', 'initiated'].includes(placedOrder.paymentStatus) ? <button className="btn btn-outline" type="button" disabled={refreshingPayment} onClick={() => void refreshPaymentStatus()}>{refreshingPayment ? 'Refreshing status...' : 'Refresh payment status'}</button> : null}
            {placedOrder.paymentStatus === 'failed' ? <button className="btn btn-outline" type="button" onClick={retryFailedPayment}>Try checkout again</button> : null}
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
          <form className="checkout-form" onSubmit={handleSubmit} aria-busy={submitting || catalogStatus === 'checking'}>
            {catalogStatus === 'checking' ? <p className="status-message info" role="status">Verifying current prices and stock before payment...</p> : null}
            {catalogStatus === 'error' ? <div className="status-message error" role="alert"><p>{catalogError}</p><button className="btn btn-outline" type="button" onClick={() => void refreshCart()}>Retry verification</button></div> : null}
            {hasUnavailableItems ? <p className="status-message error" role="alert">One or more products are no longer available or have insufficient stock. <Link to="/cart">Review your cart</Link>.</p> : null}
            {hasPriceChanges ? <div className="status-message info" role="alert"><p>Prices changed since you added these products. Review the updated cart before payment.</p><Link className="btn btn-outline" to="/cart">Review updated prices</Link></div> : null}
            <fieldset className="checkout-fields" disabled={submitting}>
            <div className="form-grid">
              <label>
                Customer name
                <input value={values.customerName} readOnly required />
              </label>
              <label>
                Email
                <input type="email" value={values.email} readOnly required />
              </label>
              <label>
                Phone
                <input value={values.phone} readOnly required />
              </label>
              <label>
                M-Pesa phone
                <input type="tel" autoComplete="tel" value={values.paymentPhone} onChange={(event) => setValues((current) => ({ ...current, paymentPhone: event.target.value }))} placeholder="Optional if same as customer phone" />
                <span className="input-hint">Use 07XXXXXXXX or +2547XXXXXXXX format for M-Pesa prompt delivery.</span>
              </label>
              <label>
                County
                <input value={values.county} onChange={(event) => setValues((current) => ({ ...current, county: event.target.value }))} required />
              </label>
              <label>
                Town / city
                <input value={values.town} onChange={(event) => setValues((current) => ({ ...current, town: event.target.value }))} required />
              </label>
            </div>
            <label>
              Address line
              <input value={values.addressLine} onChange={(event) => setValues((current) => ({ ...current, addressLine: event.target.value }))} required />
            </label>
            <label>
              Landmark
              <select
                value={landmarkSelection || 'select'}
                onChange={(event) => {
                  const selected = event.target.value
                  setLandmarkSelection(selected)

                  if (selected === 'Other' || selected === 'select') {
                    setValues((current) => ({ ...current, landmark: '' }))
                  } else {
                    setValues((current) => ({ ...current, landmark: selected }))
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
                  onChange={(event) => setValues((current) => ({ ...current, landmark: event.target.value }))}
                  placeholder="Enter a nearby landmark"
                  required
                />
              </label>
            ) : null}
            <label>
              Order notes
              <textarea rows={5} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            </fieldset>
            {error ? <p className="status-message error" role="alert">{error} {reviewCartError ? <Link to="/cart">Review your cart</Link> : null}</p> : null}
            <p className="status-message info">Your cart is kept until payment is confirmed. A retry uses the same checkout attempt to avoid duplicate orders or payment prompts.</p>
            <button className="btn btn-secondary btn-lg checkout-button" type="submit" disabled={submitting || catalogStatus !== 'ready' || hasUnavailableItems || hasPriceChanges}>
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
