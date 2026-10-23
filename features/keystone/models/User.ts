import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { password, relationship, select, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules, validateRequiredToOneRelationship } from '../access'
import { trackingFields } from './trackingFields'

export const User = list({
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === 'delete') return
      validateRequiredToOneRelationship({ operation, inputData, field: 'activeBrokerage', addValidationError })
    },
  },
  access: {
    operation: {
      query: isSignedIn,
      update: isSignedIn,
      create: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ['name', 'email', 'role', 'assignedLeads'],
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.itemId === item?.id || session?.data?.role?.canEditOtherPeople) return 'edit'
        return 'read'
      },
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({
      isFilterable: false,
      isOrderable: false,
      isIndexed: 'unique',
      validation: { isRequired: true },
      // Self-service, or a people editor within the brokerage (list filter scopes the target).
      access: { update: ({ session, item }) => session?.itemId === item.id || Boolean(session?.data?.role?.canEditOtherPeople) },
    }),
    phone: text(),
    licenseNumber: text(),
    brokerageTitle: text(),
    bio: text({ ui: { displayMode: 'textarea' } }),
    avatarUrl: text(),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) => session?.itemId === item.id,
      },
      validation: {
        length: { min: 10, max: 1000 },
        isRequired: true,
        rejectCommon: true,
      },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      // Role managers who can edit people may re-role members of their active
      // brokerage (the list update filter scopes the target user).
      access: {
        create: denyAll,
        update: ({ session, item }) =>
          permissions.canManageRoles({ session }) &&
          Boolean(session?.data?.role?.canEditOtherPeople) &&
          session?.itemId !== item.id,
      },
      ui: {
        itemView: {
          fieldMode: ({ session }) =>
            permissions.canManageRoles({ session }) && session?.data?.role?.canEditOtherPeople ? 'edit' : 'read',
        },
      },
    }),
    // Inverse writes bypass the related list's update access and hooks in Keystone.
    // Assignments and immutable evidence may only be linked by controlled commands.
    assignedProperties: relationship({ ref: 'Property.assignedAgent', many: true, access: { create: denyAll, update: denyAll } }),
    assignedLeads: relationship({ ref: 'Lead.assignedAgent', many: true, access: { create: denyAll, update: denyAll } }),
    assignedShowings: relationship({ ref: 'Showing.assignedAgent', many: true, access: { create: denyAll, update: denyAll } }),
    assignedDeals: relationship({ ref: 'Deal.assignedAgent', many: true, access: { create: denyAll, update: denyAll } }),
    leadRoutingRules: relationship({ ref: 'LeadRoutingRule.assignedAgent', many: true, access: { create: denyAll, update: denyAll } }),
    customerShowings: relationship({ ref: 'Showing.customer', many: true, access: { create: denyAll, update: denyAll } }),
    customerInquiries: relationship({ ref: 'LeadActivity.customer', many: true, access: { create: denyAll, update: denyAll } }),
    savedProperties: relationship({ ref: 'SavedProperty.user', many: true, access: { create: denyAll, update: denyAll } }),
    practitionerLicenseAuthorities: relationship({ ref: 'PractitionerLicenseAuthority.practitioner', many: true, access: { create: denyAll, update: denyAll } }),
    verifiedPractitionerLicenses: relationship({ ref: 'PractitionerLicenseAuthority.verifiedBy', many: true, access: { create: denyAll, update: denyAll } }),
    listingEngagementAuthorities: relationship({ ref: 'ListingEngagementAuthority.assignedPractitioner', many: true, access: { create: denyAll, update: denyAll } }),
    recordedListingEngagementAuthorities: relationship({ ref: 'ListingEngagementAuthority.recordedBy', many: true, access: { create: denyAll, update: denyAll } }),
    recordedListingPublicationAuthorities: relationship({ ref: 'ListingPublicationAuthority.recordedBy', many: true, access: { create: denyAll, update: denyAll } }),
    representationAuthorities: relationship({ ref: 'RepresentationAuthority.practitioner', many: true, access: { create: denyAll, update: denyAll } }),
    recordedRepresentationAuthorities: relationship({ ref: 'RepresentationAuthority.recordedBy', many: true, access: { create: denyAll, update: denyAll } }),
    recordedDocumentEvidenceEvents: relationship({ ref: 'DocumentEvidenceEvent.actor', many: true, access: { create: denyAll, update: denyAll } }),
    commissionLedgerEntries: relationship({ ref: 'CommissionLedgerEntry.payeeUser', many: true, access: { create: denyAll, update: denyAll } }),
    preparedCommissionLedgerEntries: relationship({ ref: 'CommissionLedgerEntry.preparedBy', many: true, access: { create: denyAll, update: denyAll } }),
    approvedCommissionLedgerEntries: relationship({ ref: 'CommissionLedgerEntry.approvedBy', many: true, access: { create: denyAll, update: denyAll } }),
    approvedRetentionPolicies: relationship({ ref: 'RetentionPolicy.approvedBy', many: true, access: { create: denyAll, update: denyAll } }),
    recordedTransactionFileEvents: relationship({ ref: 'TransactionFileEvent.actor', many: true, access: { create: denyAll, update: denyAll } }),
    approvedTransactionFileEvents: relationship({ ref: 'TransactionFileEvent.approvedBy', many: true, access: { create: denyAll, update: denyAll } }),
    activeBrokerage: relationship({
      ref: 'Brokerage.activeUsers',
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' } },
    }),
    brokerageMemberships: relationship({
      ref: 'BrokerageMembership.user',
      many: true,
      access: {
        create: () => false,
        update: () => false,
      },
    }),
    onboardingStatus: select({
      type: 'enum',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      // Users may record their own setup progress; nobody else's.
      access: { create: () => false, update: ({ session, item }) => session?.itemId === item.id },
      ui: { description: 'Brokerage onboarding progress.' },
    }),
    ...trackingFields,
  },
});
