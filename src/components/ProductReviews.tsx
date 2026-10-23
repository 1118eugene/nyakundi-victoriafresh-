import { FormEvent, useEffect, useState } from 'react'
import { PublicReview, ReviewSummary, fetchProductReviewsPublic, submitProductReview } from '../services/api'
import './ProductReviews.css'

const emptySummary: ReviewSummary = { count: 0, average: 0, oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 }

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' }).format(new Date(value))
}

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function loadReviews() {
    setLoading(true)
    try {
      const response = await fetchProductReviewsPublic(productId)
      setReviews(response.data.reviews)
      setSummary(response.data.summary)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reviews could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoading(true)
    try {
      const response = await fetchProductReviewsPublic(productId, reviews.length)
      setReviews((current) => [...current, ...response.data.reviews])
      setSummary(response.data.summary)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'More reviews could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadReviews() }, [productId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const response = await submitProductReview({ productId, customerName, phone, rating, title, comment })
      setNotice(response.message)
      setCustomerName('')
      setPhone('')
      setTitle('')
      setComment('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your review could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  const breakdown = [
    ['5 stars', summary.fiveStar], ['4 stars', summary.fourStar], ['3 stars', summary.threeStar],
    ['2 stars', summary.twoStar], ['1 star', summary.oneStar],
  ] as const

  return (
    <section className="product-reviews" aria-labelledby="product-reviews-title">
      <h3 id="product-reviews-title">Customer reviews</h3>
      <div className="review-summary">
        <p className="review-average" aria-label={summary.count ? `${summary.average} out of 5 from ${summary.count} approved reviews` : 'No approved reviews yet'}>
          {summary.count ? <><strong>{summary.average}</strong> / 5 · {summary.count} {summary.count === 1 ? 'review' : 'reviews'}</> : 'No approved reviews yet'}
        </p>
        <div className="review-breakdown" aria-label="Review rating breakdown">
          {breakdown.map(([label, count]) => <span key={label}>{label}: {count}</span>)}
        </div>
      </div>
      {error ? <p className="status-message error" role="alert">{error}</p> : null}
      {loading ? <p role="status">Loading approved reviews…</p> : reviews.length ? (
        <div className="approved-reviews">
          {reviews.map((review) => (
            <article className="approved-review" key={review.id}>
              <div className="approved-review-heading"><strong>{review.customerName}</strong><span>{review.rating} / 5 · {dateLabel(review.createdAt)}</span></div>
              {review.title ? <h4>{review.title}</h4> : null}
              {review.comment ? <p>{review.comment}</p> : null}
              {review.verifiedPurchase ? <span className="verified-review-label">Verified purchase</span> : null}
              {review.adminReply ? <p className="review-admin-reply"><strong>Team response:</strong> {review.adminReply}</p> : null}
            </article>
          ))}
        </div>
      ) : !loading ? <p>Be the first to review this product.</p> : null}
      {!loading && reviews.length < summary.count ? <button className="btn btn-outline" type="button" onClick={() => void loadMore()}>Load more reviews</button> : null}

      <form className="product-review-form" onSubmit={(event) => void submit(event)}>
        <h4>Write a review</h4>
        <p>Your review is shown publicly only after it has been approved. Your phone number is used for duplicate prevention and is not displayed.</p>
        <label>Name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} minLength={1} maxLength={100} autoComplete="name" required /></label>
        <label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07XXXXXXXX or +254..." autoComplete="tel" maxLength={20} required /></label>
        <label>Rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((score) => <option value={score} key={score}>{score} / 5</option>)}</select></label>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
        <label>Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} required /></label>
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message success" role="status">{notice}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Send review for approval'}</button>
      </form>
    </section>
  )
}
