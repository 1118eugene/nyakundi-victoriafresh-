import './Contact.css'

export default function Contact() {
  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="container">
          <p className="contact-kicker">Victoria Fresh Fish Kenya</p>
          <h1>Talk to our fresh-fish team</h1>
          <p>Order Lake Victoria fish, ask about availability, or arrange delivery.</p>
        </div>
      </section>
      <section className="section">
        <div className="container contact-grid">
          <a className="contact-card" href="tel:+25470346012"><span>Call David</span><strong>+254 703 460 12</strong></a>
          <a className="contact-card" href="tel:+254117224696"><span>Call Moses</span><strong>+254 117 224 696</strong></a>
          <a className="contact-card" href="mailto:info@victoriafreshfish.co.ke"><span>Email us</span><strong>info@victoriafreshfish.co.ke</strong></a>
          <a className="contact-card" href="https://wa.me/254117224696" target="_blank" rel="noreferrer"><span>WhatsApp Moses</span><strong>Message us now</strong></a>
        </div>
      </section>
      <section className="section section-light">
        <div className="container">
          <h2 className="section-title text-center">Visit us</h2>
          <p className="text-center">Gikomba Market, Nairobi, Kenya</p>
          <p className="text-center">For bulk and wholesale orders throughout Kenya, contact Moses or David directly.</p>
        </div>
      </section>
    </div>
  )
}
