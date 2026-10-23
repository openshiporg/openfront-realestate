'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, Heart, Menu, X } from 'lucide-react'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { customerSignOut } from '@/features/storefront/lib/data/account'
import { contactHref } from '@/features/storefront/lib/format'
import { BrokerageMark } from './BrokerageMark'

export type StorefrontSections = { neighborhoods?: boolean; advisors?: boolean }

export function StorefrontNavBar({ settings, sections = { neighborhoods: true, advisors: true }, customerName }: { settings: BrokerageSettings; sections?: StorefrontSections; customerName: string | null }) {
  const [open, setOpen] = useState(false)
  const contact = contactHref(settings)
  const close = () => setOpen(false)
  const links: Array<[string, string]> = [
    ['/#homes', 'Homes'],
    ...(sections.neighborhoods ? [['/#neighborhoods', 'Neighborhoods'] as [string, string]] : []),
    ...(sections.advisors ? [['/#advisors', 'Advisors'] as [string, string]] : []),
  ]

  return (
    <header className="sf-header">
      <div className="sf-container sf-header__bar">
        <Link href="/" className="sf-lockup" aria-label={`${settings.businessName} home`} onClick={close}>
          <BrokerageMark className="sf-lockup__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
          <span className="sf-lockup__name">
            <strong>{settings.businessName}</strong>
            {settings.marketLabel ? <small>{settings.marketLabel}</small> : null}
          </span>
        </Link>

        <nav className="sf-header__nav" aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>

        <div className="sf-header__actions">
          {customerName ? <>
            <Link href="/account/saved" className="sf-btn sf-btn--quiet"><Heart aria-hidden />Saved</Link>
            <Link href="/account" className="sf-btn sf-btn--quiet sf-header__account" title="My account">{customerName}</Link>
          </> : <Link href="/account" className="sf-btn sf-btn--quiet">Sign in</Link>}
          {contact ? <a href={contact} className="sf-btn sf-btn--primary">Contact</a> : null}
        </div>

        <button
          type="button"
          className="sf-header__toggle"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="sf-mobile-nav"
          onClick={() => setOpen(value => !value)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav id="sf-mobile-nav" className="sf-mobile-nav" aria-label="Mobile navigation">
          {links.map(([href, label]) => <Link key={href} href={href} onClick={close}>{label}<ArrowUpRight aria-hidden /></Link>)}
          {customerName ? <>
            <Link href="/account/saved" onClick={close}>Saved<ArrowUpRight aria-hidden /></Link>
            <Link href="/account" onClick={close}>My showings<ArrowUpRight aria-hidden /></Link>
          </> : <Link href="/account" onClick={close}>Sign in<ArrowUpRight aria-hidden /></Link>}
          {contact ? <a href={contact} onClick={close}>Contact<ArrowUpRight aria-hidden /></a> : null}
          {customerName ? <form action={customerSignOut}><button type="submit" className="sf-mobile-nav__signout">Sign out</button></form> : null}
        </nav>
      ) : null}
    </header>
  )
}
