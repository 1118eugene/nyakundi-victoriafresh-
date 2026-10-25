import { Link } from 'react-router-dom'
import { FormEvent, useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'
import ProductSkeletons from '../components/ProductSkeletons'
import './Home.css'
import { getOptimizedImageSource } from '../utils/imageSource'
import { Product } from '../types'
import { checkDeliveryCoverage, DeliveryCoverage, fetchFeaturedProducts } from '../services/api'
import { useCart } from '../contexts/CartContext'
import { getWhatsAppSupportUrl } from '../services/support'
import { fetchRecentApprovedReviews, PublicReview } from '../services/api'
import StoreInfo from '../components/StoreInfo'

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [cartActionError, setCartActionError] = useState('')
  const [coverageCounty, setCoverageCounty] = useState('')
  const [coverageTown, setCoverageTown] = useState('')
  const [coverage, setCoverage] = useState<DeliveryCoverage | null>(null)
  const [coverageError, setCoverageError] = useState('')
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [approvedReviews, setApprovedReviews] = useState<PublicReview[]>([])
  const { addToCart } = useCart()
  const whatsappSupportUrl = getWhatsAppSupportUrl('Please confirm current fish availability and pricing.')

  async function loadFeaturedProducts() {
    setLoading(true)
    setError('')
    try {
      const response = await fetchFeaturedProducts()
      setFeaturedProducts(response.data)
    } catch {
      setFeaturedProducts([])
      setError('We could not load the current catalogue, prices, or stock. No preview products are shown.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFeaturedProducts()
    void fetchRecentApprovedReviews().then((response) => setApprovedReviews(response.data)).catch(() => setApprovedReviews([]))
  }, [])

  async function checkCoverage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCoverageLoading(true)
    setCoverage(null)
    setCoverageError('')
    try {
      const response = await checkDeliveryCoverage(coverageCounty.trim(), coverageTown.trim())
      setCoverage(response.data)
    } catch (err) {
      setCoverageError(err instanceof Error ? err.message : 'Unable to check delivery coverage right now.')
    } finally {
      setCoverageLoading(false)
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <p className="hero-kicker">Fresh from Lake Victoria to Your Table</p>
            <h1 className="hero-title">Fresh Fish Delivered to Your Doorstep</h1>
            <p className="hero-subtitle">
              Explore Lake Victoria fish, choose a preparation that suits your meal, and order online from our Gikomba Market operation.
            </p>
            <div className="hero-cta">
              <Link to="/products" className="btn btn-primary btn-lg">
                Order Today
              </Link>
              {whatsappSupportUrl ? (
                <a href={whatsappSupportUrl} className="btn btn-outline btn-lg" target="_blank" rel="noreferrer">
                  Message us on WhatsApp
                </a>
              ) : (
                <span className="meal-help-support-unconfigured">WhatsApp support is not configured yet.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="container">
          <div className="meal-guide-heading">
            <p className="meal-guide-kicker">A better way to choose</p>
            <h2 className="section-title">Start with the meal you have in mind</h2>
            <p className="section-subtitle">Pick a style and we’ll take you straight to matching fish in the shop.</p>
          </div>
          <div className="meal-guide-grid">
            <Link className="meal-guide-card" to="/products?category=fresh-whole">
              <img src={getOptimizedImageSource('/images/products/nile-perch-wikimedia.jpg')} alt="" loading="lazy" decoding="async" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Whole fish</span>
                <h3>For a hearty fish meal</h3>
                <p>Browse fresh whole fish and choose the species that suits your table.</p>
                <span className="meal-guide-link">Shop fresh whole fish <span aria-hidden="true">→</span></span>
              </div>
            </Link>
            <Link className="meal-guide-card" to="/products?category=fillet">
              <img src={getOptimizedImageSource('/images/products/pexels-fillet.jpg')} alt="" loading="lazy" decoding="async" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Easy to serve</span>
                <h3>For a quick pan or grill</h3>
                <p>Go straight to fillets for a convenient option for weekday cooking.</p>
                <span className="meal-guide-link">Shop fish fillets <span aria-hidden="true">→</span></span>
              </div>
            </Link>
            <Link className="meal-guide-card" to="/products?category=smoked">
              <img src={getOptimizedImageSource('/images/products/pexels-smoked.jpg')} alt="" loading="lazy" decoding="async" />
              <div className="meal-guide-card-content">
                <span className="meal-guide-tag">Deep, smoky flavour</span>
                <h3>For a taste with character</h3>
                <p>Explore smoked fish and find a bold addition to your next meal.</p>
                <span className="meal-guide-link">Shop smoked fish <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title">How ordering works</h2>
          <div className="process-grid">
            <div className="process-step"><div className="step-number">1</div><h3>Choose</h3><p>Select active products with a confirmed price and enough stock.</p></div>
            <div className="process-step"><div className="step-number">2</div><h3>Checkout</h3><p>Enter your name, Kenyan phone number and delivery address as a guest or while signed in.</p></div>
            <div className="process-step"><div className="step-number">3</div><h3>Delivery</h3><p>Follow the private order link for status updates. Coverage and any fee are checked at checkout.</p></div>
            <div className="process-step"><div className="step-number">4</div><h3>Check and pay</h3><p>Check the items meet your expectations, then pay by Cash on Delivery or M-Pesa on delivery as selected.</p></div>
          </div>
          <StoreInfo title="Payment and delivery"><p>No upfront payment is required for these checkout methods. Delivery fees and available areas are shown after entering a covered location.</p></StoreInfo>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="featured-header">
            <div>
              <h2 className="section-title">Featured Products</h2>
              <p className="section-subtitle">A selection from the current shop catalogue.</p>
            </div>
            <Link to="/products" className="view-all">View all products</Link>
          </div>

          {error ? (
            <div className="home-recovery" role="alert" aria-live="polite">
              <div>
                <strong>Current catalogue unavailable</strong>
                <span>{error}</span>
              </div>
              <div className="home-recovery-actions">
                <button className="btn btn-outline btn-sm" type="button" onClick={() => void loadFeaturedProducts()} disabled={loading}>
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

          {loading ? <ProductSkeletons /> : null}
          {!loading && !error && featuredProducts.length === 0 ? (
            <div className="home-catalogue-empty">
              <p>No confirmed featured products are currently available.</p>
            </div>
          ) : null}
          {!loading && featuredProducts.length > 0 ? (
            <div className="grid grid-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(product) => {
                  const addError = addToCart(product)
                  setCartActionError(addError || '')
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section-light home-delivery-checker">
        <div className="container">
          <div className="meal-guide-heading">
            <p className="meal-guide-kicker">Plan your delivery</p>
            <h2 className="section-title">Check your service area</h2>
            <p className="section-subtitle">Coverage and delivery terms are shown only for areas configured by our team.</p>
          </div>
          <form className="home-delivery-form" onSubmit={(event) => void checkCoverage(event)}>
            <label>County<input value={coverageCounty} onChange={(event) => setCoverageCounty(event.target.value)} maxLength={100} required /></label>
            <label>Town or city<input value={coverageTown} onChange={(event) => setCoverageTown(event.target.value)} maxLength={100} required /></label>
            <button className="btn btn-primary" type="submit" disabled={coverageLoading}>{coverageLoading ? 'Checking…' : 'Check availability'}</button>
          </form>
          {coverageError ? <p className="status-message error" role="alert">{coverageError}</p> : null}
          {coverage?.covered ? (
            <p className="home-delivery-result" role="status">
              Delivery is configured for {coverage.name}. Fee: KES {coverage.fee?.toLocaleString()}; minimum order: KES {coverage.minimumOrder?.toLocaleString()}.
              {coverage.deliveryWindows?.length ? ` Windows: ${coverage.deliveryWindows.join(', ')}.` : ''}
              {coverage.cutoffAt ? ` Cut-off: ${coverage.cutoffAt}.` : ''}
            </p>
          ) : null}
          {coverage && !coverage.covered ? (
            <p className="home-delivery-result" role="status">
              Delivery is not currently configured for that location. {whatsappSupportUrl
                ? <a href={whatsappSupportUrl} target="_blank" rel="noreferrer">Ask us on WhatsApp about availability.</a>
                : <Link to="/contact">Contact the team to ask about availability.</Link>}
            </p>
          ) : null}
        </div>
      </section>

      {approvedReviews.length ? <section className="section" aria-labelledby="home-reviews-title">
        <div className="container">
          <h2 className="section-title" id="home-reviews-title">Customer reviews</h2>
          <div className="home-review-grid">
            {approvedReviews.map((review) => <article className="home-review-card" key={review.id}>
              <p><strong>{review.rating} / 5</strong>{review.verifiedPurchase ? ' · Verified purchase' : ''}</p>
              <h3>{review.productName}</h3>{review.title ? <h4>{review.title}</h4> : null}
              {review.comment ? <p>{review.comment}</p> : null}
              <span>{review.customerName}</span>
            </article>)}
          </div>
          <Link to="/products" className="btn btn-outline">Browse reviewed products</Link>
        </div>
      </section> : null}

      <section className="meal-help">
        <div className="container meal-help-content">
          <div>
            <p className="meal-guide-kicker">Personal help, one message away</p>
            <h2>Not sure which fish to choose?</h2>
            <p>Tell us what you’re planning to cook and our team can help you explore the available options.</p>
          </div>
          {whatsappSupportUrl ? (
            <a className="btn btn-primary btn-lg" href={whatsappSupportUrl} target="_blank" rel="noreferrer">
              Ask us on WhatsApp <span aria-hidden="true">→</span>
            </a>
          ) : (
            <span className="meal-help-support-unconfigured">WhatsApp support is not configured yet.</span>
          )}
        </div>
      </section>
    </div>
  )
}
