import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getSavedPropertyIds } from '@/features/storefront/lib/data/saved'
import { StorefrontNavBar, type StorefrontSections } from './StorefrontNavBar'

export type { StorefrontSections } from './StorefrontNavBar'

/** Header with the shopper's signed-in state and how many homes they have saved. */
export async function StorefrontNav({ settings, sections }: { settings: BrokerageSettings; sections?: StorefrontSections }) {
  const customer = await getCustomer()
  const savedCount = customer ? Object.keys(await getSavedPropertyIds()).length : 0
  return <StorefrontNavBar settings={settings} sections={sections} customerName={customer ? customer.name.trim() || customer.email : null} savedCount={savedCount} />
}
