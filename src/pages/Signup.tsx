import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCustomer } from '../contexts/CustomerContext'
import { signupCustomer, verifyOtp } from '../services/api'
import './Auth.css'

const initialValues = { customerName: '', email: '', phone: '', county: '', town: '', addressLine: '', landmark: '', preferredPayment: 'mpesa' }

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { saveProfile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (!resendIn) return
    const timer = window.setInterval(() => setResendIn(value => Math.max(value - 1, 0)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const response = await signupCustomer(values)
      setOtpSent(true)
      setResendIn(60)
      setSuccess(response.message || 'Your verification code has been sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  async function handleResend() {
    if (resendIn || submitting) return
    setSubmitting(true); setError('')
    try {
      const response = await signupCustomer(values)
      setResendIn(60)
      setSuccess(response.message || 'A new verification code has been sent.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to resend your verification code.') }
    finally { setSubmitting(false) }
  }

  async function handleVerifyOtp() {
    if (!values.phone || !otpCode.trim()) { setError('Enter the six-digit code sent to your phone.'); return }
    setSubmitting(true); setError('')
    try {
      const response = await verifyOtp({ phone: values.phone, code: otpCode.trim() })
      const user = response.data.user
      saveProfile({ customerName: user.customerName || values.customerName, email: user.email || values.email, phone: user.phone || values.phone, county: user.county || values.county, town: user.town || values.town, addressLine: user.addressLine || values.addressLine, landmark: user.landmark || values.landmark })
      localStorage.setItem('victoria-customer-token', response.data.token)
      setSuccess('Phone verified successfully. Welcome to the shop.')
      const from = (location.state as { from?: string } | null)?.from || '/'
      window.setTimeout(() => navigate(from, { replace: true }), 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please check the code.')
    } finally { setSubmitting(false) }
  }

  return (
    <section className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand-panel">
          <div className="auth-mark">VFF</div>
          <p className="auth-eyebrow">VICTORIA FRESH FISH KENYA</p>
          <h1>Fresh from the lake. Delivered with care.</h1>
          <p className="auth-brand-copy">Create your secure customer account to browse today&apos;s catch, save delivery details, and pay safely with M-Pesa.</p>
          <div className="auth-benefits"><span><b>01</b> Verified fresh products</span><span><b>02</b> Reliable county delivery</span><span><b>03</b> Secure OTP sign-in</span></div>
        </aside>
        <div className="auth-form-panel">
          <div className="auth-form-heading"><span className="auth-step">WELCOME TO THE STORE</span><h2>Create your account</h2><p>Verify your phone once, then enjoy the full Victoria Fresh Fish experience.</p></div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field-grid">
              <label>Full name<input value={values.customerName} onChange={e => setValues({ ...values, customerName: e.target.value })} required autoComplete="name" /></label>
              <label>Email<input type="email" value={values.email} onChange={e => setValues({ ...values, email: e.target.value })} required autoComplete="email" /></label>
              <label>Phone number<input value={values.phone} onChange={e => setValues({ ...values, phone: e.target.value })} required placeholder="07XXXXXXXX or +2547XXXXXXXX" autoComplete="tel" /></label>
              <label>Preferred payment<select value={values.preferredPayment} onChange={e => setValues({ ...values, preferredPayment: e.target.value })}><option value="mpesa">M-Pesa</option><option value="fuliza">Fuliza</option><option value="both">Both</option></select></label>
              <label>County<input value={values.county} onChange={e => setValues({ ...values, county: e.target.value })} required /></label>
              <label>Town<input value={values.town} onChange={e => setValues({ ...values, town: e.target.value })} required /></label>
            </div>
            <label>Delivery address<input value={values.addressLine} onChange={e => setValues({ ...values, addressLine: e.target.value })} required placeholder="Estate, building or house number" /></label>
            <label>Landmark <span className="optional">(optional)</span><input value={values.landmark} onChange={e => setValues({ ...values, landmark: e.target.value })} placeholder="Near the market or estate" /></label>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            {success && <p className="auth-message success" role="status">{success}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Preparing verification...' : 'Create account & continue'}</button>
          </form>
          {otpSent && <div className="otp-panel"><div><span className="auth-step">STEP 2 OF 2</span><h3>Verify your phone</h3><p>Enter the six-digit code sent to <strong>{values.phone}</strong>.</p></div><label>Verification code<input value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label><button type="button" onClick={() => void handleVerifyOtp()} className="auth-submit" disabled={submitting}>Verify OTP and enter the shop</button><button type="button" onClick={() => void handleResend()} disabled={submitting || resendIn > 0} className="auth-secondary">{resendIn ? `Resend code in ${resendIn}s` : 'Resend code'}</button><p className="auth-help">You can edit your email, phone, or delivery details before requesting another code.</p></div>}
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in securely</Link></p>
        </div>
      </div>
    </section>
  )
}
