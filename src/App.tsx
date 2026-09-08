import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import About from './pages/About'
import Contact from './pages/Contact'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Signup from './pages/Signup'
import AdminOrders from './pages/AdminOrders'
import FreshFish from './pages/FreshFish'
import Wholesale from './pages/Wholesale'
import Delivery from './pages/Delivery'
import FAQ from './pages/FAQ'
import Login from './pages/Login'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="main-content">
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
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}

export default App
