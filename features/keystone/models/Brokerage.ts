import { list } from '@keystone-6/core'
import { checkbox, relationship, select, text } from '@keystone-6/core/fields'

import { isOperator, rules } from '../access'
import { trackingFields } from './trackingFields'

export const Brokerage = list({
  access: {
    operation: {
      query: isOperator,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadBrokerages },
  },
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['name', 'slug', 'status', 'isPrimary'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
    }),
    isPrimary: checkbox({ defaultValue: false }),
    settings: relationship({ ref: 'BrokerageSettings.brokerage', many: true }),
    activeUsers: relationship({ ref: 'User.activeBrokerage', many: true }),
    memberships: relationship({ ref: 'BrokerageMembership.brokerage', many: true }),
    teams: relationship({ ref: 'AgentTeam.brokerage', many: true }),
    properties: relationship({ ref: 'Property.brokerage', many: true }),
    leads: relationship({ ref: 'Lead.brokerage', many: true }),
    leadActivities: relationship({ ref: 'LeadActivity.brokerage', many: true }),
    leadRoutingRules: relationship({ ref: 'LeadRoutingRule.brokerage', many: true }),
    showings: relationship({ ref: 'Showing.brokerage', many: true }),
    deals: relationship({ ref: 'Deal.brokerage', many: true }),
    offers: relationship({ ref: 'Offer.brokerage', many: true }),
    commissions: relationship({ ref: 'Commission.brokerage', many: true }),
    listingSyndications: relationship({ ref: 'ListingSyndication.brokerage', many: true }),
    listingEngagementAuthorities: relationship({ ref: 'ListingEngagementAuthority.brokerage', many: true }),
    listingPublicationAuthorities: relationship({ ref: 'ListingPublicationAuthority.brokerage', many: true }),
    practitionerLicenseAuthorities: relationship({ ref: 'PractitionerLicenseAuthority.brokerage', many: true }),
    representationAuthorities: relationship({ ref: 'RepresentationAuthority.brokerage', many: true }),
    documentEvidenceEvents: relationship({ ref: 'DocumentEvidenceEvent.brokerage', many: true }),
    commissionLedgerEntries: relationship({ ref: 'CommissionLedgerEntry.brokerage', many: true }),
    retentionPolicies: relationship({ ref: 'RetentionPolicy.brokerage', many: true }),
    transactionFileEvents: relationship({ ref: 'TransactionFileEvent.brokerage', many: true }),
    auditEvents: relationship({ ref: 'DomainAuditEvent.brokerage', many: true }),
    outboxEvents: relationship({ ref: 'DomainOutboxEvent.brokerage', many: true }),
    ...trackingFields,
  },
})
