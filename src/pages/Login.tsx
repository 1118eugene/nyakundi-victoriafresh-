import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCustomer } from '../contexts/CustomerContext'
import { loginCustomer } from '../services/api'
import './Auth.css'
import StoreInfo from '../components/StoreInfo'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { saveProfile } = useCustomer()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await loginCustomer({ identifier, password })
      const user = response.data.user
      saveProfile({
        customerName: user.customerName || '',
        email: user.email || '',
        phone: user.phone || '',
        county: user.county || '',
        town: user.town || '',
        addressLine: user.addressLine || '',
        landmark: user.landmark || '',
      })
      const from = (location.state as { from?: string } | null)?.from || '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Check your details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page"><div className="auth-shell auth-shell-compact">
      <aside className="auth-brand-panel"><div className="auth-mark">VFF</div><p className="auth-eyebrow">YOUR FRESH FISH ACCOUNT</p><h1>Welcome back to better seafood.</h1><p className="auth-brand-copy">Sign in to manage your account and saved delivery details. You can also order as a guest without signing in.</p><div className="auth-benefits"><span><b>01</b> Shop what is fresh today</span><span><b>02</b> Review saved account details</span><span><b>03</b> Keep track of your orders</span></div></aside>
      <div className="auth-form-panel"><div className="auth-form-heading"><span className="auth-step">CUSTOMER SIGN-IN</span><h2>Sign in to continue</h2><p>Enter the email or phone number and password used to create your account.</p></div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email or phone number<small>Use the email address or phone number registered to your account.</small><input value={identifier} onChange={event => setIdentifier(event.target.value)} required autoComplete="username" /></label>
          <label>Password<small>Enter the password you set for this account.</small><input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New to Victoria Fresh Fish? <Link to="/signup">Create your account</Link></p>
        <StoreInfo title="Account help"><p>Guest checkout does not require an account. If you cannot access an existing account, contact the team to request help with a temporary password.</p></StoreInfo>
      </div>
    </div></section>
  )
}
