import FoundersSection from '../components/FoundersSection'
import './About.css'
import StoreInfo from '../components/StoreInfo'

export default function About() {
  return (
    <div className="about">
      <div className="about-header">
        <div className="container">
          <h1>About Victoria Fresh Fish</h1>
          <p>Fresh from Lake Victoria to Your Table.</p>
        </div>
      </div>

      <section className="section">
        <div className="container about-content">
          <div className="about-section">
            <h2>About Victoria Fresh Fish Kenya</h2>
            <p>
              Victoria Fresh Fish Kenya&apos;s website offers fish and seafood products, cooked-food options, and fish-processing services in its online catalogue. The project identifies Gikomba Market in Nairobi as the business base.
            </p>
            <p>
              Customers can browse the catalogue, check current product details, and place an order through guest checkout or an account. Delivery availability and fees depend on the areas configured at checkout.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Vision</h2>
            <p>
              The website is designed to make product selection, checkout, payment-on-delivery and order tracking available in one place.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Mission</h2>
            <p>
              The catalogue includes products and services across fresh whole fish, fillet, dried, smoked, small-fish, coastal seafood, ready-to-eat and fish-processing categories.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Core Values</h2>
            <ul className="values-list">
              <li>Clear catalogue details</li>
              <li>Guest checkout</li>
              <li>Cash on Delivery or M-Pesa on delivery</li>
              <li>Order status tracking</li>
              <li>Customer feedback reviewed by the team</li>
            </ul>
          </div>

          <div className="about-section">
            <h2>What We Sell</h2>
            <ul className="values-list">
              <li>Fresh whole fish, fillets, dried and smoked items</li>
              <li>Small fish and coastal seafood</li>
              <li>Ready-to-eat meals</li>
              <li>Fish-processing services</li>
            </ul>
          </div>

          <StoreInfo title="Availability and pricing"><p>The active catalogue is the source for current prices and stock. Some items may show “Price to be confirmed” or “Out of stock” and cannot be ordered until they are available for purchase.</p></StoreInfo>
        </div>
      </section>

      <FoundersSection />

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">Operations Flow</h2>
          <div className="trust-grid">
            <div className="trust-card">
              <span className="trust-icon">01</span>
              <h3>Catalog</h3>
              <p>Verified products are seeded into the database and loaded by the frontend through the API.</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">02</span>
              <h3>Checkout</h3>
              <p>Customer contact details, delivery location, and route notes are stored with every order.</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">03</span>
              <h3>Payment</h3>
              <p>Checkout supports Cash on Delivery and M-Pesa on delivery when the payment option is available for the order.</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">04</span>
              <h3>Dispatch</h3>
              <p>Operations can open the live order list and prepare deliveries based on saved county and address data.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
