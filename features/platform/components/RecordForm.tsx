'use client'

import { useActionState, useEffect, useId, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from './styles'

export type FormResult = { ok: boolean; message: string; id?: string | null }
type Action = (state: FormResult, form: FormData) => Promise<FormResult>

const fieldClass = 'h-9 w-full min-w-0 rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

/** datetime-local inputs carry the browser's wall time; send them as ISO instants. */
function normalizeDates(form: FormData, element: HTMLFormElement) {
  element.querySelectorAll<HTMLInputElement>('input[type="datetime-local"][name]').forEach(input => {
    const value = String(form.get(input.name) || '')
    form.set(input.name, value ? localDateTimeToIso(value) : '')
  })
}

/** A form bound to a server action: toasts the result, refreshes the page, optionally redirects to the new record. */
export function RecordForm({ action, children, submitLabel, pendingLabel = 'Saving…', className, onDone, redirectTo }: { action: Action; children: ReactNode; submitLabel: string; pendingLabel?: string; className?: string; onDone?: () => void; redirectTo?: (id: string) => string }) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: '' })
  const router = useRouter()
  useEffect(() => {
    if (!state.message) return
    if (!state.ok) { toast.error(state.message); return }
    toast.success(state.message)
    onDone?.()
    if (redirectTo && state.id) router.push(redirectTo(state.id))
    else router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        normalizeDates(form, event.currentTarget)
        formAction(form)
      }}
      className={cn('grid gap-3 sm:grid-cols-2', className)}
    >
      {children}
      {!state.ok && state.message ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.message}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" variant="ghost" size="sm" className={pillPrimaryClass} disabled={pending}>{pending ? pendingLabel : submitLabel}</Button></div>
    </form>
  )
}

/** Side drawer holding a RecordForm; the trigger is a raised pill (or the primary pill). */
export function FormDrawer({ trigger, title, primary = false, children }: { trigger: ReactNode; title: string; primary?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass}>{trigger}</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="px-4 pb-6">{children(() => setOpen(false))}</div>
      </SheetContent>
    </Sheet>
  )
}

/** One-click command button (status change, delete) inside a recessed track. */
export function ActionButton({ action, fields, label, pendingLabel = 'Updating…', primary = false, confirm }: { action: Action; fields: Record<string, string>; label: string; pendingLabel?: string; primary?: boolean; confirm?: string }) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: '' })
  const router = useRouter()
  useEffect(() => {
    if (!state.message) return
    if (state.ok) { toast.success(state.message); router.refresh() } else toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  return (
    <form action={formAction} onSubmit={event => { if (confirm && !window.confirm(confirm)) event.preventDefault() }} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <Button type="submit" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass} disabled={pending}>{pending ? pendingLabel : label}</Button>
    </form>
  )
}

function Shell({ label, wide, children, id }: { label: string; wide?: boolean; children: ReactNode; id: string }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export function Field({ name, label, defaultValue, type = 'text', required, wide, inputMode, placeholder, min, max, step }: { name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean; wide?: boolean; inputMode?: 'decimal' | 'numeric' | 'text' | 'email' | 'tel' | 'url'; placeholder?: string; min?: number | string; max?: number | string; step?: number | string }) {
  const id = useId()
  return <Shell id={id} label={label} wide={wide}><input id={id} name={name} type={type} required={required} defaultValue={defaultValue ?? ''} inputMode={inputMode} placeholder={placeholder} min={min} max={max} step={step} className={fieldClass} /></Shell>
}

export function TextArea({ name, label, defaultValue, rows = 3, wide = true, required }: { name: string; label: string; defaultValue?: string | null; rows?: number; wide?: boolean; required?: boolean }) {
  const id = useId()
  return <Shell id={id} label={label} wide={wide}><textarea id={id} name={name} rows={rows} required={required} defaultValue={defaultValue ?? ''} className={cn(fieldClass, 'h-auto py-2')} /></Shell>
}

export function Choice({ name, label, options, defaultValue, required, wide, emptyLabel }: { name: string; label: string; options: Array<[string, string]>; defaultValue?: string | null; required?: boolean; wide?: boolean; emptyLabel?: string }) {
  const id = useId()
  return (
    <Shell id={id} label={label} wide={wide}>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? ''} className={fieldClass}>
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </Shell>
  )
}

export function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <input id={id} name={name} type="checkbox" value="true" defaultChecked={defaultChecked} className="size-4 rounded-[4px] border-input" />
      <label htmlFor={id} className="text-sm text-foreground">{label}</label>
    </div>
  )
}

/** ISO instant → value for a datetime-local input in the viewer's zone. */
export function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
