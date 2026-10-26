'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Saved homes come first: finding a home again is the account's most common errand.
const tabs: Array<[string, string]> = [['/account/saved', 'Saved homes'], ['/account', 'Showings'], ['/account/questions', 'Questions'], ['/account/profile', 'Profile']]

export function AccountTabs() {
  const pathname = usePathname() || ''
  return (
    <nav className="sf-tabs" aria-label="Account">
      {tabs.map(([href, label]) => {
        const current = pathname === href || (href === '/account' && pathname.startsWith('/account/showings/'))
        return <Link key={href} href={href} className="sf-tabs__item" aria-current={current ? 'page' : undefined}>{label}</Link>
      })}
    </nav>
  )
}
