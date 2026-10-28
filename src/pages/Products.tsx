import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import ProductGallery from '../components/ProductGallery'
import ProductSkeletons from '../components/ProductSkeletons'
import ProductReviews from '../components/ProductReviews'
import StoreInfo from '../components/StoreInfo'
import './Products.css'
import { Product } from '../types'
import { fetchProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'
import { getWhatsAppSupportUrl } from '../services/support'
import { canPurchaseProduct, purchaseBlockReason } from '../contexts/cartUtils'

const speciesOrder = ['Tilapia', 'Nile Perch (Mbuta)', 'Catfish (Nduma)', 'Omena']
const categoryIntros: Record<string, string> = {
  'fresh-whole': 'Whole fish sold by the listed unit. Common preparations include baking, grilling, steaming or pan-cooking, depending on the fish and your recipe.',
  fillet: 'Boneless or portioned fillet products, where listed. Fillets can be pan-cooked, baked or grilled and served with sides of your choice.',
  dried: 'Dried fish and seafood products. Follow the product details and safe-storage guidance; soaking or cooking methods vary by item.',
  smoked: 'Smoked fish products listed in the catalogue. They may be served as-is where appropriate or used in cooked dishes; check the product description.',
  'small-fish': 'Small-fish products in the listed formats. Use the name and description to distinguish dried, frozen and other preparations.',
  'coastal-seafood': 'Seafood items such as prawns, octopus, squid and crab where available. Cooking time and preparation depend on the item.',
  'ready-to-eat': 'Cooked meal and serving options listed in the catalogue. Check availability and serving details before ordering.',
  'fish-processing': 'Fish-preparation services and related add-ons. These entries may require the owner to confirm pricing before they can be ordered.',
}
const categoryLabelsLocal: Record<string, string> = {
  'fresh-whole': 'Fresh whole fish',
  fillet: 'Fillets',
  dried: 'Dried fish and seafood',
  smoked: 'Smoked fish',
  'small-fish': 'Small fish',
  'coastal-seafood': 'Coastal seafood',
  'ready-to-eat': 'Ready to eat',
  'fish-processing': 'Fish processing',
}
const categoryOrder = ['fresh-whole', 'fillet', 'dried', 'smoked', 'small-fish', 'coastal-seafood', 'ready-to-eat', 'fish-processing']

function speciesKey(product: Product) {
  const text = `${product.species} ${product.name}`.toLowerCase()
  if (/\b(omena|dagaa)\b/.test(text)) return 'omena'
  if (/\btilapia\b/.test(text)) return 'tilapia'
  if (/\b(nile perch|mbuta)\b/.test(text)) return 'nile-perch'
  if (/\b(catfish|nduma|mumi)\b/.test(text)) return 'catfish'
  return product.species.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-')
}

interface ProductsProps {
  initialCategory?: string
}

export default function Products({ initialCategory }: ProductsProps) {
  const [searchParams] = useSearchParams()
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>(() => initialCategory || searchParams.get('category') || 'all')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFish, setSelectedFish] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [cartActionError, setCartActionError] = useState('')
  const { addToCart } = useCart()
  const whatsappSupportUrl = getWhatsAppSupportUrl('Please confirm current fish availability and pricing.')
  const readyMealSupportUrl = getWhatsAppSupportUrl('Please confirm today’s cooked menu, side options, dine-in or takeaway availability, location, and opening hours.')

  async function loadProducts(isActive = () => true) {
    setLoading(true)
    setError('')
    setProducts([])

    try {
      const response = await fetchProducts('all')
      if (isActive()) {
        setCategories(response.filters?.categories || {})
        setProducts(response.data)
      }
    } catch {
      if (isActive()) {
        setProducts([])
        setError('We could not load the current catalogue, prices, or stock. No preview products are shown.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadProducts(() => active)
    return () => { active = false }
  }, [])

  useEffect(() => {
    setSelectedCategory(initialCategory || searchParams.get('category') || 'all')
  }, [initialCategory, searchParams])

  const fishGroups = products
    .filter((product) => product.category !== 'ready-to-eat' && product.category !== 'fish-processing')
    .reduce<Record<string, Product[]>>((groups, product) => {
    groups[product.species] = [...(groups[product.species] || []), product]
    return groups
    }, {})
  const availableSpecies = [
    ...speciesOrder.filter((species) => fishGroups[species]),
    ...Object.keys(fishGroups).filter((species) => !speciesOrder.includes(species)).sort(),
  ]
  const matchesSearch = (product: Product) => {
    const searchable = `${product.species} ${product.name} ${product.preparation} ${product.description}`.toLowerCase()
    return searchable.includes(search.trim().toLowerCase())
  }
  const visibleProducts = products.filter((product) => (
    (selectedSpecies === 'all' || product.species === selectedSpecies)
    && (selectedCategory === 'all' || product.category === selectedCategory)
    && matchesSearch(product)
  ))
  const selectedProduct = products.find((product) => product.id === selectedFish)
  const speciesProducts = selectedProduct
    ? products.filter((product) => speciesKey(product) === speciesKey(selectedProduct))
      .sort((first, second) => categoryOrder.indexOf(first.category) - categoryOrder.indexOf(second.category))
    : []
  const categoryOptions = [
    { value: 'all', label: 'All preparations' },
    ...Object.entries(categories).map(([value, label]) => ({ value, label })),
  ]

  const openFish = (product: Product) => {
    setSelectedFish(product.id)
    setQuantity(1)
  }

  const addSelectedToCart = () => {
    if (!selectedProduct) return
    const addError = addToCart(selectedProduct, quantity)
    if (addError) {
      setCartActionError(addError)
      return
    }
    setCartActionError('')
    setSelectedFish(null)
  }

  return (
    <div className="products">
      <div className="products-header">
        <div className="container">
          <h1>{selectedCategory === 'all'
            ? 'Choose from the catalogue'
            : selectedCategory === 'ready-to-eat'
              ? 'Ready-to-eat fish meals'
              : categories[selectedCategory] || categoryLabelsLocal[selectedCategory] || 'Browse the catalogue'}</h1>
          <p>{selectedCategory === 'all'
            ? 'Browse fish, seafood, cooked meals and processing services. Prices and availability are checked again at checkout.'
            : categoryIntros[selectedCategory] || 'Browse the active products in this catalogue category.'}</p>
          {selectedCategory === 'ready-to-eat' ? (
            <div className="ready-meal-service">
              <p>For dine-in or takeaway, ask the team to confirm today’s menu, location and opening hours before travelling.</p>
              {readyMealSupportUrl ? <a className="btn btn-primary" href={readyMealSupportUrl} target="_blank" rel="noreferrer">Ask about dine-in or takeaway</a> : <Link className="btn btn-primary" to="/contact">Contact the team</Link>}
            </div>
          ) : null}
        </div>
      </div>

      <div className="container products-content">
        <aside className="filters">
          <label className="search-label" htmlFor="fish-search">Search fish or preparation</label>
          <input id="fish-search" className="search-input" type="search" placeholder="Try Mbuta, grilled, or omena" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="search-label" htmlFor="fish-species">Filter by species</label>
          <select id="fish-species" className="search-input" value={selectedSpecies} onChange={(event) => setSelectedSpecies(event.target.value)}>
            <option value="all">All products</option>
            {availableSpecies.map((species) => <option key={species} value={species}>{species.replace(' (', ' / ').replace(')', '')}</option>)}
          </select>
          <label className="search-label" htmlFor="fish-preparation">Browse by category</label>
          <select id="fish-preparation" className="search-input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.value === 'all' ? 'All categories' : category.label}</option>)}
          </select>
        </aside>

        <main className="products-grid">
          <div className="products-count">
            <h2>{selectedSpecies === 'all' ? 'All products' : selectedSpecies}</h2>
            <span className="count">{loading ? 'Loading' : error ? 'Unavailable' : `${visibleProducts.length} products`}</span>
          </div>

          {loading ? <ProductSkeletons /> : null}
          {error ? (
            <div className="catalogue-recovery" role="alert" aria-live="polite">
              <div>
                <h3>Current catalogue unavailable</h3>
                <p>{error}</p>
              </div>
              <div className="catalogue-recovery-actions">
                <button className="btn btn-outline btn-sm" type="button" onClick={() => void loadProducts()} disabled={loading}>
                  {loading ? 'Retrying…' : 'Try again'}
                </button>
                {whatsappSupportUrl ? (
                  <a className="btn btn-outline btn-sm" href={whatsappSupportUrl} target="_blank" rel="noreferrer">Ask on WhatsApp</a>
                ) : (
                  <span>WhatsApp support is not configured yet.</span>
                )}
              </div>
            </div>
          ) : null}
          {cartActionError ? <p className="status-message error" role="alert">{cartActionError}</p> : null}

          {!loading && visibleProducts.length > 0 ? (
            <div className="grid grid-4">
              {visibleProducts.map((product) => {
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onViewProduct={() => openFish(product)}
                    onAddToCart={() => openFish(product)}
                  />
                )
              })}
            </div>
          ) : null}

          {!loading && !error && visibleProducts.length === 0 ? (
            <div className="no-products">
              <p>No products are currently available in this category.</p>
            </div>
          ) : null}
        </main>
      </div>

      <section className="section section-light">
        <div className="container">
          <StoreInfo title="Before you add an item">
            <p>Check the product name, unit, confirmed price and stock shown on its card. “Price to be confirmed” products are visible for browsing but cannot be purchased online yet.</p>
          </StoreInfo>
        </div>
      </section>

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">How ordering works</h2>
          <div className="process-grid">
            <div className="process-step">
              <div className="step-number">1</div>
              <h3>Choose your items</h3>
              <p>Compare product details, units, confirmed prices, and availability before adding items to your cart.</p>
            </div>
            <div className="process-step">
              <div className="step-number">2</div>
              <h3>Check out</h3>
              <p>Enter your delivery details and review the order total and delivery fee shown at checkout.</p>
            </div>
            <div className="process-step">
              <div className="step-number">3</div>
              <h3>Choose payment on delivery</h3>
              <p>Select Cash on Delivery or M-Pesa on delivery when placing your order.</p>
            </div>
            <div className="process-step">
              <div className="step-number">4</div>
              <h3>Check and pay</h3>
              <p>Check that the items meet your expectations at delivery, then pay using the selected method.</p>
            </div>
          </div>
        </div>
      </section>

      {selectedFish && selectedProduct ? (
        <div className="product-modal-backdrop" role="presentation" onClick={() => setSelectedFish(null)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close product details" onClick={() => setSelectedFish(null)}>×</button>
            <ProductGallery product={selectedProduct} className="modal-gallery" imageClassName="modal-image" />
            <div className="modal-content">
              <p className="product-kicker">{categories[selectedProduct.category] || categoryLabelsLocal[selectedProduct.category] || selectedProduct.category}</p>
              <h2 id="product-modal-title">{selectedProduct.name}</h2>
              <p>{selectedProduct.description || 'See the selected product name and preparation details.'}</p>
              <p>Unit: {selectedProduct.unit} · Preparation: {selectedProduct.preparation}</p>
              {speciesProducts.length > 1 ? (
                <section className="species-options" aria-label={`More ${selectedProduct.species} options`}>
                  <h3>More ways to get {selectedProduct.species}</h3>
                  <div className="species-option-list">
                    {speciesProducts.map((product) => (
                      <button
                        key={product.id}
                        className={`species-option ${product.id === selectedProduct.id ? 'active' : ''}`}
                        type="button"
                        aria-pressed={product.id === selectedProduct.id}
                        onClick={() => {
                          setSelectedFish(product.id)
                          setQuantity(1)
                          setCartActionError('')
                        }}
                      >
                        <span>
                          <strong>{product.name}</strong>
                          <small>{categories[product.category] || categoryLabelsLocal[product.category] || product.category}</small>
                        </span>
                        <strong>{product.priceConfirmed && product.price !== null && product.price > 0
                          ? `KES ${product.price.toLocaleString()}/${product.unit}`
                          : 'Price to be confirmed'}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className="quantity-row">
                <label htmlFor="fish-quantity">Quantity</label>
                <input id="fish-quantity" type="number" min="1" max={Math.min(selectedProduct.quantity, 100)} step="1" value={quantity} aria-invalid={!Number.isInteger(quantity) || quantity < 1 || quantity > selectedProduct.quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                <span>{purchaseBlockReason(selectedProduct, quantity) || `Available: ${selectedProduct.quantity}`}</span>
              </div>
              {cartActionError ? <p className="status-message error" role="alert">{cartActionError}</p> : null}
              <button className="btn btn-secondary btn-lg modal-add" type="button" onClick={addSelectedToCart} disabled={!canPurchaseProduct(selectedProduct) || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(selectedProduct.quantity, 100)}>
                {canPurchaseProduct(selectedProduct) && selectedProduct.price !== null
                  ? `Add to Cart · KES ${(selectedProduct.price * (Number.isFinite(quantity) ? quantity : 0)).toLocaleString()}`
                  : purchaseBlockReason(selectedProduct, quantity)}
              </button>
              {selectedProduct.rating?.count ? (
                <script type="application/ld+json">
                  {JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    name: selectedProduct.name,
                    category: categories[selectedProduct.category] || categoryLabelsLocal[selectedProduct.category] || selectedProduct.category,
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: selectedProduct.rating.average,
                      reviewCount: selectedProduct.rating.count,
                    },
                  }).replace(/</g, '\\u003c')}
                </script>
              ) : null}
              <details className="product-more-info">
                <summary>Product information and reviews</summary>
                <StoreInfo title="Cooking and serving">
                  <p>{selectedProduct.category === 'fish-processing'
                    ? 'This is a preparation service or related add-on. Confirm the service details with the team before ordering.'
                    : selectedProduct.category === 'ready-to-eat'
                      ? 'This catalogue entry is a cooked meal or serving. Follow any handling directions provided with the order.'
                      : `Common ways to prepare ${selectedProduct.name.toLowerCase()} include baking, grilling or pan-cooking where suitable for the item. Choose a method that fits the product and your recipe.`}</p>
                </StoreInfo>
                <StoreInfo title="Storage and handling">
                  <p>Keep raw fish chilled promptly, keep it separate from ready-to-eat food, and wash hands and utensils after handling. Refrigerate if using soon or freeze for longer storage; follow local food-safety guidance.</p>
                </StoreInfo>
                <ProductReviews productId={selectedProduct.id} />
              </details>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
