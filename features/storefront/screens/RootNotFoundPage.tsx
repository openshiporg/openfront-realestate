import { StorefrontFrame } from '../components/StorefrontFrame'
import { getBrokerageSettings } from '../lib/data/settings'
import NotFoundPage from './NotFoundPage'

import type { Metadata } from 'next'

// No title: the root layout's title ("Page not found · <brokerage>") applies.
export const metadata: Metadata = { robots: { index: false, follow: false }, icons: { icon: [{ url: '/brand-mark.svg', type: 'image/svg+xml' }] } }

/** Unmatched URLs render outside the storefront layout, so this wraps the branded 404 in the same frame. */
export default async function RootNotFoundPage() {
  const state = await getBrokerageSettings()
  return <StorefrontFrame logoColor={state.status === 'ready' ? state.settings.logoColor : undefined}><NotFoundPage /></StorefrontFrame>
}
