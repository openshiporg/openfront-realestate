import { cache } from 'react'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type BrokerageSettings = {
  businessName: string
  marketLabel: string
  city: string
  state: string
  tagline: string
  description: string
  equalHousingNotice: string
  publicPhone: string
  publicEmail: string
  logoIcon: string
  logoColor: string
}

export type BrokerageSettingsState =
  | { status: 'ready'; brokerageSlug: string; settings: BrokerageSettings }
  | { status: 'unconfigured'; brokerageSlug: null; settings: null }
  | { status: 'error'; brokerageSlug: null; settings: null; message: string }

type BrokerageSettingsResponse = {
  publicBrokerageIdentity: {
    status: 'ready' | 'unconfigured'
    brokerageSlug: string | null
    settings: BrokerageSettings | null
  }
}

const LOAD_ERROR = 'The storefront could not be loaded.'

export const getBrokerageSettings = cache(async function getBrokerageSettings(): Promise<BrokerageSettingsState> {
  const response = await keystoneClient<BrokerageSettingsResponse>(`
    query StorefrontBrokerageIdentity {
      publicBrokerageIdentity {
        status
        brokerageSlug
        settings {
          businessName
          marketLabel
          city
          state
          tagline
          description
          equalHousingNotice
          publicPhone
          publicEmail
          logoIcon
          logoColor
        }
      }
    }
  `, {}, { cache: 'no-store' })

  if (!response.success) return { status: 'error', brokerageSlug: null, settings: null, message: LOAD_ERROR }

  const result = response.data.publicBrokerageIdentity
  if (result.status === 'unconfigured' || !result.settings || !result.brokerageSlug) return { status: 'unconfigured', brokerageSlug: null, settings: null }
  if (result.status !== 'ready') return { status: 'error', brokerageSlug: null, settings: null, message: LOAD_ERROR }

  return {
    status: 'ready',
    brokerageSlug: result.brokerageSlug,
    settings: {
      ...result.settings,
      logoIcon: sanitizeStoreLogoSvg(result.settings.logoIcon || ''),
      logoColor: normalizeStoreLogoColor(result.settings.logoColor),
    },
  }
})
