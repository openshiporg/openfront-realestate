import type { CSSProperties, ReactNode } from 'react'
import { Hanken_Grotesk, Instrument_Serif } from 'next/font/google'
import '@/features/storefront/styles/storefront.css'
import { storefrontBrandHueFromLogoColor } from '@/features/lib/storefront-theme'

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

type StorefrontThemeStyle = CSSProperties & { '--sf-brand-hue': number }

/** Fonts, tokens and brand hue for every storefront surface, including the root 404. */
export function StorefrontFrame({ logoColor, children }: { logoColor?: string; children: ReactNode }) {
  const style: StorefrontThemeStyle = { '--sf-brand-hue': storefrontBrandHueFromLogoColor(logoColor) }
  return <div className={`storefront-root ${instrument.variable} ${hanken.variable}`} style={style}>{children}</div>
}
