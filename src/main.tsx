import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CartProvider } from './contexts/CartContext.tsx'
import { CustomerProvider } from './contexts/CustomerContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CustomerProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </CustomerProvider>
  </React.StrictMode>,
)
