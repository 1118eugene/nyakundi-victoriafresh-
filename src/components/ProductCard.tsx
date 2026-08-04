import { Product } from '../types'
import './ProductCard.css'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div className="product-card">
      <div className="product-image">
        {product.image ? (
          <img src={product.image} alt={`${product.name} - ${product.preparation}`} loading="lazy" />
        ) : (
          <div className="product-placeholder">
            <span>Verified image upload pending</span>
            <strong>{product.species}</strong>
          </div>
        )}
        {product.inStock ? (
          <span className="badge badge-success">Available</span>
        ) : (
          <span className="badge badge-danger">Out of Stock</span>
        )}
      </div>

      <div className="product-content">
        <div className="product-header">
          <h3 className="product-name">{product.name}</h3>
          <span className="product-category">{product.preparation}</span>
        </div>

        <p className="product-description">{product.description}</p>
        <p className="product-meta">{product.species} • Sold per {product.unit}</p>

        <div className="product-footer">
          <div className="product-price">
            <span className="currency">KES</span>
            <span className="price">{product.price.toLocaleString()}</span>
            <span className="unit">/{product.unit}</span>
          </div>
          {product.inStock && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onAddToCart?.(product)}
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
