import { openHouseCalendar } from '@/features/storefront/lib/calendarRoutes'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  return openHouseCalendar(slug, id)
}
