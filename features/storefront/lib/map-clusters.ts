/** A pin's anchor on screen. */
export type ScreenPoint = { id: string; x: number; y: number }

/**
 * Groups pins whose points land within `radius` px of each other into one cluster. Greedy and
 * order-stable: the first ungrouped pin collects every ungrouped pin around it. A results page holds
 * at most a page of homes, so this runs on every settled move without an index.
 */
export function groupPins(points: ScreenPoint[], radius: number): string[][] {
  const taken = new Set<string>()
  const groups: string[][] = []
  for (const point of points) {
    if (taken.has(point.id)) continue
    const group = points.filter(other => !taken.has(other.id) && Math.hypot(other.x - point.x, other.y - point.y) <= radius)
    group.forEach(member => taken.add(member.id))
    groups.push(group.map(member => member.id).sort())
  }
  return groups
}

/** "3 homes · $449K+": the cheapest home leads, sale prices before rents. */
export function clusterLabel(members: Array<{ label: string; price?: number; rent?: boolean }>) {
  const priced = members
    .filter(member => member.label && Number(member.price) > 0)
    .sort((a, b) => Number(Boolean(a.rent)) - Number(Boolean(b.rent)) || Number(a.price) - Number(b.price))
  const count = `${members.length} homes`
  return { count, from: priced[0] ? `${priced[0].label}+` : '' }
}
