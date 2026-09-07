import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'
import './Home.css'
import { Product } from '../types'
import { fetchFeaturedProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'
import { fallbackProducts } from '../data/fallbackProducts'

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const { addToCart } = useCart()

  useEffect(() => {
    fetchFeaturedProducts()
      .then((response) => setFeaturedProducts(response.data))
      .catch((err: Error) => {
        setFeaturedProducts(fallbackProducts)
        setError(err.message)
      })
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <p className="hero-kicker">Fresh from Lake Victoria to Your Table</p>
            <h1 className="hero-title">Fresh Fish Delivered to Your Doorstep</h1>
            <p className="hero-subtitle">
              Experience premium-quality fish sourced directly from Lake Victoria. Order online and enjoy fast
              delivery, affordable prices, and guaranteed freshness.
            </p>
            <div className="hero-cta">
              <Link to="/products" className="btn btn-primary btn-lg">
                Order Today
              </Link>
              <a href="https://wa.me/254117224696" className="btn btn-outline btn-lg" target="_blank" rel="noreferrer">
                Message us on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title">How ordering works now</h2>
          <div className="features-grid">
            <div className="feature-card">
              <img className="feature-card-image" src="/images/products/fresh-nile-perch.jpg" alt="Fresh Nile perch ready for preparation" />
              <div className="feature-icon">1</div>
              <h3>Pick stocked fish</h3>
              <p>The storefront now uses the backend product catalog instead of hardcoded demo cards.</p>
            </div>
            <div className="feature-card">
              <img className="feature-card-image" src="/images/products/pexels-fillet.jpg" alt="Fresh fish fillet prepared for an order" />
              <div className="feature-icon">2</div>
              <h3>Save cart properly</h3>
              <p>Items stay in the cart, quantities can be adjusted, and totals are recalculated before checkout.</p>
            </div>
            <div className="feature-card">
              <img className="feature-card-image" src="/images/products/fresh-pexels-b.jpg" alt="Fresh fish carefully prepared for delivery" />
              <div className="feature-icon">3</div>
              <h3>Capture delivery details</h3>
              <p>Every order now stores county, town, address, landmark, and customer notes for delivery planning.</p>
            </div>
            <div className="feature-card">
              <img className="feature-card-image" src="/images/products/pexels-grilled.jpg" alt="Grilled fish prepared for serving" />
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

          {error ? (
            <div className="home-recovery" role="alert">
              <div>
                <strong>Live prices are reconnecting.</strong>
                <span>{error} Browse the featured preview while the service comes back online.</span>
              </div>
              <Link to="/products" className="btn btn-outline btn-sm">Browse the shop</Link>
            </div>
          ) : null}

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
