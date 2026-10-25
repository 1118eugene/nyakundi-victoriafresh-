import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Component, ErrorInfo, lazy, ReactNode, Suspense, useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import MobileCartBar from './components/MobileCartBar'
import './App.css'
import { useCustomer } from './contexts/CustomerContext'
import { checkApiHealth } from './services/api'

const Home = lazy(() => import('./pages/Home'))
const Products = lazy(() => import('./pages/Products'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const TrackOrder = lazy(() => import('./pages/TrackOrder'))
const Signup = lazy(() => import('./pages/Signup'))
const AdminOrders = lazy(() => import('./pages/AdminOrders'))
const AdminProducts = lazy(() => import('./pages/AdminProducts'))
const AdminDeliveryZones = lazy(() => import('./pages/AdminDeliveryZones'))
const AdminSupport = lazy(() => import('./pages/AdminSupport'))
const DeliveryStaff = lazy(() => import('./pages/DeliveryStaff'))
const FreshFish = lazy(() => import('./pages/FreshFish'))
const Wholesale = lazy(() => import('./pages/Wholesale'))
const Delivery = lazy(() => import('./pages/Delivery'))
const FAQ = lazy(() => import('./pages/FAQ'))
const AdminFaqs = lazy(() => import('./pages/AdminFaqs'))
const AdminReviews = lazy(() => import('./pages/AdminReviews'))
const Login = lazy(() => import('./pages/Login'))
const Account = lazy(() => import('./pages/Account'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const ReturnsPolicy = lazy(() => import('./pages/ReturnsPolicy'))

function ApiWakeUpStatus() {
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [hasWaitedAMinute, setHasWaitedAMinute] = useState(false)

  useEffect(() => {
    let stopped = false
    let retryTimer: number | undefined
    let attempts = 0
    let controller: AbortController | undefined
    const startedAt = Date.now()

    const probe = async () => {
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 8000)
      try {
        if (await checkApiHealth(controller.signal)) {
          if (!stopped) {
            setIsWakingUp(false)
            setHasWaitedAMinute(false)
          }
          return
        }
      } catch {
        if (stopped) return
      } finally {
        window.clearTimeout(timeout)
      }

      if (stopped) return
      attempts += 1
      setIsWakingUp(true)
      setHasWaitedAMinute(Date.now() - startedAt >= 60000)
      retryTimer = window.setTimeout(() => { void probe() }, attempts === 1 ? 2000 : 5000)
    }

    void probe()
    return () => {
      stopped = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      controller?.abort()
    }
  }, [])

  if (!isWakingUp) return null
  return (
    <div className="api-wakeup" role="status" aria-live="polite">
      {hasWaitedAMinute
        ? 'The server is taking longer than usual to start. You can keep browsing while we keep trying.'
        : 'Waking up the server. This can take up to a minute on the free hosting plan; you can keep browsing.'}
    </div>
  )
}

const pageMetadata: Record<string, { title: string; description: string }> = {
  '/': { title: 'Fresh Fish in Kenya | Victoria Fresh Fish', description: 'Browse the Victoria Fresh Fish catalogue, check current availability and place an order for delivery.' },
  '/products': { title: 'Shop Fish | Victoria Fresh Fish', description: 'Browse fish and prepared products in the current Victoria Fresh Fish catalogue.' },
  '/shop': { title: 'Shop Fish | Victoria Fresh Fish', description: 'Browse fish and prepared products in the current Victoria Fresh Fish catalogue.' },
  '/fresh-fish': { title: 'Fresh Fish | Victoria Fresh Fish', description: 'Explore fresh fish products in the current Victoria Fresh Fish catalogue.' },
  '/wholesale': { title: 'Wholesale Orders | Victoria Fresh Fish', description: 'Contact Victoria Fresh Fish about wholesale product availability and ordering.' },
  '/delivery': { title: 'Delivery and Payment | Victoria Fresh Fish', description: 'Check delivery availability, fees and payment information for your area at checkout.' },
  '/faq': { title: 'Frequently Asked Questions | Victoria Fresh Fish', description: 'Answers to common questions about ordering, delivery, payment and products.' },
  '/cart': { title: 'Your Cart | Victoria Fresh Fish', description: 'Review the products and quantities in your Victoria Fresh Fish cart.' },
  '/checkout': { title: 'Checkout | Victoria Fresh Fish', description: 'Review your order details and submit a guest or account checkout.' },
  '/signup': { title: 'Create an Account | Victoria Fresh Fish', description: 'Create a Victoria Fresh Fish customer account.' },
  '/login': { title: 'Sign In | Victoria Fresh Fish', description: 'Sign in to your Victoria Fresh Fish customer account.' },
  '/about': { title: 'About Us | Victoria Fresh Fish', description: 'Learn about Victoria Fresh Fish and the information available about our business.' },
  '/contact': { title: 'Contact Us | Victoria Fresh Fish', description: 'Contact Victoria Fresh Fish using the available support options.' },
  '/account': { title: 'Your Account | Victoria Fresh Fish', description: 'Review your Victoria Fresh Fish customer account details.' },
  '/privacy': { title: 'Privacy Policy | Victoria Fresh Fish', description: 'How Victoria Fresh Fish handles customer and order information.' },
  '/terms': { title: 'Terms of Service | Victoria Fresh Fish', description: 'Terms for using the Victoria Fresh Fish website and placing orders.' },
  '/returns': { title: 'Delivery, Returns and Refunds | Victoria Fresh Fish', description: 'Delivery and customer support information for orders from Victoria Fresh Fish.' },
}

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    if (property) element.setAttribute('property', name)
    else element.name = name
    document.head.append(element)
  }
  element.content = content
}

function RouteMetadata() {
  const location = useLocation()
  useEffect(() => {
    const isOperationsPage = location.pathname.startsWith('/admin/') || location.pathname.startsWith('/delivery/staff')
    const isPrivatePage = ['/account', '/cart', '/checkout', '/login', '/signup'].includes(location.pathname)
      || location.pathname.startsWith('/track/')
    const isNotFoundPage = !pageMetadata[location.pathname] && !isOperationsPage && !location.pathname.startsWith('/track/')
    const metadata = pageMetadata[location.pathname]
      || (location.pathname.startsWith('/track/')
        ? { title: 'Track Your Order | Victoria Fresh Fish', description: 'View the latest status for your Victoria Fresh Fish order.' }
        : isOperationsPage
          ? { title: 'Operations | Victoria Fresh Fish', description: 'Victoria Fresh Fish operations portal.' }
          : { title: 'Page Not Found | Victoria Fresh Fish', description: 'The requested page could not be found.' })
    document.title = metadata.title
    setMeta('description', metadata.description)
    setMeta('og:title', metadata.title, true)
    setMeta('og:description', metadata.description, true)
    setMeta('og:type', 'website', true)
    setMeta('og:image', `${window.location.origin}/images/optimized/hero-sea.webp`, true)
    setMeta('og:url', `${window.location.origin}${location.pathname}`, true)
    const shouldHideFromSearch = isPrivatePage || isOperationsPage || isNotFoundPage
    setMeta('robots', shouldHideFromSearch ? 'noindex, nofollow' : 'index, follow')
    const canonicalPath = ['/shop', '/order-online'].includes(location.pathname) ? '/products' : location.pathname
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (shouldHideFromSearch) {
      canonical?.remove()
    } else {
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.append(canonical)
      }
      canonical.href = `${window.location.origin}${canonicalPath}`
    }
  }, [location.pathname])
  return null
}

function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <div className="info-panel" role="status">
          <p className="info-kicker">Page not found</p>
          <h1>We couldn’t find that page</h1>
          <p>The link may be out of date, or the address may have been entered incorrectly.</p>
          <p><Link className="btn btn-primary" to="/">Return to the home page</Link></p>
          <p><Link to="/products">Browse the catalogue</Link> or <Link to="/contact">contact the team</Link>.</p>
        </div>
      </div>
    </section>
  )
}

interface ErrorBoundaryState { hasError: boolean }
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Storefront rendering failed', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="section">
          <div className="container">
            <div className="info-panel" role="alert">
              <h1>We hit a problem</h1>
              <p>This page could not be displayed. Please try again, or return to the home page.</p>
              <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>Try again</button>
              {' '}<Link to="/">Home</Link>
            </div>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

function StorefrontRoutes() {
  const { profile, sessionLoading } = useCustomer()
  const location = useLocation()
  const protectedPath = location.pathname === '/account'

  if (sessionLoading && protectedPath) {
    return <div className="session-loading" role="status">Checking your secure customer session...</div>
  }
  if (!profile && protectedPath) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />
  }

  return (
    <Suspense fallback={<div className="session-loading" role="status">Loading this page...</div>}>
    <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/shop" element={<Products />} />
            <Route path="/fresh-fish" element={<FreshFish />} />
            <Route path="/wholesale" element={<Wholesale />} />
            <Route path="/order-online" element={<Products />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/track/:id" element={<TrackOrder />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/delivery-zones" element={<AdminDeliveryZones />} />
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/faqs" element={<AdminFaqs />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/delivery/staff" element={<DeliveryStaff />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<Account />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/returns" element={<ReturnsPolicy />} />
            <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <Router>
      <div className="app-layout">
        <RouteMetadata />
        <ApiWakeUpStatus />
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Header />
        <main className="main-content" id="main-content" tabIndex={-1}>
          <AppErrorBoundary>
            <StorefrontRoutes />
          </AppErrorBoundary>
        </main>
        <MobileCartBar />
        <Footer />
      </div>
    </Router>
  )
}

export default App
