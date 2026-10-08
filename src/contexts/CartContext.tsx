import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Product } from '../types'
import { fetchProductById } from '../services/api'
import { addCartProduct, readCart, StoredCartItem, updateCartProductQuantity } from './cartUtils'

interface CartContextValue {
  items: StoredCartItem[]
  addToCart: (product: Product, quantity?: number) => string | null
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => string | null
  clearCart: () => void
  refreshCart: () => Promise<{ ok: boolean; changedPrices: number }>
  acknowledgePriceChanges: () => void
  catalogStatus: 'idle' | 'checking' | 'ready' | 'error'
  catalogError: string
  cartNotice: string
  persistenceError: string
  itemCount: number
  subtotal: number
}

const STORAGE_KEY = 'victoria-fresh-fish-cart'
const CartContext = createContext<CartContextValue | undefined>(undefined)

function loadInitialCart() {
  if (typeof window === 'undefined') return { items: [] as StoredCartItem[], notice: '' }
  try {
    const restored = readCart(window.localStorage.getItem(STORAGE_KEY))
    if (restored.expired || restored.invalid) window.localStorage.removeItem(STORAGE_KEY)
    const notice = restored.expired
      ? 'Your saved cart had expired and was cleared. Browse the current catalogue to add products again.'
      : restored.invalid ? 'Some saved cart data could not be restored. The cart was safely reset.' : ''
    return { items: restored.items, notice }
  } catch {
    return { items: [] as StoredCartItem[], notice: 'Saved cart storage is unavailable in this browser.' }
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [initialCart] = useState(loadInitialCart)
  const [items, setItems] = useState<StoredCartItem[]>(initialCart.items)
  const [cartNotice, setCartNotice] = useState(initialCart.notice)
  const itemsRef = useRef(items)
  const [catalogStatus, setCatalogStatus] = useState<CartContextValue['catalogStatus']>('idle')
  const [catalogError, setCatalogError] = useState('')
  const [persistenceError, setPersistenceError] = useState('')
  const refreshInFlight = useRef(false)

  useEffect(() => {
    try {
      if (items.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY)
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), items }))
      }
      setPersistenceError('')
    } catch {
      setPersistenceError('This browser could not save your cart. Keep this page open until you finish checkout.')
    }
  }, [items])

  useEffect(() => {
    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = readCart(event.newValue).items
      setCartNotice('Your cart was updated in another browser tab.')
      itemsRef.current = next
      setItems(next)
    }
    window.addEventListener('storage', syncFromOtherTab)
    return () => window.removeEventListener('storage', syncFromOtherTab)
  }, [])

  const addToCart = useCallback((product: Product, quantity = 1) => {
    const current = itemsRef.current
    const result = addCartProduct(current, product, quantity)
    if (result.error) return result.error
    itemsRef.current = result.items
    setItems(result.items)
    setCartNotice('')
    return null
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    const next = itemsRef.current.filter((item) => item.id !== productId)
    itemsRef.current = next
    setItems(next)
    setCartNotice('')
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const result = updateCartProductQuantity(itemsRef.current, productId, quantity)
    if (result.error) return result.error
    itemsRef.current = result.items
    setItems(result.items)
    setCartNotice('')
    return null
  }, [])

  const clearCart = useCallback(() => {
    itemsRef.current = []
    setItems([])
  }, [])

  const refreshCart = useCallback(async () => {
    if (refreshInFlight.current) return { ok: false, changedPrices: 0 }
    const snapshot = itemsRef.current
    if (!snapshot.length) {
      setCatalogStatus('ready')
      setCatalogError('')
      return { ok: true, changedPrices: 0 }
    }
    refreshInFlight.current = true
    setCatalogStatus('checking')
    setCatalogError('')
    const results = await Promise.all(snapshot.map(async (item) => {
      try {
        const response = await fetchProductById(item.id)
        return { id: item.id, product: response.data, missing: false }
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode
        if (status === 404) return { id: item.id, product: null, missing: true }
        throw error
      }
    }).map(async (result) => {
      try { return await result } catch (error) { return { error } }
    }))
    const failure = results.find((result) => 'error' in result)
    if (failure && 'error' in failure) {
      const message = failure.error instanceof Error ? failure.error.message : 'Could not verify current product availability.'
      setCatalogStatus('error')
      setCatalogError(message)
      refreshInFlight.current = false
      return { ok: false, changedPrices: 0 }
    }

    const verifiedIds = new Set<string>()
    for (const result of results) {
      if (!('error' in result)) verifiedIds.add(result.id)
    }
    if (itemsRef.current.some((item) => !verifiedIds.has(item.id))) {
      setCatalogStatus('error')
      setCatalogError('Your cart changed while its products were being checked. Retry the catalogue check before continuing.')
      refreshInFlight.current = false
      return { ok: false, changedPrices: 0 }
    }

    let changedPrices = 0
    const next = itemsRef.current.map((item): StoredCartItem => {
      const result = results.find((entry) => !('error' in entry) && entry.id === item.id)
      if (!result || 'error' in result) return item
      if (result.missing || !result.product) {
        return { ...item, quantity: 0, inStock: false, active: false, availabilityStatus: 'unavailable' }
      }
      const product = result.product
      const previousPrice = item.price === product.price
        ? item.previousPrice === product.price ? null : item.previousPrice ?? null
        : item.previousPrice ?? item.price
      if (item.price !== product.price && item.previousPrice === null) changedPrices += 1
      return { ...product, cartQuantity: item.cartQuantity, availabilityStatus: 'available', previousPrice }
    })
    itemsRef.current = next
    setItems(next)
    setCatalogStatus('ready')
    refreshInFlight.current = false
    return { ok: true, changedPrices }
  }, [items])

  useEffect(() => {
    const refreshAfterReconnect = () => {
      if (itemsRef.current.length && catalogStatus !== 'checking') void refreshCart()
    }
    window.addEventListener('online', refreshAfterReconnect)
    return () => window.removeEventListener('online', refreshAfterReconnect)
  }, [catalogStatus, refreshCart])

  const acknowledgePriceChanges = useCallback(() => {
    const next = itemsRef.current.map((item) => ({ ...item, previousPrice: null }))
    itemsRef.current = next
    setItems(next)
  }, [])

  const value = useMemo<CartContextValue>(() => ({
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    refreshCart,
    acknowledgePriceChanges,
    catalogStatus,
    catalogError,
    cartNotice,
    persistenceError,
    itemCount: items.reduce((sum, item) => sum + item.cartQuantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.cartQuantity, 0),
  }), [items, addToCart, removeFromCart, updateQuantity, clearCart, refreshCart, acknowledgePriceChanges, catalogStatus, catalogError, cartNotice, persistenceError])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}