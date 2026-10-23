'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs: Array<[string, string]> = [['/account', 'My showings'], ['/account/saved', 'Saved'], ['/account/profile', 'Profile']]

export function AccountTabs() {
  const pathname = usePathname()
  return (
    <nav className="sf-track" aria-label="Account">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} className="sf-track__item" aria-current={pathname === href ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  )
}
