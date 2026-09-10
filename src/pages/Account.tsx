import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyOrders } from '../services/api'
import { useCustomer } from '../contexts/CustomerContext'
import { Order } from '../types'
import './Account.css'

export default function Account() {
  const { profile } = useCustomer()
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    fetchMyOrders().then(response => setOrders(response.data)).catch(err => setError(err instanceof Error ? err.message : 'Unable to load your orders.'))
  }, [])
  return <section className="account-page"><div className="container account-shell"><div className="account-heading"><span className="auth-step">CUSTOMER ACCOUNT</span><h1>Welcome, {profile?.customerName.split(' ')[0]}</h1><p>Your profile and recent Victoria Fresh Fish orders.</p></div><div className="account-grid"><article className="account-card"><h2>Your details</h2><dl><dt>Email</dt><dd>{profile?.email}</dd><dt>Phone</dt><dd>{profile?.phone}</dd><dt>Delivery</dt><dd>{profile?.town}, {profile?.county}<br />{profile?.addressLine}</dd></dl><Link to="/shop" className="btn btn-primary">Continue shopping</Link></article><article className="account-card"><h2>Recent orders</h2>{error && <p className="account-error">{error}</p>}{!error && orders.length === 0 && <p className="account-muted">Your recent orders will appear here.</p>}{orders.map(order => <div className="account-order" key={order.id}><div><strong>{order.orderNumber}</strong><span>{order.status.replace(/_/g, ' ')}</span></div><b>KES {order.totalPrice.toLocaleString()}</b></div>)}</article></div></div></section>
}
