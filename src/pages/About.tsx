import FoundersSection from '../components/FoundersSection'
import './About.css'

export default function About() {
  return (
    <div className="about">
      <div className="about-header">
        <div className="container">
          <h1>About Victoria Fresh Fish</h1>
          <p>Building a practical fish-ordering and delivery workflow for real customers in Kenya.</p>
        </div>
      </div>

      <section className="section">
        <div className="container about-content">
          <div className="about-section">
            <h2>What this site does now</h2>
            <p>
              The storefront now focuses on a smaller verified catalog, persistent order records, and proper
              delivery capture instead of broad demo content that could mislead customers.
            </p>
            <p>
              Customers can add fish to cart, submit full delivery details, and generate a checkout request that
              operations can review from one place.
            </p>
          </div>

          <div className="about-section">
            <h2>How we handle realism</h2>
            <p>
              Product prices have been adjusted to stay closer to current Kenya market references and common retail
              ranges. Images are only shown when they match the listed fish or preparation.
            </p>
          </div>

          <div className="about-section">
            <h2>What still needs verified business inputs</h2>
            <ul className="values-list">
              <li><strong>M-Pesa go-live credentials:</strong> Safaricom Daraja consumer key, secret, shortcode, passkey, and callback URL.</li>
              <li><strong>Final delivery rules:</strong> exact county pricing, dispatch windows, and cold-chain service radius.</li>
              <li><strong>Verified media:</strong> in-house product photos for catfish, fillets, omena, and family packs.</li>
            </ul>
          </div>
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
              <p>M-Pesa STK push logic is ready for live credentials from the official Safaricom Daraja portal.</p>
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
