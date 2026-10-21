'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import type { PlatformShowing } from '../actions/showings'
import { label, leadIntentLabels, leadStatusLabels } from '../../leads/lib/labels'
import { showingStatusColors, showingStatusLabels, showingTypeLabels } from '../lib/labels'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

function formatMoney(value?: string | null, listingType?: string | null) {
  if (moneyToMinor(value || '0') <= 0n) return 'Price TBD'
  const formatted = exactMoney(value || '0')
  return listingType === 'rent' ? `${formatted}/mo` : formatted
}

function ShowingCard({ showing, timeZone }: { showing: PlatformShowing; timeZone?: string }) {
  const { property, lead, assignedAgent: agent } = showing
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone }).format(new Date(showing.scheduledStart))

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[10rem_1fr_auto]">
        <div>
          <p className="text-lg font-semibold text-foreground">{time}</p>
          <p className="text-sm text-muted-foreground">{label(showingTypeLabels, showing.showingType, 'Showing')}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold text-foreground">{property?.title || 'No listing'}</h3>
            <Badge color={showingStatusColors[showing.status] || 'zinc'} className="shrink-0">{label(showingStatusLabels, showing.status)}</Badge>
          </div>
          {property ? <p className="mt-1 text-sm text-muted-foreground">{[property.addressLine1, property.city, property.state].filter(Boolean).join(', ')} · {formatMoney(property.price, property.listingType)}</p> : null}
          <p className="mt-2 text-sm text-foreground">{lead?.name || 'No client'}{lead ? <span className="text-muted-foreground"> · {[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}</span> : null}</p>
          {lead ? <p className="text-xs text-muted-foreground">{label(leadIntentLabels, lead.intent, 'Intent unknown')} · {label(leadStatusLabels, lead.status)}</p> : null}
          <p className="mt-1 text-sm text-muted-foreground">Agent: {agent ? agent.name || 'Assigned' : 'Unassigned'}</p>
          {showing.notes ? <p className="mt-2 line-clamp-3 text-sm text-foreground/90">{showing.notes}</p> : null}
          {showing.feedback ? <p className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-sm text-foreground/90"><span className="font-medium">Feedback:</span> {showing.feedback}</p> : null}
        </div>
        <div className="lg:self-start">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/platform/showings/${encodeURIComponent(showing.id)}`}>View showing</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

/** Groups showings by day in the viewer's own time zone once running in the browser. */
export function ShowingBoard({ showings }: { showings: PlatformShowing[] }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const timeZone = hydrated ? undefined : 'UTC'
  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone })
  const groups: Array<{ day: string; items: PlatformShowing[] }> = []
  for (const showing of showings) {
    const day = dayFormat.format(new Date(showing.scheduledStart))
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(showing)
    else groups.push({ day, items: [showing] })
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.day}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{group.day}</h2>
          <div className="space-y-3">{group.items.map((showing) => <ShowingCard key={showing.id} showing={showing} timeZone={timeZone} />)}</div>
        </section>
      ))}
    </div>
  )
}
