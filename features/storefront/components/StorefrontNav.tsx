import type { BrokerageSettings } from '@/features/storefront/lib/data/settings'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { StorefrontNavBar, type StorefrontSections } from './StorefrontNavBar'

export type { StorefrontSections } from './StorefrontNavBar'

/** Header with the shopper's signed-in state. */
export async function StorefrontNav({ settings, sections }: { settings: BrokerageSettings; sections?: StorefrontSections }) {
  const customer = await getCustomer()
  return <StorefrontNavBar settings={settings} sections={sections} customerName={customer ? customer.name.trim() || customer.email : null} />
}
