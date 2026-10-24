import type { MetadataRoute } from 'next'
import { getBrokerageSettings } from './data/settings'
import { storefrontOrigin } from './metadata'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [state, origin] = await Promise.all([getBrokerageSettings(), storefrontOrigin()])
  if (state.status !== 'ready') return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/account', '/password-reset', '/calendar', '/api'] },
    ...(origin ? { sitemap: new URL('/sitemap.xml', origin).toString() } : {}),
  }
}
