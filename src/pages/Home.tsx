import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'
import './Home.css'
import { Product } from '../types'
import { fetchFeaturedProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const { addToCart } = useCart()

  useEffect(() => {
    fetchFeaturedProducts()
      .then((response) => setFeaturedProducts(response.data))
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <p className="hero-kicker">Lake Victoria fish • Real orders • Countrywide delivery</p>
            <h1 className="hero-title">Fresh fish, verified prices, and delivery details captured properly</h1>
            <p className="hero-subtitle">
              Order fresh whole fish, fillets, dried omena, or ready-to-eat grilled tilapia from a live catalog.
              Your cart, delivery instructions, and M-Pesa checkout are handled in one flow.
            </p>
            <div className="hero-cta">
              <Link to="/products" className="btn btn-primary btn-lg">
                Shop Verified Catalog
              </Link>
              <Link to="/checkout" className="btn btn-outline btn-lg">
                Go to Checkout
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <img src="/images/hero-sea.jpg" alt="Grilled whole tilapia platter ready for serving" />
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title">How ordering works now</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">1</div>
              <h3>Pick stocked fish</h3>
              <p>The storefront now uses the backend product catalog instead of hardcoded demo cards.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">2</div>
              <h3>Save cart properly</h3>
              <p>Items stay in the cart, quantities can be adjusted, and totals are recalculated before checkout.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">3</div>
              <h3>Capture delivery details</h3>
              <p>Every order now stores county, town, address, landmark, and customer notes for delivery planning.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">4</div>
              <h3>Start M-Pesa payment</h3>
              <p>Once Daraja credentials are added, checkout can send a live STK push and update order status.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="featured-header">
            <div>
              <h2 className="section-title">Featured Products</h2>
              <p className="section-subtitle">Verified items currently exposed from the live backend catalog</p>
            </div>
            <Link to="/products" className="view-all">View all products</Link>
          </div>

          {error ? <p className="status-message">{error}</p> : null}

          <div className="grid grid-4">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">MongoDB</div>
              <div className="stat-label">Persistent catalog and orders</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">M-Pesa</div>
              <div className="stat-label">Daraja STK push ready</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">Kenya</div>
              <div className="stat-label">Delivery fields built for county routing</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">Real Cart</div>
              <div className="stat-label">Add, review, and checkout flow</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
