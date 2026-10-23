'use client'

import { useEffect, useState } from 'react'
import { ListingInquiryForm } from './ListingInquiryForm'
import { ShowingRequestForm } from './ShowingRequestForm'

type Prefill = { name: string; email: string; phone: string } | null
type Tab = 'tour' | 'question'

export function ListingActionPanel({ propertyId, intent, customer, accountHref, timeZone, timeZoneName }: { propertyId: string; intent: 'buy' | 'rent'; customer: Prefill; accountHref: string; timeZone: string | null; timeZoneName: string }) {
  const [tab, setTab] = useState<Tab>('tour')

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === '#showing') setTab('tour')
      if (window.location.hash === '#ask') {
        setTab('question')
        document.getElementById('showing')?.scrollIntoView({ block: 'start' })
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const tabs: Array<[Tab, string]> = [['tour', 'Tour'], ['question', intent === 'rent' ? 'Ask about applying' : 'Ask a question']]

  return (
    <section id="showing" className="sf-panel" aria-label="Contact about this home">
      <div className="sf-track sf-track--block" role="tablist" aria-label="Request type">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`listing-tab-${value}`}
            aria-controls={`listing-panel-${value}`}
            aria-selected={tab === value}
            className="sf-track__item"
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="listing-panel-tour" role="tabpanel" aria-labelledby="listing-tab-tour" hidden={tab !== 'tour'}>
        <ShowingRequestForm propertyId={propertyId} customer={customer} accountHref={accountHref} timeZone={timeZone} timeZoneName={timeZoneName} />
      </div>
      <div id="listing-panel-question" role="tabpanel" aria-labelledby="listing-tab-question" hidden={tab !== 'question'}>
        <ListingInquiryForm propertyId={propertyId} intent={intent} customer={customer} />
      </div>
    </section>
  )
}
