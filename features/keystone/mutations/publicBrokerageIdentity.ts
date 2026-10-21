import type { Context } from '.keystone/types'
import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '../../lib/store-logo'

export type PublicBrokerageIdentity = {
  businessName: string
  marketLabel: string
  city: string
  state: string
  tagline: string
  description: string
  equalHousingNotice: string
  publicPhone: string
  publicEmail: string
  brandHue: number
  logoIcon: string
  logoColor: string
}

export type PublicBrokerageIdentityState = {
  status: 'ready' | 'unconfigured'
  brokerageSlug: string | null
  settings: PublicBrokerageIdentity | null
}

/** The storefront serves the single primary brokerage. An explicit slug is still
 * accepted for callers that already know which active brokerage they want. */
export async function resolvePublicBrokerage(context: Context, brokerageSlug?: string | null) {
  const slug = String(brokerageSlug || '').trim().toLowerCase()
  if (slug && (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) return null
  const rows = await context.sudo().query.Brokerage.findMany({
    where: slug
      ? { slug: { equals: slug }, status: { equals: 'active' } }
      : { isPrimary: { equals: true }, status: { equals: 'active' } },
    orderBy: [{ id: 'asc' }],
    take: 1,
    query: 'id slug',
  })
  return rows[0] ? { id: String(rows[0].id), slug: String(rows[0].slug) } : null
}

export async function publicBrokerageIdentity(
  _root: unknown,
  { brokerageSlug }: { brokerageSlug?: string | null },
  context: Context
): Promise<PublicBrokerageIdentityState> {
  const brokerage = await resolvePublicBrokerage(context, brokerageSlug)
  if (!brokerage) return { status: 'unconfigured', brokerageSlug: null, settings: null }

  const settings = await context.sudo().query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: brokerage.id } } },
    orderBy: [{ id: 'asc' }],
    take: 1,
    query: 'businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail brandHue logoIcon logoColor',
  })

  const identity = settings[0]
  if (!identity) return { status: 'unconfigured', brokerageSlug: brokerage.slug, settings: null }
  const requiredIdentity = [identity.businessName, identity.marketLabel, identity.city, identity.state, identity.tagline]
  if (requiredIdentity.some(value => !String(value || '').trim())) return { status: 'unconfigured', brokerageSlug: brokerage.slug, settings: null }

  return {
    status: 'ready',
    brokerageSlug: brokerage.slug,
    settings: {
      businessName: identity.businessName,
      marketLabel: identity.marketLabel,
      city: identity.city,
      state: identity.state,
      tagline: identity.tagline,
      description: identity.description || '',
      equalHousingNotice: identity.equalHousingNotice || '',
      publicPhone: identity.publicPhone || '',
      publicEmail: identity.publicEmail || '',
      brandHue: identity.brandHue,
      logoIcon: sanitizeStoreLogoSvg(identity.logoIcon || ''),
      logoColor: normalizeStoreLogoColor(identity.logoColor),
    },
  }
}
