'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { contactHref } from '@/features/storefront/lib/format'
import { BrokerageMark } from './BrokerageMark'

export type StorefrontSections = { neighborhoods?: boolean; advisors?: boolean }

export function StorefrontNav({ settings, sections = { neighborhoods: true, advisors: true } }: { settings: BrokerageSettings; sections?: StorefrontSections }) {
  const [open, setOpen] = useState(false)
  const contact = contactHref(settings)
  const close = () => setOpen(false)

  return (
    <header className="sf-site-header">
      <div className="sf-container sf-nav">
        <Link href="/" className="sf-wordmark" aria-label={`${settings.businessName} home`}>
          <BrokerageMark className="sf-wordmark__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
          <span className="sf-wordmark__copy">
            <strong>{settings.businessName}</strong>
            <small>{settings.marketLabel}</small>
          </span>
        </Link>

        <nav className="sf-nav__links" aria-label="Primary navigation">
          <Link href="/#homes">Homes</Link>
          {sections.neighborhoods ? <Link href="/#neighborhoods">Neighborhoods</Link> : null}
          {sections.advisors ? <Link href="/#advisors">Advisors</Link> : null}
          <Link href="/account">My account</Link>
        </nav>

        {contact ? <a className="sf-nav__contact" href={contact}>Contact</a> : <span />}
        <button
          type="button"
          className="sf-nav__toggle"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav className="sf-mobile-nav" aria-label="Mobile navigation">
          <Link href="/#homes" onClick={close}>Homes</Link>
          {sections.neighborhoods ? <Link href="/#neighborhoods" onClick={close}>Neighborhoods</Link> : null}
          {sections.advisors ? <Link href="/#advisors" onClick={close}>Advisors</Link> : null}
          {contact ? <a href={contact} onClick={close}>Contact</a> : null}
          <Link href="/account" onClick={close}>My account</Link>
        </nav>
      ) : null}
    </header>
  )
}
