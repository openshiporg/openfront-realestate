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
              <li><Link href="/#homes">Homes</Link></li>
              {sections.neighborhoods ? <li><Link href="/#neighborhoods">Neighborhoods</Link></li> : null}
              {sections.advisors ? <li><Link href="/#advisors">Advisors</Link></li> : null}
              <li><Link href="/account">My showings</Link></li>
            </ul>
          </nav>

          {phone || email || location ? (
            <div>
              <h2>Contact</h2>
              <address>
                {phone ? <a href={phone}>{settings.publicPhone}</a> : null}
                {email ? <a href={email}>{settings.publicEmail}</a> : null}
                {location ? <span>{location}</span> : null}
              </address>
            </div>
          ) : null}
        </div>

        <div className="sf-footer__legal">
          <p>© {new Date().getFullYear()} {settings.businessName}</p>
          {settings.equalHousingNotice ? <p>{settings.equalHousingNotice}</p> : null}
        </div>
      </div>
    </footer>
  )
}
