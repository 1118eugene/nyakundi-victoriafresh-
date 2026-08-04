import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'
import './Products.css'
import { Product } from '../types'
import { fetchProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { addToCart } = useCart()

  useEffect(() => {
    setLoading(true)
    setError('')

    fetchProducts(selectedCategory)
      .then((response) => {
        setProducts(response.data)
        setCategories(response.filters?.categories || {})
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedCategory])

  return (
    <div className="products">
      <div className="products-header">
        <div className="container">
          <h1>Order Fish by Category</h1>
          <p>Live catalog, realistic prices in Kenya, and product photos only where they match the listing.</p>
        </div>
      </div>

      <div className="container products-content">
        <aside className="filters">
          <h3>Browse by type</h3>
          <div className="filter-options">
            <button
              className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Products
            </button>
            {Object.entries(categories).map(([id, label]) => (
              <button
                key={id}
                className={`filter-btn ${selectedCategory === id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </aside>

        <main className="products-grid">
          <div className="products-count">
            <h2>{selectedCategory === 'all' ? 'All Products' : categories[selectedCategory]}</h2>
            <span className="count">{products.length} items</span>
          </div>

          {loading ? <p className="status-message">Loading products...</p> : null}
          {error ? <p className="status-message error">{error}</p> : null}

          <div className="grid grid-4">
            {!loading && products.length > 0 ? (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                />
              ))
            ) : null}
          </div>

          {!loading && !error && products.length === 0 ? (
            <div className="no-products">
              <p>No products found in this category.</p>
            </div>
          ) : null}
        </main>
      </div>

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">Delivery team notes captured per order</h2>
          <div className="process-grid">
            <div className="process-step">
              <div className="step-number">1</div>
              <h3>Cart review</h3>
              <p>Customers confirm the exact fish, quantity, and unit before checkout.</p>
            </div>
            <div className="process-step">
              <div className="step-number">2</div>
              <h3>Address capture</h3>
              <p>County, town, street details, landmarks, and notes are saved for delivery planning.</p>
            </div>
            <div className="process-step">
              <div className="step-number">3</div>
              <h3>M-Pesa request</h3>
              <p>The backend can initiate a Daraja STK push against the order total once credentials are live.</p>
            </div>
            <div className="process-step">
              <div className="step-number">4</div>
              <h3>Operations follow-up</h3>
              <p>Confirmed orders appear in the operations view for preparation and dispatch tracking.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
