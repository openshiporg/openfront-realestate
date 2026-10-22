import type { CSSProperties } from 'react'
import type { Metadata, Viewport } from 'next'
import { Hanken_Grotesk, Instrument_Serif } from 'next/font/google'
import '@/features/storefront/styles/storefront.css'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { StorefrontSettingsState } from '@/features/storefront/components/StorefrontSettingsState'
import { storefrontBrandHueFromLogoColor, storefrontThemeColor } from '@/features/lib/storefront-theme'

const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
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
    <div className={`storefront-root ${instrument.variable} ${hanken.variable}`} style={style}>
      {state.status === 'ready' ? children : <StorefrontSettingsState state={state} />}
    </div>
  )
}
