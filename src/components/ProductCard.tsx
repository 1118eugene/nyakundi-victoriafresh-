import { Product } from '../types'
import './ProductCard.css'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const speciesImages: Record<Product['category'], string> = {
    tilapia: '/images/products/fresh-tilapia.jpg',
    samaki: '/images/products/fresh-nile-perch.jpg',
    nduma: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Catfish.jpg/1280px-Catfish.jpg',
    omena: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Selling_Omena.jpg/1280px-Selling_Omena.jpg',
    other: product.image,
  }

  return (
    <div className="product-card">
      <div className="product-image">
        <img src={speciesImages[product.category]} alt={product.name} loading="lazy" />
        {product.inStock ? (
          <span className="badge badge-success">In Stock</span>
        ) : (
          <span className="badge badge-danger">Out of Stock</span>
        )}
      </div>

      <div className="product-content">
        <div className="product-header">
          <h3 className="product-name">{product.name}</h3>
          <span className="product-category">{product.category}</span>
        </div>

        <p className="product-description">{product.description}</p>

        <div className="product-footer">
          <div className="product-price">
            <span className="currency">KES</span>
            <span className="price">{product.price.toLocaleString()}</span>
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
