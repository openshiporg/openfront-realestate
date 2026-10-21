import { sanitizeStoreLogoSvg } from './sanitize-store-logo'
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from './store-logo'

/** Sized by the caller's className; the SVG fills the box. */
export function StoreLogo({ logoIcon, logoColor, className }: { logoIcon?: string; logoColor?: string; className?: string }) {
  const svg = sanitizeStoreLogoSvg(logoIcon || '') || DEFAULT_STORE_LOGO_ICON
  return <span className={`inline-flex shrink-0 [&>svg]:size-full ${className ?? 'size-11'}`} aria-hidden="true" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} />
}
