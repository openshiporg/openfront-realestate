'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Choice, Field, FormDrawer, RecordForm, ActionButton } from '../../components/RecordForm'
import { checkPaymentStatus, refundPaymentAction, requestPayment, savePaymentProvider } from '../actions/payments'

export function ProviderDrawer({ label = 'Add provider' }: { label?: string }) {
  return (
    <FormDrawer trigger={label} title="Payment provider" primary>
      {close => (
        <RecordForm action={savePaymentProvider} submitLabel="Save provider" onDone={close}>
          <Choice name="kind" label="Provider" required wide options={[['stripe', 'Stripe (cards, and ACH for rent)'], ['manual', 'Pay at the office (cheque, wire, cash)']]} />
          <Field name="secretKey" label="Stripe secret key" wide placeholder="sk_live_… or sk_test_…" />
          <Field name="webhookSecret" label="Stripe webhook signing secret" wide placeholder="whsec_…" />
          <p className="text-xs text-muted-foreground sm:col-span-2">Keys are stored on the server and never shown again. Leave blank to use the server&apos;s environment keys. Point your Stripe webhook at the URL shown on the provider page.</p>
        </RecordForm>
      )}
    </FormDrawer>
  )
}

/** The pay link is shown once (its token is never readable again), so the drawer stays open with it until copied. */
export function RequestPaymentDrawer({ leadId, dealId, disabled }: { leadId: string; dealId?: string | null; disabled?: boolean }) {
  if (disabled) return null
  return (
    <FormDrawer trigger="Request payment" title="Request a payment">
      {close => (
        <RecordForm action={requestPayment} submitLabel="Create payment link" result={state => <PaymentLinkResult message={state.message} onClose={close} />}>
          <input type="hidden" name="leadId" value={leadId} />
          {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
          <Choice name="purpose" label="For" required wide options={[['holding_deposit', 'Holding deposit'], ['rent', 'Rent (bank transfer)']]} />
          <Field name="amount" label="Amount ($)" required inputMode="decimal" placeholder="1500.00" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function CheckStatusButton({ paymentId }: { paymentId: string }) {
  return <ActionButton action={checkPaymentStatus} fields={{ paymentId }} label="Check status" pendingLabel="Checking…" />
}

export function RefundPaymentButton({ paymentId }: { paymentId: string }) {
  return <ActionButton action={refundPaymentAction} fields={{ paymentId }} label="Refund" pendingLabel="Refunding…" confirm="Refund the full paid amount to the payer's card?" />
}

function PaymentLinkResult({ message, onClose }: { message: string; onClose: () => void }) {
  const url = (message.match(/https?:\/\/\S+/) || [''])[0]
  const [copied, setCopied] = React.useState(false)
  if (!url) return <p role="status" className="text-sm">{message}</p>
  return (
    <div role="status" className="space-y-2 rounded-[6px] border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Payment link ready. Send it to the payer; it is shown only once.</p>
      <input readOnly value={url} aria-label="Payment link" onFocus={event => event.currentTarget.select()} className="h-9 w-full min-w-0 rounded-[6px] border border-input bg-background px-3 font-mono text-xs" />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setCopied(true) }}>{copied ? 'Copied' : 'Copy link'}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
