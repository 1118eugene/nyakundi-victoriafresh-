import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import './Header.css'
import { useCart } from '../contexts/CartContext'

export default function Header() {
  const { itemCount } = useCart()

  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo-link">
          <Logo size="sm" showText={true} />
        </Link>

        <nav className="nav">
          <NavLink to="/" className="nav-link">Home</NavLink>
          <NavLink to="/products" className="nav-link">Products</NavLink>
          <NavLink to="/about" className="nav-link">About</NavLink>
          <NavLink to="/contact" className="nav-link">Contact</NavLink>
        </nav>

        <div className="header-actions">
          <Link to="/cart" className="cart-link" aria-label={`Cart with ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <span className="cart-icon">Cart</span>
            <span className="cart-count">{itemCount}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
