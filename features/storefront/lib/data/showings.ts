'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'
import { explicitDateTimeToIso } from '@/features/lib/date-time'
import { classifyShowingRequestResult, type ShowingRequestState } from './showingRequestResult'

export type { ShowingRequestState } from './showingRequestResult'
const initialFailure = (message: string): ShowingRequestState => ({ ok: false, message })

function value(data: FormData, key: string) {
  return String(data.get(key) || '').trim()
}

export async function createShowingRequest(_previous: ShowingRequestState, formData: FormData): Promise<ShowingRequestState> {
  if (_previous.uncertain || _previous.ok) return _previous
  const idempotencyKey = value(formData, 'idempotencyKey')
  const propertyId = value(formData, 'propertyId')
  const name = value(formData, 'name')
  const email = value(formData, 'email')
  const phone = value(formData, 'phone')
  const requestedStart = explicitDateTimeToIso(value(formData, 'requestedStart'))
  const showingType = value(formData, 'showingType') || 'in_person'
  const message = value(formData, 'message')

  if (!propertyId || !name || (!email && !phone) || !requestedStart || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(idempotencyKey)) {
    return initialFailure('Add your name, a time, and an email or phone number.')
  }

  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return initialFailure('We could not send your request. Please try again.')

  let response: unknown
  try {
    response = await keystoneClient<unknown>(`
    mutation StorefrontShowingRequest($data: RequestPropertyShowingInput!) {
      requestPropertyShowing(data: $data) { ok message requestReference }
    }
  `, { data: { brokerageSlug, propertyId, name, email, phone, requestedStart, showingType, message, idempotencyKey } }, { cache: 'no-store' })

  } catch {
    return classifyShowingRequestResult(null)
  }
  return classifyShowingRequestResult(response)
}
