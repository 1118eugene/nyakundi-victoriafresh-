import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useCustomer } from '../contexts/CustomerContext'
import { CheckoutQuote, createCheckoutOrder, fetchCheckoutQuote } from '../services/api'
import { CheckoutFormValues } from '../types'
import './Checkout.css'

const initialValues: CheckoutFormValues = {
  customerName: '',
  email: '',
  phone: '',
  paymentPhone: '',
  paymentMethod: 'cash_on_delivery',
  website: '',
  county: '',
  town: '',
  addressLine: '',
  landmark: '',
  notes: '',
}

const CHECKOUT_KEY_STORAGE = 'victoria-checkout-attempt'

function getCheckoutKey(identity: string) {
  const storageKey = `${CHECKOUT_KEY_STORAGE}:${identity.toLowerCase()}`
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

function clearCheckoutKey(identity: string) {
  try {
    window.sessionStorage.removeItem(`${CHECKOUT_KEY_STORAGE}:${identity.toLowerCase()}`)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export default function Checkout() {
  const navigate = useNavigate()
  const { items, subtotal, clearCart, refreshCart, catalogStatus, catalogError } = useCart()
  const { profile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reviewCartError, setReviewCartError] = useState(false)
  const submitLock = useRef(false)
  const checkoutKey = useRef<string | null>(null)
  const identity = profile?.email || 'guest'
  if (!checkoutKey.current) checkoutKey.current = getCheckoutKey(identity)

  const hasPriceChanges = items.some((item) => item.previousPrice !== null && item.previousPrice !== undefined)
  const hasUnavailableItems = items.some((item) => item.availabilityStatus === 'unavailable'
    || item.quantity < item.cartQuantity || !item.priceConfirmed || item.price === null || item.price <= 0)

  useEffect(() => {
    void refreshCart()
  }, [refreshCart])

  useEffect(() => {
    if (!profile) return
    setValues((current) => ({
      ...current,
      customerName: current.customerName || profile.customerName,
      email: current.email || profile.email,
      phone: current.phone || profile.phone,
      county: current.county || profile.county,
      town: current.town || profile.town,
      addressLine: current.addressLine || profile.addressLine,
      landmark: current.landmark || profile.landmark,
    }))
  }, [profile])

  useEffect(() => {
    let active = true
    setQuote(null)
    setQuoteError('')
    if (!values.county.trim() || !values.town.trim() || !items.length || catalogStatus !== 'ready') {
      setQuoteLoading(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      setQuoteLoading(true)
      void fetchCheckoutQuote(values.county, values.town, items)
        .then((response) => { if (active) setQuote(response.data) })
        .catch((err: Error) => { if (active) setQuoteError(err.message || 'Could not calculate the current order total.') })
        .finally(() => { if (active) setQuoteLoading(false) })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [values.county, values.town, items, catalogStatus])

  if (!items.length) return <Navigate to="/cart" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current || !quote || quoteLoading || quoteError || catalogStatus !== 'ready' || hasUnavailableItems || hasPriceChanges) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    setReviewCartError(false)
    try {
      const response = await createCheckoutOrder(values, items, checkoutKey.current || getCheckoutKey(identity))
      const token = response.payment.trackingToken
      if (!token) {
        setError('The order response did not include a tracking link. Do not place another order; contact support with your checkout details.')
        return
      }
      clearCart()
      clearCheckoutKey(identity)
      navigate(`/track/${encodeURIComponent(response.data.id)}?token=${encodeURIComponent(token)}`, { replace: true })
    } catch (err) {
      const checkoutError = err instanceof Error ? err : new Error('Checkout failed')
      setError(checkoutError.message)
      const statusCode = (checkoutError as Error & { statusCode?: number }).statusCode
      setReviewCartError([400, 404, 409].includes(statusCode || 0))
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="checkout-page">
      <section className="checkout-hero">
        <div className="container">
          <h1>Checkout</h1>
          <p>Order as a guest. No OTP or upfront payment is required.</p>
        </div>
      </section>

      <section className="section">
        <div className="container checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit} aria-busy={submitting || catalogStatus === 'checking' || quoteLoading}>
            {catalogStatus === 'checking' ? <p className="status-message info" role="status">Verifying current prices and stock...</p> : null}
            {catalogStatus === 'error' ? <div className="status-message error" role="alert"><p>{catalogError}</p><button className="btn btn-outline" type="button" onClick={() => void refreshCart()}>Retry verification</button></div> : null}
            {hasUnavailableItems ? <p className="status-message error" role="alert">A selected item is unavailable or has insufficient stock. <Link to="/cart">Review your cart</Link>.</p> : null}
            {hasPriceChanges ? <p className="status-message info" role="alert">Prices changed since you added these products. <Link to="/cart">Review the updated cart</Link> before ordering.</p> : null}
            {quoteError ? <p className="status-message error" role="alert">{quoteError}</p> : null}

            <fieldset className="checkout-fields" disabled={submitting}>
              <input className="checkout-honeypot" type="text" name="website" value={values.website} onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="form-grid">
                <label>
                  Customer name
                  <input value={values.customerName} onChange={(event) => setValues((current) => ({ ...current, customerName: event.target.value }))} autoComplete="name" minLength={2} maxLength={120} required />
                </label>
                <label>
                  Phone
                  <input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} placeholder="07XXXXXXXX" maxLength={20} required />
                </label>
                <label>
                  Email (optional)
                  <input type="email" autoComplete="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} maxLength={254} />
                </label>
                <label>
                  County
                  <input value={values.county} onChange={(event) => setValues((current) => ({ ...current, county: event.target.value }))} maxLength={100} required />
                </label>
                <label>
                  Town / city
                  <input value={values.town} onChange={(event) => setValues((current) => ({ ...current, town: event.target.value }))} maxLength={100} required />
                </label>
              </div>
              <label>
                Delivery address
                <input value={values.addressLine} onChange={(event) => setValues((current) => ({ ...current, addressLine: event.target.value }))} maxLength={300} required />
              </label>
              <label>
                Landmark (optional)
                <input value={values.landmark} onChange={(event) => setValues((current) => ({ ...current, landmark: event.target.value }))} maxLength={200} />
              </label>
              <label>
                Delivery instructions (optional)
                <textarea rows={4} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} maxLength={1000} />
              </label>

              <fieldset className="payment-method-options">
                <legend>Pay after delivery</legend>
                <label>
                  <input type="radio" name="paymentMethod" value="cash_on_delivery" checked={values.paymentMethod === 'cash_on_delivery'} onChange={() => setValues((current) => ({ ...current, paymentMethod: 'cash_on_delivery' }))} />
                  Cash on delivery
                </label>
                <label>
                  <input type="radio" name="paymentMethod" value="mpesa_after_delivery" checked={values.paymentMethod === 'mpesa_after_delivery'} onChange={() => setValues((current) => ({ ...current, paymentMethod: 'mpesa_after_delivery' }))} />
                  M-Pesa after delivery
                </label>
                <p className="input-hint">No payment happens at checkout. M-Pesa is requested only after delivery and only if the live payment service is available.</p>
              </fieldset>
            </fieldset>

            {error ? <p className="status-message error" role="alert">{error} {reviewCartError ? <Link to="/cart">Review your cart</Link> : null}</p> : null}
            <p className="status-message info">Your order is stored before payment. The tracking link contains a private token, so keep it safe.</p>
            <button className="btn btn-secondary btn-lg checkout-button" type="submit" disabled={submitting || catalogStatus !== 'ready' || hasUnavailableItems || hasPriceChanges || quoteLoading || !quote || Boolean(quoteError)}>
              {submitting ? 'Submitting order...' : 'Place order'}
            </button>
          </form>

          <aside className="checkout-summary">
            <h2>Order summary</h2>
            {items.map((item) => {
              const quotedItem = quote?.items.find((quoted) => quoted.productId === item.id)
              return (
                <div className="summary-row" key={item.id}>
                  <span>{item.name} × {item.cartQuantity}</span>
                  <strong>{quotedItem ? `KES ${quotedItem.lineTotal.toLocaleString()}`
                    : item.priceConfirmed && item.price !== null && item.price > 0
                      ? `KES ${(item.price * item.cartQuantity).toLocaleString()}`
                      : 'Price to be confirmed'}</strong>
                </div>
              )
            })}
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{quote ? `KES ${quote.subtotal.toLocaleString()}`
                : items.some((item) => !item.priceConfirmed || item.price === null || item.price <= 0)
                  ? 'Price to be confirmed'
                  : `KES ${subtotal.toLocaleString()}`}</strong>
            </div>
            <div className="summary-row">
              <span>Delivery charge</span>
              <strong>{quote ? `KES ${quote.shippingFee.toLocaleString()}` : quoteLoading ? 'Calculating…' : values.county ? 'Unavailable' : 'Enter county'}</strong>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <strong>{quote ? `KES ${quote.totalPrice.toLocaleString()}` : '—'}</strong>
            </div>
            <p className="checkout-note">The backend verifies product prices, stock, delivery charge and total again when you place the order.</p>
          </aside>
        </div>
      </section>
    </div>
  )
}
