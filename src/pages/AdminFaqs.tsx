import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { createAdminFaq, FAQ, fetchAdminFaqs, hideAdminFaq, updateAdminFaq } from '../services/api'
import StoreInfo from '../components/StoreInfo'
import './AdminProducts.css'

const emptyFaq = { category: 'ordering', question: '', answer: '', sortOrder: 0, active: true }

export default function AdminFaqs() {
  const [adminKey, setAdminKey] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [draft, setDraft] = useState(emptyFaq)
  const [editing, setEditing] = useState<Record<string, FAQ>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminFaqs(adminKey)
      setFaqs(response.data)
      setEditing(Object.fromEntries(response.data.map((faq) => [faq.id, faq])))
      setHasAccess(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load FAQs.') }
    finally { setLoading(false) }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await createAdminFaq(adminKey, draft)
      setNotice(response.message)
      setDraft(emptyFaq)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'FAQ could not be added.') }
    finally { setLoading(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>, faq: FAQ) {
    event.preventDefault()
    const values = editing[faq.id]
    if (!values) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await updateAdminFaq(adminKey, faq.id, values)
      setNotice('FAQ updated.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'FAQ could not be updated.') }
    finally { setLoading(false) }
  }

  async function hide(id: string) {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await hideAdminFaq(adminKey, id)
      setNotice(response.message)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'FAQ could not be hidden.') }
    finally { setLoading(false) }
  }

  return (
    <div className="admin-products-page">
      <header className="admin-hero"><div className="container admin-hero-inner"><div>
        <span className="admin-eyebrow">Store information</span><h1>FAQ management</h1>
        <p>Add, edit, reorder or hide customer answers. Hidden FAQ records are retained.</p>
      </div><nav className="admin-products-actions"><Link className="btn btn-outline" to="/admin/reviews">Customer reviews</Link><Link className="btn btn-outline" to="/admin/orders">Orders</Link></nav></div></header>
      <main className="container admin-products-content">
        <StoreInfo title="Keep answers accurate"><p>Use confirmed service facts only. If delivery hours, fees, coverage or policies are unknown, ask customers to contact the team instead of guessing.</p></StoreInfo>
        {!hasAccess ? <form className="admin-access-panel" onSubmit={(event) => void load(event)}><div><h2>Administrator access</h2><p>Enter the existing admin dashboard key to manage FAQs.</p></div><label className="admin-products-key">Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required /></label><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open FAQs'}</button></form> : (
          <>
            <section className="admin-products-panel">
              <div className="admin-products-heading"><div><h2>Add FAQ</h2><p>Use a short question and a plain, verified answer.</p></div></div>
              <form className="admin-products-form" onSubmit={(event) => void create(event)}>
                <label>Category<input value={draft.category} maxLength={80} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required /></label>
                <label>Sort order<input type="number" min="0" max="100000" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
                <label className="admin-products-wide">Question<input value={draft.question} maxLength={240} onChange={(event) => setDraft({ ...draft, question: event.target.value })} required /></label>
                <label className="admin-products-wide">Answer<textarea rows={3} maxLength={2000} value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} required /></label>
                <div className="admin-products-actions admin-products-wide"><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add FAQ'}</button></div>
              </form>
            </section>
            <section className="admin-products-panel"><div className="admin-products-heading"><div><h2>Existing answers</h2><p>{faqs.length} FAQs, including hidden records.</p></div><button className="btn btn-outline btn-sm" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
              {faqs.map((faq) => {
                const value = editing[faq.id] || faq
                return <form className="admin-products-form admin-faq-card" key={faq.id} onSubmit={(event) => void save(event, faq)}>
                  <label>Category<input value={value.category} maxLength={80} onChange={(event) => setEditing((current) => ({ ...current, [faq.id]: { ...value, category: event.target.value } }))} required /></label>
                  <label>Sort order<input type="number" min="0" max="100000" value={value.sortOrder} onChange={(event) => setEditing((current) => ({ ...current, [faq.id]: { ...value, sortOrder: Number(event.target.value) } }))} /></label>
                  <label className="admin-products-wide">Question<input value={value.question} maxLength={240} onChange={(event) => setEditing((current) => ({ ...current, [faq.id]: { ...value, question: event.target.value } }))} required /></label>
                  <label className="admin-products-wide">Answer<textarea rows={3} maxLength={2000} value={value.answer} onChange={(event) => setEditing((current) => ({ ...current, [faq.id]: { ...value, answer: event.target.value } }))} required /></label>
                  <label><span>Visible to customers</span><input type="checkbox" checked={Boolean(value.active)} onChange={(event) => setEditing((current) => ({ ...current, [faq.id]: { ...value, active: event.target.checked } }))} /></label>
                  <div className="admin-products-actions admin-products-wide"><button className="btn btn-primary btn-sm" type="submit" disabled={loading}>Save changes</button>{faq.active ? <button className="btn btn-outline btn-sm" type="button" disabled={loading} onClick={() => void hide(faq.id)}>Hide FAQ</button> : null}</div>
                </form>
              })}
            </section>
          </>
        )}
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message success" role="status">{notice}</p> : null}
      </main>
    </div>
  )
}
