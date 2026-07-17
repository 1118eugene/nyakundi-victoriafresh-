import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { freshWholeFish } from '../data/products'
import './Home.css'
import { Product } from '../types'

export default function Home() {
  const featuredProducts = freshWholeFish.slice(0, 4)

  const handleAddToCart = (product: Product) => {
    console.log('Added to cart:', product)
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Fresh Fish from Lake Victoria</h1>
            <p className="hero-subtitle">
              Premium quality fish products delivered straight to your home. 
              Supporting local fisheries and sustainable practices.
            </p>
            <div className="hero-cta">
              <Link to="/products" className="btn btn-primary btn-lg">
                Shop Now
              </Link>
              <Link to="/about" className="btn btn-outline btn-lg">
                Learn More
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <img src="/images/hero-sea-side.jpg" alt="Sea and fishing boat" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section section-light">
        <div className="container">
          <h2 className="section-title">Why Choose Us</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🌊</div>
              <h3>Fresh Daily Catch</h3>
              <p>We source directly from Lake Victoria fisheries, ensuring only the freshest fish reaches your table.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <h3>Quality Assured</h3>
              <p>Every product is carefully selected and inspected for quality, freshness, and safety standards.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚚</div>
              <h3>Fast Delivery</h3>
              <p>Quick and reliable delivery service throughout Kenya, keeping your fish cold and fresh.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💚</div>
              <h3>Sustainable Fishing</h3>
              <p>We support eco-friendly fishing practices to protect Lake Victoria's ecosystem for future generations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="section">
        <div className="container">
          <div className="featured-header">
            <div>
              <h2 className="section-title">Featured Products</h2>
              <p className="section-subtitle">Browse our selection of premium fresh fish</p>
            </div>
            <Link to="/products" className="view-all">View All Products →</Link>
          </div>
          
          <div className="grid grid-4">
            {featuredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">1000+</div>
              <div className="stat-label">Happy Customers</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">5000+</div>
              <div className="stat-label">Orders Delivered</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">100%</div>
              <div className="stat-label">Fresh Guarantee</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Experience Fresh Fish?</h2>
            <p>Join thousands of satisfied customers enjoying premium Lake Victoria fish</p>
            <Link to="/products" className="btn btn-secondary btn-lg">Start Shopping</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
