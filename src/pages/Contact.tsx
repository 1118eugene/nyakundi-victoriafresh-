import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { submitSupportRequest, SupportRequestType } from '../services/api'
import { getSupportEmail, getSupportPhone, getWhatsAppSupportUrl, socialSupportLinks } from '../services/support'
import './Contact.css'

const initialForm = {
  type: 'question' as SupportRequestType,
  name: '',
  phone: '',
  email: '',
  orderNumber: '',
  message: '',
  contactConsent: false,
}

export default function Contact() {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const phone = getSupportPhone()
  const email = getSupportEmail()
  const whatsapp = getWhatsAppSupportUrl('Please confirm today’s cooked menu, side options, dine-in or takeaway availability, location, and opening hours.')

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setReference('')
    try {
      const response = await submitSupportRequest(form)
      setReference(response.data.id)
      setForm(initialForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="container">
          <p className="contact-kicker">Victoria Fresh Fish Kenya</p>
          <h1>Contact and support</h1>
          <p>Send a question, complaint, or refund request. Do not include payment passwords, PINs, or other secret details.</p>
        </div>
      </section>
      <section className="section">
        <div className="container contact-grid">
          {whatsapp ? <a className="contact-card" href={whatsapp} target="_blank" rel="noreferrer"><span>WhatsApp support</span><strong>Message the team</strong></a> : null}
          {phone ? <a className="contact-card" href={`tel:${phone}`}><span>Call support</span><strong>{phone}</strong></a> : null}
          {email ? <a className="contact-card" href={`mailto:${email}`}><span>Email support</span><strong>{email}</strong></a> : null}
          {socialSupportLinks.map((link) => (
            <a className="contact-card" key={link.name} href={link.url} target="_blank" rel="noreferrer">
              <span>{link.name}</span>
              <strong>{link.contactLabel}</strong>
            </a>
          ))}
          {!whatsapp ? <p className="contact-unconfigured">WhatsApp support will appear here once the official business number is configured.</p> : null}
          {!phone && !email ? <p className="contact-unconfigured">Phone and email support are not configured. Message us on Instagram or submit the support request below.</p> : null}
        </div>
      </section>
      <section className="section section-light">
        <div className="container contact-request-layout">
          <div>
            <p className="contact-kicker">Support request</p>
            <h2>How can we help?</h2>
            <p>Requests are stored for staff follow-up. A submitted request is not confirmation of a refund or order change.</p>
            <p>Browse the <Link to="/products?category=ready-to-eat">ready-to-eat menu</Link>. For dine-in or takeaway, contact the team to confirm today’s sides, location and opening hours before travelling.</p>
          </div>
          <form className="contact-request-form" onSubmit={(event) => void sendRequest(event)}>
            <label>
              Request type
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as SupportRequestType }))}>
                <option value="question">Question</option>
                <option value="complaint">Complaint</option>
                <option value="refund">Refund request</option>
              </select>
            </label>
            <label>Name<small>How should the team address you?</small><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" minLength={2} maxLength={120} required /></label>
            <label>Phone<small>Enter a number the team can use to respond.</small><input type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" maxLength={20} required /></label>
            <label>Email (optional)<small>Optional; include it if you prefer an email response.</small><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" maxLength={254} /></label>
            <label>Order number (optional)<small>Include this for an order-related question or issue.</small><input value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))} maxLength={60} /></label>
            <label className="contact-request-wide">Message<small>Describe what you need help with. Never include a payment PIN or password.</small><textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} minLength={10} maxLength={4000} rows={5} required /></label>
            <label className="contact-request-consent contact-request-wide">
              <input type="checkbox" checked={form.contactConsent} onChange={(event) => setForm((current) => ({ ...current, contactConsent: event.target.checked }))} required />
              <span>I agree that the team may use these contact details to respond to this request.</span>
            </label>
            {error ? <p className="status-message error contact-request-wide" role="alert">{error}</p> : null}
            {reference ? <p className="status-message success contact-request-wide" role="status">Request submitted. Reference: {reference}</p> : null}
            <button className="btn btn-primary contact-request-wide" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit support request'}</button>
          </form>
        </div>
      </section>
    </div>
  )
}
