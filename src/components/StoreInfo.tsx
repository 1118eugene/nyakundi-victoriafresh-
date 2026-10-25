import { ReactNode } from 'react'
import './StoreInfo.css'

export default function StoreInfo({ title, children, tone = 'plain' }: { title?: string; children: ReactNode; tone?: 'plain' | 'accent' }) {
  return (
    <aside className={`store-info store-info-${tone}`}>
      {title ? <h3>{title}</h3> : null}
      <div>{children}</div>
    </aside>
  )
}
