'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import type { PlatformShowing } from '../actions/showings'
import { label, leadIntentLabels } from '../../leads/lib/labels'
import { showingStatusColors, showingStatusLabels, showingTypeLabels } from '../lib/labels'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

const dotTones: Record<string, string> = { blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }

function formatMoney(value?: string | null, listingType?: string | null) {
  if (moneyToMinor(value || '0') <= 0n) return 'Price TBD'
  const formatted = exactMoney(value || '0')
  return listingType === 'rent' ? `${formatted}/mo` : formatted
}

function ShowingRow({ showing, timeZone }: { showing: PlatformShowing; timeZone?: string }) {
  const { property, lead, assignedAgent: agent } = showing
  const start = new Date(showing.scheduledStart)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(start)
  const zone = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone }).formatToParts(start).find(part => part.type === 'timeZoneName')?.value
  const href = `/dashboard/platform/showings/${encodeURIComponent(showing.id)}`

  return (
    <li className="group relative grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-muted/40 sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
      <div className="row-span-2 sm:row-span-1">
        <p className="text-base font-semibold tabular-nums text-foreground">{time}</p>
        <p className="text-xs text-muted-foreground">{zone ? `${zone} · ` : ''}{label(showingTypeLabels, showing.showingType, 'Showing')}</p>
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">
            <span aria-hidden className={`mr-2 inline-block size-2 -translate-y-px rounded-full align-middle ${dotTones[showingStatusColors[showing.status]] || 'bg-zinc-400'}`} />
            <Link href={href} className="after:absolute after:inset-0">{property?.title || 'No listing'}</Link>
          </h3>
          <span className="text-xs font-medium text-muted-foreground">{label(showingStatusLabels, showing.status)}</span>
        </div>
        {property ? <p className="truncate text-sm text-muted-foreground">{[property.addressLine1, property.city].filter(Boolean).join(', ')} · <span className="tabular-nums">{formatMoney(property.price, property.listingType)}</span></p> : null}
        <p className="text-sm text-foreground">
          {lead?.name || 'No client'}
          <span className="text-muted-foreground">{lead ? ` · ${label(leadIntentLabels, lead.intent, 'Intent unknown')}` : ''} · {agent ? agent.name || 'Assigned' : 'Unassigned'}</span>
        </p>
        {showing.feedback ? <p className="line-clamp-2 text-sm text-foreground/90"><span className="font-medium">Feedback:</span> {showing.feedback}</p> : showing.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{showing.notes}</p> : null}
      </div>
      <ChevronRight aria-hidden className="hidden size-4 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </li>
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
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.day} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <h2 className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground">
            {group.day}
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{group.items.length}</span>
          </h2>
          <ol className="divide-y divide-border">{group.items.map((showing) => <ShowingRow key={showing.id} showing={showing} timeZone={timeZone} />)}</ol>
        </section>
      ))}
    </div>
  )
}
