import { FormEvent, useEffect, useState } from 'react'
import { fetchOrderProductReviewStatus, submitProductReview } from '../services/api'
import { Order, OrderItem } from '../types'

export default function OrderProductReviewForm({ order, item, trackingToken }: { order: Order; item: OrderItem; trackingToken: string }) {
  const [customerName, setCustomerName] = useState(order.customer.name)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    void fetchOrderProductReviewStatus(item.productId, order.id, trackingToken)
      .then((response) => {
        if (active) {
          setSubmitted(response.data.submitted)
          if (!response.data.delivered || !response.data.purchased) {
            setError('A review is available only for a product in a delivered order.')
          }
        }
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Review status could not be checked.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [item.productId, order.id, trackingToken])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError('')
    setNotice('')
    try {
      const response = await submitProductReview({
        productId: item.productId,
        orderId: order.id,
        customerName,
        phone: order.customer.phone,
        rating,
        title,
        comment,
      }, trackingToken)
      setSubmitted(true)
      setNotice(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your review could not be submitted.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p role="status">Checking review status for {item.name}…</p>
  if (submitted) return <p className="status-message success">{notice || `A review for ${item.name} has already been submitted.`}</p>
  if (error && !error.includes('could not be checked')) return <p className="status-message info">{error}</p>
  return (
    <form className="product-review-form" onSubmit={(event) => void submit(event)}>
      <h4>Review {item.name}</h4>
      <p>This review is linked to the delivered order and will be marked as a verified purchase. It appears publicly only after moderation.</p>
      <label>Name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={100} required /></label>
      <label>Rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((score) => <option value={score} key={score}>{score} / 5</option>)}</select></label>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
      <label>Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} required /></label>
      {error ? <p className="status-message error" role="alert">{error}</p> : null}
      {notice ? <p className="status-message success" role="status">{notice}</p> : null}
      <button className="btn btn-outline" type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit product review'}</button>
    </form>
  )
}
