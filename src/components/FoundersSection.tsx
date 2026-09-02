import './FoundersSection.css'

const founders = [
  {
    initials: 'MN',
    name: 'Moses Odiwuor Nyakundi',
    role: 'Founder & Managing Director',
    image: '/images/moses nyakundi founder.png',
    bio: 'Moses oversees business strategy, operations, customer relations, and growth while ensuring every customer receives quality products and excellent service.',
    contact: '+254117224696',
    skills: ['Supplier Coordination', 'Pricing', 'Customer Follow-up'],
  },
  {
    initials: 'DO',
    name: 'David Odhiambo',
    role: 'Founder & Managing Director',
    image: '/images/david nyakundi founder.png',
    bio: 'David manages sourcing, logistics, quality control, and business development while building lasting relationships with customers and suppliers.',
    contact: '+25470346012',
    skills: ['Dispatch Planning', 'Cold Chain Handling', 'Delivery Coordination'],
  },
]

export default function FoundersSection() {
  return (
    <section className="section section-light">
      <div className="container">
        <h2 className="section-title text-center">Meet the Team Running Deliveries</h2>
        <p className="section-subtitle text-center">
          This section now uses verified profile text only and avoids unconfirmed staff photos.
        </p>

        <div className="founders-grid">
          {founders.map((founder) => (
            <div className="founder-card" key={founder.name}>
              <div className={`founder-avatar ${founder.image ? 'founder-avatar--image' : ''}`}>
                {founder.image ? (
                  <img src={founder.image} alt={founder.name} />
                ) : (
                  <span>{founder.initials}</span>
                )}
                <div className="founder-badge">{founder.role}</div>
              </div>
              <div className="founder-content">
                <h3>{founder.name}</h3>
                <p className="founder-role">{founder.role}</p>
                <p className="founder-bio">{founder.bio}</p>
                <p className="founder-contact"><a href={`tel:${founder.contact}`}>{founder.contact}</a></p>
                <div className="founder-skills">
                  {founder.skills.map((skill) => <span className="skill" key={skill}>{skill}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
