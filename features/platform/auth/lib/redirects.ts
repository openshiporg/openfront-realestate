const DASHBOARD_BASE = 'https://dashboard.invalid'
const FALLBACK = '/dashboard'

/** Accept only same-origin dashboard paths; never reinterpret a return URL as an external URL. */
export function safeDashboardReturnPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return FALLBACK
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return FALLBACK

  try {
    const destination = new URL(value, DASHBOARD_BASE)
    if (destination.origin !== DASHBOARD_BASE) return FALLBACK
    const decodedPath = decodeURIComponent(destination.pathname)
    if (decodedPath.includes('\\') || /[\u0000-\u001f\u007f]/.test(decodedPath)) return FALLBACK
    if (!(decodedPath === '/dashboard' || decodedPath.startsWith('/dashboard/'))) return FALLBACK
    if (/^\/dashboard\/(?:signin|reset|init|no-access)(?:\/|$)/i.test(decodedPath)) return FALLBACK
    return `${destination.pathname}${destination.search}`
  } catch {
    return FALLBACK
  }
}
