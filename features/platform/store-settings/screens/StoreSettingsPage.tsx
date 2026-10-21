import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { getPlatformStorefrontSettings } from '../actions/storefront-settings'
import { StoreSettingsPageClient } from './StoreSettingsPageClient'

export default async function StoreSettingsPage() {
  const response = await getPlatformStorefrontSettings()

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Store Settings' },
        ]}
      />
      <StoreSettingsPageClient
        initialData={response.status === 'ready' ? response.settings : null}
        initialError={response.status === 'error' ? response.error : null}
      />
    </section>
  )
}
