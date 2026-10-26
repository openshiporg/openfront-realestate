'use client'

import { useId, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { pillClass, quietButtonClass } from '../../components/styles'

export type RecordOption = { value: string; label: string }

const NONE = '__none__'

function FieldShell({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function TextField({ name, label, required = true, placeholder, inputMode, wide }: { name: string; label: string; required?: boolean; placeholder?: string; inputMode?: 'decimal' | 'numeric' | 'text'; wide?: boolean }) {
  const id = useId()
  return <FieldShell id={id} label={label} wide={wide}><Input className="rounded-[6px]" id={id} name={name} required={required} placeholder={placeholder} inputMode={inputMode} /></FieldShell>
}

export function SelectField({ name, label, options, defaultValue, wide }: { name: string; label: string; options: Array<[string, string]>; defaultValue?: string; wide?: boolean }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} wide={wide}>
      <Select name={name} defaultValue={defaultValue ?? options[0]?.[0]}>
        <SelectTrigger id={id} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent className="rounded-[6px]">{options.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent>
      </Select>
    </FieldShell>
  )
}

/** Picks an existing record; falls back to a plain field when no records could be loaded. */
export function RecordField({ name, label, options, required = true, wide, placeholder }: { name: string; label: string; options: RecordOption[]; required?: boolean; wide?: boolean; placeholder?: string }) {
  const id = useId()
  const [value, setValue] = useState('')
  if (!options.length) return <TextField name={name} label={label} required={required} wide={wide} placeholder={placeholder} />
  return (
    <FieldShell id={id} label={label} wide={wide}>
      <input type="hidden" name={name} value={value === NONE ? '' : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="h-9 w-full rounded-[6px] text-sm"><SelectValue placeholder={required ? 'Select…' : 'None'} /></SelectTrigger>
        <SelectContent className="rounded-[6px]">
          {required ? null : <SelectItem value={NONE}>None</SelectItem>}
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

/** Shows a local date and time and submits it as an exact timestamp. */
export function DateTimeField({ name, label, required = true }: { name: string; label: string; required?: boolean }) {
  const id = useId()
  const [local, setLocal] = useState('')
  return (
    <FieldShell id={id} label={label}>
      <input type="hidden" name={name} value={local ? localDateTimeToIso(local) : ''} />
      <Input className="rounded-[6px]" id={id} type="datetime-local" required={required} value={local} onChange={(event) => setLocal(event.target.value)} />
    </FieldShell>
  )
}

export function toCents(value: string): string {
  const match = /^\s*(\d+)(?:\.(\d{0,2}))?\s*$/.exec(value.replaceAll(',', ''))
  if (!match) return ''
  const cents = (BigInt(match[1]) * 100n) + BigInt((match[2] || '').padEnd(2, '0') || '0')
  return cents.toString()
}

/** Accepts a dollar amount and submits whole cents. */
export function MoneyField({ name, label, required = true }: { name: string; label: string; required?: boolean }) {
  const id = useId()
  const [amount, setAmount] = useState('')
  return (
    <FieldShell id={id} label={label}>
      <input type="hidden" name={name} value={toCents(amount)} />
      <Input className="rounded-[6px]" id={id} inputMode="decimal" required={required} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
    </FieldShell>
  )
}

export function CheckboxField({ name, label }: { name: string; label: string }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} name={name} className="rounded-[4px]" />
      <Label htmlFor={id} className="font-normal">{label}</Label>
    </div>
  )
}

export type RowColumn = { key: string; label: string; options?: Array<[string, string]>; money?: boolean }

/** Edits a list of rows and submits them as JSON under one field name. */
export function RowsField({ name, label, columns, addLabel = 'Add row' }: { name: string; label: string; columns: RowColumn[]; addLabel?: string }) {
  const id = useId()
  const blank = () => Object.fromEntries(columns.map((column) => [column.key, column.options?.[0]?.[0] ?? '']))
  const [rows, setRows] = useState<Array<Record<string, string>>>(() => [blank()])
  const filled = rows.filter((row) => columns.some((column) => !column.options?.length && row[column.key]?.trim()))
  const serialized = JSON.stringify(filled.map((row) => Object.fromEntries(columns.map((column) => [column.key, column.money ? toCents(row[column.key] || '') : (row[column.key] || '').trim()]))))
  const update = (index: number, key: string, value: string) => setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <input type="hidden" name={name} value={serialized} />
      {rows.map((row, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((column) => {
              const fieldId = `${id}-${index}-${column.key}`
              return (
                <div key={column.key} className="space-y-1">
                  <Label htmlFor={fieldId} className="text-xs text-muted-foreground">{column.label}</Label>
                  {column.options?.length ? (
                    <Select value={row[column.key]} onValueChange={(value) => update(index, column.key, value)}>
                      <SelectTrigger id={fieldId} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-[6px]">{column.options.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input className="rounded-[6px]" id={fieldId} value={row[column.key]} inputMode={column.money ? 'decimal' : undefined} placeholder={column.money ? '0.00' : undefined} onChange={(event) => update(index, column.key, event.target.value)} />
                  )}
                </div>
              )
            })}
          </div>
          <Button type="button" variant="ghost" size="icon" className={cn(quietButtonClass, 'size-9 px-0')} aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className={pillClass} onClick={() => setRows((current) => [...current, blank()])}><Plus />{addLabel}</Button>
    </fieldset>
  )
}
