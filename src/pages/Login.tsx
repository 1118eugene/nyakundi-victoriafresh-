import { type CSSProperties, type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomer } from '../contexts/CustomerContext'
import { requestLoginOtp, verifyOtp } from '../services/api'

const initialValues = {
  customerName: '',
  email: '',
  phone: '',
  county: '',
  town: '',
  addressLine: '',
  landmark: '',
}

export default function Login() {
  const navigate = useNavigate()
  const { saveProfile } = useCustomer()
  const [values, setValues] = useState(initialValues)
  const [error, setError] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedEmail = values.email.trim()
    const trimmedPhone = values.phone.trim()

    if (!trimmedEmail && !trimmedPhone) {
      setError('Enter the email or phone number used when you signed up.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await requestLoginOtp({ email: trimmedEmail || undefined, phone: trimmedPhone || undefined })
      setValues((current) => ({ ...current, phone: response.data.phone }))
      setOtpSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the login OTP.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async () => {
    if (!otp.trim()) {
      setError('Enter the OTP sent to your phone.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await verifyOtp({ phone: values.phone, code: otp.trim() })
      const user = response.data.user
      saveProfile({
        customerName: user.customerName || '',
        email: user.email || '',
        phone: user.phone || values.phone,
        county: user.county || '',
        town: user.town || '',
        addressLine: user.addressLine || '',
        landmark: user.landmark || '',
      })
      localStorage.setItem('victoria-customer-token', response.data.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '2rem' }}>
        <h1 style={{ margin: '0 0 0.75rem', fontSize: '2rem' }}>Sign in with OTP</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#475569' }}>
          Verify your phone to access the full shop and saved delivery details.
        </p>
        <p style={{ margin: '0 0 1rem' }}>
          Need an account? <a href="/signup" style={{ color: '#0f766e', fontWeight: 700 }}>Create one here</a>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Full name (optional)
            <input
              value={values.customerName}
              onChange={(event) => setValues({ ...values, customerName: event.target.value })}
              placeholder="Your name"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Email
            <input
              type="email"
              value={values.email}
              onChange={(event) => setValues({ ...values, email: event.target.value })}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Phone
            <input
              value={values.phone}
              onChange={(event) => setValues({ ...values, phone: event.target.value })}
              placeholder="07XXXXXXXX or +2547XXXXXXXX"
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              County
              <input
                value={values.county}
                onChange={(event) => setValues({ ...values, county: event.target.value })}
                placeholder="Nairobi"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Town
              <input
                value={values.town}
                onChange={(event) => setValues({ ...values, town: event.target.value })}
                placeholder="Kisumu"
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Address line
            <input
              value={values.addressLine}
              onChange={(event) => setValues({ ...values, addressLine: event.target.value })}
              placeholder="House number or estate"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Landmark (optional)
            <input
              value={values.landmark}
              onChange={(event) => setValues({ ...values, landmark: event.target.value })}
              placeholder="Near the bus stop"
              style={inputStyle}
            />
          </label>

          {error ? (
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              border: 'none',
              borderRadius: 10,
              background: '#0f766e',
              color: '#fff',
              padding: '0.9rem 1.1rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {submitting ? 'Sending OTP...' : 'Send login OTP'}
          </button>
        </form>
        {otpSent ? (
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Verification code
              <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6-digit OTP" style={inputStyle} />
            </label>
            <button type="button" onClick={() => void handleVerify()} disabled={submitting} style={buttonStyle}>
              Verify and enter the shop
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  fontSize: '1rem',
  boxSizing: 'border-box',
}

const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  background: '#0f766e',
  color: '#fff',
  padding: '0.9rem 1.1rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
}
