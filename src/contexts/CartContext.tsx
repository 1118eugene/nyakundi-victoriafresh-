import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { CartItem, Product } from '../types'

interface CartContextValue {
  items: CartItem[]
  addToCart: (product: Product) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

const STORAGE_KEY = 'victoria-fresh-fish-cart'
const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      setItems(JSON.parse(raw))
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    addToCart: (product) => {
      setItems((current) => {
        const existing = current.find((item) => item.id === product.id)
        if (existing) {
          return current.map((item) =>
            item.id === product.id
              ? { ...item, cartQuantity: Math.min(item.cartQuantity + 1, item.quantity) }
              : item,
          )
        }

        return [...current, { ...product, cartQuantity: 1 }]
      })
    },
    removeFromCart: (productId) => {
      setItems((current) => current.filter((item) => item.id !== productId))
    },
    updateQuantity: (productId, quantity) => {
      setItems((current) =>
        current
          .map((item) =>
            item.id === productId
              ? { ...item, cartQuantity: Math.max(1, Math.min(quantity, item.quantity)) }
              : item,
          )
          .filter((item) => item.cartQuantity > 0),
      )
    },
    clearCart: () => setItems([]),
    itemCount: items.reduce((sum, item) => sum + item.cartQuantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.cartQuantity, 0),
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }

  return context
}
