import { useState } from 'react'
import { Product } from '../types'
import './ProductCard.css'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
  displayName?: string
  onViewProduct?: () => void
}

export default function ProductCard({ product, onAddToCart, displayName, onViewProduct }: ProductCardProps) {
  const [imageSrc, setImageSrc] = useState(product.image)
  const hasImage = Boolean(imageSrc)

  return (
    <div className="product-card">
      <div className="product-image">
        {hasImage ? (
          <img
            src={imageSrc}
            alt={`${product.preparation} fish product photo`}
            loading="lazy"
            onError={() => setImageSrc('')}
          />
        ) : (
          <div
            className="product-placeholder"
            role="img"
            aria-label={`${product.species} ${product.preparation} photo coming soon`}
          >
            <span>Authentic product photo coming soon</span>
            <strong>{product.species} · {product.preparation}</strong>
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
          <h3 className="product-name">{displayName || product.name}</h3>
          <span className="product-category">{product.preparation}</span>
        </div>

        <p className="product-description">{product.description}</p>
        <p className="product-meta">Sold per {product.unit}</p>
        {product.priceUpdatedAt ? <p className="product-price-updated">Price updated on {new Date(product.priceUpdatedAt).toLocaleDateString('en-KE')}</p> : null}

        <div className="product-footer">
          <div className="product-price">
            <span className="currency">KES</span>
            <span className="price">{product.price.toLocaleString()}</span>
            <span className="unit">/{product.unit}</span>
          </div>
          <div className="product-actions">
            {onViewProduct ? <button className="btn btn-outline btn-sm" onClick={onViewProduct}>View Product</button> : null}
            {product.inStock && onAddToCart ? <button className="btn btn-secondary btn-sm" type="button" onClick={() => onAddToCart(product)}>Add to Cart</button> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
