import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const PractitionerLicenseAuthority = list({
  access: {
    operation: { query: permissions.canManagePeople, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'PractitionerLicenseAuthority',
    users: ['practitioner', 'verifiedBy'],
    parents: { supersedes: 'PractitionerLicenseAuthority' },
    required: ['practitioner', 'verifiedBy'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['licenseNumber', 'practitioner', 'jurisdictionCode', 'status', 'effectiveFrom', 'effectiveThrough'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.practitionerLicenseAuthorities' }),
    practitioner: relationship({ ref: 'User.practitionerLicenseAuthorities' }),
    licenseNumber: text({ validation: { isRequired: true } }),
    licenseType: select({
      type: 'enum',
      options: [
        { label: 'Broker', value: 'broker' },
        { label: 'Associate broker', value: 'associate_broker' },
        { label: 'Sales agent', value: 'sales_agent' },
      ],
      validation: { isRequired: true },
    }),
    jurisdictionCode: text({ validation: { isRequired: true } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Verified active', value: 'verified_active' },
        { label: 'Restricted', value: 'restricted' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Expired', value: 'expired' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
      ],
      validation: { isRequired: true },
    }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveThrough: timestamp({ validation: { isRequired: true } }),
    verifiedAt: timestamp({ validation: { isRequired: true } }),
    verificationSource: text({ validation: { isRequired: true } }),
    restrictions: text({ ui: { displayMode: 'textarea' } }),
    supersedes: relationship({ ref: 'PractitionerLicenseAuthority.supersededBy' }),
    supersededBy: relationship({ ref: 'PractitionerLicenseAuthority.supersedes', many: true }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    verifiedBy: relationship({ ref: 'User.verifiedPractitionerLicenses' }),
    ...trackingFields,
  },
})
