'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addLeadActivity, type LeadQuickActionState } from '../actions/leads'

const initialState: LeadQuickActionState = { ok: false, message: '' }

function FieldSelect({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: Array<[string, string]> }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id} className="h-9 rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

export function LeadActivityForm({ leadId, propertyId }: { leadId: string; propertyId?: string }) {
  const [state, action, pending] = useActionState(addLeadActivity, initialState)
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!state.message) return
    if (state.ok) { toast.success(state.message); formRef.current?.reset() }
    else toast.error(state.message)
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="propertyId" value={propertyId || ''} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldSelect id={`${id}-type`} name="activityType" label="Type" defaultValue="note" options={[['note', 'Note'], ['call', 'Call'], ['email', 'Email'], ['text', 'Text']]} />
        <FieldSelect id={`${id}-direction`} name="direction" label="Direction" defaultValue="internal" options={[['internal', 'Internal'], ['outbound', 'Outbound'], ['inbound', 'Inbound']]} />
        <FieldSelect id={`${id}-channel`} name="channel" label="Channel" defaultValue="crm" options={[['crm', 'CRM'], ['phone', 'Phone'], ['email', 'Email'], ['sms', 'SMS'], ['in_person', 'In person']]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-subject`}>Subject</Label>
        <Input className="rounded-[6px]" id={`${id}-subject`} name="subject" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-body`}>Notes</Label>
        <Textarea className="rounded-[6px]" id={`${id}-body`} name="body" required rows={3} />
      </div>
      <Button type="submit" size="sm" className="rounded-[6px] active:scale-[0.98]" disabled={pending}>{pending ? 'Saving…' : 'Log activity'}</Button>
    </form>
  )
}
