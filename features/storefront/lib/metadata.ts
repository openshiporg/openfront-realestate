import type { Metadata } from 'next'
import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl'
import { getBrokerageSettings } from './data/settings'

/** Absolute site origin for canonical, Open Graph, robots and sitemap URLs. */
export async function storefrontOrigin() {
  const base = await getBaseUrl()
  try {
    return base ? new URL(base) : null
  } catch {
    return null
  }
}

/** "Title · Brokerage" for pages whose metadata does not inherit the layout template (parallel route slots). */
export async function storefrontTitle(title: string): Promise<Metadata['title']> {
  const state = await getBrokerageSettings()
  return { absolute: state.status === 'ready' ? `${title} · ${state.settings.businessName}` : title }
}
