import { requirePlatformAccess } from '@/features/platform/lib/requireAccess'
import StoreSettingsPage from '@/features/platform/store-settings/screens/StoreSettingsPage'

export default async function Page() {
  await requirePlatformAccess('/platform/store-settings')
  return StoreSettingsPage()
}
