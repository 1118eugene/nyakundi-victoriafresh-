import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import './Products.css'
import { FishPreparation, Product } from '../types'
import { fetchProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'
import { fallbackProducts } from '../data/fallbackProducts'

const categoryOptions = [
  { value: 'all', label: 'All preparations' },
  { value: 'fresh-whole', label: 'Fresh whole fish' },
  { value: 'fillet', label: 'Fillets' },
  { value: 'steak', label: 'Fish steaks' },
  { value: 'heads', label: 'Fish heads' },
  { value: 'frames', label: 'Fish frames' },
  { value: 'smoked', label: 'Smoked fish' },
  { value: 'dried', label: 'Dried fish' },
  { value: 'omena-packets', label: 'Omena packets' },
  { value: 'ready-to-eat', label: 'Cooked & ready' },
]

export default function Products() {
  const [searchParams] = useSearchParams()
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>(() =>
    categoryOptions.find((category) => category.value === searchParams.get('category'))?.value || 'all',
  )
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFish, setSelectedFish] = useState<string | null>(null)
  const [selectedPreparation, setSelectedPreparation] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [cartActionError, setCartActionError] = useState('')
  const { addToCart } = useCart()

  async function loadProducts(category = selectedCategory, isActive = () => true) {
    setLoading(true)
    setError('')

    try {
      const response = await fetchProducts(category)
      if (isActive()) setProducts(response.data)
    } catch {
      if (isActive()) {
        setProducts(category === 'all' ? fallbackProducts : fallbackProducts.filter((product) => product.category === category))
        setError('Live prices and stock are temporarily unavailable.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadProducts(selectedCategory, () => active)
    return () => { active = false }
  }, [selectedCategory])

  const fishGroups = products.reduce<Record<string, Product[]>>((groups, product) => {
    groups[product.species] = [...(groups[product.species] || []), product]
    return groups
  }, {})
  const speciesOrder = ['Tilapia', 'Nile Perch (Mbuta)', 'Catfish (Nduma)', 'Omena']
  const matchesSearch = (product: Product) => {
    const searchable = `${product.species} ${product.name} ${product.preparation} ${product.description}`.toLowerCase()
    return searchable.includes(search.trim().toLowerCase())
  }
  const visibleGroups = speciesOrder
    .filter((species) => selectedSpecies === 'all' || selectedSpecies === species)
    .map((species) => ({ species, products: (fishGroups[species] || []).filter(matchesSearch) }))
    .filter((group) => group.products.length > 0)
  const activeProducts = selectedFish ? fishGroups[selectedFish] || [] : []
  const preparations: FishPreparation[] = [...new Map(activeProducts.map((product) => [product.preparation, product])).values()]
    .map((product) => ({ type: product.preparation, price: product.price, product }))
  const selectedProduct = preparations.find((preparation) => preparation.type === selectedPreparation)?.product || preparations[0]?.product

  const openFish = (species: string) => {
    const options = fishGroups[species] || []
    setSelectedFish(species)
    setSelectedPreparation(options[0]?.preparation || '')
    setQuantity(1)
  }

  const addSelectedToCart = () => {
    if (!selectedProduct) return
    if (error) {
      setCartActionError('The live catalogue is unavailable. Preview products cannot be added until prices and stock reconnect.')
      return
    }
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
          <h1>Choose Your Fish</h1>
          <p>Fresh Lake Victoria fish, prepared your way and delivered from Gikomba Market to your table.</p>
        </div>
      </div>

      <div className="container products-content">
        <aside className="filters">
          <label className="search-label" htmlFor="fish-search">Search fish or preparation</label>
          <input id="fish-search" className="search-input" type="search" placeholder="Try Mbuta, grilled, or omena" value={search} onChange={(event) => setSearch(event.target.value)} />
          <h3>Browse fish</h3>
          <div className="filter-options">
            <button
              className={`filter-btn ${selectedSpecies === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedSpecies('all')}
            >
              All
            </button>
            {speciesOrder.map((species) => (
              <button
                key={species}
                className={`filter-btn ${selectedSpecies === species ? 'active' : ''}`}
                onClick={() => setSelectedSpecies(species)}
              >
                {species.replace(' (', ' / ').replace(')', '')}
              </button>
            ))}
          </div>
          <h3>Browse by preparation</h3>
          <div className="filter-options">
            {categoryOptions.map((category) => (
              <button
                key={category.value}
                className={`filter-btn ${selectedCategory === category.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="products-grid">
          <div className="products-count">
            <h2>{selectedSpecies === 'all' ? 'All Fish' : selectedSpecies}</h2>
            <span className="count">{error ? 'Preview catalogue' : `${visibleGroups.length} fish`}</span>
          </div>

          {loading ? <p className="status-message">Loading products...</p> : null}
          {error ? (
            <div className="catalogue-recovery" role="status">
              <div>
                <span className="recovery-kicker">Preview catalogue</span>
                <h3>Browse fish while live prices reconnect</h3>
                <p>{error} Preview items cannot be purchased until current pricing and availability are confirmed.</p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => void loadProducts()} disabled={loading}>Try again</button>
            </div>
          ) : null}
          {cartActionError ? <p className="status-message error" role="alert">{cartActionError}</p> : null}

          <div className="grid grid-4">
            {!loading && visibleGroups.length > 0 ? (
              visibleGroups.map(({ species, products: groupProducts }) => {
                const product = groupProducts.find((item) => item.preparation === 'Fresh') || groupProducts[0]
                return (
                <ProductCard
                  key={species}
                  product={product}
                  displayName={species}
                  previewOnly={Boolean(error)}
                  onViewProduct={() => openFish(species)}
                  onAddToCart={error ? undefined : () => openFish(species)}
                />
                )
              })
            ) : null}
          </div>

          {!loading && !error && visibleGroups.length === 0 ? (
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

      {selectedFish && selectedProduct ? (
        <div className="product-modal-backdrop" role="presentation" onClick={() => setSelectedFish(null)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close product details" onClick={() => setSelectedFish(null)}>×</button>
            {selectedProduct.image ? (
              <img src={selectedProduct.image} alt={`${selectedProduct.preparation} fish product photo`} className="modal-image" />
            ) : (
              <div
                className="modal-image product-placeholder"
                role="img"
                aria-label={`${selectedProduct.species} ${selectedProduct.preparation} photo coming soon`}
              >
                <span>Authentic product photo coming soon</span>
                <strong>{selectedProduct.species} · {selectedProduct.preparation}</strong>
              </div>
            )}
            <div className="modal-content">
              <p className="product-kicker">Lake Victoria selection</p>
              <h2 id="product-modal-title">{selectedFish}</h2>
              <p>Choose your preferred preparation, then set the quantity before adding it to your cart.</p>
              <div className="preparation-options">
                {preparations.map((preparation) => (
                  <button key={preparation.type} className={`preparation-option ${selectedPreparation === preparation.type ? 'active' : ''}`} onClick={() => setSelectedPreparation(preparation.type)}>
                    <span>{preparation.type}</span>
                    {!error ? <strong>KES {preparation.price.toLocaleString()}</strong> : null}
                  </button>
                ))}
              </div>
              {error ? (
                <p className="product-preview-note">Current prices and availability will appear when the live catalogue reconnects.</p>
              ) : (
                <div className="quantity-row">
                  <label htmlFor="fish-quantity">Quantity</label>
                  <input id="fish-quantity" type="number" min="1" max={Math.min(selectedProduct.quantity, 100)} step="1" value={quantity} aria-invalid={!Number.isInteger(quantity) || quantity < 1 || quantity > selectedProduct.quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  <span>Available: {selectedProduct.quantity}</span>
                </div>
              )}
              {cartActionError ? <p className="status-message error" role="alert">{cartActionError}</p> : null}
              {!error ? (
                <button className="btn btn-secondary btn-lg modal-add" type="button" onClick={addSelectedToCart} disabled={!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(selectedProduct.quantity, 100)}>
                  Add to Cart · KES {(selectedProduct.price * (Number.isFinite(quantity) ? quantity : 0)).toLocaleString()}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
