import FoundersSection from '../components/FoundersSection'
import './About.css'

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
              Victoria Fresh Fish Kenya is a trusted online fish supplier dedicated to delivering fresh,
              high-quality fish sourced directly from Lake Victoria. Based in Gikomba Market, Nairobi, we supply
              households, hotels, restaurants, supermarkets, schools, hospitals, and businesses.
            </p>
            <p>
              Our mission is to make buying fish simple, convenient, and reliable through online ordering and fast
              delivery. Every order is handled with care so customers receive hygienically handled fish at an
              affordable price.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Vision</h2>
            <p>
              To become Kenya's leading online fresh fish supplier, recognized for quality, affordability,
              reliability, and excellent customer service.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Mission</h2>
            <p>
              To provide fresh, healthy, and affordable fish while creating a convenient online shopping
              experience and supporting local fishing communities.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Core Values</h2>
            <ul className="values-list">
              <li>Freshness</li>
              <li>Quality</li>
              <li>Integrity</li>
              <li>Customer Satisfaction</li>
              <li>Reliability</li>
              <li>Affordable Pricing</li>
              <li>Fast Delivery</li>
            </ul>
          </div>

          <div className="about-section">
            <h2>What We Sell</h2>
            <ul className="values-list">
              <li>Nile Perch (Mbuta)</li>
              <li>Tilapia</li>
              <li>Catfish (Nduma)</li>
              <li>Omena</li>
              <li>Fish fillets and steaks</li>
              <li>Smoked and whole fish</li>
              <li>Fish heads and frames</li>
            </ul>
          </div>

          <div className="about-section">
            <h2>Why Choose Us?</h2>
            <ul className="values-list">
              <li>Fresh fish sourced daily from Lake Victoria</li>
              <li>Affordable wholesale and retail prices</li>
              <li>Hygienically cleaned and packaged</li>
              <li>Reliable delivery and friendly support</li>
              <li>Secure payment options and easy online ordering</li>
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
