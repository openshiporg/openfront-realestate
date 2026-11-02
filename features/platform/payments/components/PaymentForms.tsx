'use client'

import { Choice, Field, FormDrawer, RecordForm, ActionButton, Toggle } from '../../components/RecordForm'
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

export function RequestPaymentDrawer({ leadId, dealId, disabled }: { leadId: string; dealId?: string | null; disabled?: boolean }) {
  if (disabled) return null
  return (
    <FormDrawer trigger="Request payment" title="Request a payment">
      {close => (
        <RecordForm action={requestPayment} submitLabel="Create payment link" onDone={close}>
          <input type="hidden" name="leadId" value={leadId} />
          {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
          <Choice name="purpose" label="For" required wide options={[['holding_deposit', 'Holding deposit'], ['rent', 'Rent (bank transfer)']]} />
          <Field name="amount" label="Amount ($)" required inputMode="decimal" placeholder="1500.00" />
          <Toggle name="sendEmail" label="Email the link to the payer" defaultChecked />
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
