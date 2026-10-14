import './Footer.css'
import { getSupportEmail, getSupportPhone, getWhatsAppSupportUrl } from '../services/support'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const phone = getSupportPhone()
  const email = getSupportEmail()
  const whatsapp = getWhatsAppSupportUrl('I need help with a Victoria Fresh Fish order.')

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Victoria Fresh Fish</h3>
            <p>Fresh Lake Victoria fish, handled with care from the lake to your table.</p>
            <div className="social-links" aria-label="Contact Victoria Fresh Fish">
              {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
              {email ? <a href={`mailto:${email}`}>Email us</a> : null}
              <a href="/contact">Support request</a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://www.instagram.com/victoriafreshfishke/" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.tiktok.com/@victoriafreshfishke" target="_blank" rel="noreferrer">TikTok</a>
              <a href="https://x.com/VictoriaFishKE" target="_blank" rel="noreferrer">X</a>
            </div>
            <p className="social-note">Follow Victoria Fresh Fish Kenya on Facebook, Instagram, TikTok, and X.</p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/products">Products</a></li>
              <li><a href="/wholesale">Wholesale Orders</a></li>
              <li><a href="/order-online">Order Online</a></li>
              <li><a href="/delivery">Delivery</a></li>
              <li><a href="/faq">FAQ</a></li>
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
            {phone ? <p><a href={`tel:${phone}`}>Call {phone}</a></p> : <p>Phone support is not configured.</p>}
            {email ? <p><a href={`mailto:${email}`}>{email}</a></p> : null}
            <p><a href="/contact">Contact support</a></p>
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
