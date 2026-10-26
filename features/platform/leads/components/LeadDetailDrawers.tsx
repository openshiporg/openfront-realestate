'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import type { OperatorViewer } from '../lib/leadDetail'
import { LeadActivityForm } from './LeadActivityForm'
import { ScheduleShowingForm } from './PendingShowingForms'

/** A section button that opens its form in a side sheet, so the record page reads before it asks. */
function SectionSheet({ trigger, title, primary = false, children }: { trigger: string; title: string; primary?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass}>{trigger}</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

export function LogActivityButton({ leadId, leadName, propertyId }: { leadId: string; leadName: string; propertyId?: string }) {
  return (
    <SectionSheet trigger="Log activity" title={`Log activity · ${leadName}`}>
      <LeadActivityForm leadId={leadId} propertyId={propertyId} />
    </SectionSheet>
  )
}

export function ScheduleShowingButton({ leadId, leadName, propertyId, assignedAgentId, viewer }: { leadId: string; leadName: string; propertyId?: string; assignedAgentId?: string; viewer: OperatorViewer }) {
  return (
    <SectionSheet trigger="Schedule showing" title={`Schedule showing · ${leadName}`}>
      <ScheduleShowingForm viewer={viewer} leadId={leadId} propertyId={propertyId} assignedAgentId={assignedAgentId} />
    </SectionSheet>
  )
}
