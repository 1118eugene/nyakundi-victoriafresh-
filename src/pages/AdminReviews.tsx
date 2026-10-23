import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AdminFeedback, downloadAdminFeedbackCsv, fetchAdminFeedback, fetchAdminFeedbackSummary,
  moderateLegacyReview, updateAdminFeedback,
} from '../services/api'
import StoreInfo from '../components/StoreInfo'
import './AdminProducts.css'

type FeedbackType = 'all' | 'products' | 'service'
type FeedbackStatus = '' | 'pending' | 'approved' | 'rejected'

export default function AdminReviews() {
  const [adminKey, setAdminKey] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [type, setType] = useState<FeedbackType>('all')
  const [status, setStatus] = useState<FeedbackStatus>('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<AdminFeedback[]>([])
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchAdminFeedbackSummary>>['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const [feedback, totals] = await Promise.all([
        fetchAdminFeedback(adminKey, type, status, search),
        fetchAdminFeedbackSummary(adminKey),
      ])
      setItems(feedback.data)
      setReplies(Object.fromEntries(feedback.data.map((item) => [item.id, item.adminReply || ''])))
      setSummary(totals.data)
      setHasAccess(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Feedback could not be loaded.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (hasAccess) void load()
  }, [type, status, hasAccess])

  async function moderate(item: AdminFeedback, action: 'approved' | 'rejected' | 'reply') {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      if (item.type === 'legacy') {
        await moderateLegacyReview(adminKey, item.id, action === 'rejected' ? 'rejected' : 'approved')
      } else {
        const category = item.type === 'products' ? 'products' : 'service'
        await updateAdminFeedback(adminKey, category, item.id, action === 'reply'
          ? { adminReply: replies[item.id] || '' }
          : { status: action })
      }
      setNotice(action === 'reply' ? 'Reply saved.' : `Feedback ${action}.`)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Feedback could not be updated.') }
    finally { setLoading(false) }
  }

  async function exportCsv() {
    setLoading(true)
    setError('')
    try {
      const blob = await downloadAdminFeedbackCsv(adminKey, type === 'all' ? 'all' : type)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'customer-feedback.csv'
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Feedback CSV downloaded.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Feedback could not be exported.') }
    finally { setLoading(false) }
  }

  return (
    <div className="admin-products-page">
      <header className="admin-hero"><div className="container admin-hero-inner"><div>
        <span className="admin-eyebrow">Customer voice</span><h1>Reviews and feedback</h1>
        <p>Moderate customer-submitted content before publication and use private service feedback to improve.</p>
      </div><nav className="admin-products-actions"><Link className="btn btn-outline" to="/admin/faqs">Manage FAQs</Link><Link className="btn btn-outline" to="/admin/orders">Orders</Link></nav></div></header>
      <main className="container admin-products-content">
        <StoreInfo title="Moderation guidance"><p>Only approve genuine, relevant feedback. Product reviews become public after approval; service feedback remains private. The app does not seed example reviews or ratings.</p></StoreInfo>
        {!hasAccess ? <form className="admin-access-panel" onSubmit={(event) => void load(event)}><div><h2>Administrator access</h2><p>Enter the existing admin dashboard key to view customer submissions.</p></div><label className="admin-products-key">Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required /></label><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open feedback'}</button></form> : (
          <>
            {summary ? <section className="admin-products-panel"><h2>Approved product review summary</h2>
              <p>Service feedback average: {summary.service.count ? `${summary.service.average} / 5 from ${summary.service.count} approved responses` : 'No approved service feedback yet.'}</p>
              <div className="admin-feedback-summary-grid">
                <div><h3>Ratings by star</h3>{[5, 4, 3, 2, 1].map((star) => <p key={star}>{star} stars: {summary.stars.find((item) => item.rating === star)?.count || 0}</p>)}</div>
                <div><h3>By category</h3>{summary.categories.length ? summary.categories.map((item) => <p key={item.category}>{item.category}: {item.average} / 5 ({item.count})</p>) : <p>No approved product reviews yet.</p>}</div>
                <div><h3>Most reviewed</h3>{summary.mostReviewed.length ? summary.mostReviewed.map((item) => <p key={item.name}>{item.name}: {item.count} · {item.average} / 5</p>) : <p>No approved product reviews yet.</p>}</div>
                <div><h3>Lowest rated</h3>{summary.lowestRated.length ? summary.lowestRated.map((item) => <p key={item.name}>{item.name}: {item.average} / 5 ({item.count})</p>) : <p>No approved product reviews yet.</p>}</div>
              </div>
            </section> : null}
            <section className="admin-products-panel">
              <div className="admin-products-heading"><div><h2>Customer submissions</h2><p>Pending, approved and rejected entries can be filtered and searched.</p></div><button className="btn btn-outline btn-sm" type="button" onClick={() => void exportCsv()} disabled={loading}>Export CSV</button></div>
              <form className="admin-products-form" onSubmit={(event) => void load(event)}>
                <label>Type<select value={type} onChange={(event) => setType(event.target.value as FeedbackType)}><option value="all">All feedback</option><option value="products">Product reviews</option><option value="service">Service feedback</option></select></label>
                <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as FeedbackStatus)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
                <label className="admin-products-wide">Search by customer, product or comment<input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} /></label>
                <div className="admin-products-actions admin-products-wide"><button className="btn btn-primary btn-sm" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Search'}</button></div>
              </form>
              {items.map((item) => <article className="admin-products-panel admin-feedback-card" key={`${item.type}-${item.id}`}>
                <span className="panel-kicker">{item.type === 'legacy' ? 'Existing order review' : item.type === 'service' ? 'Service feedback' : 'Product review'} · {item.status}</span>
                <h3>{item.productName || 'Customer service'} · {item.rating} / 5</h3>
                <p>{item.customerName}{item.orderNumber ? ` · ${item.orderNumber}` : ''}{item.verifiedPurchase ? ' · Verified purchase' : ''}</p>
                {item.type === 'service' ? <p>Delivery {item.deliveryRating}/5 · Product {item.productQualityRating}/5 · Customer service {item.customerServiceRating}/5 · Recommend: {item.wouldRecommend ? 'Yes' : 'No'}</p> : null}
                {item.title ? <h4>{item.title}</h4> : null}<p>{item.comment || 'No written comment.'}</p>
                {item.type !== 'legacy' ? <label>Admin reply<textarea rows={2} maxLength={2000} value={replies[item.id] || ''} onChange={(event) => setReplies((current) => ({ ...current, [item.id]: event.target.value }))} /></label> : null}
                <div className="admin-products-actions">
                  <button className="btn btn-primary btn-sm" type="button" disabled={loading || item.status === 'approved'} onClick={() => void moderate(item, 'approved')}>Approve</button>
                  <button className="btn btn-outline btn-sm" type="button" disabled={loading || item.status === 'rejected'} onClick={() => void moderate(item, 'rejected')}>Reject</button>
                  {item.type !== 'legacy' ? <button className="btn btn-outline btn-sm" type="button" disabled={loading} onClick={() => void moderate(item, 'reply')}>Save reply</button> : null}
                </div>
              </article>)}
              {!items.length ? <p className="status-message info">No submissions match the selected filters.</p> : null}
            </section>
          </>
        )}
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message success" role="status">{notice}</p> : null}
      </main>
    </div>
  )
}
