import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminProductInput, createAdminProduct, deactivateAdminProduct, fetchAdminInventory, fetchProducts, updateAdminProduct } from '../services/api'
import { Product } from '../types'
import './AdminOrders.css'
import './AdminProducts.css'

interface ProductForm {
  sku: string
  name: string
  description: string
  price: string
  priceConfirmed: boolean
  unit: string
  sizeLabel: string
  photos: string
  category: string
  species: string
  preparation: string
  quantity: string
  active: boolean
  inStock: boolean
  featured: boolean
}

const emptyForm: ProductForm = {
  sku: '',
  name: '',
  description: '',
  price: '',
  priceConfirmed: false,
  unit: '',
  sizeLabel: '',
  photos: '',
  category: '',
  species: '',
  preparation: '',
  quantity: '0',
  active: false,
  inStock: false,
  featured: false,
}

function formForProduct(product: Product): ProductForm {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.priceConfirmed ? String(product.price) : '',
    priceConfirmed: product.priceConfirmed,
    unit: product.unit,
    sizeLabel: product.sizeLabel,
    photos: product.photos.join('\n'),
    category: product.category,
    species: product.species,
    preparation: product.preparation,
    quantity: String(product.quantity),
    active: Boolean(product.active),
    inStock: product.inStock,
    featured: product.featured,
  }
}

export default function AdminProducts() {
  const [adminKey, setAdminKey] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const [inventoryResponse, catalogueResponse] = await Promise.all([
        fetchAdminInventory(adminKey),
        fetchProducts(),
      ])
      setProducts(inventoryResponse.data)
      setCategories(catalogueResponse.filters?.categories || {})
      setHasAccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the product catalogue.')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const product: AdminProductInput = {
      ...form,
      price: form.priceConfirmed ? Number(form.price) : null,
      photos: form.photos.split(/\r?\n/).map((photo) => photo.trim()).filter(Boolean),
      quantity: Number(form.quantity),
    }
    try {
      const response = editingId
        ? await updateAdminProduct(editingId, adminKey, product)
        : await createAdminProduct(adminKey, product)
      setProducts((current) => {
        const existing = current.some((item) => item.id === response.data.id)
        return existing
          ? current.map((item) => item.id === response.data.id ? response.data : item)
          : [...current, response.data]
      })
      setNotice(editingId ? 'Product details saved.' : 'Product draft created.')
      setForm(emptyForm)
      setEditingId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the product.')
    } finally {
      setLoading(false)
    }
  }

  async function deactivateProduct(product: Product) {
    if (!window.confirm(`Hide ${product.name} from the public catalogue? The product record will be retained.`)) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await deactivateAdminProduct(product.id, adminKey)
      setProducts((current) => current.map((item) => item.id === product.id ? response.data : item))
      setNotice('Product hidden. Its history and order references were retained.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to hide the product.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-orders-page admin-products-page">
      <header className="admin-hero">
        <div className="container admin-hero-inner">
          <div>
            <span className="admin-eyebrow">Catalogue management</span>
            <h1>Products</h1>
            <p>Unconfirmed prices stay hidden from customers. Product records are retained when hidden.</p>
          </div>
          <div className="admin-products-actions">
            <Link className="btn btn-outline" to="/admin/orders">Order operations</Link>
            <Link className="btn btn-outline" to="/admin/delivery-zones">Delivery zones</Link>
          </div>
        </div>
      </header>
      <main className="container admin-products-content">
        {!hasAccess ? (
          <form className="admin-access-panel" onSubmit={(event) => void loadInventory(event)}>
            <div>
              <h2>Administrator access</h2>
              <p>Enter the configured admin key to load the catalogue tools.</p>
            </div>
            <label className="admin-products-key">
              Admin key
              <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open catalogue tools'}</button>
          </form>
        ) : (
          <>
            <section className="admin-products-panel" aria-labelledby="product-editor-heading">
              <div className="admin-products-heading">
                <div>
                  <span className="panel-kicker">{editingId ? 'Edit product' : 'New product'}</span>
                  <h2 id="product-editor-heading">{editingId ? 'Update catalogue record' : 'Add a catalogue draft'}</h2>
                  <p>Only add owner-confirmed information. Photo upload and image resizing require an approved media store.</p>
                </div>
                {editingId ? <button className="btn btn-outline btn-sm" type="button" onClick={() => { setForm(emptyForm); setEditingId('') }}>Cancel edit</button> : null}
              </div>
              <form className="admin-products-form" onSubmit={(event) => void saveProduct(event)}>
                <label>SKU<input value={form.sku} onChange={(event) => updateField('sku', event.target.value)} maxLength={64} required /></label>
                <label>Product name<input value={form.name} onChange={(event) => updateField('name', event.target.value)} maxLength={120} required /></label>
                <label>Category<select value={form.category} onChange={(event) => updateField('category', event.target.value)} required><option value="">Choose a category</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Species<input value={form.species} onChange={(event) => updateField('species', event.target.value)} maxLength={80} required /></label>
                <label>Preparation<input value={form.preparation} onChange={(event) => updateField('preparation', event.target.value)} maxLength={80} required /></label>
                <label>Unit<input value={form.unit} onChange={(event) => updateField('unit', event.target.value)} maxLength={40} placeholder="Owner-confirmed unit" required /></label>
                <label>Size / pack label<input value={form.sizeLabel} onChange={(event) => updateField('sizeLabel', event.target.value)} maxLength={80} /></label>
                <label>Price (KES)<input type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => updateField('price', event.target.value)} disabled={!form.priceConfirmed} required={form.priceConfirmed} /></label>
                <label className="admin-products-check"><input type="checkbox" checked={form.priceConfirmed} onChange={(event) => updateField('priceConfirmed', event.target.checked)} /> Price confirmed by owner</label>
                <label>Quantity<input type="number" min="0" max="1000000" step="1" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} disabled={!form.priceConfirmed} required /></label>
                <label className="admin-products-check"><input type="checkbox" checked={form.active} onChange={(event) => updateField('active', event.target.checked)} disabled={!form.priceConfirmed} /> Active</label>
                <label className="admin-products-check"><input type="checkbox" checked={form.inStock} onChange={(event) => updateField('inStock', event.target.checked)} disabled={!form.priceConfirmed} /> In stock</label>
                <label className="admin-products-check"><input type="checkbox" checked={form.featured} onChange={(event) => updateField('featured', event.target.checked)} disabled={!form.priceConfirmed} /> Featured</label>
                <label className="admin-products-wide">Description<textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} maxLength={2000} rows={3} /></label>
                <label className="admin-products-wide">Photo paths / HTTPS URLs (one per line)<textarea value={form.photos} onChange={(event) => updateField('photos', event.target.value)} rows={3} /></label>
                <div className="admin-products-wide admin-products-actions">
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Saving…' : editingId ? 'Save product' : 'Create draft'}</button>
                </div>
              </form>
            </section>
            <section className="admin-products-panel" aria-labelledby="product-list-heading">
              <div className="admin-products-heading"><div><span className="panel-kicker">Inventory records</span><h2 id="product-list-heading">Catalogue inventory</h2></div></div>
              <div className="admin-products-list">
                {products.map((product) => (
                  <article className="admin-products-row" key={product.id}>
                    <div>
                      <h3>{product.name || 'Unnamed product'}</h3>
                      <p>{product.sku} · {product.sizeLabel || product.unit} · {product.priceConfirmed ? `KES ${product.price.toLocaleString()}` : 'Price unconfirmed'}</p>
                      <span>{product.active && product.inStock ? `Available · ${product.quantity} in stock` : 'Hidden or unavailable'}</span>
                    </div>
                    <div className="admin-products-actions">
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => { setForm(formForProduct(product)); setEditingId(product.id) }}>Edit</button>
                      <button className="btn btn-outline btn-sm" type="button" disabled={loading || !product.active} onClick={() => void deactivateProduct(product)}>Hide</button>
                    </div>
                  </article>
                ))}
                {products.length === 0 ? <p className="status-message info">No product records are present. Add only confirmed business data.</p> : null}
              </div>
            </section>
          </>
        )}
        {error ? <p className="status-message error" role="alert">{error}</p> : null}
        {notice ? <p className="status-message info" role="status">{notice}</p> : null}
      </main>
    </div>
  )
}
