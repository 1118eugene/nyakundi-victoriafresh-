import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSupportRequests, setCustomerTemporaryPassword, SupportRequest, updateSupportRequest } from '../services/api'
import './AdminOrders.css'
import './AdminProducts.css'

interface SupportDraft {
  status: SupportRequest['status']
  staffResponse: string
  resolutionOutcome: string
}

export default function AdminSupport() {
  const [adminKey, setAdminKey] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [drafts, setDrafts] = useState<Record<string, SupportDraft>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [customerIdentifier, setCustomerIdentifier] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')

  async function loadRequests(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetchSupportRequests(adminKey)
      setRequests(response.data)
      setDrafts(Object.fromEntries(response.data.map((item) => [item.id, {
        status: item.status,
        staffResponse: item.staffResponse,
        resolutionOutcome: item.resolutionOutcome,
      }])))
      setHasAccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support requests.')
    } finally {
      setLoading(false)
    }
  }

  function updateDraft<K extends keyof SupportDraft>(id: string, field: K, value: SupportDraft[K]) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    const draft = drafts[id]
    if (!draft) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await updateSupportRequest(id, adminKey, draft)
      setRequests((current) => current.map((item) => item.id === id ? { ...item, ...response.data } : item))
      setNotice(`Support request ${id} updated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the support request.')
    } finally {
      setLoading(false)
    }
  }

  async function resetCustomerPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await setCustomerTemporaryPassword(adminKey, customerIdentifier, temporaryPassword)
      setTemporaryPassword('')
      setNotice(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to set the temporary password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-orders-page admin-products-page">
      <header className="admin-hero">
        <div className="container admin-hero-inner">
          <div>
            <span className="admin-eyebrow">Customer care</span>
            <h1>Support requests</h1>
            <p>Review customer questions, complaints, and refund requests; record the staff response and outcome.</p>
          </div>
          <div className="admin-products-actions">
            <Link className="btn btn-outline" to="/admin/orders">Order operations</Link>
            <Link className="btn btn-outline" to="/admin/reviews">Customer reviews</Link>
            <Link className="btn btn-outline" to="/admin/faqs">Manage FAQs</Link>
            <Link className="btn btn-outline" to="/admin/delivery-zones">Delivery zones</Link>
          </div>
        </div>
      </header>
      <main className="container admin-products-content">
        {!hasAccess ? (
          <form className="admin-access-panel" onSubmit={(event) => void loadRequests(event)}>
            <div><h2>Administrator access</h2><p>Enter the configured admin key to load customer support requests.</p></div>
            <label className="admin-products-key">Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required /></label>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open support requests'}</button>
          </form>
        ) : (
          <>
          <section className="admin-products-panel" aria-labelledby="customer-password-heading">
            <div className="admin-products-heading">
              <div><h2 id="customer-password-heading">Customer account access</h2><p>Set a temporary password for a customer who cannot sign in. Their existing sessions will be revoked.</p></div>
            </div>
            <form className="admin-products-form" onSubmit={(event) => void resetCustomerPassword(event)}>
              <label>Registered email or Kenyan phone<input type="text" value={customerIdentifier} onChange={(event) => setCustomerIdentifier(event.target.value)} autoComplete="off" required /></label>
              <label>Temporary password<input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={72} required /></label>
              <div className="admin-products-actions admin-products-wide"><button className="btn btn-primary btn-sm" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Set temporary password'}</button></div>
            </form>
          </section>
          <section className="admin-products-panel" aria-labelledby="support-list-heading">
            <div className="admin-products-heading">
              <div><h2 id="support-list-heading">Requests</h2><p>{requests.length} request(s) loaded. Customer contact data is visible only in this admin view.</p></div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => void loadRequests()} disabled={loading}>Refresh</button>
            </div>
            {requests.length ? (
              <div className="admin-products-list">
                {requests.map((item) => {
                  const draft = drafts[item.id]
                  return (
                    <article className="admin-products-panel" key={item.id}>
                      <div className="admin-products-heading">
                        <div>
                          <span className="panel-kicker">{item.requestType} · {item.status.replace('_', ' ')}</span>
                          <h3>{item.customerName}</h3>
                          <p>{item.phone}{item.email ? ` · ${item.email}` : ''}{item.orderNumber ? ` · Order ${item.orderNumber}` : ''}</p>
                          <p>{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(new Date(item.createdAt))}</p>
                        </div>
                      </div>
                      <p>{item.message}</p>
                      <form className="admin-products-form" onSubmit={(event) => void saveRequest(event, item.id)}>
                        <label>Status<select value={draft?.status || item.status} onChange={(event) => {
                          const value = event.target.value
                          if (value === 'new' || value === 'in_review' || value === 'resolved') updateDraft(item.id, 'status', value)
                        }}><option value="new">New</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></label>
                        <label>Staff response<textarea rows={3} maxLength={2000} value={draft?.staffResponse || ''} onChange={(event) => updateDraft(item.id, 'staffResponse', event.target.value)} required={draft?.status === 'resolved'} /></label>
                        <label className="admin-products-wide">Recorded outcome<textarea rows={2} maxLength={1000} value={draft?.resolutionOutcome || ''} onChange={(event) => updateDraft(item.id, 'resolutionOutcome', event.target.value)} required={draft?.status === 'resolved'} /></label>
                        <div className="admin-products-actions admin-products-wide"><button className="btn btn-primary btn-sm" type="submit" disabled={loading}>Save response</button></div>
                      </form>
                    </article>
                  )
                })}
              </div>
            ) : <p>No support requests have been submitted.</p>}
          </section>
          </>
        )}
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message success" role="status">{notice}</p> : null}
      </main>
    </div>
  )
}
