import { type CSSProperties, type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendOtp, signupCustomer, verifyOtp } from '../services/api'
import { useCustomer } from '../contexts/CustomerContext'

const initialValues = {
  customerName: '',
  email: '',
  phone: '',
  county: '',
  town: '',
  addressLine: '',
  landmark: '',
  preferredPayment: 'mpesa',
}

export default function Signup() {
  const navigate = useNavigate()
  const { saveProfile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await signupCustomer(values)
      setOtpSent(true)
      setSuccess(response.message || 'Your OTP has been generated. Please verify the code sent to your phone.')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign up failed')
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!values.phone || !otpCode.trim()) {
      setError('Enter your phone number and the OTP code you received.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await verifyOtp({ phone: values.phone, code: otpCode.trim() })
      saveProfile({
        customerName: values.customerName,
        email: values.email,
        phone: values.phone,
        county: values.county,
        town: values.town,
        addressLine: values.addressLine,
        landmark: values.landmark,
      })
      localStorage.setItem('victoria-customer-token', response.data.token)
      setSuccess('Phone verified successfully. Redirecting to checkout...')
      setTimeout(() => navigate('/checkout'), 600)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('OTP verification failed')
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = () => {
    setSuccess('Google sign-in is available as a profile shortcut. Complete your phone and OTP verification to continue safely.')
  }

  return (
    <section style={{ maxWidth: 760, margin: '3rem auto', padding: '0 1rem' }}>
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', padding: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Create account</h1>
        <p style={{ color: '#475569', marginTop: 0 }}>Sign up with Google, fill your delivery details, and verify with OTP before paying.</p>

        <button type="button" onClick={handleGoogleSignIn} style={primaryButtonStyle}>Continue with Google</button>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={fieldStyle}>
              Full name
              <input value={values.customerName} onChange={(event) => setValues({ ...values, customerName: event.target.value })} required style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Email
              <input type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} required style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Phone number
              <input value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} required placeholder="07XXXXXXXX or +2547XXXXXXXX" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Preferred payment
              <select value={values.preferredPayment} onChange={(event) => setValues({ ...values, preferredPayment: event.target.value })} style={inputStyle}>
                <option value="mpesa">M-Pesa</option>
                <option value="fuliza">Fuliza</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label style={fieldStyle}>
              County
              <input value={values.county} onChange={(event) => setValues({ ...values, county: event.target.value })} required style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Town
              <input value={values.town} onChange={(event) => setValues({ ...values, town: event.target.value })} required style={inputStyle} />
            </label>
          </div>

          <label style={fieldStyle}>
            Delivery address
            <input value={values.addressLine} onChange={(event) => setValues({ ...values, addressLine: event.target.value })} required style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            Landmark
            <input value={values.landmark} onChange={(event) => setValues({ ...values, landmark: event.target.value })} placeholder="Near the market or estate" style={inputStyle} />
          </label>

          {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
          {success ? <p style={{ margin: 0, color: '#166534', fontWeight: 700 }}>{success}</p> : null}

          <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Sending OTP...' : 'Create account and send OTP'}
          </button>
        </form>

        {otpSent ? (
          <div style={{ marginTop: '1.5rem', background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Verification code
              <input value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="Enter 6-digit code" style={inputStyle} />
            </label>
            <button type="button" onClick={handleVerifyOtp} style={{ ...primaryButtonStyle, marginTop: '0.75rem' }}>
              Verify OTP and continue
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontWeight: 600,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box',
  fontSize: '1rem',
}

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  background: '#0f766e',
  color: '#fff',
  borderRadius: 10,
  padding: '0.9rem 1.1rem',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
}
