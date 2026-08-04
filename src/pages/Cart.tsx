import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import './Cart.css'

export default function Cart() {
  const { items, subtotal, updateQuantity, removeFromCart } = useCart()

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
                    <p className="cart-meta">KES {item.price.toLocaleString()} per {item.unit}</p>
                  </div>
                  <div className="cart-item-controls">
                    <label>
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={item.cartQuantity}
                        onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                      />
                    </label>
                    <strong>KES {(item.price * item.cartQuantity).toLocaleString()}</strong>
                    <button className="btn btn-outline btn-sm" onClick={() => removeFromCart(item.id)}>
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
            <Link to="/checkout" className={`btn btn-secondary ${items.length === 0 ? 'disabled-link' : ''}`}>
              Continue to Checkout
            </Link>
          </aside>
        </div>
      </section>
    </div>
  )
}
