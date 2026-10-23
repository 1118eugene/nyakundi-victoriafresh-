import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCustomer } from '../contexts/CustomerContext'
import { signupCustomer } from '../services/api'
import './Auth.css'

const initialValues = {
  customerName: '',
  email: '',
  phone: '',
  county: '',
  town: '',
  addressLine: '',
  landmark: '',
  password: '',
}

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { saveProfile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await signupCustomer(values)
      const user = response.data.user
      saveProfile({
        customerName: user.customerName || values.customerName,
        email: user.email || values.email,
        phone: user.phone || values.phone,
        county: user.county || values.county,
        town: user.town || values.town,
        addressLine: user.addressLine || values.addressLine,
        landmark: user.landmark || values.landmark,
      })
      localStorage.setItem('victoria-customer-token', response.data.token)
      const from = (location.state as { from?: string } | null)?.from || '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand-panel">
          <div className="auth-mark">VFF</div>
          <p className="auth-eyebrow">VICTORIA FRESH FISH KENYA</p>
          <h1>Fresh from the lake. Delivered with care.</h1>
          <p className="auth-brand-copy">Create your customer account to save delivery details and keep track of your orders.</p>
          <div className="auth-benefits"><span><b>01</b> Verified fresh products</span><span><b>02</b> Reliable county delivery</span><span><b>03</b> Secure password sign-in</span></div>
        </aside>
        <div className="auth-form-panel">
          <div className="auth-form-heading"><span className="auth-step">WELCOME TO THE STORE</span><h2>Create your account</h2><p>Set a password to securely manage your account and orders.</p></div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field-grid">
              <label>Full name<input value={values.customerName} onChange={event => setValues({ ...values, customerName: event.target.value })} required autoComplete="name" maxLength={120} /></label>
              <label>Email<input type="email" value={values.email} onChange={event => setValues({ ...values, email: event.target.value })} required autoComplete="email" maxLength={254} /></label>
              <label>Phone number<input value={values.phone} onChange={event => setValues({ ...values, phone: event.target.value })} required placeholder="07XXXXXXXX or +2547XXXXXXXX" autoComplete="tel" /></label>
              <label>Password<input type="password" value={values.password} onChange={event => setValues({ ...values, password: event.target.value })} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
              <label>County<input value={values.county} onChange={event => setValues({ ...values, county: event.target.value })} required /></label>
              <label>Town<input value={values.town} onChange={event => setValues({ ...values, town: event.target.value })} required /></label>
            </div>
            <label>Delivery address<input value={values.addressLine} onChange={event => setValues({ ...values, addressLine: event.target.value })} required placeholder="Estate, building or house number" maxLength={300} /></label>
            <label>Landmark <span className="optional">(optional)</span><input value={values.landmark} onChange={event => setValues({ ...values, landmark: event.target.value })} placeholder="Near the market or estate" maxLength={200} /></label>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Creating account...' : 'Create account'}</button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </section>
  )
}
