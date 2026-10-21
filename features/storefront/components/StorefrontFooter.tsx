import Link from 'next/link'
import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { contactHref, emailHref, phoneHref } from '@/features/storefront/lib/format'
import { BrokerageMark } from './BrokerageMark'
import type { StorefrontSections } from './StorefrontNav'

export function StorefrontFooter({ settings, sections = { neighborhoods: true, advisors: true } }: { settings: BrokerageSettings; sections?: StorefrontSections }) {
  const contact = contactHref(settings)
  const phone = phoneHref(settings.publicPhone)
  const email = emailHref(settings.publicEmail)
  const location = [settings.city, settings.state].filter(Boolean).join(', ')

  return (
    <footer className="sf-footer">
      <div className="sf-container sf-footer__lead">
        <p className="sf-footer__statement">{settings.businessName}</p>
        {contact ? <a className="sf-footer__email" href={contact}>Contact us</a> : null}
      </div>

      <div className="sf-container sf-footer__contact">
        <div className="sf-footer__brand">
          <BrokerageMark className="sf-footer__mark" logoIcon={settings.logoIcon} logoColor={settings.logoColor} />
          <div>
            <p className="sf-display">{settings.businessName}</p>
            {settings.description ? <p>{settings.description}</p> : null}
          </div>
        </div>

        <address>
          {phone ? <a href={phone}>{settings.publicPhone}</a> : null}
          {email ? <a href={email}>{settings.publicEmail}</a> : null}
          {location ? <span>{location}</span> : null}
        </address>
      </div>

      <div className="sf-container sf-footer__meta">
        <nav aria-label="Footer navigation">
          <Link href="/#homes">Homes</Link>
          {sections.neighborhoods ? <Link href="/#neighborhoods">Neighborhoods</Link> : null}
          {sections.advisors ? <Link href="/#advisors">Advisors</Link> : null}
          <Link href="/account">My account</Link>
        </nav>
        <p>© {new Date().getFullYear()} {settings.businessName}. {settings.equalHousingNotice}</p>
      </div>
    </footer>
  )
}
