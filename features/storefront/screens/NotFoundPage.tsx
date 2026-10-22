import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountShell } from '../components/AccountShell'

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } }

export default function NotFoundPage() {
  return <AccountShell>
    <main className="sf-container sf-section">
      <div className="sf-state">
        <p className="sf-eyebrow">404</p>
        <h1>Page not found</h1>
        <p>This home or page is no longer available.</p>
        <Link href="/#homes" className="sf-btn sf-btn--primary">Browse homes</Link>
      </div>
    </main>
  </AccountShell>
}
