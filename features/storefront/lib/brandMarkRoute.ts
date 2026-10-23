import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { getBrokerageSettings } from './data/settings'

/** The brokerage's registry mark as a standalone SVG, tinted like StoreLogo, for the browser tab icon. */
export async function GET() {
  const state = await getBrokerageSettings()
  const settings = state.status === 'ready' ? state.settings : null
  const source = settings?.logoIcon || DEFAULT_STORE_LOGO_ICON
  const hue = normalizeStoreLogoColor(settings?.logoColor)
  const svg = source.replace(/^<svg\b/, `<svg style="filter:hue-rotate(${hue}deg)"`).replace(/^<svg\b(?![^>]*\bxmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg"')
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

export function faviconRedirect(request: Request) {
  return Response.redirect(new URL('/brand-mark.svg', request.url), 307)
}
