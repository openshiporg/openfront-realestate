import { list } from '@keystone-6/core'
import { checkbox, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { isOperator, rules, validateRequiredToOneRelationship } from '../access'
import { trackingFields } from './trackingFields'

export const BrokerageMembership = list({
  access: {
    operation: {
      query: isOperator,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadBrokerageMemberships },
  },
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === 'delete') return
      validateRequiredToOneRelationship({ operation, inputData, field: 'brokerage', addValidationError })
      validateRequiredToOneRelationship({ operation, inputData, field: 'user', addValidationError })
    },
  },
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['brokerage', 'user', 'membershipRole', 'status', 'isPrimary'] } },
  fields: {
    membershipKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    brokerage: relationship({ ref: 'Brokerage.memberships' }),
    user: relationship({ ref: 'User.brokerageMemberships' }),
    membershipRole: select({
      type: 'enum',
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Administrator', value: 'admin' },
        { label: 'Team Lead', value: 'team_lead' },
        { label: 'Agent', value: 'agent' },
        { label: 'Coordinator', value: 'coordinator' },
        { label: 'Analyst', value: 'analyst' },
      ],
      defaultValue: 'agent',
      validation: { isRequired: true },
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
      defaultValue: 'invited',
      validation: { isRequired: true },
    }),
    isPrimary: checkbox({ defaultValue: false }),
    joinedAt: timestamp(),
    ...trackingFields,
  },
})
