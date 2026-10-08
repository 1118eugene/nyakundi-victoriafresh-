import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCart } from '../contexts/CartContext'
import './Cart.css'

export default function Cart() {
  const { items, subtotal, updateQuantity, removeFromCart, refreshCart, acknowledgePriceChanges, catalogStatus, catalogError, cartNotice, persistenceError } = useCart()
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const hasPriceChanges = items.some((item) => item.previousPrice !== null && item.previousPrice !== undefined)
  const hasUnavailableItems = items.some((item) => item.availabilityStatus === 'unavailable')

  useEffect(() => {
    void refreshCart()
  }, [])

  const changeQuantity = (productId: string, quantity: number) => {
    const error = updateQuantity(productId, quantity)
    setItemErrors((current) => {
      const next = { ...current }
      if (error) next[productId] = error
      else delete next[productId]
      return next
    })
  }

  const hasInsufficientStock = items.some((item) => item.availabilityStatus === 'available' && item.quantity < item.cartQuantity)
  const canCheckout = items.length > 0 && catalogStatus === 'ready' && !hasUnavailableItems && !hasInsufficientStock && !hasPriceChanges

  return (
    <div className="cart-page">
      <section className="cart-hero">
        <div className="container">
          <h1>Your Cart</h1>
          <p>Review quantities before checkout. Delivery details and M-Pesa payment are collected next.</p>
        </div>
      </section>

      <section className="section">
        <div className="container cart-layout">
          <div className="cart-items">
            {catalogStatus === 'checking' ? <p className="cart-status" role="status">Checking current prices and availability...</p> : null}
            {cartNotice ? <p className="cart-status" role="status">{cartNotice}</p> : null}
            {catalogStatus === 'error' ? (
              <div className="cart-recovery" role="alert">
                <p>{catalogError} Your saved items are still here. Verify them before checkout.</p>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => void refreshCart()}>Retry catalogue check</button>
              </div>
            ) : null}
            {persistenceError ? <p className="cart-warning" role="alert">{persistenceError}</p> : null}
            {hasPriceChanges ? (
              <div className="cart-recovery" role="alert">
                <p>Some prices changed since these items were added. Review the updated prices before continuing.</p>
                <button className="btn btn-outline btn-sm" type="button" onClick={acknowledgePriceChanges}>I reviewed the updated prices</button>
              </div>
            ) : null}
            {items.length === 0 ? (
              <div className="cart-empty">
                <h2>Your cart is empty</h2>
                <p>Start with the verified product catalog and add items for delivery.</p>
                <Link to="/products" className="btn btn-primary">Browse Products</Link>
              </div>
            ) : (
              items.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-image">
                    {item.image ? <img src={item.image} alt={item.name} /> : <div className="cart-placeholder">No image</div>}
                  </div>
                  <div className="cart-item-content">
                    <h2>{item.name}</h2>
                    <p>{item.preparation}</p>
                    {item.availabilityStatus === 'unavailable' ? <p className="cart-warning" role="status">This item is no longer available. Remove it to continue.</p> : null}
                    {item.availabilityStatus === 'available' && item.quantity < item.cartQuantity ? <p className="cart-warning" role="alert">Only {item.quantity} currently available. Reduce the quantity to continue.</p> : null}
                    <p className="cart-meta">KES {item.price.toLocaleString()} per {item.unit}</p>
                    {item.previousPrice !== null && item.previousPrice !== undefined ? <p className="cart-price-change">Previously KES {item.previousPrice.toLocaleString()} each</p> : null}
                    {item.priceUpdatedAt ? <p className="cart-meta">Price updated {new Date(item.priceUpdatedAt).toLocaleDateString()}</p> : null}
                  </div>
                  <div className="cart-item-controls">
                    <label htmlFor={`cart-quantity-${item.id}`}>
                      Quantity
                      <input
                        id={`cart-quantity-${item.id}`}
                        type="number"
                        min={1}
                        max={Math.max(item.quantity, 1)}
                        step={1}
                        value={item.cartQuantity}
                        onChange={(event) => changeQuantity(item.id, Number(event.target.value))}
                        aria-invalid={Boolean(itemErrors[item.id])}
                        aria-describedby={itemErrors[item.id] ? `cart-quantity-error-${item.id}` : undefined}
                      />
                    </label>
                    {itemErrors[item.id] ? <span className="cart-inline-error" id={`cart-quantity-error-${item.id}`} role="alert">{itemErrors[item.id]}</span> : null}
                    <strong>KES {(item.price * item.cartQuantity).toLocaleString()}</strong>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name} from cart`}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="cart-summary">
            <h2>Summary</h2>
            <div className="summary-row">
              <span>Cart subtotal</span>
              <strong>KES {subtotal.toLocaleString()}</strong>
            </div>
            <div className="summary-row muted">
              <span>Delivery fee</span>
              <span>Calculated at checkout</span>
            </div>
            <Link to="/checkout" aria-disabled={!canCheckout} tabIndex={canCheckout ? 0 : -1} className={`btn btn-secondary ${canCheckout ? '' : 'disabled-link'}`} onClick={(event) => { if (!canCheckout) event.preventDefault() }}>
              Continue to Checkout
            </Link>
          </aside>
        </div>
      </section>
    </div>
  )
}
