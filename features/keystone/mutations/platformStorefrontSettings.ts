import type { Context } from '.keystone/types'
import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '../../lib/store-logo'

import { activeBrokerageIds, permissions } from '../access'

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
  brandHue: number
  logoIcon: string
  logoColor: string
}

export type PlatformStorefrontSettingsState = {
  status: 'ready' | 'unconfigured'
  settings: PlatformStorefrontSettings | null
}

// brandHue stays readable for older clients but is no longer written: the storefront
// theme derives from logoColor.
type SettingsInput = Omit<PlatformStorefrontSettings, 'id' | 'brandHue'> & { brandHue?: number | null }

const SETTINGS_SELECTION = 'id businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail showingDurationMinutes brandHue logoIcon logoColor'

function activeBrokerageScope(context: Context) {
  const ids = activeBrokerageIds(context.session as any)
  const selected = context.session?.data.activeBrokerage
  if (ids.length !== 1 || !selected || selected.id !== ids[0] || selected.status !== 'active') {
    throw new Error('An active brokerage is required.')
  }
  return { id: ids[0], slug: selected.slug }
}

async function findScopedSettings(context: Context, brokerageId: string) {
  const rows = await context.query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: brokerageId } } },
    orderBy: [{ id: 'asc' }],
    take: 2,
    query: SETTINGS_SELECTION,
  })
  if (rows.length > 1) throw new Error('Multiple storefront settings records require administrator review.')
  return rows[0] || null
}

function requiredText(value: unknown, label: string, max: number) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error(`${label} is required.`)
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return normalized
}

function optionalText(value: unknown, label: string, max: number) {
  const normalized = String(value ?? '').trim()
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return normalized
}

function normalizeInput(input: SettingsInput) {
  const showingDurationMinutes = Number(input.showingDurationMinutes)
  if (!Number.isInteger(showingDurationMinutes) || showingDurationMinutes < 15 || showingDurationMinutes > 240) {
    throw new Error('Showing duration must be between 15 and 240 minutes.')
  }

  return {
    businessName: requiredText(input.businessName, 'Business name', 120),
    marketLabel: requiredText(input.marketLabel, 'Market label', 120),
    city: requiredText(input.city, 'City', 120),
    state: requiredText(input.state, 'State', 80),
    tagline: requiredText(input.tagline, 'Tagline', 220),
    description: optionalText(input.description, 'Description', 1000),
    equalHousingNotice: optionalText(input.equalHousingNotice, 'Equal housing notice', 240),
    publicPhone: optionalText(input.publicPhone, 'Public phone', 80),
    publicEmail: (() => {
      const email = optionalText(input.publicEmail, 'Public email', 320).toLowerCase()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Public email must be valid.')
      return email
    })(),
    showingDurationMinutes,
    logoIcon: (() => { const raw = String(input.logoIcon || ''); const safe = sanitizeStoreLogoSvg(raw); if (raw.trim() && !safe) throw new Error('This logo SVG is not supported.'); return safe })(),
    logoColor: normalizeStoreLogoColor(input.logoColor),
  }
}

export async function platformStorefrontSettings(
  _root: unknown,
  _args: unknown,
  context: Context
): Promise<PlatformStorefrontSettingsState> {
  if (!permissions.canManageBrokerageSettings({ session: context.session as any })) throw new Error('Not authorized to view storefront settings.')
  const brokerage = activeBrokerageScope(context)
  const settings = await findScopedSettings(context, brokerage.id)
  return settings ? { status: 'ready', settings: settings as PlatformStorefrontSettings } : { status: 'unconfigured', settings: null }
}

export async function updatePlatformStorefrontSettings(
  _root: unknown,
  { data }: { data: SettingsInput },
  context: Context
): Promise<PlatformStorefrontSettingsState> {
  if (!permissions.canManageBrokerageSettings({ session: context.session as any })) throw new Error('Not authorized to update storefront settings.')
  const brokerage = activeBrokerageScope(context)
  const normalized = normalizeInput(data)

  const settings = await context.transaction(async tx => {
    const existing = await findScopedSettings(tx, brokerage.id)
    if (existing) {
      return tx.query.BrokerageSettings.updateOne({
        where: { id: existing.id },
        data: normalized,
        query: SETTINGS_SELECTION,
      })
    }

    return tx.query.BrokerageSettings.createOne({
      data: {
        ...normalized,
        key: `${brokerage.slug}:primary`,
        brokerage: { connect: { id: brokerage.id } },
      },
      query: SETTINGS_SELECTION,
    })
  })

  return { status: 'ready', settings: settings as PlatformStorefrontSettings }
}
