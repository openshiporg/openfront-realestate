import { list } from '@keystone-6/core'
import { integer, relationship, text } from '@keystone-6/core/fields'

import {
  canCreateInActiveBrokerage,
  canMoveToActiveBrokerage,
  permissions,
  rules,
  validateRequiredToOneRelationship,
} from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { normalizeStorefrontBrandHue } from '../../lib/storefront-theme'
import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '../../lib/store-logo'
import { trackingFields } from './trackingFields'

const settingsHooks = createTenantOwnedHooks({ listKey: 'BrokerageSettings', protectDelete: true })

export const BrokerageSettings = list({
  access: {
    operation: {
      query: permissions.canManageBrokerageSettings,
      create: permissions.canManageBrokerageSettings,
      update: permissions.canManageBrokerageSettings,
      delete: () => false,
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage,
    },
  },
  hooks: {
    resolveInput: settingsHooks.resolveInput,
    validateInput: async (args) => {
      await settingsHooks.validateInput(args)
      validateRequiredToOneRelationship({ operation: args.operation, inputData: args.inputData, field: 'brokerage', addValidationError: args.addValidationError })
    },
    beforeOperation: settingsHooks.beforeOperation,
    afterOperation: settingsHooks.afterOperation,
  },
  db: { idField: { kind: 'autoincrement' } },
  graphql: {
    plural: 'BrokerageSettingsItems',
  },
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ['businessName', 'marketLabel', 'city', 'state'],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.settings', access: { update: () => false } }),
    key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    businessName: text({ validation: { isRequired: true } }),
    marketLabel: text({ validation: { isRequired: true } }),
    city: text({ validation: { isRequired: true } }),
    state: text({ validation: { isRequired: true } }),
    tagline: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    equalHousingNotice: text(),
    publicPhone: text(),
    publicEmail: text(),
    showingDurationMinutes: integer({ defaultValue: 60, validation: { min: 15, max: 240 } }),
    brandHue: integer({
      defaultValue: 151,
      validation: { min: 0, max: 359, isRequired: true },
      ui: { description: 'Constrained storefront brand hue in degrees (0–359).' },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey]
          return value === undefined ? value : normalizeStorefrontBrandHue(value)
        },
      },
    }),
    logoIcon: text({ hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
      const value = resolvedData[fieldKey]
      if (value === undefined) return value
      const safe = sanitizeStoreLogoSvg(String(value || ''))
      if (String(value || '').trim() && !safe) throw new Error('Logo SVG is not allowed.')
      return safe
    } } }),
    logoColor: text({ defaultValue: '0', hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    ...trackingFields,
  },
})
