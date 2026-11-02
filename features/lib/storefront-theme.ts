export const DEFAULT_STOREFRONT_BRAND_HUE = 151
export const MIN_STOREFRONT_BRAND_HUE = 0
export const MAX_STOREFRONT_BRAND_HUE = 359

export function normalizeStorefrontBrandHue(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_STOREFRONT_BRAND_HUE
  const integer = Math.round(numeric)
  return ((integer % 360) + 360) % 360
}

/**
 * The storefront palette follows the brokerage's own brand hue, not the logo colour:
 * the logo colour only tints the mark (hue-rotate), so picking a mark colour never repaints
 * buttons, price pins or the search bar.
 */
export function storefrontBrandHue(brandHue: unknown): number {
  return normalizeStorefrontBrandHue(brandHue ?? DEFAULT_STOREFRONT_BRAND_HUE)
}

export function storefrontThemeColor(value: unknown): string {
  return `hsl(${normalizeStorefrontBrandHue(value)} 34% 24%)`
}
