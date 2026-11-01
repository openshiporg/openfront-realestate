import type { CSSProperties, ReactNode } from 'react'
import { Figtree, Newsreader } from 'next/font/google'
import '@/features/storefront/styles/vega.css'
import { storefrontBrandHueFromLogoColor } from '@/features/lib/storefront-theme'

// Vega: a map-first search. A bookish serif carries the brokerage name, prices and addresses;
// a quiet geometric sans does the reading and the controls.
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

type StorefrontThemeStyle = CSSProperties & { '--sf-brand-hue': number }

/** Fonts, tokens and brand hue for every storefront surface, including the root 404. */
export function StorefrontFrame({ logoColor, children }: { logoColor?: string; children: ReactNode }) {
  const style: StorefrontThemeStyle = { '--sf-brand-hue': storefrontBrandHueFromLogoColor(logoColor) }
  return <div className={`storefront-root ${newsreader.variable} ${figtree.variable}`} style={style}>{children}</div>
}
