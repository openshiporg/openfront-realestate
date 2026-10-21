export function humanize(value?: string | null, fallback = '—') {
  if (!value) return fallback
  const text = value.replaceAll('_', ' ').replaceAll('.', ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback
}

export const leadStatusLabels: Record<string, string> = {
  new: 'New',
  attempted_contact: 'Attempted contact',
  qualified: 'Qualified',
  tour_scheduled: 'Tour scheduled',
  offer: 'Offer',
  closed: 'Closed',
  lost: 'Lost',
}

export const leadStatusColors: Record<string, 'blue' | 'amber' | 'emerald' | 'violet' | 'fuchsia' | 'zinc' | 'rose'> = {
  new: 'blue',
  attempted_contact: 'amber',
  qualified: 'emerald',
  tour_scheduled: 'violet',
  offer: 'fuchsia',
  closed: 'zinc',
  lost: 'rose',
}

export const leadIntentLabels: Record<string, string> = { buy: 'Buying', rent: 'Renting', sell: 'Selling', invest: 'Investing', unknown: 'Intent unknown' }
export const leadSourceLabels: Record<string, string> = { website: 'Website', zillow: 'Zillow', referral: 'Referral', open_house: 'Open house', phone: 'Phone', import: 'Import' }
export const activityTypeLabels: Record<string, string> = { inquiry: 'Inquiry', call: 'Call', email: 'Email', text: 'Text', note: 'Note', status_change: 'Status change', showing_requested: 'Showing requested', showing_scheduled: 'Showing scheduled' }
export const channelLabels: Record<string, string> = { website: 'Website', phone: 'Phone', email: 'Email', sms: 'SMS', in_person: 'In person', crm: 'CRM' }

export function label(map: Record<string, string>, value?: string | null, fallback = '—') {
  if (!value) return fallback
  return map[value] || humanize(value, fallback)
}
