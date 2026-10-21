import type { CSSProperties } from 'react'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Source_Sans_3 } from 'next/font/google'
import '@/features/storefront/styles/storefront.css'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { StorefrontSettingsState } from '@/features/storefront/components/StorefrontSettingsState'
import { storefrontBrandHueFromLogoColor, storefrontThemeColor } from '@/features/lib/storefront-theme'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const dynamic = 'force-dynamic'

type StorefrontThemeStyle = CSSProperties & { '--sf-brand-hue': number }

export async function generateMetadata(): Promise<Metadata> {
  const state = await getBrokerageSettings()
  if (state.status !== 'ready') {
    return {
      title: state.status === 'unconfigured' ? 'Coming soon' : 'Unavailable',
      robots: { index: false, follow: false },
    }
  }

  const { settings } = state
  return {
    title: { default: settings.businessName, template: `%s · ${settings.businessName}` },
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
  const style: StorefrontThemeStyle = { '--sf-brand-hue': storefrontBrandHueFromLogoColor(state.status === 'ready' ? state.settings.logoColor : undefined) }

  return (
    <div className={`storefront-root ${cormorant.variable} ${sourceSans.variable}`} style={style}>
      {state.status === 'ready' ? children : <StorefrontSettingsState state={state} />}
    </div>
  )
}
