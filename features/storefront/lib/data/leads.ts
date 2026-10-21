'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'

export type InquiryState = {
  ok: boolean
  message: string
}

function required(value: FormDataEntryValue | null) {
  const text = String(value || '').trim()
  return text.length ? text : ''
}

export async function createListingInquiry(_prevState: InquiryState, formData: FormData): Promise<InquiryState> {
  const name = required(formData.get('name'))
  const email = required(formData.get('email'))
  const phone = required(formData.get('phone'))
  const message = required(formData.get('message'))
  const propertyId = required(formData.get('propertyId'))
  const intent = required(formData.get('intent')) || 'unknown'
  const preferredTime = required(formData.get('preferredTime'))

  if (!name || (!email && !phone)) {
    return { ok: false, message: 'Add your name and an email or phone number.' }
  }

  if (!propertyId) {
    return { ok: false, message: 'Choose a home before sending a message.' }
  }

  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { ok: false, message: 'We could not send your message. Please try again.' }

  const mutation = `
    mutation SubmitListingInquiry($data: SubmitListingInquiryInput!) {
      submitListingInquiry(data: $data) {
        ok
        message
      }
    }
  `

  const response = await keystoneClient<{ submitListingInquiry: InquiryState }>(mutation, {
    data: {
      brokerageSlug,
      name,
      email,
      phone,
      intent,
      message,
      preferredTime,
      propertyId,
    },
  }, { cache: 'no-store' })

  if (!response.success) {
    return { ok: false, message: 'We could not send your message. Please try again.' }
  }

  if (!response.data.submitListingInquiry.ok) {
    const message = response.data.submitListingInquiry.message
    return { ok: false, message: /authori|eligib|verif/i.test(message) ? 'This home is not accepting messages right now.' : message }
  }

    return { ok: true, message: 'Message sent. An advisor will be in touch.' }
}
