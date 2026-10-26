import Link from 'next/link'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { emailHref, phoneHref } from '@/features/storefront/lib/format'
import { BrokerageMark } from './BrokerageMark'
import type { StorefrontSections } from './StorefrontNav'

export function StorefrontFooter({ settings, sections = { neighborhoods: true, advisors: true } }: { settings: BrokerageSettings; sections?: StorefrontSections }) {
  const phone = phoneHref(settings.publicPhone)
  const email = emailHref(settings.publicEmail)
  const location = [settings.city, settings.state].filter(Boolean).join(', ')

  return (
    <footer className="sf-footer">
      <div className="sf-container">
        <div className="sf-footer__grid">
          <div className="sf-footer__brand">
            <span className="sf-lockup">
              <BrokerageMark className="sf-lockup__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
              <span className="sf-lockup__name">
                <strong>{settings.businessName}</strong>
                {settings.marketLabel ? <small>{settings.marketLabel}</small> : null}
              </span>
            </span>
            {settings.description ? <p>{settings.description}</p> : null}
          </div>

          <nav aria-label="Footer navigation">
            <h2>Browse</h2>
            <ul>
              <li><Link href="/listings?type=sale">Homes for sale</Link></li>
              <li><Link href="/listings?type=rent">Homes for rent</Link></li>
              {sections.neighborhoods ? <li><Link href="/#neighborhoods">Neighborhoods</Link></li> : null}
              {sections.advisors ? <li><Link href="/#advisors">Advisors</Link></li> : null}
            </ul>
          </nav>

          <nav aria-label="Your account">
            <h2>Your account</h2>
            <ul>
              <li><Link href="/account/saved">Saved homes</Link></li>
              <li><Link href="/account">My showings</Link></li>
              <li><Link href="/account/questions">Questions</Link></li>
            </ul>
          </nav>

          {phone || email || location ? (
            <div>
              <h2>Contact</h2>
              <address>
                {phone ? <a href={phone} className="sf-num">{settings.publicPhone}</a> : null}
                {email ? <a href={email}>{settings.publicEmail}</a> : null}
                {location ? <span>{location}</span> : null}
              </address>
            </div>
          ) : null}
        </div>

        <div className="sf-footer__legal">
          {settings.equalHousingNotice ? (
            <p className="sf-footer__eho">
              <svg viewBox="0 0 24 24" aria-hidden className="sf-footer__eho-mark"><path d="M3 11 12 4l9 7M5 10v10h14V10M9 13h6M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" /></svg>
              {settings.equalHousingNotice}
            </p>
          ) : null}
          <p>© {new Date().getFullYear()} {settings.businessName}</p>
        </div>
      </div>
    </footer>
  )
}
