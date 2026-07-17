import { useState } from 'react'
import ProductCard from '../components/ProductCard'
import { productCategories, allProducts } from '../data/products'
import { Product } from '../types'
import './Products.css'

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredProducts = selectedCategory === 'all' 
    ? allProducts 
    : productCategories.find(cat => cat.id === selectedCategory)?.products || []

  const handleAddToCart = (product: Product) => {
    console.log('Added to cart:', product)
  }

  return (
    <div className="products">
      <div className="products-header">
        <div className="container">
          <h1>Our Products</h1>
          <p>Premium fresh fish and seafood products from Lake Victoria</p>
        </div>
      </div>

      <div className="container products-content">
        {/* Filters */}
        <aside className="filters">
          <h3>Filter by Type</h3>
          <div className="filter-options">
            <button
              className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Products
            </button>
            {productCategories.map(category => (
              <button
                key={category.id}
                className={`filter-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Products Grid */}
        <main className="products-grid">
          <div className="products-count">
            <h2>
              {selectedCategory === 'all' 
                ? 'All Products' 
                : productCategories.find(cat => cat.id === selectedCategory)?.label
              }
            </h2>
            <span className="count">{filteredProducts.length} products</span>
          </div>

          <div className="grid grid-4">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))
            ) : (
              <div className="no-products">
                <p>No products found in this category</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Product Info Section */}
      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">How We Process Your Fish</h2>
          <div className="process-grid">
            <div className="process-step">
              <div className="step-number">1</div>
              <h3>Fresh Catch</h3>
              <p>Direct from Lake Victoria fishermen. Cold stored within hours of catch.</p>
            </div>
            <div className="process-step">
              <div className="step-number">2</div>
              <h3>Quality Check</h3>
              <p>Every fish inspected for freshness and quality. Standards certified.</p>
            </div>
            <div className="process-step">
              <div className="step-number">3</div>
              <h3>Processing</h3>
              <p>Clean, fillet, smoke, or cook according to your order requirements.</p>
            </div>
            <div className="process-step">
              <div className="step-number">4</div>
              <h3>Cold Chain</h3>
              <p>Temperature controlled packaging and fast delivery to your door.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
