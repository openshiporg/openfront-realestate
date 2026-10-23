import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LocalDateTime } from '@/features/platform/showings/components/LocalDateTime'
import { getCustomer, getCustomerInquiries } from '../lib/data/account'
import { storefrontTitle } from '../lib/metadata'

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Questions') }
}

const statusLabels: Record<string, string> = { new: 'Sent', attempted_contact: 'Advisor reached out', qualified: 'In touch', tour_scheduled: 'Showing scheduled', offer: 'Offer stage', closed: 'Closed', lost: 'Closed' }

export default async function AccountQuestionsPage() {
  const customer = await getCustomer()
  if (!customer) notFound()
  const inquiries = await getCustomerInquiries()

  return <>
    <header className="sf-account__head">
      <div>
        <p className="sf-eyebrow">{customer.name}</p>
        <h1 style={{ marginTop: '0.5rem' }}>Questions</h1>
      </div>
      <Link className="sf-btn sf-btn--quiet" href="/#homes">Browse homes</Link>
    </header>
    {inquiries.error ? <p className="sf-message" role="alert">{inquiries.error}</p> : !inquiries.items.length ? (
      <div className="sf-state"><h2>No questions</h2></div>
    ) : (
      <ul className="sf-trips">
        {inquiries.items.map(inquiry => (
          <li key={inquiry.id} className="sf-trip">
            <div>
              <h2>{inquiry.listingTitle}</h2>
              <p className="sf-trip__meta">
                <span><b>{statusLabels[inquiry.status] || 'Sent'}</b></span>
                <LocalDateTime className="sf-num" value={inquiry.sentAt} options={{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} />
              </p>
              <p className="sf-trip__message">{inquiry.message}</p>
            </div>
            {inquiry.listingSlug ? <Link className="sf-link" href={`/listings/${encodeURIComponent(inquiry.listingSlug)}`}>View home</Link> : null}
          </li>
        ))}
      </ul>
    )}
  </>
}
