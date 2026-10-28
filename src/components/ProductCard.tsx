import { Product } from '../types'
import ProductGallery from './ProductGallery'
import { canPurchaseProduct, purchaseBlockReason } from '../contexts/cartUtils'
import './ProductCard.css'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
  displayName?: string
  onViewProduct?: () => void
}

export default function ProductCard({ product, onAddToCart, displayName, onViewProduct }: ProductCardProps) {
  const purchasable = canPurchaseProduct(product)
  const unavailableReason = purchaseBlockReason(product)
  return (
    <div className="product-card">
      <div className="product-image">
        <ProductGallery product={product} />
        <div className="product-status-badges" aria-label="Product availability">
          {product.active !== false && product.quantity < 1 ? <span className="badge badge-danger">Out of stock</span> : null}
          {product.active !== false && product.quantity > 0 && !product.inStock ? <span className="badge badge-danger">Currently unavailable</span> : null}
          {unavailableReason === 'Price to be confirmed' ? <span className="badge badge-pending">Price to be confirmed</span> : null}
        </div>
      </div>

      <div className="product-content">
        <div className="product-header">
          <div className="product-heading-row">
            <h3 className="product-name">{displayName || product.name}</h3>
            <div className="product-price" aria-label={product.priceConfirmed && product.price !== null && product.price > 0
              ? `KES ${product.price.toLocaleString()} per ${product.unit}`
              : 'Price to be confirmed'}>
              {product.priceConfirmed && product.price !== null && product.price > 0 ? (
                <>
                  <span className="currency">KES</span>
                  <span className="price">{product.price.toLocaleString()}</span>
                  <span className="unit">/{product.unit}</span>
                </>
              ) : (
                <span className="product-pending-price">Price to be confirmed</span>
              )}
            </div>
          </div>
          <span className="product-category">{product.preparation}</span>
        </div>

        <p className="product-description">{product.description}</p>
        <p className="product-meta">{product.sizeLabel ? `${product.sizeLabel} · ` : ''}Sold per {product.unit}</p>
        {product.rating ? (
          <p className="product-meta" aria-label={product.rating.count
            ? `Rated ${product.rating.average} out of 5 from ${product.rating.count} reviews`
            : 'No approved reviews yet'}>
            {product.rating.count
              ? `${product.rating.average} / 5 · ${product.rating.count} ${product.rating.count === 1 ? 'review' : 'reviews'}`
              : 'No reviews yet'}
          </p>
        ) : null}
        {product.priceUpdatedAt ? <p className="product-price-updated">Price updated on {new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi' }).format(new Date(product.priceUpdatedAt))}</p> : null}

        <div className="product-footer">
          <div className="product-actions">
            {onViewProduct ? <button className="btn btn-outline btn-sm" onClick={onViewProduct}>View Product</button> : null}
            {onAddToCart ? (
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={!purchasable}
                aria-label={purchasable ? `Add ${product.name} to cart` : `${unavailableReason}: ${product.name}`}
                onClick={() => onAddToCart(product)}
              >
                {purchasable ? 'Add to Cart' : unavailableReason}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
