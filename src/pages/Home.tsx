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
  const [loading, setLoading] = useState(false)
  const [cartActionError, setCartActionError] = useState('')
  const { addToCart } = useCart()

  async function loadFeaturedProducts() {
    setLoading(true)
    try {
      const response = await fetchFeaturedProducts()
      setFeaturedProducts(response.data)
      setError('')
    } catch (err) {
      setFeaturedProducts(fallbackProducts)
      setError(err instanceof Error ? err.message : 'Live prices are temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFeaturedProducts()
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <p className="hero-kicker">Fresh from Lake Victoria to Your Table</p>
            <h1 className="hero-title">Fresh Fish Delivered to Your Doorstep</h1>
            <p className="hero-subtitle">
              Explore Lake Victoria fish, choose a preparation that suits your meal, and order online from our Gikomba Market operation.
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
          <div className="meal-guide-heading">
            <p className="meal-guide-kicker">A better way to choose</p>
            <h2 className="section-title">Start with the meal you have in mind</h2>
            <p className="section-subtitle">Pick a style and we’ll take you straight to matching fish in the shop.</p>
          </div>
          <div className="meal-guide-grid">
            <Link className="meal-guide-card" to="/products?category=fresh-whole">
              <img src="/images/products/nile-perch-wikimedia.jpg" alt="" loading="lazy" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Family favourite</span>
                <h3>For a hearty fish meal</h3>
                <p>Browse fresh whole fish and choose the species that suits your table.</p>
                <span className="meal-guide-link">Shop fresh whole fish <span aria-hidden="true">→</span></span>
              </div>
            </Link>
            <Link className="meal-guide-card" to="/products?category=fillet">
              <img src="/images/products/pexels-fillet.jpg" alt="" loading="lazy" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Easy to serve</span>
                <h3>For a quick pan or grill</h3>
                <p>Go straight to fillets for a convenient option for weekday cooking.</p>
                <span className="meal-guide-link">Shop fish fillets <span aria-hidden="true">→</span></span>
              </div>
            </Link>
            <Link className="meal-guide-card" to="/products?category=smoked">
              <img src="/images/products/pexels-smoked.jpg" alt="" loading="lazy" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Deep, smoky flavour</span>
                <h3>For a taste with character</h3>
                <p>Explore smoked fish and find a bold addition to your next meal.</p>
                <span className="meal-guide-link">Shop smoked fish <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="featured-header">
            <div>
              <h2 className="section-title">Featured Products</h2>
              <p className="section-subtitle">A selection from the current shop catalogue.</p>
            </div>
            <Link to="/products" className="view-all">View all products</Link>
          </div>

          {error ? (
            <div className="home-recovery" role="status">
              <div>
                <strong>Browsing is still available.</strong>
                <span>Current prices and stock will appear once the live catalogue reconnects. These featured items are for preview only.</span>
              </div>
              <div className="home-recovery-actions">
                <button className="btn btn-outline btn-sm" type="button" onClick={() => void loadFeaturedProducts()} disabled={loading}>
                  {loading ? 'Checking prices…' : 'Refresh prices'}
                </button>
                <Link to="/products" className="btn btn-outline btn-sm">Browse the shop</Link>
              </div>
            </div>
          ) : null}
          {cartActionError ? <p className="status-message error" role="alert">{cartActionError}</p> : null}

          <div className="grid grid-4">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                previewOnly={Boolean(error)}
                onAddToCart={error ? undefined : (product) => {
                  const addError = addToCart(product)
                  setCartActionError(addError || '')
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="meal-help">
        <div className="container meal-help-content">
          <div>
            <p className="meal-guide-kicker">Personal help, one message away</p>
            <h2>Not sure which fish to choose?</h2>
            <p>Tell us what you’re planning to cook and our team can help you explore the available options.</p>
          </div>
          <a className="btn btn-primary btn-lg" href="https://wa.me/254117224696" target="_blank" rel="noreferrer">
            Ask us on WhatsApp <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </div>
  )
}
