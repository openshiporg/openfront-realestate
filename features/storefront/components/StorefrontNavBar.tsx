'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Heart, House, Menu, Search, Tag, UserRound, X } from 'lucide-react'
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

/** "List your home" opens the seller form, which lands as a sell lead in the dashboard. */
function listHomeHref(_settings: BrokerageSettings) {
  return '/sell'
}

export function StorefrontNavBar({ settings, sections = { neighborhoods: true, advisors: true }, customerName, savedCount = 0, search }: { settings: BrokerageSettings; sections?: StorefrontSections; customerName: string | null; savedCount?: number; search?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() || '/'
  const close = () => setOpen(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const toggleButton = useRef<HTMLButtonElement>(null)

  // The menu is a full-screen sheet: the page behind stays put, Escape closes it, and focus returns to the menu button.
  useEffect(() => {
    if (!open) return
    const toggle = toggleButton.current
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); toggle?.focus({ preventScroll: true }) }
  }, [open])
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
            {listHome ? <Link href={listHome}>Sell</Link> : null}
            {sections.advisors ? <Link href="/#agents">Agents</Link> : null}
            {sections.neighborhoods ? <Link href="/#neighborhoods">Neighborhoods</Link> : null}
          </nav>

          <div className="sf-header__actions">
            {search ? null : <Link href="/listings" className="sf-header__icon" aria-label="Search homes"><Search aria-hidden /></Link>}
            <Link href={savedHref} className="sf-header__icon sf-header__saved" aria-label={signedIn ? `Saved homes, ${savedCount}` : 'Saved homes, sign in'}>
              <Heart aria-hidden />{signedIn && savedCount ? <b className="sf-num">{savedCount}</b> : null}
            </Link>
            <Link href="/account" className={search ? 'sf-header__account' : 'sf-btn sf-btn--primary sf-btn--pill sf-header__account'} title={customerName || undefined}><span>{customerName || 'Sign In'}</span></Link>
            {search && listHome ? <Link href={listHome} className="sf-btn sf-btn--primary sf-header__cta">List Your Home</Link> : null}
          </div>

          <button
            type="button"
            ref={toggleButton}
            className="sf-header__toggle"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="sf-mobile-nav"
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden />
          </button>
        </div>

        {open ? (
          <div id="sf-mobile-nav" className="sf-mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="sf-mobile-nav__head">
              <Link href="/" className="sf-lockup" aria-label={`${settings.businessName} home`} onClick={close}>
                <BrokerageMark className="sf-lockup__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
                <span className="sf-lockup__name">{settings.businessName}</span>
              </Link>
              <button ref={closeButton} type="button" className="sf-header__toggle" aria-label="Close menu" onClick={close}><X aria-hidden /></button>
            </div>
            <div className="sf-mobile-nav__body">
              <form action="/listings" className="sf-mobile-nav__search" role="search" aria-label="Search homes">
                <Search aria-hidden />
                <input type="search" name="q" placeholder="City, neighborhood, or ZIP" aria-label="City, neighborhood, or ZIP" autoComplete="off" enterKeyHint="search" />
              </form>
              <nav aria-label="Menu">
                <Link href="/" onClick={close} aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
                {INTENTS.map(([value, label]) => <Link key={value} href={`/listings?type=${value}`} onClick={close}>{label === 'Buy' ? 'Homes for sale' : 'Homes for rent'}</Link>)}
                {sections.advisors ? <Link href="/#agents" onClick={close}>Agents</Link> : null}
                {sections.neighborhoods ? <Link href="/#neighborhoods" onClick={close}>Neighborhoods</Link> : null}
                {listHome ? <Link href={listHome} onClick={close}>List your home</Link> : null}
                {contact ? <a href={contact} onClick={close}>Contact</a> : null}
              </nav>
              {signedIn ? (
                <nav aria-label="Your account">
                  <p className="sf-mobile-nav__label">{customerName}</p>
                  <Link href="/account" onClick={close}>My showings</Link>
                  <Link href="/account/saved" onClick={close}>Saved homes</Link>
                  <Link href="/account/questions" onClick={close}>Questions</Link>
                  <Link href="/account/profile" onClick={close}>Profile</Link>
                  <form action={customerSignOut}><button type="submit" className="sf-mobile-nav__signout">Sign out</button></form>
                </nav>
              ) : (
                <Link href="/account" className="sf-btn sf-btn--primary sf-btn--block" onClick={close}>Sign in or create account</Link>
              )}
            </div>
          </div>
        ) : null}

        {search ? <div className="sf-header__search">{search}</div> : null}
      </header>

      <TabBar pathname={pathname} signedIn={signedIn} savedHref={savedHref} />
    </>
  )
}

/** Phone tab bar: the app-style way around the storefront. */
function TabBar({ pathname, signedIn, savedHref }: { pathname: string; signedIn: boolean; savedHref: string }) {
  // Home already is the map and list, so there is no separate Map tab; a visitor sees "Sign in", not tabs that only lead to it.
  const tabs: Array<[string, string, ReactNode, boolean]> = [
    ['/', 'Home', <House key="i" aria-hidden />, pathname === '/' || pathname === '/listings'],
    [savedHref, 'Saved', <Heart key="i" aria-hidden />, pathname === '/account/saved'],
    ['/sell', 'Sell', <Tag key="i" aria-hidden />, pathname === '/sell'],
    ['/account', signedIn ? 'Account' : 'Sign in', <UserRound key="i" aria-hidden />, pathname === '/account' || (signedIn && pathname.startsWith('/account/') && pathname !== '/account/saved')],
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
