'use server'

import { revalidatePath } from 'next/cache'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PlatformStorefrontSettings = {
  id: string
  businessName: string
  marketLabel: string
  city: string
  state: string
  tagline: string
  description: string
  equalHousingNotice: string
  publicPhone: string
  publicEmail: string
  showingDurationMinutes: number
  logoIcon: string
  logoColor: string
}

export type PlatformStorefrontSettingsResult =
  | { status: 'ready'; settings: PlatformStorefrontSettings; error: null }
  | { status: 'unconfigured'; settings: null; error: null }
  | { status: 'error'; settings: null; error: string }

const SETTINGS_FIELDS = `
  id
  businessName
  marketLabel
  city
  state
  tagline
  description
  equalHousingNotice
  publicPhone
  publicEmail
  showingDurationMinutes
  logoIcon
  logoColor
`

export async function getPlatformStorefrontSettings(): Promise<PlatformStorefrontSettingsResult> {
  const response = await keystoneClient<any>(`
    query PlatformStorefrontSettings {
      platformStorefrontSettings {
        status
        settings { ${SETTINGS_FIELDS} }
      }
    }
  `, {}, { cache: 'no-store' })

  if (!response.success) return { status: 'error', settings: null, error: 'Store settings could not be loaded.' }
  const result = response.data.platformStorefrontSettings
  return result.status === 'ready' && result.settings
    ? { status: 'ready', settings: result.settings, error: null }
    : { status: 'unconfigured', settings: null, error: null }
}

export type StorefrontSettingsInput = Omit<PlatformStorefrontSettings, 'id'>

export async function savePlatformStorefrontSettings(input: StorefrontSettingsInput): Promise<{ success: boolean; error?: string }> {
  const text = (value: unknown) => String(value ?? '').trim()
  const showingDurationMinutes = Number(input.showingDurationMinutes)
  const data = {
    businessName: text(input.businessName),
    marketLabel: text(input.marketLabel),
    city: text(input.city),
    state: text(input.state),
    tagline: text(input.tagline),
    description: text(input.description),
    equalHousingNotice: text(input.equalHousingNotice),
    publicPhone: text(input.publicPhone),
    publicEmail: text(input.publicEmail).toLowerCase(),
    showingDurationMinutes,
    logoIcon: sanitizeStoreLogoSvg(text(input.logoIcon)),
    logoColor: normalizeStoreLogoColor(input.logoColor),
  }

  if (text(input.logoIcon) && !data.logoIcon) return { success: false, error: 'This logo SVG is not supported.' }
  if (!data.businessName || !data.marketLabel || !data.city || !data.state || !data.tagline) {
    return { success: false, error: 'Business name, market label, city, state and tagline are required.' }
  }
  if (data.publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.publicEmail)) return { success: false, error: 'Enter a valid public email.' }
  if (!Number.isInteger(showingDurationMinutes) || showingDurationMinutes < 15 || showingDurationMinutes > 240) {
    return { success: false, error: 'Showing duration must be between 15 and 240 minutes.' }
  }

  const response = await keystoneClient<any>(`
    mutation UpdatePlatformStorefrontSettings($data: PlatformStorefrontSettingsInput!) {
      updatePlatformStorefrontSettings(data: $data) {
        status
        settings { ${SETTINGS_FIELDS} }
      }
    }
  `, { data }, { cache: 'no-store' })

  if (!response.success || response.data.updatePlatformStorefrontSettings.status !== 'ready') {
    return { success: false, error: 'Store settings could not be saved.' }
  }

  revalidatePath('/dashboard/platform/store-settings')
  revalidatePath('/', 'layout')
  return { success: true }
}
