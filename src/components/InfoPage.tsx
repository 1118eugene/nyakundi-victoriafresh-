import { Link } from 'react-router-dom'
import './InfoPage.css'

export interface InfoPageSection {
  title: string
  text?: string
  items?: string[]
}

interface InfoPageProps {
  kicker: string
  title: string
  intro: string
  sections: InfoPageSection[]
  ctaLabel?: string
  ctaTo?: string
}

export default function InfoPage({ kicker, title, intro, sections, ctaLabel, ctaTo }: InfoPageProps) {
  return (
    <div className="info-page">
      <header className="info-hero">
        <div className="container">
          <p className="info-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p className="info-intro">{intro}</p>
        </div>
      </header>

      <main className="container info-content">
        <div className="info-grid">
          {sections.map((section) => (
            <section className="info-panel" key={section.title}>
              <h2>{section.title}</h2>
              {section.text ? <p>{section.text}</p> : null}
              {section.items ? (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {ctaLabel && ctaTo ? (
          <div className="info-cta">
            <h2>Ready to enjoy fresh fish?</h2>
            <p>Place your order online or speak to our team about delivery and wholesale quantities.</p>
            <Link className="btn btn-primary btn-lg" to={ctaTo}>{ctaLabel}</Link>
          </div>
        ) : null}
      </main>
    </div>
  )
}
