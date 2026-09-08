import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import './Header.css'
import { useCart } from '../contexts/CartContext'
import { useCustomer } from '../contexts/CustomerContext'
import { useEffect, useState } from 'react'

export default function Header() {
  const { itemCount } = useCart()
  const { profile, clearProfile } = useCustomer()
  const [menuOpen, setMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem('victoria-dark-mode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false
  })

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark-mode')
    } else {
      root.classList.remove('dark-mode')
    }
    window.localStorage.setItem('victoria-dark-mode', darkMode.toString())
  }, [darkMode])

  useEffect(() => {
    if (!menuOpen) return
    const handleResize = () => setMenuOpen(false)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [menuOpen])

  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo-link" onClick={() => setMenuOpen(false)}>
          <Logo size="sm" showText={true} />
        </Link>

        <button
          className={`nav-toggle ${menuOpen ? 'open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/shop" className="nav-link" onClick={() => setMenuOpen(false)}>Shop</NavLink>
          <NavLink to="/fresh-fish" className="nav-link" onClick={() => setMenuOpen(false)}>Fresh Fish</NavLink>
          <NavLink to="/delivery" className="nav-link" onClick={() => setMenuOpen(false)}>Delivery</NavLink>
          <NavLink to="/faq" className="nav-link" onClick={() => setMenuOpen(false)}>FAQ</NavLink>
          <NavLink to="/about" className="nav-link" onClick={() => setMenuOpen(false)}>About</NavLink>
          <NavLink to="/contact" className="nav-link" onClick={() => setMenuOpen(false)}>Contact</NavLink>
        </nav>

        <div className="header-actions">
          {profile ? <button type="button" className="customer-chip" onClick={clearProfile} title="Sign out">{profile.customerName.split(' ')[0]}</button> : <Link to="/login" className="login-link">Sign in</Link>}
          <button
            type="button"
            className={`theme-toggle ${darkMode ? 'dark' : 'light'}`}
            onClick={() => setDarkMode((current) => !current)}
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <Link
            to="/cart"
            className="cart-link"
            aria-label={`Cart with ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="cart-icon">Cart</span>
            <span className="cart-count">{itemCount}</span>
          </Link>
        </div>
      </div>

      {menuOpen ? <div className="nav-backdrop" onClick={() => setMenuOpen(false)} /> : null}
    </header>
  )
}
