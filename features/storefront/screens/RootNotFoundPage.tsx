import { StorefrontFrame } from '../components/StorefrontFrame'
import { getBrokerageSettings } from '../lib/data/settings'
import NotFoundPage from './NotFoundPage'

export { metadata } from './NotFoundPage'

/** Unmatched URLs render outside the storefront layout, so this wraps the branded 404 in the same frame. */
export default async function RootNotFoundPage() {
  const state = await getBrokerageSettings()
  return <StorefrontFrame logoColor={state.status === 'ready' ? state.settings.logoColor : undefined}><NotFoundPage /></StorefrontFrame>
}
