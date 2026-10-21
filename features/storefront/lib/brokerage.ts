import { getBrokerageSettings } from './data/settings'

/** The storefront serves the primary brokerage, resolved server-side by the public identity query. */
export async function getStorefrontBrokerageSlug(): Promise<string | null> {
  const state = await getBrokerageSettings()
  return state.status === 'ready' ? state.brokerageSlug : null
}
