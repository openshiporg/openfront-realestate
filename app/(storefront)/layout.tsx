import type { Metadata, Viewport } from 'next'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { StorefrontSettingsState } from '@/features/storefront/components/StorefrontSettingsState'
import { storefrontOrigin } from '@/features/storefront/lib/metadata'
import { StorefrontFrame } from '@/features/storefront/components/StorefrontFrame'
import { storefrontBrandHueFromLogoColor, storefrontThemeColor } from '@/features/lib/storefront-theme'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const [state, origin] = await Promise.all([getBrokerageSettings(), storefrontOrigin()])
  const shared: Metadata = { ...(origin ? { metadataBase: origin } : {}), icons: { icon: [{ url: '/brand-mark.svg', type: 'image/svg+xml' }] } }
  if (state.status !== 'ready') {
    return {
      ...shared,
      title: state.status === 'unconfigured' ? 'Coming soon' : 'Unavailable',
      robots: { index: false, follow: false },
    }
  }

  const { settings } = state
  return {
    ...shared,
    title: { absolute: settings.businessName, template: `%s · ${settings.businessName}` },
    description: settings.description || settings.tagline,
    openGraph: { type: 'website', title: settings.businessName, description: settings.description || settings.tagline, siteName: settings.businessName },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const state = await getBrokerageSettings()
  return { themeColor: storefrontThemeColor(storefrontBrandHueFromLogoColor(state.status === 'ready' ? state.settings.logoColor : undefined)) }
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const state = await getBrokerageSettings()
  return (
    <StorefrontFrame logoColor={state.status === 'ready' ? state.settings.logoColor : undefined}>
      {state.status === 'ready' ? children : <StorefrontSettingsState state={state} />}
    </StorefrontFrame>
  )
}
