import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'
import './Products.css'
import { FishPreparation, Product } from '../types'
import { fetchProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'

export default function Products() {
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFish, setSelectedFish] = useState<string | null>(null)
  const [selectedPreparation, setSelectedPreparation] = useState('')
  const [quantity, setQuantity] = useState(1)
  const { addToCart } = useCart()

  useEffect(() => {
    setLoading(true)
    setError('')

    fetchProducts('all')
      .then((response) => {
        setProducts(response.data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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
    for (let index = 0; index < quantity; index += 1) addToCart(selectedProduct)
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
        </aside>

        <main className="products-grid">
          <div className="products-count">
            <h2>{selectedSpecies === 'all' ? 'All Fish' : selectedSpecies}</h2>
            <span className="count">{visibleGroups.length} fish</span>
          </div>

          {loading ? <p className="status-message">Loading products...</p> : null}
          {error ? <p className="status-message error">{error}</p> : null}

          <div className="grid grid-4">
            {!loading && visibleGroups.length > 0 ? (
              visibleGroups.map(({ species, products: groupProducts }) => {
                const product = groupProducts.find((item) => item.preparation === 'Fresh') || groupProducts[0]
                return (
                <ProductCard
                  key={species}
                  product={product}
                  displayName={species}
                  onViewProduct={() => openFish(species)}
                  onAddToCart={() => openFish(species)}
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
            <img src={selectedProduct.image} alt={selectedFish} className="modal-image" />
            <div className="modal-content">
              <p className="product-kicker">Lake Victoria selection</p>
              <h2 id="product-modal-title">{selectedFish}</h2>
              <p>Choose your preferred preparation, then set the quantity before adding it to your cart.</p>
              <div className="preparation-options">
                {preparations.map((preparation) => (
                  <button key={preparation.type} className={`preparation-option ${selectedPreparation === preparation.type ? 'active' : ''}`} onClick={() => setSelectedPreparation(preparation.type)}>
                    <span>{preparation.type}</span><strong>KES {preparation.price.toLocaleString()}</strong>
                  </button>
                ))}
              </div>
              <div className="quantity-row">
                <label htmlFor="fish-quantity">Quantity</label>
                <input id="fish-quantity" type="number" min="1" max={selectedProduct.quantity} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(Number(event.target.value) || 1, selectedProduct.quantity)))} />
                <span>Available: {selectedProduct.quantity}</span>
              </div>
              <button className="btn btn-secondary btn-lg modal-add" onClick={addSelectedToCart}>Add to Cart · KES {(selectedProduct.price * quantity).toLocaleString()}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
