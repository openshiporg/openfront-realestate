'use client'

import Link from 'next/link'
import { Fragment, useSyncExternalStore } from 'react'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import { cn } from '@/lib/utils'
import { DataTable, StatusCell, Td } from '../../components/PlatformUI'
import { trackItemClass } from '../../components/styles'
import type { PlatformShowing } from '../actions/showings'
import { label, leadIntentLabels } from '../../leads/lib/labels'
import { showingStatusColors, showingStatusLabels, showingTypeLabels } from '../lib/labels'
import { ShowingStatusButton } from './ShowingActionForms'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export type ShowingVersion = { expectedStatus: string; expectedUpdatedAt: string; expectedRevision: string }

function formatMoney(value?: string | null, listingType?: string | null) {
  if (moneyToMinor(value || '0') <= 0n) return 'Price TBD'
  const formatted = exactMoney(value || '0')
  return listingType === 'rent' ? `${formatted}/mo` : formatted
}

const head = [
  { label: 'Time', className: 'hidden w-28 sm:table-cell' },
  { label: 'Listing' },
  { label: 'Status' },
  { label: 'Client', className: 'hidden md:table-cell' },
  { label: 'Agent', className: 'hidden lg:table-cell' },
  { label: <span className="sr-only">Action</span>, className: 'w-px' },
]

function RowAction({ showing, version, href, now }: { showing: PlatformShowing; version?: ShowingVersion; href: string; now: number }) {
  if (showing.status === 'requested') {
    return version
      ? <ShowingStatusButton showingId={showing.id} leadId={showing.lead?.id} status="scheduled" label="Confirm" {...version} />
      : <Link href={href} className={cn(trackItemClass(false), 'max-sm:h-9')}>Review</Link>
  }
  if (showing.status === 'scheduled' && Date.parse(showing.scheduledStart) <= now) {
    return <Link href={href} className={cn(trackItemClass(false), 'max-sm:h-9')}>Record outcome</Link>
  }
  return null
}

/** Showings as a dense table grouped by day, in the viewer's own time zone once running in the browser. */
export function ShowingBoard({ showings, versions }: { showings: PlatformShowing[]; versions: Record<string, ShowingVersion> }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const timeZone = hydrated ? undefined : 'UTC'
  const now = Date.now()
  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone })
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
  const zoneFormat = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone })
  const groups: Array<{ day: string; items: PlatformShowing[] }> = []
  for (const showing of showings) {
    const day = dayFormat.format(new Date(showing.scheduledStart))
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(showing)
    else groups.push({ day, items: [showing] })
  }

  return (
    <DataTable label="Showings" head={head}>
      {groups.map(group => (
        <Fragment key={group.day}>
          <tr>
            <th scope="colgroup" colSpan={6} className="border-b bg-muted/20 px-3 py-1.5 text-left text-xs font-semibold text-foreground">
              {group.day}<span className="ml-2 font-medium tabular-nums text-muted-foreground">{group.items.length}</span>
            </th>
          </tr>
          {group.items.map(showing => {
            const { property, lead, assignedAgent: agent } = showing
            const start = new Date(showing.scheduledStart)
            const time = timeFormat.format(start)
            const zone = zoneFormat.formatToParts(start).find(part => part.type === 'timeZoneName')?.value
            const href = `/dashboard/platform/showings/${encodeURIComponent(showing.id)}`
            const past = showing.status === 'requested' && start.getTime() < now
            return (
              <tr key={showing.id} className="transition-colors hover:bg-muted/30">
                <Td className="hidden whitespace-nowrap py-2 sm:table-cell">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{time}</span>
                  <span className="text-xs text-muted-foreground">{zone ? `${zone} · ` : ''}{label(showingTypeLabels, showing.showingType, 'Showing')}</span>
                </Td>
                <Td className="min-w-0 max-w-80 py-2">
                  <Link href={href} className="block truncate font-medium text-foreground underline-offset-2 hover:underline">{property?.title || 'No listing'}</Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="tabular-nums sm:hidden">{time} · </span>
                    {property ? <>{[property.addressLine1, property.city].filter(Boolean).join(', ')} · <span className="tabular-nums">{formatMoney(property.price, property.listingType)}</span></> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground md:hidden">{lead?.name || 'No client'}</span>
                </Td>
                <Td className="py-2">
                  <StatusCell tone={showingStatusColors[showing.status] || 'zinc'}>{label(showingStatusLabels, showing.status)}</StatusCell>
                  {past ? <span className="block text-xs text-amber-700 dark:text-amber-400">Time passed</span> : null}
                </Td>
                <Td className="hidden py-2 md:table-cell">
                  <span className="block text-[13px] text-foreground">{lead?.name || 'No client'}</span>
                  {lead ? <span className="text-xs text-muted-foreground">{label(leadIntentLabels, lead.intent, 'Intent unknown')}</span> : null}
                </Td>
                <Td className="hidden whitespace-nowrap py-2 text-[13px] lg:table-cell">{agent ? agent.name || 'Assigned' : <span className="text-muted-foreground">Unassigned</span>}</Td>
                <Td className="py-2 text-right"><RowAction showing={showing} version={versions[showing.id]} href={href} now={now} /></Td>
              </tr>
            )
          })}
        </Fragment>
      ))}
    </DataTable>
  )
}
