'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Heart, Menu, UserRound, X } from 'lucide-react'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { customerSignOut } from '@/features/storefront/lib/data/account'
import { contactHref } from '@/features/storefront/lib/format'
import { BrokerageMark } from './BrokerageMark'

export type StorefrontSections = { neighborhoods?: boolean; advisors?: boolean }

const INTENTS: Array<[string, string]> = [['sale', 'Buy'], ['rent', 'Rent']]

/** Buy/Rent keeps the rest of the search when the shopper is already looking at results. */
function intentHref(pathname: string, current: URLSearchParams, value: string) {
  const onResults = pathname === '/listings' || pathname === '/'
  const next = new URLSearchParams(onResults ? current.toString() : '')
  next.delete('skip')
  if (current.get('type') === value && onResults) next.delete('type')
  else next.set('type', value)
  const query = next.toString()
  return query ? `/listings?${query}` : '/listings'
}

export function StorefrontNavBar({ settings, sections = { neighborhoods: true, advisors: true }, customerName, savedCount = 0 }: { settings: BrokerageSettings; sections?: StorefrontSections; customerName: string | null; savedCount?: number }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() || '/'
  const contact = contactHref(settings)
  const close = () => setOpen(false)
  const links: Array<[string, string]> = [
    ['/listings', 'Homes'],
    ...(sections.neighborhoods ? [['/#neighborhoods', 'Neighborhoods'] as [string, string]] : []),
    ...(sections.advisors ? [['/#advisors', 'Advisors'] as [string, string]] : []),
  ]

  return (
    <header className="sf-header">
      <div className="sf-header__bar">
        <Link href="/" className="sf-lockup" aria-label={`${settings.businessName} home`} onClick={close}>
          <BrokerageMark className="sf-lockup__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
          <span className="sf-lockup__name">
            <strong>{settings.businessName}</strong>
            {settings.marketLabel ? <small>{settings.marketLabel}</small> : null}
          </span>
        </Link>

        <nav className="sf-segment sf-header__intent" aria-label="Buy or rent">
          <Suspense fallback={INTENTS.map(([value, label]) => <Link key={value} href={`/listings?type=${value}`} className="sf-segment__item">{label}</Link>)}>
            <IntentLinks onNavigate={close} />
          </Suspense>
        </nav>

        <nav className="sf-header__nav" aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={href === pathname ? 'page' : undefined}>{label}</Link>)}
          {contact ? <a href={contact}>Contact</a> : null}
        </nav>

        <div className="sf-header__actions">
          <Link href={customerName ? '/account/saved' : `/account?from=${encodeURIComponent('/account/saved')}`} className="sf-header__saved" aria-label={customerName ? `Saved homes, ${savedCount}` : 'Saved homes, sign in'}>
            <Heart aria-hidden /><span>Saved</span>{customerName && savedCount ? <b className="sf-num">{savedCount}</b> : null}
          </Link>
          <Link href="/account" className="sf-header__account" title={customerName || undefined}>
            <UserRound aria-hidden /><span>{customerName || 'Sign in'}</span>
          </Link>
        </div>

        <button
          type="button"
          className="sf-header__toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="sf-mobile-nav"
          onClick={() => setOpen(value => !value)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav id="sf-mobile-nav" className="sf-mobile-nav" aria-label="Menu">
          {links.map(([href, label]) => <Link key={href} href={href} onClick={close}>{label}</Link>)}
          {customerName ? <>
            <Link href="/account/saved" onClick={close}>Saved homes{savedCount ? <b className="sf-num">{savedCount}</b> : null}</Link>
            <Link href="/account" onClick={close}>My showings</Link>
          </> : <Link href="/account" onClick={close}>Sign in</Link>}
          {contact ? <a href={contact} onClick={close}>Contact</a> : null}
          {customerName ? <form action={customerSignOut}><button type="submit" className="sf-mobile-nav__signout">Sign out</button></form> : null}
        </nav>
      ) : null}
    </header>
  )
}

/** Reads the current search so Buy/Rent shows its state and keeps the other filters. */
function IntentLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const current = new URLSearchParams(searchParams?.toString() || '')
  const activeIntent = pathname === '/listings' || pathname === '/' ? current.get('type') : null
  return <>{INTENTS.map(([value, label]) => (
    <Link key={value} href={intentHref(pathname, current, value)} className="sf-segment__item" aria-current={activeIntent === value ? 'page' : undefined} onClick={onNavigate}>{label}</Link>
  ))}</>
}
