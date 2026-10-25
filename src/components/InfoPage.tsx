import { Link } from 'react-router-dom'
import StoreInfo from './StoreInfo'
import './InfoPage.css'
import { getOptimizedImageSource } from '../utils/imageSource'

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
  imageSrc: string
  imageAlt: string
}

export default function InfoPage({ kicker, title, intro, sections, ctaLabel, ctaTo, imageSrc, imageAlt }: InfoPageProps) {
  return (
    <div className="info-page">
      <header className="info-hero">
        <div className="container info-hero-content">
          <div>
            <p className="info-kicker">{kicker}</p>
            <h1>{title}</h1>
            <p className="info-intro">{intro}</p>
          </div>
          <img className="info-hero-image" src={getOptimizedImageSource(imageSrc)} alt={imageAlt} fetchPriority="high" />
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
            <h2>What would you like to do next?</h2>
            <p>Check current catalogue details and delivery coverage, or contact the team to confirm information not listed online.</p>
            <Link className="btn btn-primary btn-lg" to={ctaTo}>{ctaLabel}</Link>
          </div>
        ) : null}
        <StoreInfo title="Current availability and delivery"><p>Prices and stock are shown in the active catalogue. Delivery areas and any fees are checked at checkout. Contact us to confirm details that are not listed.</p></StoreInfo>
        <p><Link to="/faq">Read frequently asked questions</Link> or <Link to="/contact">contact the team</Link>.</p>
      </main>
    </div>
  )
}
