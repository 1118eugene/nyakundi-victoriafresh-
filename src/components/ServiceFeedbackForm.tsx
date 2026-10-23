import { FormEvent, useEffect, useState } from 'react'
import { fetchServiceFeedbackStatus, submitServiceFeedback } from '../services/api'
import { Order } from '../types'

export default function ServiceFeedbackForm({ order, trackingToken }: { order: Order; trackingToken: string }) {
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [ratings, setRatings] = useState({ deliveryRating: 5, productQualityRating: 5, customerServiceRating: 5 })
  const [comment, setComment] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    void fetchServiceFeedbackStatus(order.id, trackingToken).then((response) => {
      if (active) setAlreadySubmitted(response.data.submitted)
    }).catch((err: Error) => {
      if (active) setError(err.message || 'Feedback status could not be checked.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [order.id, trackingToken])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await submitServiceFeedback({
        orderId: order.id,
        customerName: order.customer.name,
        phone: order.customer.phone,
        ...ratings,
        comment,
        wouldRecommend,
      }, trackingToken)
      setMessage(response.message)
      setAlreadySubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  if (order.status !== 'delivered') return null
  if (loading) return <section aria-label="Customer feedback"><p role="status">Checking feedback status…</p></section>
  if (alreadySubmitted) return <section aria-label="Customer feedback"><p className="status-message success">Thank you. Feedback has already been recorded for this order.</p></section>

  const fields = [
    ['deliveryRating', 'Delivery'],
    ['productQualityRating', 'Product quality'],
    ['customerServiceRating', 'Customer service'],
  ] as const
  return (
    <section aria-labelledby="service-feedback-title">
      <h3 id="service-feedback-title">How was our service?</h3>
      <p>Your feedback is sent to the team for review and is not published publicly.</p>
      <form className="product-review-form" onSubmit={(event) => void submit(event)}>
        {fields.map(([field, label]) => (
          <label key={field}>{label}
            <select value={ratings[field]} onChange={(event) => setRatings((current) => ({ ...current, [field]: Number(event.target.value) }))}>
              {[5, 4, 3, 2, 1].map((score) => <option value={score} key={score}>{score} / 5</option>)}
            </select>
          </label>
        ))}
        <label>Comment (optional)<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} /></label>
        <label>Would you recommend us?
          <select value={wouldRecommend ? 'yes' : 'no'} onChange={(event) => setWouldRecommend(event.target.value === 'yes')}>
            <option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {message ? <p className="status-message success" role="status">{message}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send feedback'}</button>
      </form>
    </section>
  )
}
