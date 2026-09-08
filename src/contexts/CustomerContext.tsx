import { createContext, useContext, useMemo, useState } from 'react'

export interface CustomerProfile {
  customerName: string
  email: string
  phone: string
  county: string
  town: string
  addressLine: string
  landmark: string
}

interface CustomerContextValue {
  profile: CustomerProfile | null
  saveProfile: (profile: CustomerProfile) => void
  clearProfile: () => void
}

const storageKey = 'victoria-customer-profile'
const CustomerContext = createContext<CustomerContextValue | undefined>(undefined)

function readProfile() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) as CustomerProfile : null
  } catch {
    return null
  }
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(() => readProfile())

  const value = useMemo(() => ({
    profile,
    saveProfile: (nextProfile: CustomerProfile) => {
      setProfile(nextProfile)
      window.localStorage.setItem(storageKey, JSON.stringify(nextProfile))
    },
    clearProfile: () => {
      setProfile(null)
      window.localStorage.removeItem(storageKey)
    },
  }), [profile])

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

export function useCustomer() {
  const context = useContext(CustomerContext)
  if (!context) throw new Error('useCustomer must be used inside CustomerProvider')
  return context
}
