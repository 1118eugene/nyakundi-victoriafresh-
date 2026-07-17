import './Footer.css'

const contact = {
  david: '+25470346012',
  moses: '+254117224696',
  email: 'info@victoriafreshfish.ke',
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Victoria Fresh Fish</h3>
            <p>Fresh Lake Victoria fish, handled with care from the lake to your table.</p>
            <div className="social-links" aria-label="Contact Victoria Fresh Fish">
              <a href={`https://wa.me/${contact.moses.slice(1)}`} target="_blank" rel="noreferrer">WhatsApp</a>
              <a href={`mailto:${contact.email}`}>Email us</a>
            </div>
            <p className="social-note">Official Facebook, Instagram and TikTok pages will be linked here once the accounts are verified.</p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/products">Products</a></li>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Fish We Supply</h4>
            <ul>
              <li><a href="/products">Tilapia</a></li>
              <li><a href="/products">Nile Perch (Mbuta)</a></li>
              <li><a href="/products">Catfish (Nduma)</a></li>
              <li><a href="/products">Omena</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Contact Us</h4>
            <p>Kisumu, Kenya</p>
            <p><a href={`tel:${contact.david}`}>David: +254 703 460 12</a></p>
            <p><a href={`tel:${contact.moses}`}>Moses: +254 117 224 696</a></p>
            <p><a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          </div>
        </div>

        <div className="footer-divider" />
        <div className="footer-bottom">
          <p>&copy; {currentYear} Victoria Fresh Fish Kenya. All rights reserved.</p>
          <p>Bringing freshness from Lake Victoria to your doorstep</p>
        </div>
      </div>
    </footer>
  )
}
