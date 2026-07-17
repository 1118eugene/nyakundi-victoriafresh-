import { Link } from 'react-router-dom'
import Logo from './Logo'
import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo-link">
          <Logo size="sm" showText={true} />
        </Link>
        
        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/products" className="nav-link">Products</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </nav>

        <div className="header-actions">
          <button className="btn-icon">🛒</button>
        </div>
      </div>
    </header>
  )
}
