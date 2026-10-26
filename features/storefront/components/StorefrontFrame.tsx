import type { CSSProperties, ReactNode } from 'react'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import '@/features/storefront/styles/galvalume.css'
import { storefrontBrandHueFromLogoColor } from '@/features/lib/storefront-theme'

// Barlow was drawn from highway and rail signage: a sturdy grotesk for reading,
// its condensed cut for prices and facts set like stamped metal plates.
const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

type StorefrontThemeStyle = CSSProperties & { '--sf-brand-hue': number }

/** Fonts, tokens and brand hue for every storefront surface, including the root 404. */
export function StorefrontFrame({ logoColor, children }: { logoColor?: string; children: ReactNode }) {
  const style: StorefrontThemeStyle = { '--sf-brand-hue': storefrontBrandHueFromLogoColor(logoColor) }
  return <div className={`storefront-root ${barlow.variable} ${barlowCondensed.variable}`} style={style}>{children}</div>
}
