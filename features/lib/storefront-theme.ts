import { normalizeStoreLogoColor } from './store-logo'

export const DEFAULT_STOREFRONT_BRAND_HUE = 151
export const MIN_STOREFRONT_BRAND_HUE = 0
export const MAX_STOREFRONT_BRAND_HUE = 359

export function normalizeStorefrontBrandHue(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_STOREFRONT_BRAND_HUE
  const integer = Math.round(numeric)
  return ((integer % 360) + 360) % 360
}

/** The storefront palette follows the store logo colour (as in Openfront Restaurant). */
export function storefrontBrandHueFromLogoColor(logoColor: unknown): number {
  return normalizeStorefrontBrandHue(DEFAULT_STOREFRONT_BRAND_HUE + Number(normalizeStoreLogoColor(logoColor)))
}

export function storefrontThemeColor(value: unknown): string {
  return `hsl(${normalizeStorefrontBrandHue(value)} 34% 24%)`
}
