import { showingCalendar } from '@/features/storefront/lib/calendarRoutes'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return showingCalendar(id)
}
