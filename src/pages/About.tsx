import FoundersSection from '../components/FoundersSection'
import './About.css'

export default function About() {
  return (
    <div className="about">
      <div className="about-header">
        <div className="container">
          <h1>About Victoria Fresh Fish</h1>
          <p>Quality, freshness, and sustainability in every catch</p>
        </div>
      </div>

      <section className="section">
        <div className="container about-content">
          <div className="about-section">
            <h2>Our Story</h2>
            <p>
              Victoria Fresh Fish Kenya was founded with a mission to bring the finest, freshest fish from 
              Lake Victoria directly to your table. We work with local fishing communities to ensure sustainable 
              practices while providing premium quality products.
            </p>
            <p>
              For years, we've been dedicated to supporting local fishermen and delivering exceptional quality 
              to families and businesses across Kenya.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Mission</h2>
            <p>
              To be the most trusted source of fresh, high-quality fish products in Kenya while supporting 
              sustainable fishing practices and empowering local fishing communities.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Values</h2>
            <ul className="values-list">
              <li>
                <strong>Quality First:</strong> We guarantee premium, fresh fish in every delivery
              </li>
              <li>
                <strong>Sustainability:</strong> We protect Lake Victoria's ecosystem for future generations
              </li>
              <li>
                <strong>Community Support:</strong> We work directly with local fishermen for fair practices
              </li>
              <li>
                <strong>Customer Care:</strong> Your satisfaction is our top priority with 24/7 support
              </li>
              <li>
                <strong>Transparency:</strong> Full traceability from lake to table
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Founders Section */}
      <FoundersSection />

      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">Why Our Customers Trust Us</h2>
          <div className="trust-grid">
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>Fresh Daily</h3>
              <p>Direct from Lake Victoria fisheries to your home, never more than 24 hours from catch</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>Quality Certified</h3>
              <p>All products meet Kenya Bureau of Standards (KEBS) and health regulations</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>Expert Handling</h3>
              <p>Professional handling and cold chain management ensures optimal freshness</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>Reliable Delivery</h3>
              <p>Fast delivery throughout Kenya with temperature-controlled packaging</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>Competitive Pricing</h3>
              <p>Direct sourcing means fair prices without middleman markups</p>
            </div>
            <div className="trust-card">
              <span className="trust-icon">✓</span>
              <h3>24/7 Support</h3>
              <p>Dedicated customer service team ready to help anytime, anywhere</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title text-center">Our Fish Varieties</h2>
          <div className="varieties-grid">
            <div className="variety-card">
              <h3>🐟 Tilapia</h3>
              <p>Mild flavor, versatile preparation methods. Perfect for grilling, frying, or steaming.</p>
            </div>
            <div className="variety-card">
              <h3>🐠 Samaki (Perch)</h3>
              <p>Tender white flesh, delicate taste. Ideal for steaming and traditional dishes.</p>
            </div>
            <div className="variety-card">
              <h3>🐟 Nduma (Catfish)</h3>
              <p>Rich flavor, firm texture. Perfect for soups, stews, and traditional recipes.</p>
            </div>
            <div className="variety-card">
              <h3>🐟 Omena (Sardines)</h3>
              <p>Small, nutritious fish rich in calcium. Great for daily meals and traditional recipes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container">
          <h2>Join Our Growing Community</h2>
          <p>Experience the difference of genuinely fresh fish. Order now and taste the quality!</p>
          <a href="/products" className="btn btn-secondary btn-lg">Browse Products</a>
        </div>
      </section>
    </div>
  )
}
