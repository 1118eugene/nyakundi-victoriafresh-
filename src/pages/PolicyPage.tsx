import { Link } from 'react-router-dom'

export interface PolicySection {
  title: string
  paragraphs: string[]
  items?: string[]
}

interface PolicyPageProps {
  title: string
  summary: string
  sections: PolicySection[]
}

export default function PolicyPage({ title, summary, sections }: PolicyPageProps) {
  return (
    <section className="section">
      <div className="container">
        <header className="section-header">
          <p className="info-kicker">Customer information</p>
          <h1>{title}</h1>
          <p>{summary}</p>
          <p className="status-message info" role="note">
            Owner review required before publication: confirm the business details and operating rules listed in <Link to="/contact">contact and support</Link>.
          </p>
        </header>
        <div className="info-grid">
          {sections.map((section) => (
            <article className="info-panel" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items ? (
                <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : null}
            </article>
          ))}
        </div>
        <p><Link to="/contact">Contact the team</Link> with a question about this policy.</p>
      </div>
    </section>
  )
}
