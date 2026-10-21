export const showingStatusLabels: Record<string, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Cancelled',
}

export const showingStatusColors: Record<string, 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'> = {
  requested: 'blue',
  scheduled: 'violet',
  completed: 'emerald',
  no_show: 'amber',
  cancelled: 'rose',
}

export const showingTypeLabels: Record<string, string> = { in_person: 'In person', virtual: 'Virtual', open_house: 'Open house' }

export const showingHistoryLabels: Record<string, string> = {
  request: 'Requested',
  request_receipt: 'Request received',
  schedule: 'Scheduled',
  complete_with_feedback: 'Completed with feedback',
}
