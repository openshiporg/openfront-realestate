'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useState, type ReactNode } from 'react'
import { Bookmark, Heart, House, Map as MapIcon, Menu, MessageCircle, Search, UserRound, X } from 'lucide-react'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { customerSignOut } from '@/features/storefront/lib/data/account'
import { emailHref } from '@/features/storefront/lib/format'
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

/** "List your home" opens a message to the office with the subject filled in. */
function listHomeHref(settings: BrokerageSettings) {
  const email = emailHref(settings.publicEmail)
  return email ? `${email}?subject=${encodeURIComponent('Listing my home with ' + settings.businessName)}` : null
}

export function StorefrontNavBar({ settings, sections = { neighborhoods: true, advisors: true }, customerName, savedCount = 0, search }: { settings: BrokerageSettings; sections?: StorefrontSections; customerName: string | null; savedCount?: number; search?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() || '/'
  const close = () => setOpen(false)
  const listHome = listHomeHref(settings)
  const contact = emailHref(settings.publicEmail)
  const signedIn = Boolean(customerName)
  const savedHref = signedIn ? '/account/saved' : `/account?from=${encodeURIComponent('/account/saved')}`

  return (
    <>
      <header className="sf-header" data-search={search ? true : undefined}>
        <div className="sf-header__bar">
          <Link href="/" className="sf-lockup" aria-label={`${settings.businessName} home`} onClick={close}>
            <BrokerageMark className="sf-lockup__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
            <span className="sf-lockup__name">{settings.businessName}</span>
          </Link>

          <nav className="sf-header__nav" aria-label="Primary navigation">
            <Suspense fallback={INTENTS.map(([value, label]) => <Link key={value} href={`/listings?type=${value}`}>{label}</Link>)}>
              <IntentLinks onNavigate={close} />
            </Suspense>
            {listHome ? <a href={listHome}>Sell</a> : null}
            {sections.advisors ? <Link href="/#agents">Agents</Link> : null}
            {sections.neighborhoods ? <Link href="/#neighborhoods">Neighborhoods</Link> : null}
          </nav>

          <div className="sf-header__actions">
            {search ? null : <Link href="/listings" className="sf-header__icon" aria-label="Search homes"><Search aria-hidden /></Link>}
            <Link href={savedHref} className="sf-header__icon" aria-label={signedIn ? `Saved homes, ${savedCount}` : 'Saved homes, sign in'}>
              <Heart aria-hidden />{signedIn && savedCount ? <b className="sf-num">{savedCount}</b> : null}
            </Link>
            <Link href="/account" className={search ? 'sf-header__account' : 'sf-btn sf-btn--primary sf-btn--pill sf-header__account'} title={customerName || undefined}><span>{customerName || 'Sign In'}</span></Link>
            {search && listHome ? <a href={listHome} className="sf-btn sf-btn--primary sf-header__cta">List Your Home</a> : null}
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
            {INTENTS.map(([value, label]) => <Link key={value} href={`/listings?type=${value}`} onClick={close}>{label === 'Buy' ? 'Homes for sale' : 'Homes for rent'}</Link>)}
            {sections.advisors ? <Link href="/#agents" onClick={close}>Agents</Link> : null}
            {sections.neighborhoods ? <Link href="/#neighborhoods" onClick={close}>Neighborhoods</Link> : null}
            {signedIn ? <Link href="/account" onClick={close}>My showings</Link> : null}
            {listHome ? <a href={listHome} onClick={close}>List your home</a> : null}
            {contact ? <a href={contact} onClick={close}>Contact</a> : null}
            {signedIn ? <form action={customerSignOut}><button type="submit" className="sf-mobile-nav__signout">Sign out</button></form> : null}
          </nav>
        ) : null}

        {search ? <div className="sf-header__search">{search}</div> : null}
      </header>

      <TabBar pathname={pathname} signedIn={signedIn} savedHref={savedHref} />
    </>
  )
}

/** Phone tab bar: the app-style way around the storefront. */
function TabBar({ pathname, signedIn, savedHref }: { pathname: string; signedIn: boolean; savedHref: string }) {
  const gate = (path: string) => signedIn ? path : `/account?from=${encodeURIComponent(path)}`
  const tabs: Array<[string, string, ReactNode, boolean]> = [
    ['/', 'Home', <House key="i" aria-hidden />, pathname === '/'],
    ['/listings', 'Map', <MapIcon key="i" aria-hidden />, pathname === '/listings' || pathname.startsWith('/listings/')],
    [savedHref, 'Saved', <Bookmark key="i" aria-hidden />, pathname === '/account/saved'],
    [gate('/account/questions'), 'Messages', <MessageCircle key="i" aria-hidden />, pathname === '/account/questions'],
    [signedIn ? '/account/profile' : '/account', 'Profile', <UserRound key="i" aria-hidden />, pathname === '/account/profile' || (!signedIn && pathname === '/account')],
  ]
  return (
    <nav className="sf-tabbar" aria-label="Sections">
      {tabs.map(([href, label, icon, current]) => (
        <Link key={label} href={href} className="sf-tabbar__item" aria-current={current ? 'page' : undefined}>{icon}<span>{label}</span></Link>
      ))}
    </nav>
  )
}

/** Reads the current search so Buy/Rent shows its state and keeps the other filters. */
function IntentLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const current = new URLSearchParams(searchParams?.toString() || '')
  const activeIntent = pathname === '/listings' || pathname === '/' ? current.get('type') : null
  return <>{INTENTS.map(([value, label]) => (
    <Link key={value} href={intentHref(pathname, current, value)} aria-current={activeIntent === value ? 'page' : undefined} onClick={onNavigate}>{label}</Link>
  ))}</>
}
