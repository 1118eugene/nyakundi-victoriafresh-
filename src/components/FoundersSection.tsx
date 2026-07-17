import './FoundersSection.css'

export default function FoundersSection() {
  return (
    <section className="section section-light">
      <div className="container">
        <h2 className="section-title text-center">Meet Our Founders</h2>
        <p className="section-subtitle text-center">
          Dedicated to bringing Lake Victoria's finest fish to your table
        </p>

        <div className="founders-grid">
          {/* Founder 1 - Moses Odiwuor Nyakundi */}
          <div className="founder-card">
            <div className="founder-image">
              <img
                src="/images/moses.jpg"
                alt="Moses Odiwuor Nyakundi - Founder"
              />
              <div className="founder-badge">Founder & CEO</div>
            </div>
            <div className="founder-content">
              <h3>Moses Odiwuor Nyakundi</h3>
              <p className="founder-role">Founder & CEO</p>
              <p className="founder-bio">
                With over 15 years of experience in the fishing industry, Moses leads Victoria Fresh Fish 
                with a vision of sustainable fishing and premium quality. His passion for excellence and 
                commitment to supporting local fishermen drives our mission.
              </p>
              <p className="founder-contact"><a href="tel:+254117224696">Call Moses: +254 117 224 696</a></p>
              <div className="founder-skills">
                <span className="skill">Business Strategy</span>
                <span className="skill">Sustainability</span>
                <span className="skill">Community Relations</span>
              </div>
            </div>
          </div>

          {/* Founder 2 - David Odhiambo */}
          <div className="founder-card">
            <div className="founder-image">
              <img
                src="/images/david.jpg"
                alt="David Odhiambo - Co-Founder"
              />
              <div className="founder-badge">Co-Founder</div>
            </div>
            <div className="founder-content">
              <h3>David Odhiambo</h3>
              <p className="founder-role">Co-Founder & Operations Lead</p>
              <p className="founder-bio">
                David brings expertise in supply chain management and logistics, ensuring every fish reaches 
                customers in perfect condition. His operational excellence and innovation in cold chain 
                technology have made Victoria Fresh Fish a trusted name.
              </p>
              <p className="founder-contact"><a href="tel:+25470346012">Call David: +254 703 460 12</a></p>
              <div className="founder-skills">
                <span className="skill">Logistics</span>
                <span className="skill">Quality Control</span>
                <span className="skill">Innovation</span>
              </div>
            </div>
          </div>
        </div>

        <div className="founders-vision">
          <h3>Our Shared Vision</h3>
          <p>
            Together, Moses and David are committed to transforming the fresh fish industry in Kenya by 
            ensuring quality, sustainability, and fair practices. We believe that the finest fish deserves 
            the finest care, from lake to your table.
          </p>
        </div>
      </div>
    </section>
  )
}
