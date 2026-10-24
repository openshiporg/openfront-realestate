import { BarChart3, Building2, CalendarDays, ContactRound, KanbanSquare, ListChecks, LucideIcon, Route, Settings, Store, Users, Workflow } from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  color: string
  description: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

export const platformNavItems: PlatformNavItem[] = [
  { title: 'Listings', href: '/platform/listings', color: 'emerald', description: 'Manage listings for sale and for rent.', icon: Building2, group: 'standalone' },
  { title: 'Leads', href: '/platform/leads', color: 'blue', description: 'Follow up with buyer, renter and seller inquiries.', icon: ContactRound, group: 'standalone' },
  { title: 'Showings', href: '/platform/showings', color: 'violet', description: 'Confirm tours and record feedback.', icon: CalendarDays, group: 'standalone' },
  { title: 'Pipeline', href: '/platform/pipeline', color: 'amber', description: 'Track deals from first contact to close.', icon: KanbanSquare, group: 'standalone' },
  { title: 'Tasks', href: '/platform/tasks', color: 'sky', description: 'Agent to-dos across leads, deals and listings.', icon: ListChecks, group: 'standalone' },
  { title: 'Agents & Teams', href: '/platform/people', color: 'slate', description: 'Manage agents, teams and workload.', icon: Users, group: 'brokerage' },
  { title: 'Lead Routing', href: '/platform/routing', color: 'emerald', description: 'Assign new leads by location, source and intent.', icon: Route, group: 'brokerage' },
  { title: 'Reports', href: '/platform/reports', color: 'indigo', description: 'Leads, showings, listings and commission.', icon: BarChart3, group: 'brokerage' },
  { title: 'Operations', href: '/platform/operations', color: 'rose', description: 'Offers, closings, commissions and records.', icon: Workflow, group: 'brokerage' },
  { title: 'Store Settings', href: '/platform/store-settings', color: 'emerald', description: 'Manage your brokerage details and storefront.', icon: Store, group: 'settings' },
  { title: 'Roles', href: '/roles', color: 'zinc', description: 'Manage staff roles and permissions.', icon: Settings, group: 'settings' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'brokerage', title: 'Brokerage', icon: Users, items: platformNavItems.filter((i) => i.group === 'brokerage') },
  { id: 'settings', title: 'Settings', icon: Settings, items: platformNavItems.filter((i) => i.group === 'settings') },
]

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
