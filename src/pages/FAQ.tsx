import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StoreInfo from '../components/StoreInfo'
import './FAQ.css'
import { FAQ, fetchFaqs } from '../services/api'

const categoryNames: Record<string, string> = {
  ordering: 'Ordering',
  payment: 'Payment',
  delivery: 'Delivery',
  tracking: 'Order tracking',
  products: 'Products and handling',
  orders: 'Order issues',
  account: 'Account',
  contact: 'Contact',
  eatery: 'Cooked food',
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void fetchFaqs().then((response) => { if (active) setFaqs(response.data) })
      .catch((err: Error) => { if (active) setError(err.message || 'FAQs are temporarily unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const groups = faqs.reduce<Record<string, FAQ[]>>((result, faq) => {
    result[faq.category] = [...(result[faq.category] || []), faq]
    return result
  }, {})

  return (
    <div className="info-page">
      <header className="info-page-hero"><div className="container">
        <p className="section-kicker">Helpful answers</p>
        <h1>Frequently asked questions</h1>
        <p>Information about the catalogue, ordering, delivery, payment and customer support.</p>
      </div></header>
      <main className="container info-page-content">
        <StoreInfo title="Current delivery and service details">
          <p>Coverage is checked at checkout. Delivery fees are shown there for configured areas. Contact us to confirm timings, opening hours or any policy not listed here.</p>
        </StoreInfo>
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {!error && loading ? <p role="status">Loading frequently asked questions…</p> : null}
        {!error && !loading && !faqs.length ? <p>No answers are published right now. Please <Link to="/contact">contact the team</Link>.</p> : null}
        {Object.entries(groups).map(([category, items]) => (
          <section key={category} aria-labelledby={`faq-${category}`}>
            <h2 id={`faq-${category}`}>{categoryNames[category] || category}</h2>
            {items.map((faq) => <details className="faq-accordion-item" key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
          </section>
        ))}
        <p>Still need help? <Link to="/contact">Contact the team</Link> and include your order number when relevant.</p>
      </main>
    </div>
  )
}
