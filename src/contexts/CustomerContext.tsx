import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchCurrentCustomer } from '../services/api'

export interface CustomerProfile { customerName: string; email: string; phone: string; county: string; town: string; addressLine: string; landmark: string }
interface CustomerContextValue { profile: CustomerProfile | null; saveProfile: (profile: CustomerProfile) => void; clearProfile: () => void; sessionLoading: boolean }
const storageKey = 'victoria-customer-profile'
const tokenKey = 'victoria-customer-token'
const CustomerContext = createContext<CustomerContextValue | undefined>(undefined)

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  useEffect(() => {
    const clearSession = () => { setProfile(null); localStorage.removeItem(storageKey); localStorage.removeItem(tokenKey) }
    window.addEventListener('victoria-session-invalidated', clearSession)
    if (!localStorage.getItem(tokenKey)) { clearSession(); setSessionLoading(false); return () => window.removeEventListener('victoria-session-invalidated', clearSession) }
    fetchCurrentCustomer().then(response => {
      const user = response.data.user
      setProfile({ customerName: user.customerName, email: user.email, phone: user.phone, county: user.county, town: user.town, addressLine: user.addressLine, landmark: user.landmark })
      localStorage.setItem(storageKey, JSON.stringify(user))
    }).catch(clearSession).finally(() => setSessionLoading(false))
    return () => window.removeEventListener('victoria-session-invalidated', clearSession)
  }, [])
  const value = useMemo(() => ({
    profile,
    sessionLoading,
    saveProfile: (nextProfile: CustomerProfile) => { setProfile(nextProfile); localStorage.setItem(storageKey, JSON.stringify(nextProfile)) },
    clearProfile: () => { setProfile(null); localStorage.removeItem(storageKey); localStorage.removeItem(tokenKey) },
  }), [profile, sessionLoading])
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}
export function useCustomer() { const context = useContext(CustomerContext); if (!context) throw new Error('useCustomer must be used inside CustomerProvider'); return context }
