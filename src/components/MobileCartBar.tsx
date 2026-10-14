import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import './MobileCartBar.css'

export default function MobileCartBar() {
  const { itemCount, subtotal } = useCart()
  const location = useLocation()
  const hiddenPaths = ['/cart', '/checkout']

  if (!itemCount || hiddenPaths.includes(location.pathname) || location.pathname.startsWith('/admin') || location.pathname.startsWith('/delivery/staff')) {
    return null
  }

  return (
    <div className="mobile-cart-bar">
      <Link to="/cart" aria-label={`Open cart with ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, subtotal KES ${subtotal.toLocaleString()}`}>
        <span className="mobile-cart-bar-summary">
          <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
          <strong>KES {subtotal.toLocaleString()}</strong>
        </span>
        <span className="mobile-cart-bar-action">View cart <span aria-hidden="true">→</span></span>
      </Link>
    </div>
  )
}
