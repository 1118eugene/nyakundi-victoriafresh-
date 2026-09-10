import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomer } from '../contexts/CustomerContext'
import { requestLoginOtp, verifyOtp } from '../services/api'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { saveProfile } = useCustomer()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() && !phone.trim()) { setError('Enter the email or phone number used when you signed up.'); return }
    setSubmitting(true); setError('')
    try {
      const response = await requestLoginOtp({ email: email.trim() || undefined, phone: phone.trim() || undefined })
      setPhone(response.data.phone); setOtpSent(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your sign-in code.') }
    finally { setSubmitting(false) }
  }

  async function handleVerify() {
    if (!otp.trim()) { setError('Enter the six-digit code sent to your phone.'); return }
    setSubmitting(true); setError('')
    try {
      const response = await verifyOtp({ phone, code: otp.trim() })
      const user = response.data.user
      saveProfile({ customerName: user.customerName || '', email: user.email || '', phone: user.phone || phone, county: user.county || '', town: user.town || '', addressLine: user.addressLine || '', landmark: user.landmark || '' })
      localStorage.setItem('victoria-customer-token', response.data.token)
      navigate('/')
    } catch (err) { setError(err instanceof Error ? err.message : 'Verification failed. Please check the code.') }
    finally { setSubmitting(false) }
  }

  return (
    <section className="auth-page"><div className="auth-shell auth-shell-compact">
      <aside className="auth-brand-panel"><div className="auth-mark">VFF</div><p className="auth-eyebrow">YOUR FRESH FISH ACCOUNT</p><h1>Welcome back to better seafood.</h1><p className="auth-brand-copy">Sign in to access the store, your saved delivery details, and secure M-Pesa checkout.</p><div className="auth-benefits"><span><b>01</b> Shop what is fresh today</span><span><b>02</b> Track every order</span><span><b>03</b> Pay securely with M-Pesa</span></div></aside>
      <div className="auth-form-panel"><div className="auth-form-heading"><span className="auth-step">SECURE CUSTOMER SIGN-IN</span><h2>Sign in to continue</h2><p>Enter your registered email or phone. We&apos;ll send a one-time code to your verified phone.</p></div>
        <form onSubmit={handleSubmit} className="auth-form"><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label><div className="auth-divider"><span>or use your phone</span></div><label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX or +2547XXXXXXXX" autoComplete="tel" /></label>{error && <p className="auth-message error" role="alert">{error}</p>}<button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Sending your code...' : 'Send secure sign-in code'}</button></form>
        {otpSent && <div className="otp-panel"><div><span className="auth-step">VERIFICATION REQUIRED</span><h3>Check your phone</h3><p>Enter the one-time code sent to <strong>{phone}</strong>.</p></div><label>Verification code<input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label><button type="button" onClick={() => void handleVerify()} disabled={submitting} className="auth-submit">Verify and enter the shop</button></div>}
        <p className="auth-switch">New to Victoria Fresh Fish? <Link to="/signup">Create your account</Link></p>
      </div>
    </div></section>
  )
}
