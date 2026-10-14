import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAdminDeliveryZone,
  deactivateAdminDeliveryZone,
  DeliveryZone,
  DeliveryZoneInput,
  fetchAdminDeliveryZones,
  updateAdminDeliveryZone,
} from '../services/api'
import './AdminOrders.css'
import './AdminProducts.css'

interface ZoneForm {
  name: string
  county: string
  towns: string
  fee: string
  minimumOrder: string
  deliveryWindows: string
  cutoffAt: string
  priority: string
  active: boolean
}

const emptyForm: ZoneForm = {
  name: '',
  county: '',
  towns: '',
  fee: '',
  minimumOrder: '0',
  deliveryWindows: '',
  cutoffAt: '',
  priority: '0',
  active: false,
}

function formForZone(zone: DeliveryZone): ZoneForm {
  return {
    name: zone.name,
    county: zone.county,
    towns: zone.towns.join('\n'),
    fee: String(zone.fee),
    minimumOrder: String(zone.minimumOrder),
    deliveryWindows: zone.deliveryWindows.join('\n'),
    cutoffAt: zone.cutoffAt || '',
    priority: String(zone.priority),
    active: zone.active,
  }
}

export default function AdminDeliveryZones() {
  const [adminKey, setAdminKey] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [form, setForm] = useState<ZoneForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function updateField<K extends keyof ZoneForm>(field: K, value: ZoneForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function loadZones(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminDeliveryZones(adminKey)
      setZones(response.data)
      setHasAccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load delivery zones.')
    } finally {
      setLoading(false)
    }
  }

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const zone: DeliveryZoneInput = {
      name: form.name.trim(),
      county: form.county.trim(),
      towns: form.towns.split(/\r?\n/).map((town) => town.trim()).filter(Boolean),
      fee: Number(form.fee),
      minimumOrder: Number(form.minimumOrder),
      deliveryWindows: form.deliveryWindows.split(/\r?\n/).map((window) => window.trim()).filter(Boolean),
      cutoffAt: form.cutoffAt.trim() || null,
      priority: Number(form.priority),
      active: form.active,
    }
    try {
      const response = editingId
        ? await updateAdminDeliveryZone(editingId, adminKey, zone)
        : await createAdminDeliveryZone(adminKey, zone)
      setZones((current) => {
        const exists = current.some((item) => item.id === response.data.id)
        return exists
          ? current.map((item) => item.id === response.data.id ? response.data : item)
          : [...current, response.data]
      })
      setNotice(editingId ? 'Delivery zone updated.' : 'Delivery zone created.')
      setForm(emptyForm)
      setEditingId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this delivery zone.')
    } finally {
      setLoading(false)
    }
  }

  async function deactivateZone(zone: DeliveryZone) {
    if (!window.confirm(`Turn off delivery coverage for ${zone.name}? The zone record will be retained.`)) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await deactivateAdminDeliveryZone(zone.id, adminKey)
      setZones((current) => current.map((item) => item.id === zone.id ? response.data : item))
      setNotice('Delivery zone deactivated; its record was retained.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate this delivery zone.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-orders-page admin-products-page">
      <header className="admin-hero">
        <div className="container admin-hero-inner">
          <div>
            <span className="admin-eyebrow">Delivery operations</span>
            <h1>Delivery zones</h1>
            <p>Only activate areas, fees, minimums, cut-offs, and windows confirmed by the business owner.</p>
          </div>
          <div className="admin-products-actions">
            <Link className="btn btn-outline" to="/admin/orders">Order operations</Link>
            <Link className="btn btn-outline" to="/admin/support">Support requests</Link>
          </div>
        </div>
      </header>
      <main className="container admin-products-content">
        {!hasAccess ? (
          <form className="admin-access-panel" onSubmit={(event) => void loadZones(event)}>
            <div>
              <h2>Administrator access</h2>
              <p>Enter the configured admin key to manage delivery coverage.</p>
            </div>
            <label className="admin-products-key">
              Admin key
              <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open delivery zones'}</button>
          </form>
        ) : (
          <>
            <section className="admin-products-panel" aria-labelledby="zone-editor-heading">
              <div className="admin-products-heading">
                <div>
                  <span className="panel-kicker">{editingId ? 'Edit delivery zone' : 'New delivery zone'}</span>
                  <h2 id="zone-editor-heading">{editingId ? 'Update confirmed coverage' : 'Add a delivery zone'}</h2>
                  <p>An empty towns list covers the whole county. Leave a zone inactive until all details are confirmed.</p>
                </div>
                {editingId ? <button className="btn btn-outline btn-sm" type="button" onClick={() => { setForm(emptyForm); setEditingId('') }}>Cancel edit</button> : null}
              </div>
              <form className="admin-products-form" onSubmit={(event) => void saveZone(event)}>
                <label>Zone name<input value={form.name} onChange={(event) => updateField('name', event.target.value)} maxLength={120} required /></label>
                <label>County<input value={form.county} onChange={(event) => updateField('county', event.target.value)} maxLength={100} required /></label>
                <label className="admin-products-wide">Towns (one per line; leave empty for county-wide)<textarea rows={3} value={form.towns} onChange={(event) => updateField('towns', event.target.value)} /></label>
                <label>Delivery fee (KES)<input type="number" min="0" step="0.01" value={form.fee} onChange={(event) => updateField('fee', event.target.value)} required /></label>
                <label>Minimum order (KES)<input type="number" min="0" step="0.01" value={form.minimumOrder} onChange={(event) => updateField('minimumOrder', event.target.value)} required /></label>
                <label className="admin-products-wide">Delivery windows (HH:MM-HH:MM, one per line)<textarea rows={3} value={form.deliveryWindows} onChange={(event) => updateField('deliveryWindows', event.target.value)} required={form.active} /></label>
                <label>Cut-off (24-hour HH:MM)<input type="time" value={form.cutoffAt} onChange={(event) => updateField('cutoffAt', event.target.value)} /></label>
                <label>Priority<input type="number" min="-1000" max="1000" step="1" value={form.priority} onChange={(event) => updateField('priority', event.target.value)} /></label>
                <label className="admin-products-check"><input type="checkbox" checked={form.active} onChange={(event) => updateField('active', event.target.checked)} /> Coverage is owner-confirmed and active</label>
                <div className="admin-products-actions admin-products-wide">
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Saving…' : editingId ? 'Save zone' : 'Create zone'}</button>
                </div>
              </form>
            </section>
            <section className="admin-products-panel" aria-labelledby="zone-list-heading">
              <div className="admin-products-heading">
                <div><h2 id="zone-list-heading">Configured zones</h2><p>{zones.length} retained zone record(s).</p></div>
              </div>
              {zones.length ? (
                <div className="admin-products-list">
                  {zones.map((zone) => (
                    <article className="admin-products-row" key={zone.id}>
                      <div>
                        <h3>{zone.name} — {zone.county}</h3>
                        <p>{zone.towns.length ? zone.towns.join(', ') : 'All towns in county'} · KES {zone.fee.toLocaleString()} fee · KES {zone.minimumOrder.toLocaleString()} minimum</p>
                        <span>{zone.active ? 'Active' : 'Inactive'} · {zone.deliveryWindows.join(', ') || 'No windows configured'}</span>
                      </div>
                      <div className="admin-products-actions">
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => { setForm(formForZone(zone)); setEditingId(zone.id); setNotice('') }}>Edit</button>
                        {zone.active ? <button className="btn btn-outline btn-sm" type="button" onClick={() => void deactivateZone(zone)} disabled={loading}>Deactivate</button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p>No delivery zones are configured.</p>}
            </section>
          </>
        )}
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message success" role="status">{notice}</p> : null}
      </main>
    </div>
  )
}
