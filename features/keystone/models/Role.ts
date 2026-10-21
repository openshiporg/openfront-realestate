import { list } from '@keystone-6/core'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { isOperator, permissions } from '../access'
import { trackingFields } from './trackingFields'

export const Role = list({
  access: {
    operation: {
      query: isOperator,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: permissions.canManageRoles,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    isHidden: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'canAccessDashboard', 'canManageListings', 'canManageLeads', 'assignedTo'],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canAccessDashboard: checkbox({ defaultValue: false }),
    canManageListings: checkbox({ defaultValue: false }),
    canManageLeads: checkbox({ defaultValue: false }),
    canManageShowings: checkbox({ defaultValue: false }),
    canManageDeals: checkbox({ defaultValue: false }),
    canViewReports: checkbox({ defaultValue: false }),
    canManageOnboarding: checkbox({ defaultValue: false }),
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      // Assign roles from the user record, where brokerage scoping applies.
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' }, createView: { fieldMode: 'hidden' } },
    }),
    ...trackingFields,
  },
});
