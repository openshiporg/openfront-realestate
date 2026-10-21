"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core44 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/lib/staticFieldUi.ts
function deniesStatically(rule) {
  return rule === false || typeof rule === "function" && rule.length === 0 && rule() === false;
}
function staticFieldUi(field) {
  return (meta) => {
    const config3 = field(meta);
    const access = config3.access;
    const createLocked = deniesStatically(typeof access === "function" ? access : access?.create);
    const updateLocked = deniesStatically(typeof access === "function" ? access : access?.update);
    if (!createLocked && !updateLocked) return config3;
    return { ...config3, ui: {
      ...config3.ui,
      ...createLocked ? { createView: { ...config3.ui?.createView, fieldMode: "hidden" } } : {},
      ...updateLocked ? { itemView: { ...config3.ui?.itemView, fieldMode: "read" } } : {}
    } };
  };
}

// features/keystone/models/DomainAuditEvent.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function hasActiveBrokerageSession({ session }) {
  return Boolean(session?.itemId && activeBrokerageIds(session).length);
}
function isSignedIn(args) {
  return hasActiveBrokerageSession(args);
}
var hasRoleFlag = (session, flag) => Boolean(session?.data.role?.[flag]);
function activeBrokerageIds(session) {
  const selected = session?.data.activeBrokerage;
  const memberships = session?.data.brokerageMemberships || [];
  if (!selected || selected.status !== "active") return [];
  const selectedMemberships = memberships.filter(
    (membership) => membership.status === "active" && membership.brokerage?.status === "active" && membership.brokerage.id === selected.id
  );
  return selectedMemberships.length === 1 ? [selected.id] : [];
}
function relationshipInput(inputData, field) {
  const value = inputData?.[field];
  return value && typeof value === "object" ? value : void 0;
}
function canCreateInActiveBrokerage({ session, inputData }) {
  const brokerageId = relationshipInput(inputData, "brokerage")?.connect?.id;
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId));
}
async function canCreateForActiveParent({ session, inputData, context }, field, listKey) {
  const parentId = relationshipInput(inputData, field)?.connect?.id;
  if (!parentId || !context) return false;
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: "id brokerage { id status }" });
  return Boolean(parent?.brokerage?.status === "active" && activeBrokerageIds(session).includes(parent.brokerage.id));
}
var canCreateForActiveDeal = (args) => canCreateForActiveParent(args, "deal", "Deal");
var canCreateForActiveProperty = (args) => canCreateForActiveParent(args, "property", "Property");
var canCreateForActiveShowing = (args) => canCreateForActiveParent(args, "showing", "Showing");
async function canCreateForAssignedParent({ session, inputData, context }, field, listKey, permission) {
  const parentId = relationshipInput(inputData, field)?.connect?.id;
  if (!parentId || !context || !session?.data.role?.[permission]) return false;
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: "id brokerage { id status } assignedAgent { id }" });
  if (!parent?.brokerage?.id || parent.brokerage.status !== "active" || !activeBrokerageIds(session).includes(parent.brokerage.id)) return false;
  return Boolean(session.data.role.canManagePeople || parent.assignedAgent?.id === session.itemId);
}
var canCreateForManagedProperty = (args) => canCreateForAssignedParent(args, "property", "Property", "canManageListings");
var canCreateForManagedSubjectProperty = (args) => canCreateForAssignedParent(args, "subjectProperty", "Property", "canManageListings");
function canMoveToActiveBrokerage({ session, inputData }) {
  if (!inputData || !Object.prototype.hasOwnProperty.call(inputData, "brokerage")) return true;
  const relationship44 = relationshipInput(inputData, "brokerage");
  if (relationship44?.disconnect) return false;
  const brokerageId = relationship44?.connect?.id;
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId));
}
function validateRequiredToOneRelationship({
  operation,
  inputData,
  field,
  addValidationError
}) {
  const relationship44 = relationshipInput(inputData, field);
  const label = field.charAt(0).toUpperCase() + field.slice(1);
  if (operation === "create" && !relationship44?.connect) {
    addValidationError(`${label} is required.`);
  }
  if (operation === "update" && relationship44?.disconnect) {
    addValidationError(`${label} cannot be disconnected.`);
  }
}
var permissions = {
  canManagePeople: ({ session }) => hasRoleFlag(session, "canManagePeople"),
  canManageRoles: ({ session }) => hasRoleFlag(session, "canManageRoles"),
  canManageListings: ({ session }) => hasRoleFlag(session, "canManageListings"),
  canManageLeads: ({ session }) => hasRoleFlag(session, "canManageLeads"),
  canManageShowings: ({ session }) => hasRoleFlag(session, "canManageShowings"),
  canManageDeals: ({ session }) => hasRoleFlag(session, "canManageDeals"),
  canViewReports: ({ session }) => hasRoleFlag(session, "canViewReports"),
  canViewMarketIntelligence: ({ session }) => hasRoleFlag(session, "canManageListings") || hasRoleFlag(session, "canViewReports"),
  canReadSensitiveDeals: ({ session }) => hasRoleFlag(session, "canManageDeals") && hasRoleFlag(session, "canManagePeople"),
  canReadLeadActivities: ({ session }) => hasRoleFlag(session, "canManageLeads") && hasRoleFlag(session, "canManagePeople"),
  canManageOnboarding: ({ session }) => hasRoleFlag(session, "canManageOnboarding"),
  canManageBrokerageListings: ({ session }) => hasRoleFlag(session, "canManageListings") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageDeals: ({ session }) => hasRoleFlag(session, "canManageDeals") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageShowings: ({ session }) => hasRoleFlag(session, "canManageShowings") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageTasks: ({ session }) => hasRoleFlag(session, "canManageLeads") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageSettings: ({ session }) => hasRoleFlag(session, "canManageOnboarding") && hasRoleFlag(session, "canManagePeople"),
  canReadLeads: ({ session }) => hasRoleFlag(session, "canManageLeads"),
  canReadShowings: ({ session }) => hasRoleFlag(session, "canManageShowings"),
  canReadDeals: ({ session }) => hasRoleFlag(session, "canManageDeals")
};
function brokerageOwnedFilter(session) {
  const brokerageIds = activeBrokerageIds(session);
  return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false;
}
function brokerageAndAssignment(session, assignment) {
  const brokerage = brokerageOwnedFilter(session);
  return brokerage === false ? false : { AND: [brokerage, assignment] };
}
var rules = {
  canReadBrokerages: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { id: { in: brokerageIds } } : false;
  },
  canReadBrokerageMemberships: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false;
  },
  canAccessBrokerageRecords: ({ session }) => brokerageOwnedFilter(session),
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople) {
      const brokerageIds = activeBrokerageIds(session);
      if (!brokerageIds.length) return { id: { equals: session.itemId } };
      return {
        OR: [
          { id: { equals: session.itemId } },
          {
            brokerageMemberships: {
              some: {
                status: { equals: "active" },
                brokerage: { id: { in: brokerageIds } }
              }
            }
          }
        ]
      };
    }
    return { id: { equals: session.itemId } };
  },
  // Sharing a brokerage grants visibility, not authority over another user's
  // global identity, credentials, or grants in other brokerages.
  canUpdatePeople: ({ session }) => session ? { id: { equals: session.itemId } } : false,
  canReadLeads: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedLeads: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadLeadActivities: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } });
  },
  canManageAssignedLeadActivities: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } });
  },
  canReadShowings: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedShowings: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadDeals: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedDeals: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadPropertyChildren: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { property: { brokerage: { id: { in: brokerageIds } } } } : false;
  },
  canManageAssignedProperties: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManagePropertyChildren: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { property: { brokerage: { id: { in: brokerageIds } } } } : { property: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadSubjectPropertyChildren: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } } : false;
  },
  canManageSubjectPropertyChildren: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } } : { subjectProperty: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadShowingChildren: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { showing: { brokerage: { id: { in: brokerageIds } } } } : { showing: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadDealChildren: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { deal: { brokerage: { id: { in: brokerageIds } } } } : { deal: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadSavedProperties: ({ session }) => {
    if (!session || !activeBrokerageIds(session).length) return false;
    if (session.data.role?.canManageLeads && session.data.role?.canManagePeople) {
      return { property: { brokerage: { id: { in: activeBrokerageIds(session) } } } };
    }
    return { user: { id: { equals: session.itemId } } };
  },
  canReadAgentTasks: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadSavedSearchAlerts: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { user: { id: { equals: session.itemId } } });
  },
  canReadSavedSearches: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageLeads && session.data.role?.canManagePeople) return brokerageOwnedFilter(session);
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { AND: [{ brokerage: { id: { in: brokerageIds } } }, { user: { id: { equals: session.itemId } } }] } : false;
  }
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/DomainAuditEvent.ts
var DomainAuditEvent = (0, import_core.list)({
  access: {
    operation: { query: permissions.canViewReports, create: import_access.denyAll, update: import_access.denyAll, delete: import_access.denyAll },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "aggregateType", "aggregateId", "action", "actor"] }
  },
  fields: {
    eventKey: (0, import_fields2.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    brokerage: (0, import_fields2.relationship)({ ref: "Brokerage.auditEvents" }),
    aggregateType: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    action: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    actor: (0, import_fields2.relationship)({ ref: "User" }),
    beforeState: (0, import_fields2.json)({ access: { create: import_access.denyAll, update: import_access.denyAll } }),
    afterState: (0, import_fields2.json)({ access: { create: import_access.denyAll, update: import_access.denyAll } }),
    occurredAt: (0, import_fields2.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields
  }
});

// features/keystone/models/DomainOutboxEvent.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
var DomainOutboxEvent = (0, import_core2.list)({
  access: {
    operation: { query: permissions.canViewReports, create: import_access3.denyAll, update: import_access3.denyAll, delete: import_access3.denyAll },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "eventType", "aggregateType", "aggregateId", "status", "attempts"] }
  },
  fields: {
    eventKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    eventType: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    brokerage: (0, import_fields3.relationship)({ ref: "Brokerage.outboxEvents" }),
    aggregateType: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    requestHash: (0, import_fields3.text)({ validation: { isRequired: true } }),
    payloadHash: (0, import_fields3.text)({ validation: { isRequired: true } }),
    payload: (0, import_fields3.json)({ access: { create: import_access3.denyAll, update: import_access3.denyAll } }),
    status: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Dispatched", value: "dispatched" },
        { label: "Failed", value: "failed" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
      isIndexed: true
    }),
    attempts: (0, import_fields3.integer)({ defaultValue: 0, validation: { min: 0 } }),
    replayCount: (0, import_fields3.integer)({ defaultValue: 0, validation: { min: 0 } }),
    availableAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, isIndexed: true }),
    occurredAt: (0, import_fields3.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    dispatchedAt: (0, import_fields3.timestamp)(),
    lastError: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/Brokerage.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var Brokerage = (0, import_core3.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadBrokerages }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "slug", "status", "isPrimary"] }
  },
  fields: {
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: (0, import_fields4.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    isPrimary: (0, import_fields4.checkbox)({ defaultValue: false }),
    settings: (0, import_fields4.relationship)({ ref: "BrokerageSettings.brokerage", many: true }),
    activeUsers: (0, import_fields4.relationship)({ ref: "User.activeBrokerage", many: true }),
    memberships: (0, import_fields4.relationship)({ ref: "BrokerageMembership.brokerage", many: true }),
    teams: (0, import_fields4.relationship)({ ref: "AgentTeam.brokerage", many: true }),
    properties: (0, import_fields4.relationship)({ ref: "Property.brokerage", many: true }),
    leads: (0, import_fields4.relationship)({ ref: "Lead.brokerage", many: true }),
    leadActivities: (0, import_fields4.relationship)({ ref: "LeadActivity.brokerage", many: true }),
    leadRoutingRules: (0, import_fields4.relationship)({ ref: "LeadRoutingRule.brokerage", many: true }),
    showings: (0, import_fields4.relationship)({ ref: "Showing.brokerage", many: true }),
    deals: (0, import_fields4.relationship)({ ref: "Deal.brokerage", many: true }),
    offers: (0, import_fields4.relationship)({ ref: "Offer.brokerage", many: true }),
    commissions: (0, import_fields4.relationship)({ ref: "Commission.brokerage", many: true }),
    listingSyndications: (0, import_fields4.relationship)({ ref: "ListingSyndication.brokerage", many: true }),
    listingEngagementAuthorities: (0, import_fields4.relationship)({ ref: "ListingEngagementAuthority.brokerage", many: true }),
    listingPublicationAuthorities: (0, import_fields4.relationship)({ ref: "ListingPublicationAuthority.brokerage", many: true }),
    practitionerLicenseAuthorities: (0, import_fields4.relationship)({ ref: "PractitionerLicenseAuthority.brokerage", many: true }),
    representationAuthorities: (0, import_fields4.relationship)({ ref: "RepresentationAuthority.brokerage", many: true }),
    documentEvidenceEvents: (0, import_fields4.relationship)({ ref: "DocumentEvidenceEvent.brokerage", many: true }),
    commissionLedgerEntries: (0, import_fields4.relationship)({ ref: "CommissionLedgerEntry.brokerage", many: true }),
    retentionPolicies: (0, import_fields4.relationship)({ ref: "RetentionPolicy.brokerage", many: true }),
    transactionFileEvents: (0, import_fields4.relationship)({ ref: "TransactionFileEvent.brokerage", many: true }),
    auditEvents: (0, import_fields4.relationship)({ ref: "DomainAuditEvent.brokerage", many: true }),
    outboxEvents: (0, import_fields4.relationship)({ ref: "DomainOutboxEvent.brokerage", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/BrokerageMembership.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var BrokerageMembership = (0, import_core4.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadBrokerageMemberships }
  },
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === "delete") return;
      validateRequiredToOneRelationship({ operation, inputData, field: "brokerage", addValidationError });
      validateRequiredToOneRelationship({ operation, inputData, field: "user", addValidationError });
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["brokerage", "user", "membershipRole", "status", "isPrimary"] }
  },
  fields: {
    membershipKey: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    brokerage: (0, import_fields5.relationship)({ ref: "Brokerage.memberships" }),
    user: (0, import_fields5.relationship)({ ref: "User.brokerageMemberships" }),
    membershipRole: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Owner", value: "owner" },
        { label: "Administrator", value: "admin" },
        { label: "Team Lead", value: "team_lead" },
        { label: "Agent", value: "agent" },
        { label: "Coordinator", value: "coordinator" },
        { label: "Analyst", value: "analyst" }
      ],
      defaultValue: "agent",
      validation: { isRequired: true }
    }),
    status: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    isPrimary: (0, import_fields5.checkbox)({ defaultValue: false }),
    joinedAt: (0, import_fields5.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/BrokerageSettings.ts
var import_core5 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// features/keystone/lib/domainEvents.ts
var import_node_crypto = __toESM(require("node:crypto"));
var sensitiveKey = /(?:credentials?|password|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)/i;
var decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i;
function decimalValue(value) {
  const prototype = Object.getPrototypeOf(value);
  const constructorName = prototype?.constructor?.name;
  const tag = Object.prototype.toString.call(value);
  if (constructorName !== "Decimal" && tag !== "[object Decimal]") return null;
  const rendered = String(value.toString());
  if (!decimalPattern.test(rendered)) throw new Error("Domain JSON contains an invalid Decimal value");
  return rendered;
}
function normalizeJsonValue(value, options, ancestors, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Domain JSON contains a non-finite number at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new Error(`Domain JSON contains unsupported ${typeof value} at ${path}`);
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`Domain JSON contains an invalid Date at ${path}`);
    return value.toISOString();
  }
  const decimal14 = decimalValue(value);
  if (decimal14 !== null) return decimal14;
  if (ancestors.has(value)) throw new Error(`Domain JSON contains a cyclic reference at ${path}`);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Domain JSON contains unsupported object ${prototype?.constructor?.name || "prototype"} at ${path}`);
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error(`Domain JSON contains symbol keys at ${path}`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (child, index) => normalizeJsonValue(child, options, ancestors, `${path}[${index}]`));
    }
    const normalized = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) throw new Error(`Domain JSON contains an accessor at ${path}.${key}`);
      if (options.redactSensitive && sensitiveKey.test(key)) {
        normalizeJsonValue(descriptor.value, { redactSensitive: false }, ancestors, `${path}.${key}`);
        normalized[key] = "[REDACTED]";
      } else {
        normalized[key] = normalizeJsonValue(descriptor.value, options, ancestors, `${path}.${key}`);
      }
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}
function normalizeDomainJson(value, options = {}) {
  return normalizeJsonValue(value, options, /* @__PURE__ */ new WeakSet(), "$");
}
function redactDomainSecrets(value) {
  return normalizeDomainJson(value, { redactSensitive: true });
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalValue(child)])
    );
  }
  return value;
}
function canonicalDomainJson(value) {
  return JSON.stringify(canonicalValue(normalizeDomainJson(value)));
}
function domainPayloadHash(value) {
  return import_node_crypto.default.createHash("sha256").update(canonicalDomainJson(value)).digest("hex");
}
function normalizeDomainIdentifier(value, label = "Domain identifier") {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} must be a non-negative safe integer or non-empty string`);
  }
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}
function boundedDomainEvent(input) {
  const eventKey = String(input.eventKey || "").trim();
  if (!eventKey || eventKey.length > 240) throw new Error("A bounded domain event key is required");
  return {
    ...input,
    eventKey,
    brokerageId: normalizeDomainIdentifier(input.brokerageId, "Brokerage identifier"),
    aggregateId: normalizeDomainIdentifier(input.aggregateId, "Aggregate identifier"),
    actorId: input.actorId == null ? null : normalizeDomainIdentifier(input.actorId, "Actor identifier")
  };
}
async function enqueueDomainEvent(context, command2) {
  const input = boundedDomainEvent(command2);
  const { eventKey } = input;
  const sudo = context.sudo();
  const requestHash = domainPayloadHash(input.request);
  await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `domain-event:${eventKey}`);
  const existing = await sudo.query.DomainOutboxEvent.findOne({
    where: { eventKey },
    query: "id eventKey requestHash payload"
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error("Domain event idempotency key was reused with a different command");
    }
    return { eventId: existing.id, replayed: true, result: existing.payload?.result ?? null };
  }
  return writeDomainEvent(sudo, input, requestHash);
}
async function recordCrudDomainEvent(context, { operation, ...event }) {
  if (operation !== "create" && operation !== "update" && operation !== "delete") {
    throw new Error("CRUD domain events require a create, update or delete operation");
  }
  const input = boundedDomainEvent({
    ...event,
    eventKey: `hook:${event.aggregateType}:${event.aggregateId}:${operation}:${import_node_crypto.default.randomUUID()}`,
    eventType: `${event.aggregateType}.${operation}d`,
    action: operation
  });
  return writeDomainEvent(context.sudo(), input, domainPayloadHash(input.request));
}
async function writeDomainEvent(sudo, input, requestHash) {
  const { eventKey, brokerageId, aggregateId, actorId: actorId4 } = input;
  const occurredAt = input.occurredAt || (/* @__PURE__ */ new Date()).toISOString();
  const payload = redactDomainSecrets({
    schemaVersion: 1,
    eventKey,
    eventType: input.eventType,
    brokerageId,
    aggregate: { type: input.aggregateType, id: aggregateId },
    actorId: actorId4,
    occurredAt,
    request: input.request,
    before: input.before ?? null,
    after: input.after ?? null,
    result: input.after ?? null
  });
  const payloadHash = domainPayloadHash(payload);
  await sudo.query.DomainAuditEvent.createOne({
    data: {
      eventKey: `${eventKey}:audit`,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      action: input.action,
      ...actorId4 ? { actor: { connect: { id: actorId4 } } } : {},
      beforeState: payload.before,
      afterState: payload.after,
      occurredAt
    },
    query: "id"
  });
  const event = await sudo.query.DomainOutboxEvent.createOne({
    data: {
      eventKey,
      eventType: input.eventType,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      requestHash,
      payloadHash,
      payload,
      status: "pending",
      attempts: 0,
      replayCount: 0,
      availableAt: occurredAt,
      occurredAt
    },
    query: "id eventKey"
  });
  return { eventId: event.id, replayed: false, result: payload.result ?? null };
}

// features/keystone/lib/money.ts
var import_fields6 = require("@keystone-6/core/fields");

// features/lib/money.ts
function moneyToMinor(value) {
  const text44 = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text44)) throw new Error("Money must have at most two decimal places.");
  const negative = text44.startsWith("-");
  const [whole, fraction = ""] = text44.replace(/^-/, "").split(".");
  const cents2 = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const result = negative ? -cents2 : cents2;
  if (result < -9223372036854775808n || result > 9223372036854775807n) throw new Error("Money exceeds supported storage range.");
  return result;
}
function minorToMoney(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
function sumMoney(values) {
  return minorToMoney(values.reduce((sum, value) => sum + moneyToMinor(value ?? "0"), 0n));
}
var wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });

// features/keystone/lib/money.ts
function minorFilter(value) {
  if (value === null || value === void 0 || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(minorFilter);
  if (typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, minorFilter(item)]));
  }
  return moneyToMinor(value);
}
var legacyColumns = /* @__PURE__ */ new Map();
function normalizeMoneyRecord(listKey, record4) {
  if (!record4) return record4;
  const next = { ...record4 };
  for (const field of legacyColumns.get(listKey)?.keys() || []) {
    if (typeof next[field] === "bigint") next[field] = minorToMoney(next[field]);
  }
  return next;
}
function preserveLegacyMoneyColumns(schema) {
  let next = schema;
  for (const [list45, columns] of legacyColumns) {
    const pattern = new RegExp(`(model ${list45} \\{[\\s\\S]*?)(\\n\\})`);
    if (!pattern.test(next)) throw new Error(`Missing money model ${list45}`);
    next = next.replace(pattern, `$1
${[...columns.values()].join("\n")}$2`);
  }
  return next;
}
function money(config3 = {}) {
  return (meta) => {
    const base = (0, import_fields6.decimal)({ ...config3, scale: 2 })(meta);
    if (base.dbField.kind !== "scalar" || base.dbField.scalar !== "Decimal") throw new Error("Unsupported money storage metadata.");
    const legacyName = `legacy${meta.fieldKey[0].toUpperCase()}${meta.fieldKey.slice(1)}`;
    const legacyType = config3.legacyText ? 'String @default("")' : `Decimal${base.dbField.mode === "optional" ? "?" : ""}${config3.defaultValue === void 0 ? "" : ` @default("${config3.defaultValue}")`} @postgresql.Decimal(${config3.precision || 18}, 2)`;
    const columns = legacyColumns.get(meta.listKey) || /* @__PURE__ */ new Map();
    columns.set(meta.fieldKey, `  ${legacyName} ${legacyType} @map("${meta.fieldKey}") @ignore`);
    legacyColumns.set(meta.listKey, columns);
    const storage = (0, import_fields6.bigInt)({
      db: { ...config3.db, map: `${meta.fieldKey}Minor` },
      isIndexed: config3.isIndexed,
      validation: { isRequired: config3.validation?.isRequired },
      ...config3.defaultValue === void 0 ? {} : { defaultValue: moneyToMinor(config3.defaultValue) }
    })(meta);
    const convert = (value) => {
      const minor = moneyToMinor(value);
      const maximum = 10n ** BigInt(config3.precision || 18) - 1n;
      if (minor > maximum || minor < -maximum) throw new Error("Money exceeds the field precision.");
      return minor;
    };
    const validate = base.hooks?.validate;
    const input = base.input;
    if (!input?.create?.resolve || !input.update || !base.output.resolve) throw new Error("Unsupported Keystone money field contract.");
    const create = input.create;
    const output = base.output.resolve;
    return {
      ...base,
      dbField: storage.dbField,
      hooks: {
        ...base.hooks,
        validate: typeof validate === "function" ? (args) => {
          if (args.operation === "delete") return validate(args);
          const value = args.resolvedData[meta.fieldKey];
          return validate({ ...args, resolvedData: {
            ...args.resolvedData,
            [meta.fieldKey]: typeof value === "bigint" ? minorToMoney(value) : value
          } });
        } : validate
      },
      input: {
        ...input,
        create: { ...create, resolve: (value) => {
          const normalized = value === void 0 ? config3.defaultValue : value;
          return normalized == null ? normalized : convert(normalized);
        } },
        update: { ...input.update, resolve: (value) => value == null ? value : convert(value) },
        where: input.where ? { ...input.where, resolve: (value) => value == null ? null : minorFilter(value) } : void 0,
        uniqueWhere: input.uniqueWhere ? { ...input.uniqueWhere, resolve: (value) => moneyToMinor(value) } : void 0
      },
      output: { ...base.output, resolve: (source, args, context, info) => output({
        ...source,
        value: source.value == null ? source.value : minorToMoney(BigInt(String(source.value)))
      }, args, context, info) }
    };
  };
}

// features/keystone/lib/tenantOwnedHooks.ts
function relationshipId(data, field) {
  const value = data?.[field];
  if (typeof value === "string") return value;
  return value?.connect?.id || data?.[`${field}Id`] || null;
}
function relationshipIds(data, field) {
  const connect = data?.[field]?.connect;
  if (Array.isArray(connect)) return connect.map((item) => item?.id).filter(Boolean);
  return connect?.id ? [connect.id] : [];
}
async function relatedBrokerageIds(context, listKey, id) {
  if (listKey === "User") {
    const user = await context.sudo().query.User.findOne({
      where: { id },
      query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }"
    });
    return (user?.brokerageMemberships || []).filter((membership) => membership.brokerage?.status === "active").map((membership) => membership.brokerage.id);
  }
  const item = await context.sudo().query[listKey].findOne({
    where: { id },
    query: "id brokerage { id }"
  });
  return item?.brokerage?.id ? [item.brokerage.id] : [];
}
async function deriveBrokerage(context, inputData, config3) {
  for (const [field, listKey] of Object.entries(config3.parents || {})) {
    const id = relationshipId(inputData, field);
    if (!id) continue;
    const brokerageIds = await relatedBrokerageIds(context, listKey, id);
    if (brokerageIds.length === 1) return brokerageIds[0];
  }
  for (const field of config3.users || []) {
    const id = relationshipId(inputData, field);
    if (!id) continue;
    const brokerageIds = await relatedBrokerageIds(context, "User", id);
    if (brokerageIds.length === 1) return brokerageIds[0];
  }
  return null;
}
function createTenantOwnedHooks(config3) {
  return {
    async resolveInput({ operation, inputData, resolvedData, context }) {
      if (operation !== "create" || config3.deriveOnly || relationshipId(inputData, "brokerage")) return resolvedData;
      const brokerageId = await deriveBrokerage(context, inputData, config3);
      return brokerageId ? { ...resolvedData, brokerage: { connect: { id: brokerageId } } } : resolvedData;
    },
    async validateInput({ operation, inputData, resolvedData, item, context, addValidationError }) {
      const relationshipData = { ...item || {}, ...resolvedData || {}, ...inputData || {} };
      const brokerageId = relationshipId(relationshipData, "brokerage") || await deriveBrokerage(context, relationshipData, config3);
      if (operation === "create" && !brokerageId) {
        addValidationError(`${config3.listKey} requires a brokerage.`);
        return;
      }
      if (inputData?.brokerage?.disconnect) {
        addValidationError(`${config3.listKey} brokerage cannot be disconnected.`);
        return;
      }
      if (!brokerageId) return;
      if (operation === "create") {
        for (const field of config3.required || []) {
          if (!relationshipId(inputData, field)) addValidationError(`${config3.listKey} requires ${field}.`);
        }
        if (config3.requiredAny?.length && !config3.requiredAny.some((field) => relationshipId(inputData, field))) {
          addValidationError(`${config3.listKey} requires one of ${config3.requiredAny.join(", ")}.`);
        }
      }
      if (config3.coherentWith) {
        const rootId = relationshipId(relationshipData, config3.coherentWith.field);
        if (rootId) {
          const selection = Object.values(config3.coherentWith.matches).map((field) => `${field} { id }`).join(" ");
          const root = await context.sudo().query[config3.coherentWith.listKey].findOne({ where: { id: rootId }, query: `id ${selection}` });
          for (const [field, rootField] of Object.entries(config3.coherentWith.matches)) {
            const connectedId = relationshipId(relationshipData, field);
            if (connectedId && root?.[rootField]?.id !== connectedId) {
              addValidationError(`${config3.listKey} ${field} must match ${config3.coherentWith.field}.${rootField}.`);
            }
          }
        }
      }
      for (const [field, listKey] of Object.entries(config3.parents || {})) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, listKey, id);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must belong to the same brokerage.`);
        }
      }
      for (const field of config3.users || []) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, "User", id);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must have an active membership in the brokerage.`);
        }
      }
      for (const field of config3.manyUsers || []) {
        for (const id of relationshipIds(relationshipData, field)) {
          const brokerageIds = await relatedBrokerageIds(context, "User", id);
          if (!brokerageIds.includes(brokerageId)) {
            addValidationError(`${config3.listKey} ${field} must contain only active brokerage members.`);
          }
        }
      }
      for (const field of config3.teams || []) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, "AgentTeam", id);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must belong to the same brokerage.`);
        }
      }
    },
    beforeOperation({ operation }) {
      if (operation === "delete" && config3.protectDelete) {
        throw new Error(`${config3.listKey} deletion requires a controlled domain operation.`);
      }
    },
    async afterOperation({ operation, item, originalItem, inputData, context }) {
      const actorId4 = context.session?.itemId;
      const record4 = item || originalItem;
      const brokerageId = record4?.brokerageId || record4?.brokerage || await deriveBrokerage(context, { ...record4 || {}, ...inputData || {} }, config3);
      if (!actorId4 || !record4?.id || !brokerageId) return;
      const aggregateType = config3.listKey.charAt(0).toLowerCase() + config3.listKey.slice(1);
      await recordCrudDomainEvent(context, {
        operation,
        brokerageId,
        aggregateType,
        aggregateId: record4.id,
        actorId: actorId4,
        request: inputData || { id: record4.id },
        before: normalizeMoneyRecord(config3.listKey, originalItem || null),
        after: normalizeMoneyRecord(config3.listKey, item || null)
      });
    }
  };
}

// features/lib/storefront-theme.ts
var DEFAULT_STOREFRONT_BRAND_HUE = 151;
function normalizeStorefrontBrandHue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_STOREFRONT_BRAND_HUE;
  const integer22 = Math.round(numeric);
  return (integer22 % 360 + 360) % 360;
}

// features/lib/sanitize-store-logo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) return "";
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) return "";
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/lib/store-logo.ts
var DEFAULT_STORE_LOGO_COLOR = "0";
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/models/BrokerageSettings.ts
var settingsHooks = createTenantOwnedHooks({ listKey: "BrokerageSettings", protectDelete: true });
var BrokerageSettings = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canManageOnboarding,
      create: permissions.canManageBrokerageSettings,
      update: permissions.canManageBrokerageSettings,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
      delete: rules.canAccessBrokerageRecords
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage
    }
  },
  hooks: {
    resolveInput: settingsHooks.resolveInput,
    validateInput: async (args) => {
      await settingsHooks.validateInput(args);
      validateRequiredToOneRelationship({ operation: args.operation, inputData: args.inputData, field: "brokerage", addValidationError: args.addValidationError });
    },
    beforeOperation: settingsHooks.beforeOperation,
    afterOperation: settingsHooks.afterOperation
  },
  db: { idField: { kind: "autoincrement" } },
  graphql: {
    plural: "BrokerageSettingsItems"
  },
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["businessName", "marketLabel", "city", "state"]
    }
  },
  fields: {
    brokerage: (0, import_fields7.relationship)({ ref: "Brokerage.settings", access: { update: () => false } }),
    key: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    businessName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    marketLabel: (0, import_fields7.text)({ validation: { isRequired: true } }),
    city: (0, import_fields7.text)({ validation: { isRequired: true } }),
    state: (0, import_fields7.text)({ validation: { isRequired: true } }),
    tagline: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    equalHousingNotice: (0, import_fields7.text)(),
    publicPhone: (0, import_fields7.text)(),
    publicEmail: (0, import_fields7.text)(),
    showingDurationMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { min: 15, max: 240 } }),
    brandHue: (0, import_fields7.integer)({
      defaultValue: 151,
      validation: { min: 0, max: 359, isRequired: true },
      ui: { description: "Constrained storefront brand hue in degrees (0\u2013359)." },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return value === void 0 ? value : normalizeStorefrontBrandHue(value);
        }
      }
    }),
    logoIcon: (0, import_fields7.text)({ hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
      const value = resolvedData[fieldKey];
      if (value === void 0) return value;
      const safe = sanitizeStoreLogoSvg(String(value || ""));
      if (String(value || "").trim() && !safe) throw new Error("Logo SVG is not allowed.");
      return safe;
    } } }),
    logoColor: (0, import_fields7.text)({ defaultValue: "0", hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    ...trackingFields
  }
});

// features/keystone/models/SavedSearchAlert.ts
var import_core6 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var SavedSearchAlert = (0, import_core6.list)({
  access: { operation: { query: permissions.canReadLeads, create: () => false, update: () => false, delete: () => false }, filter: { query: rules.canReadSavedSearchAlerts } },
  hooks: createTenantOwnedHooks({ listKey: "SavedSearchAlert", parents: { savedSearch: "SavedSearch" }, users: ["user"], required: ["savedSearch", "user"], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["savedSearch", "user", "status", "cadence"] }
  },
  fields: {
    brokerage: (0, import_fields8.relationship)({ ref: "Brokerage" }),
    savedSearch: (0, import_fields8.relationship)({ ref: "SavedSearch" }),
    user: (0, import_fields8.relationship)({ ref: "User" }),
    status: (0, import_fields8.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Unsubscribed", value: "unsubscribed" }], defaultValue: "active" }),
    cadence: (0, import_fields8.select)({ type: "enum", options: [{ label: "Instant", value: "instant" }, { label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }], defaultValue: "daily" }),
    lastSentAt: (0, import_fields8.timestamp)(),
    sentCount: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
    metadata: (0, import_fields8.json)(),
    ...trackingFields
  }
});

// features/keystone/models/Disclosure.ts
var import_core7 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var Disclosure = (0, import_core7.list)({
  access: {
    operation: { query: permissions.canReadDeals, create: permissions.canManageBrokerageDeals, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren, delete: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: createTenantOwnedHooks({ listKey: "Disclosure", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "property", "disclosureType", "status"] }
  },
  fields: {
    title: (0, import_fields9.text)({ validation: { isRequired: true } }),
    property: (0, import_fields9.relationship)({ ref: "Property" }),
    deal: (0, import_fields9.relationship)({ ref: "Deal" }),
    disclosureType: (0, import_fields9.select)({ type: "enum", options: [{ label: "Seller Property", value: "seller_property" }, { label: "Lead Paint", value: "lead_paint" }, { label: "HOA", value: "hoa" }, { label: "Natural Hazard", value: "natural_hazard" }, { label: "Other", value: "other" }], defaultValue: "other" }),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [{ label: "Draft", value: "draft" }, { label: "Sent", value: "sent" }, { label: "Acknowledged", value: "acknowledged" }, { label: "Expired", value: "expired" }],
      defaultValue: "draft",
      access: { create: () => false, update: () => false }
    }),
    documentUrl: (0, import_fields9.text)(),
    sentAt: (0, import_fields9.timestamp)({ access: { create: () => false, update: () => false } }),
    acknowledgedAt: (0, import_fields9.timestamp)({ access: { create: () => false, update: () => false } }),
    metadata: (0, import_fields9.json)(),
    ...trackingFields
  }
});

// features/keystone/models/PropertyValuation.ts
var import_core8 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var PropertyValuation = (0, import_core8.list)({
  access: {
    operation: { query: permissions.canViewMarketIntelligence, create: permissions.canManageListings, update: permissions.canManageListings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren, delete: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty }
  },
  hooks: createTenantOwnedHooks({ listKey: "PropertyValuation", parents: { property: "Property" }, users: ["performedBy"], required: ["property"], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["valuationNumber", "property", "valuationType", "estimatedValue"] }
  },
  fields: {
    valuationNumber: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    property: (0, import_fields10.relationship)({ ref: "Property", access: { update: () => false } }),
    valuationType: (0, import_fields10.select)({ type: "enum", options: [{ label: "CMA", value: "cma" }, { label: "Appraisal", value: "appraisal" }, { label: "AVM", value: "avm" }], defaultValue: "cma" }),
    lowValue: money({ precision: 12, scale: 2 }),
    estimatedValue: money({ precision: 12, scale: 2 }),
    highValue: money({ precision: 12, scale: 2 }),
    performedBy: (0, import_fields10.relationship)({ ref: "User", access: { update: () => false } }),
    valuedAt: (0, import_fields10.timestamp)(),
    notes: (0, import_fields10.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields10.json)(),
    ...trackingFields
  }
});

// features/keystone/models/TransactionMilestone.ts
var import_core9 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var TransactionMilestone = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canReadDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren }
  },
  hooks: createTenantOwnedHooks({ listKey: "TransactionMilestone", parents: { deal: "Deal" }, users: ["assignedTo"], required: ["deal"], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "deal", "status", "dueAt"] }
  },
  fields: {
    brokerage: (0, import_fields11.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    deal: (0, import_fields11.relationship)({ ref: "Deal" }),
    status: (0, import_fields11.select)({
      type: "enum",
      options: [{ label: "Not Started", value: "not_started" }, { label: "In Progress", value: "in_progress" }, { label: "Complete", value: "complete" }, { label: "Blocked", value: "blocked" }],
      defaultValue: "not_started",
      access: { create: () => false, update: () => false }
    }),
    dueAt: (0, import_fields11.timestamp)(),
    completedAt: (0, import_fields11.timestamp)({ access: { create: () => false, update: () => false } }),
    assignedTo: (0, import_fields11.relationship)({ ref: "User" }),
    sortOrder: (0, import_fields11.integer)({ defaultValue: 0 }),
    notes: (0, import_fields11.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields11.json)(),
    ...trackingFields
  }
});

// features/keystone/models/MortgageApplication.ts
var import_core10 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var MortgageApplication = (0, import_core10.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren }
  },
  hooks: createTenantOwnedHooks({ listKey: "MortgageApplication", parents: { deal: "Deal", lead: "Lead" }, required: ["deal", "lead"], coherentWith: { field: "deal", listKey: "Deal", matches: { lead: "lead" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["applicationNumber", "deal", "lenderName", "status"] }
  },
  fields: {
    applicationNumber: (0, import_fields12.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields12.relationship)({ ref: "Deal" }),
    lead: (0, import_fields12.relationship)({ ref: "Lead" }),
    lenderName: (0, import_fields12.text)(),
    status: (0, import_fields12.select)({ type: "enum", options: [{ label: "Started", value: "started" }, { label: "Preapproved", value: "preapproved" }, { label: "Underwriting", value: "underwriting" }, { label: "Approved", value: "approved" }, { label: "Denied", value: "denied" }], defaultValue: "started" }),
    loanAmount: money({ precision: 12, scale: 2 }),
    interestRate: (0, import_fields12.decimal)({ precision: 6, scale: 3 }),
    submittedAt: (0, import_fields12.timestamp)(),
    decisionAt: (0, import_fields12.timestamp)(),
    metadata: (0, import_fields12.json)(),
    ...trackingFields
  }
});

// features/keystone/models/TitleOrder.ts
var import_core11 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var TitleOrder = (0, import_core11.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren }
  },
  hooks: createTenantOwnedHooks({ listKey: "TitleOrder", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["orderNumber", "deal", "titleCompany", "status"] }
  },
  fields: {
    orderNumber: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields13.relationship)({ ref: "Deal" }),
    property: (0, import_fields13.relationship)({ ref: "Property" }),
    titleCompany: (0, import_fields13.text)(),
    status: (0, import_fields13.select)({ type: "enum", options: [{ label: "Ordered", value: "ordered" }, { label: "In Review", value: "in_review" }, { label: "Clear", value: "clear" }, { label: "Exception", value: "exception" }], defaultValue: "ordered" }),
    orderedAt: (0, import_fields13.timestamp)(),
    clearedAt: (0, import_fields13.timestamp)(),
    exceptions: (0, import_fields13.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields13.json)(),
    ...trackingFields
  }
});

// features/keystone/models/Escrow.ts
var import_core12 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var Escrow = (0, import_core12.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren }
  },
  hooks: createTenantOwnedHooks({ listKey: "Escrow", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["escrowNumber", "deal", "status", "scheduledCloseAt"] }
  },
  fields: {
    escrowNumber: (0, import_fields14.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields14.relationship)({ ref: "Deal" }),
    property: (0, import_fields14.relationship)({ ref: "Property" }),
    status: (0, import_fields14.select)({ type: "enum", options: [{ label: "Opened", value: "opened" }, { label: "Pending", value: "pending" }, { label: "Closed", value: "closed" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "opened" }),
    escrowCompany: (0, import_fields14.text)(),
    officerName: (0, import_fields14.text)(),
    officerEmail: (0, import_fields14.text)(),
    openedAt: (0, import_fields14.timestamp)(),
    scheduledCloseAt: (0, import_fields14.timestamp)(),
    closedAt: (0, import_fields14.timestamp)(),
    depositAmount: money({ precision: 12, scale: 2 }),
    metadata: (0, import_fields14.json)(),
    ...trackingFields
  }
});

// features/keystone/models/ShowingFeedback.ts
var import_core13 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var ShowingFeedback = (0, import_core13.list)({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadShowingChildren, update: rules.canReadShowingChildren, delete: rules.canReadShowingChildren },
    item: { create: canCreateForActiveShowing }
  },
  hooks: createTenantOwnedHooks({ listKey: "ShowingFeedback", parents: { showing: "Showing", lead: "Lead", property: "Property" }, required: ["showing", "lead", "property"], coherentWith: { field: "showing", listKey: "Showing", matches: { lead: "lead", property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["showing", "lead", "rating", "interestLevel"] }
  },
  fields: {
    showing: (0, import_fields15.relationship)({ ref: "Showing", access: { update: () => false } }),
    lead: (0, import_fields15.relationship)({ ref: "Lead", access: { update: () => false } }),
    property: (0, import_fields15.relationship)({ ref: "Property", access: { update: () => false } }),
    rating: (0, import_fields15.integer)({ validation: { min: 1, max: 5 } }),
    interestLevel: (0, import_fields15.select)({ type: "enum", options: [{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }, { label: "Offer Likely", value: "offer_likely" }], defaultValue: "medium" }),
    comments: (0, import_fields15.text)({ ui: { displayMode: "textarea" } }),
    priceOpinion: money({ precision: 12, scale: 2 }),
    followUpRequired: (0, import_fields15.checkbox)({ defaultValue: false }),
    metadata: (0, import_fields15.json)(),
    ...trackingFields
  }
});

// features/keystone/models/OpenHouse.ts
var import_core14 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var OpenHouse = (0, import_core14.list)({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canReadPropertyChildren, delete: rules.canReadPropertyChildren },
    item: { create: canCreateForActiveProperty }
  },
  hooks: createTenantOwnedHooks({ listKey: "OpenHouse", parents: { property: "Property" }, users: ["hostAgent"], required: ["property"], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "property", "status", "startsAt"] }
  },
  fields: {
    title: (0, import_fields16.text)({ validation: { isRequired: true } }),
    property: (0, import_fields16.relationship)({ ref: "Property", access: { update: () => false } }),
    hostAgent: (0, import_fields16.relationship)({ ref: "User" }),
    status: (0, import_fields16.select)({ type: "enum", options: [{ label: "Scheduled", value: "scheduled" }, { label: "Completed", value: "completed" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "scheduled", access: { create: () => false, update: () => false } }),
    startsAt: (0, import_fields16.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields16.timestamp)({ validation: { isRequired: true } }),
    attendeeCount: (0, import_fields16.integer)({ defaultValue: 0, validation: { min: 0 } }),
    notes: (0, import_fields16.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields16.json)(),
    ...trackingFields
  }
});

// features/keystone/models/SourceFeed.ts
var import_core15 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var SourceFeed = (0, import_core15.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({ listKey: "SourceFeed", protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "provider", "feedType", "status"] }
  },
  fields: {
    brokerage: (0, import_fields17.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    provider: (0, import_fields17.text)(),
    feedType: (0, import_fields17.select)({ type: "enum", options: [{ label: "MLS RETS", value: "rets" }, { label: "RESO Web API", value: "reso" }, { label: "CSV", value: "csv" }, { label: "Manual", value: "manual" }], defaultValue: "manual" }),
    status: (0, import_fields17.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Error", value: "error" }], defaultValue: "active", access: { create: () => false, update: () => false } }),
    lastImportedAt: (0, import_fields17.timestamp)(),
    recordsImported: (0, import_fields17.integer)({ defaultValue: 0, validation: { min: 0 } }),
    credentials: (0, import_fields17.json)({
      access: { read: () => false, create: () => false, update: () => false },
      ui: {
        itemView: { fieldMode: "hidden" },
        createView: { fieldMode: "hidden" }
      }
    }),
    metadata: (0, import_fields17.json)(),
    ...trackingFields
  }
});

// features/keystone/models/ListingSyndication.ts
var import_core16 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var ListingSyndication = (0, import_core16.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingSyndication",
    parents: { property: "Property" },
    required: ["property"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["property", "channel", "status", "externalListingId"] }
  },
  fields: {
    brokerage: (0, import_fields18.relationship)({ ref: "Brokerage.listingSyndications" }),
    channel: (0, import_fields18.select)({ type: "enum", options: [{ label: "MLS", value: "mls" }, { label: "Zillow", value: "zillow" }, { label: "Realtor", value: "realtor" }, { label: "Website", value: "website" }, { label: "Social", value: "social" }], defaultValue: "website" }),
    property: (0, import_fields18.relationship)({ ref: "Property" }),
    status: (0, import_fields18.select)({ type: "enum", options: [{ label: "Draft", value: "draft" }, { label: "Reported published (unverified)", value: "published" }, { label: "Provider error reported (unverified)", value: "error" }, { label: "Reported removed (unverified)", value: "removed" }], defaultValue: "draft", access: { create: () => false, update: () => false } }),
    externalListingId: (0, import_fields18.text)(),
    listingUrl: (0, import_fields18.text)(),
    publishedAt: (0, import_fields18.timestamp)({ access: { create: () => false, update: () => false } }),
    lastSyncedAt: (0, import_fields18.timestamp)({ access: { create: () => false, update: () => false } }),
    errorMessage: (0, import_fields18.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields18.json)(),
    ...trackingFields
  }
});

// features/keystone/models/User.ts
var import_core17 = require("@keystone-6/core");
var import_access19 = require("@keystone-6/core/access");
var import_fields19 = require("@keystone-6/core/fields");
var User = (0, import_core17.list)({
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === "delete") return;
      validateRequiredToOneRelationship({ operation, inputData, field: "activeBrokerage", addValidationError });
    }
  },
  access: {
    operation: {
      ...(0, import_access19.allOperations)(isSignedIn),
      query: ({ session }) => Boolean(session?.itemId),
      update: ({ session }) => Boolean(session?.itemId),
      create: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "email", "role", "assignedLeads"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    email: (0, import_fields19.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: { isRequired: true },
      access: { update: () => false }
    }),
    phone: (0, import_fields19.text)(),
    licenseNumber: (0, import_fields19.text)(),
    brokerageTitle: (0, import_fields19.text)(),
    bio: (0, import_fields19.text)({ ui: { displayMode: "textarea" } }),
    avatarUrl: (0, import_fields19.text)(),
    password: (0, import_fields19.password)({
      access: {
        read: import_access19.denyAll,
        update: ({ session, item }) => session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields19.relationship)({
      ref: "Role.assignedTo",
      // User/Role are shared control-plane identities. A tenant administrator
      // must use the reviewed new-member command, never re-role an existing user.
      access: { create: import_access19.denyAll, update: import_access19.denyAll },
      ui: { itemView: { fieldMode: "read" } }
    }),
    // Inverse writes bypass the related list's update access and hooks in Keystone.
    // Assignments and immutable evidence may only be linked by controlled commands.
    assignedProperties: (0, import_fields19.relationship)({ ref: "Property.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedLeads: (0, import_fields19.relationship)({ ref: "Lead.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedShowings: (0, import_fields19.relationship)({ ref: "Showing.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedDeals: (0, import_fields19.relationship)({ ref: "Deal.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    leadRoutingRules: (0, import_fields19.relationship)({ ref: "LeadRoutingRule.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    customerShowings: (0, import_fields19.relationship)({ ref: "Showing.customer", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    savedProperties: (0, import_fields19.relationship)({ ref: "SavedProperty.user", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    practitionerLicenseAuthorities: (0, import_fields19.relationship)({ ref: "PractitionerLicenseAuthority.practitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    verifiedPractitionerLicenses: (0, import_fields19.relationship)({ ref: "PractitionerLicenseAuthority.verifiedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    listingEngagementAuthorities: (0, import_fields19.relationship)({ ref: "ListingEngagementAuthority.assignedPractitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedListingEngagementAuthorities: (0, import_fields19.relationship)({ ref: "ListingEngagementAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedListingPublicationAuthorities: (0, import_fields19.relationship)({ ref: "ListingPublicationAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    representationAuthorities: (0, import_fields19.relationship)({ ref: "RepresentationAuthority.practitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedRepresentationAuthorities: (0, import_fields19.relationship)({ ref: "RepresentationAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedDocumentEvidenceEvents: (0, import_fields19.relationship)({ ref: "DocumentEvidenceEvent.actor", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    commissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.payeeUser", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    preparedCommissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.preparedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedCommissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedRetentionPolicies: (0, import_fields19.relationship)({ ref: "RetentionPolicy.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedTransactionFileEvents: (0, import_fields19.relationship)({ ref: "TransactionFileEvent.actor", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedTransactionFileEvents: (0, import_fields19.relationship)({ ref: "TransactionFileEvent.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    activeBrokerage: (0, import_fields19.relationship)({
      ref: "Brokerage.activeUsers",
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } }
    }),
    brokerageMemberships: (0, import_fields19.relationship)({
      ref: "BrokerageMembership.user",
      many: true,
      access: {
        create: () => false,
        update: () => false
      }
    }),
    onboardingStatus: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      access: { create: () => false, update: () => false },
      ui: { description: "Brokerage onboarding progress." }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core18 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var Role = (0, import_core18.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "canAccessDashboard", "canManageListings", "canManageLeads", "assignedTo"]
    },
    itemView: {
      defaultFieldMode: "read"
    }
  },
  fields: {
    name: (0, import_fields20.text)({ validation: { isRequired: true } }),
    canSeeOtherPeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields20.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageListings: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageLeads: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageShowings: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageDeals: (0, import_fields20.checkbox)({ defaultValue: false }),
    canViewReports: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageOnboarding: (0, import_fields20.checkbox)({ defaultValue: false }),
    assignedTo: (0, import_fields20.relationship)({
      ref: "User.role",
      many: true,
      ui: {
        itemView: { fieldMode: "read" }
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Property.ts
var import_core19 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");

// features/lib/real-estate-images.ts
var PROPERTY_IMAGE_PATHS = {
  "riverfront-loft-austin": "/images/real-estate/properties/riverfront-loft-austin.svg",
  "hill-country-estate": "/images/real-estate/properties/hill-country-estate.svg",
  "eastside-townhome-rental": "/images/real-estate/properties/eastside-townhome-rental.svg",
  "mueller-bungalow": "/images/real-estate/properties/mueller-bungalow.svg"
};
var AGENT_IMAGE_PATHS = {
  "maya.chen@example.realestate.local": "/images/real-estate/agents/maya-chen.svg",
  "omar.patel@example.realestate.local": "/images/real-estate/agents/omar-patel.svg",
  "evelyn.brooks@example.realestate.local": "/images/real-estate/agents/evelyn-brooks.svg"
};
var NEIGHBORHOOD_IMAGE_PATHS = {
  "rainey street historic district": "/images/real-estate/neighborhoods/rainey-street.svg",
  "westlake hills": "/images/real-estate/neighborhoods/westlake-hills.svg",
  "east cesar chavez": "/images/real-estate/neighborhoods/east-cesar-chavez.svg",
  mueller: "/images/real-estate/neighborhoods/mueller.svg"
};
function getPropertyImagePath(listing) {
  if (listing.publicImagePack?.propertyImagePath) return listing.publicImagePack.propertyImagePath;
  if (listing.primaryImageUrl) return listing.primaryImageUrl;
  return listing.slug ? PROPERTY_IMAGE_PATHS[listing.slug] : void 0;
}
function getAgentImagePath(agent, publicImagePack) {
  if (publicImagePack?.agentImagePath) return publicImagePack.agentImagePath;
  if (!agent) return void 0;
  if (agent.avatarUrl) return agent.avatarUrl;
  return agent.email ? AGENT_IMAGE_PATHS[agent.email.toLowerCase()] : void 0;
}
function getNeighborhoodImagePath(neighborhood, publicImagePack) {
  if (publicImagePack?.neighborhoodImagePath) return publicImagePack.neighborhoodImagePath;
  if (!neighborhood) return void 0;
  return NEIGHBORHOOD_IMAGE_PATHS[neighborhood.trim().toLowerCase()];
}

// features/keystone/models/Property.ts
var Property = (0, import_core19.list)({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageBrokerageListings,
      update: permissions.canManageListings,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canManageAssignedProperties
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "Property", users: ["assignedAgent"], protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "status", "listingType", "city", "price", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields21.relationship)({ ref: "Brokerage.properties", access: { update: () => false } }),
    title: (0, import_fields21.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields21.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Coming Soon", value: "coming_soon" },
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Rented", value: "rented" },
        { label: "Off Market", value: "off_market" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    listingType: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "For Sale", value: "sale" },
        { label: "For Rent", value: "rent" }
      ],
      defaultValue: "sale",
      validation: { isRequired: true }
    }),
    propertyType: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "House", value: "house" },
        { label: "Condo", value: "condo" },
        { label: "Townhome", value: "townhome" },
        { label: "Multi-Family", value: "multi_family" },
        { label: "Land", value: "land" },
        { label: "Commercial", value: "commercial" }
      ],
      defaultValue: "house"
    }),
    shortDescription: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
    description: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
    addressLine1: (0, import_fields21.text)({ validation: { isRequired: true } }),
    addressLine2: (0, import_fields21.text)(),
    city: (0, import_fields21.text)({ validation: { isRequired: true } }),
    state: (0, import_fields21.text)({ validation: { isRequired: true } }),
    postalCode: (0, import_fields21.text)(),
    neighborhood: (0, import_fields21.text)(),
    latitude: (0, import_fields21.decimal)({ precision: 10, scale: 7 }),
    longitude: (0, import_fields21.decimal)({ precision: 10, scale: 7 }),
    price: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    bedrooms: (0, import_fields21.integer)({ validation: { min: 0 }, defaultValue: 0 }),
    bathrooms: (0, import_fields21.decimal)({ precision: 4, scale: 1, defaultValue: "0.0" }),
    squareFeet: (0, import_fields21.integer)({ validation: { min: 0 } }),
    lotSizeSquareFeet: (0, import_fields21.integer)({ validation: { min: 0 } }),
    yearBuilt: (0, import_fields21.integer)(),
    hoaFee: money({ precision: 10, scale: 2 }),
    availableAt: (0, import_fields21.timestamp)(),
    isFeatured: (0, import_fields21.checkbox)({ defaultValue: false }),
    virtualTourUrl: (0, import_fields21.text)(),
    primaryImageUrl: (0, import_fields21.text)(),
    assignedAgent: (0, import_fields21.relationship)({ ref: "User.assignedProperties", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    leads: (0, import_fields21.relationship)({ ref: "Lead.property", many: true, access: { create: () => false, update: () => false } }),
    showings: (0, import_fields21.relationship)({ ref: "Showing.property", many: true, access: { create: () => false, update: () => false } }),
    savedBy: (0, import_fields21.relationship)({ ref: "SavedProperty.property", many: true, access: { create: () => false, update: () => false } }),
    listingEngagementAuthorities: (0, import_fields21.relationship)({ ref: "ListingEngagementAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    listingPublicationAuthorities: (0, import_fields21.relationship)({ ref: "ListingPublicationAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: (0, import_fields21.relationship)({ ref: "RepresentationAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    addressLabel: (0, import_fields21.virtual)({
      field: import_core19.graphql.field({
        type: import_core19.graphql.String,
        resolve(item) {
          return [item.addressLine1, item.city, item.state].filter(Boolean).join(", ");
        }
      })
    }),
    publicImagePack: (0, import_fields21.virtual)({
      field: import_core19.graphql.field({
        type: import_core19.graphql.object()({
          name: "PropertyPublicImagePack",
          fields: {
            propertyImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.propertyImagePath }),
            agentImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.agentImagePath }),
            neighborhoodImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.neighborhoodImagePath })
          }
        }),
        async resolve(item, _args, context) {
          const property = await context.sudo().query.Property.findOne({
            where: { id: item.id },
            query: "slug primaryImageUrl neighborhood assignedAgent { email avatarUrl }"
          });
          return {
            propertyImagePath: getPropertyImagePath(property || item),
            agentImagePath: getAgentImagePath(property?.assignedAgent),
            neighborhoodImagePath: getNeighborhoodImagePath(property?.neighborhood || item.neighborhood)
          };
        }
      }),
      ui: { query: "{ propertyImagePath agentImagePath neighborhoodImagePath }" }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Lead.ts
var import_core20 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var Lead = (0, import_core20.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: () => false,
      update: permissions.canManageLeads,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeads,
      update: rules.canManageAssignedLeads
    },
    item: { update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Lead",
    parents: { property: "Property" },
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["name", "status", "intent", "property", "assignedAgent", "lastContactedAt"]
    }
  },
  fields: {
    brokerage: (0, import_fields22.relationship)({ ref: "Brokerage.leads", access: { update: () => false } }),
    name: (0, import_fields22.text)({ validation: { isRequired: true } }),
    identityKey: (0, import_fields22.text)({
      isIndexed: true,
      access: {
        create: () => false,
        update: () => false
      },
      ui: { itemView: { fieldMode: "read" } }
    }),
    email: (0, import_fields22.text)(),
    phone: (0, import_fields22.text)(),
    status: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "New", value: "new" },
        { label: "Attempted Contact", value: "attempted_contact" },
        { label: "Qualified", value: "qualified" },
        { label: "Tour Scheduled", value: "tour_scheduled" },
        { label: "Offer", value: "offer" },
        { label: "Closed", value: "closed" },
        { label: "Lost", value: "lost" }
      ],
      defaultValue: "new",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    intent: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" },
        { label: "Unknown", value: "unknown" }
      ],
      defaultValue: "unknown"
    }),
    source: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" }
      ],
      defaultValue: "website"
    }),
    budgetMin: money({ precision: 12, legacyText: true }),
    budgetMax: money({ precision: 12, legacyText: true }),
    preferredLocation: (0, import_fields22.text)(),
    timeline: (0, import_fields22.text)(),
    message: (0, import_fields22.text)({ ui: { displayMode: "textarea" } }),
    lastContactedAt: (0, import_fields22.timestamp)({ access: { create: () => false, update: () => false } }),
    property: (0, import_fields22.relationship)({ ref: "Property.leads", access: { update: () => false } }),
    assignedAgent: (0, import_fields22.relationship)({ ref: "User.assignedLeads", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: (0, import_fields22.relationship)({ ref: "AgentTeam.leads", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    showings: (0, import_fields22.relationship)({ ref: "Showing.lead", many: true, access: { create: () => false, update: () => false } }),
    activities: (0, import_fields22.relationship)({ ref: "LeadActivity.lead", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: (0, import_fields22.relationship)({ ref: "RepresentationAuthority.lead", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields22.virtual)({
      field: import_core20.graphql.field({
        type: import_core20.graphql.String,
        resolve(item) {
          return `${item.name || "Lead"}${item.intent ? ` \xB7 ${item.intent}` : ""}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Showing.ts
var import_core21 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var Showing = (0, import_core21.list)({
  access: {
    operation: {
      query: permissions.canReadShowings,
      create: () => false,
      update: permissions.canManageShowings,
      delete: () => false
    },
    filter: {
      query: rules.canReadShowings,
      update: rules.canManageAssignedShowings
    },
    item: { update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Showing",
    parents: { property: "Property", lead: "Lead" },
    users: ["assignedAgent"],
    required: ["property", "lead"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["property", "lead", "status", "scheduledStart", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields23.relationship)({ ref: "Brokerage.showings", access: { update: () => false } }),
    status: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "No Show", value: "no_show" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    customer: (0, import_fields23.relationship)({ ref: "User.customerShowings", access: { create: () => false, update: () => false } }),
    requestSnapshot: (0, import_fields23.json)({ access: { create: () => false, update: () => false } }),
    showingType: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "In Person", value: "in_person" },
        { label: "Virtual", value: "virtual" },
        { label: "Open House", value: "open_house" }
      ],
      defaultValue: "in_person"
    }),
    // Schedule changes must use a controlled command with authority and slot validation.
    scheduledStart: (0, import_fields23.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
    scheduledEnd: (0, import_fields23.timestamp)({ access: { update: () => false } }),
    notes: (0, import_fields23.text)({ ui: { displayMode: "textarea" } }),
    feedback: (0, import_fields23.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields23.relationship)({ ref: "Property.showings", access: { update: () => false } }),
    lead: (0, import_fields23.relationship)({ ref: "Lead.showings", access: { update: () => false } }),
    assignedAgent: (0, import_fields23.relationship)({ ref: "User.assignedShowings", access: { create: permissions.canManagePeople, update: () => false } }),
    displayLabel: (0, import_fields23.virtual)({
      field: import_core21.graphql.field({
        type: import_core21.graphql.String,
        resolve(item) {
          return `${item.showingType || "showing"} \xB7 ${item.status || "requested"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Deal.ts
var import_core22 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");
var Deal = (0, import_core22.list)({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canManageBrokerageDeals,
      update: permissions.canManageDeals,
      delete: () => false
    },
    filter: {
      query: rules.canReadDeals,
      update: rules.canManageAssignedDeals
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Deal",
    parents: { property: "Property", lead: "Lead" },
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    required: ["property", "lead"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "stage", "property", "lead", "assignedAgent", "expectedCloseDate"]
    }
  },
  fields: {
    brokerage: (0, import_fields24.relationship)({ ref: "Brokerage.deals", access: { update: () => false } }),
    title: (0, import_fields24.text)({ validation: { isRequired: true } }),
    stage: (0, import_fields24.select)({
      type: "enum",
      options: [
        { label: "Prospecting", value: "prospecting" },
        { label: "Active Search", value: "active_search" },
        { label: "Offer Drafted", value: "offer_drafted" },
        { label: "Under Contract", value: "under_contract" },
        { label: "Inspection", value: "inspection" },
        { label: "Financing", value: "financing" },
        { label: "Closed Won", value: "closed_won" },
        { label: "Closed Lost", value: "closed_lost" }
      ],
      defaultValue: "prospecting",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    transactionType: (0, import_fields24.select)({
      type: "enum",
      options: [
        { label: "Buyer", value: "buyer" },
        { label: "Seller", value: "seller" },
        { label: "Tenant", value: "tenant" },
        { label: "Landlord", value: "landlord" }
      ],
      defaultValue: "buyer"
    }),
    offerAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    commissionAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    expectedCloseDate: (0, import_fields24.timestamp)(),
    closedAt: (0, import_fields24.timestamp)({ access: { create: () => false, update: () => false } }),
    closedSnapshot: (0, import_fields24.json)({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    nextStep: (0, import_fields24.text)({ access: { update: () => false } }),
    notes: (0, import_fields24.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields24.relationship)({ ref: "Property", access: { update: () => false } }),
    lead: (0, import_fields24.relationship)({ ref: "Lead", access: { update: () => false } }),
    assignedAgent: (0, import_fields24.relationship)({ ref: "User.assignedDeals", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: (0, import_fields24.relationship)({ ref: "AgentTeam.deals", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    representationAuthorities: (0, import_fields24.relationship)({ ref: "RepresentationAuthority.deal", many: true, access: { create: () => false, update: () => false } }),
    documentEvidenceEvents: (0, import_fields24.relationship)({ ref: "DocumentEvidenceEvent.deal", many: true, access: { create: () => false, update: () => false } }),
    commissionLedgerEntries: (0, import_fields24.relationship)({ ref: "CommissionLedgerEntry.deal", many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: (0, import_fields24.relationship)({ ref: "TransactionFileEvent.deal", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields24.virtual)({
      field: import_core22.graphql.field({
        type: import_core22.graphql.String,
        resolve(item) {
          return `${item.title || "Deal"} \xB7 ${item.stage || "prospecting"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/SavedProperty.ts
var import_core23 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var SavedProperty = (0, import_core23.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadSavedProperties
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["property", "user", "status", "notes"]
    }
  },
  fields: {
    status: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Saved", value: "saved" },
        { label: "Interested", value: "interested" },
        { label: "Hidden", value: "hidden" }
      ],
      defaultValue: "saved"
    }),
    notes: (0, import_fields25.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields25.relationship)({ ref: "Property.savedBy" }),
    user: (0, import_fields25.relationship)({ ref: "User.savedProperties" }),
    ...trackingFields
  }
});

// features/keystone/models/LeadActivity.ts
var import_core24 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var LeadActivity = (0, import_core24.list)({
  access: {
    operation: {
      query: permissions.canReadLeadActivities,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadActivities
    }
  },
  hooks: createTenantOwnedHooks({
    listKey: "LeadActivity",
    parents: { lead: "Lead", property: "Property", showing: "Showing" },
    users: ["agent"],
    required: ["lead"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["lead", "activityType", "direction", "channel", "occurredAt", "agent"]
    }
  },
  fields: {
    brokerage: (0, import_fields26.relationship)({ ref: "Brokerage.leadActivities" }),
    activityType: (0, import_fields26.select)({
      type: "enum",
      options: [
        { label: "Inquiry", value: "inquiry" },
        { label: "Call", value: "call" },
        { label: "Email", value: "email" },
        { label: "Text", value: "text" },
        { label: "Note", value: "note" },
        { label: "Status Change", value: "status_change" },
        { label: "Showing Requested", value: "showing_requested" },
        { label: "Showing Scheduled", value: "showing_scheduled" },
        { label: "Showing Feedback", value: "showing_feedback" },
        { label: "System", value: "system" }
      ],
      defaultValue: "note",
      validation: { isRequired: true }
    }),
    direction: (0, import_fields26.select)({
      type: "enum",
      options: [
        { label: "Inbound", value: "inbound" },
        { label: "Outbound", value: "outbound" },
        { label: "Internal", value: "internal" }
      ],
      defaultValue: "internal"
    }),
    channel: (0, import_fields26.select)({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "In Person", value: "in_person" },
        { label: "CRM", value: "crm" }
      ],
      defaultValue: "crm"
    }),
    subject: (0, import_fields26.text)(),
    body: (0, import_fields26.text)({ ui: { displayMode: "textarea" } }),
    occurredAt: (0, import_fields26.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    lead: (0, import_fields26.relationship)({ ref: "Lead.activities" }),
    property: (0, import_fields26.relationship)({ ref: "Property" }),
    showing: (0, import_fields26.relationship)({ ref: "Showing" }),
    agent: (0, import_fields26.relationship)({ ref: "User" }),
    displayLabel: (0, import_fields26.virtual)({
      field: import_core24.graphql.field({
        type: import_core24.graphql.String,
        resolve(item) {
          return `${item.activityType || "activity"}${item.subject ? ` \xB7 ${item.subject}` : ""}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/LeadRoutingRule.ts
var import_core25 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var LeadRoutingRule = (0, import_core25.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageBrokerageTasks,
      delete: permissions.canManageBrokerageTasks
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
      delete: rules.canAccessBrokerageRecords
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "LeadRoutingRule",
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    requiredAny: ["assignedAgent", "assignedTeam"]
  }),
  ui: {
    listView: {
      initialColumns: ["name", "status", "priority", "intent", "city", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields27.relationship)({ ref: "Brokerage.leadRoutingRules" }),
    name: (0, import_fields27.text)({ validation: { isRequired: true } }),
    status: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" }
      ],
      defaultValue: "active"
    }),
    priority: (0, import_fields27.integer)({ defaultValue: 100, validation: { min: 1, max: 999 } }),
    intent: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" }
      ],
      defaultValue: "any"
    }),
    source: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" }
      ],
      defaultValue: "any"
    }),
    city: (0, import_fields27.text)({ ui: { description: "Optional city match. Leave blank for any city." } }),
    state: (0, import_fields27.text)({ ui: { description: "Optional state match. Leave blank for any state." } }),
    postalCode: (0, import_fields27.text)({ ui: { description: "Optional ZIP/postal match. Leave blank for any ZIP." } }),
    isFallback: (0, import_fields27.checkbox)({ defaultValue: false }),
    assignedAgent: (0, import_fields27.relationship)({ ref: "User.leadRoutingRules" }),
    assignedTeam: (0, import_fields27.relationship)({ ref: "AgentTeam.leadRoutingRules" }),
    displayLabel: (0, import_fields27.virtual)({
      field: import_core25.graphql.field({
        type: import_core25.graphql.String,
        resolve(item) {
          return `${item.name || "Routing rule"} \xB7 ${item.status || "active"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/PropertyMedia.ts
var import_core26 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");
var PropertyMedia = (0, import_core26.list)({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: permissions.canManageListings
    },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren, delete: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty }
  },
  hooks: createTenantOwnedHooks({ listKey: "PropertyMedia", parents: { property: "Property" }, required: ["property"], deriveOnly: true }),
  ui: { listView: { initialColumns: ["title", "mediaType", "property", "sortOrder", "isHero"] } },
  fields: {
    title: (0, import_fields28.text)({ validation: { isRequired: true } }),
    mediaType: (0, import_fields28.select)({
      type: "enum",
      options: [
        { label: "Photo", value: "photo" },
        { label: "Floor Plan", value: "floor_plan" },
        { label: "Virtual Tour", value: "virtual_tour" },
        { label: "Video", value: "video" },
        { label: "Document", value: "document" }
      ],
      defaultValue: "photo",
      validation: { isRequired: true }
    }),
    url: (0, import_fields28.text)({ validation: { isRequired: true } }),
    altText: (0, import_fields28.text)(),
    caption: (0, import_fields28.text)({ ui: { displayMode: "textarea" } }),
    sortOrder: (0, import_fields28.integer)({ defaultValue: 0 }),
    isHero: (0, import_fields28.checkbox)({ defaultValue: false }),
    property: (0, import_fields28.relationship)({ ref: "Property", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/PropertyInspection.ts
var import_core27 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var PropertyInspection = (0, import_core27.list)({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canReadSensitiveDeals,
      update: permissions.canManageDeals,
      delete: () => false
    },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren, delete: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: createTenantOwnedHooks({ listKey: "PropertyInspection", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "inspectionType", "status", "property", "scheduledAt"] }
  },
  fields: {
    title: (0, import_fields29.text)({ validation: { isRequired: true } }),
    inspectionType: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "General", value: "general" },
        { label: "Pest", value: "pest" },
        { label: "Roof", value: "roof" },
        { label: "Appraisal", value: "appraisal" },
        { label: "Final Walkthrough", value: "walkthrough" }
      ],
      defaultValue: "general"
    }),
    status: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "Needs Follow-up", value: "needs_follow_up" },
        { label: "Waived", value: "waived" }
      ],
      defaultValue: "scheduled",
      access: { create: () => false, update: () => false }
    }),
    scheduledAt: (0, import_fields29.timestamp)(),
    completedAt: (0, import_fields29.timestamp)({ access: { create: () => false, update: () => false } }),
    inspectorName: (0, import_fields29.text)(),
    inspectorEmail: (0, import_fields29.text)(),
    estimatedCost: money({ precision: 10, scale: 2 }),
    summary: (0, import_fields29.text)({ ui: { displayMode: "textarea" } }),
    findings: (0, import_fields29.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields29.relationship)({ ref: "Property", access: { update: () => false } }),
    deal: (0, import_fields29.relationship)({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Offer.ts
var import_core28 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var Offer = (0, import_core28.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDeals }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Offer",
    parents: { deal: "Deal", property: "Property", lead: "Lead", parentOffer: "Offer" },
    users: ["assignedAgent"],
    required: ["deal", "property", "lead"],
    coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property", lead: "lead" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["offerNumber", "status", "amount", "property", "deal", "submittedAt"] }
  },
  fields: {
    brokerage: (0, import_fields30.relationship)({ ref: "Brokerage.offers" }),
    offerNumber: (0, import_fields30.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    version: (0, import_fields30.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: { create: () => false, update: () => false } }),
    parentOffer: (0, import_fields30.relationship)({ ref: "Offer.counterOffers" }),
    counterOffers: (0, import_fields30.relationship)({ ref: "Offer.parentOffer", many: true, access: { create: () => false, update: () => false } }),
    status: (0, import_fields30.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Countered", value: "countered" },
        { label: "Accepted", value: "accepted" },
        { label: "Rejected", value: "rejected" },
        { label: "Withdrawn", value: "withdrawn" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    amount: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    earnestMoney: money({ precision: 12, scale: 2 }),
    financingType: (0, import_fields30.select)({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Conventional", value: "conventional" },
        { label: "FHA", value: "fha" },
        { label: "VA", value: "va" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "conventional"
    }),
    contingencies: (0, import_fields30.text)({ ui: { displayMode: "textarea" } }),
    submittedAt: (0, import_fields30.timestamp)(),
    responseDueAt: (0, import_fields30.timestamp)(),
    acceptedAt: (0, import_fields30.timestamp)({ access: { create: () => false, update: () => false } }),
    acceptedSnapshot: (0, import_fields30.json)({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    property: (0, import_fields30.relationship)({ ref: "Property" }),
    deal: (0, import_fields30.relationship)({ ref: "Deal" }),
    lead: (0, import_fields30.relationship)({ ref: "Lead" }),
    assignedAgent: (0, import_fields30.relationship)({ ref: "User" }),
    documentEvidenceEvents: (0, import_fields30.relationship)({ ref: "DocumentEvidenceEvent.offer", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields30.virtual)({ field: import_core28.graphql.field({ type: import_core28.graphql.String, resolve: (item) => `${item.offerNumber || "Offer"} \xB7 ${item.status || "draft"}` }) }),
    ...trackingFields
  }
});

// features/keystone/models/DealDocument.ts
var import_core29 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");
var DealDocument = (0, import_core29.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: permissions.canManageBrokerageDeals,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "DealDocument", parents: { deal: "Deal", property: "Property" }, users: ["uploadedBy"], required: ["deal"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "documentType", "status", "deal", "requiresSignature"] }
  },
  fields: {
    brokerage: (0, import_fields31.relationship)({ ref: "Brokerage", access: { update: () => false } }),
    title: (0, import_fields31.text)({ validation: { isRequired: true } }),
    documentType: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Listing Agreement", value: "listing_agreement" },
        { label: "Offer", value: "offer" },
        { label: "Disclosure", value: "disclosure" },
        { label: "Inspection Report", value: "inspection_report" },
        { label: "Closing Statement", value: "closing_statement" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "other"
    }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Signed", value: "signed" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "draft",
      access: { create: () => false, update: () => false }
    }),
    fileUrl: (0, import_fields31.text)({ validation: { isRequired: true } }),
    requiresSignature: (0, import_fields31.checkbox)({ defaultValue: false }),
    sentAt: (0, import_fields31.timestamp)(),
    signedAt: (0, import_fields31.timestamp)(),
    expiresAt: (0, import_fields31.timestamp)(),
    notes: (0, import_fields31.text)({ ui: { displayMode: "textarea" } }),
    deal: (0, import_fields31.relationship)({ ref: "Deal", access: { update: () => false } }),
    property: (0, import_fields31.relationship)({ ref: "Property", access: { update: () => false } }),
    uploadedBy: (0, import_fields31.relationship)({ ref: "User", access: { update: () => false } }),
    evidenceEvents: (0, import_fields31.relationship)({ ref: "DocumentEvidenceEvent.document", many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: (0, import_fields31.relationship)({ ref: "TransactionFileEvent.document", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Commission.ts
var import_core30 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var Commission = (0, import_core30.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDeals }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Commission",
    parents: { deal: "Deal", property: "Property" },
    users: ["agent"],
    required: ["deal", "property", "agent"],
    coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["title", "status", "grossCommission", "netCommission", "agent", "deal"] }
  },
  fields: {
    brokerage: (0, import_fields32.relationship)({ ref: "Brokerage.commissions" }),
    title: (0, import_fields32.text)({ validation: { isRequired: true } }),
    status: (0, import_fields32.select)({
      type: "enum",
      options: [
        { label: "Projected", value: "projected" },
        { label: "Approved", value: "approved" },
        { label: "Paid", value: "paid" },
        { label: "Clawed Back", value: "clawed_back" }
      ],
      defaultValue: "projected",
      access: { create: () => false, update: () => false }
    }),
    side: (0, import_fields32.select)({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Referral", value: "referral" }
      ],
      defaultValue: "listing"
    }),
    grossCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    brokerageSplitPercent: (0, import_fields32.decimal)({ precision: 5, scale: 2, defaultValue: "0.00" }),
    agentSplitPercent: (0, import_fields32.decimal)({ precision: 5, scale: 2, defaultValue: "0.00" }),
    netCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    paidAt: (0, import_fields32.timestamp)({ access: { create: () => false, update: () => false } }),
    notes: (0, import_fields32.text)({ ui: { displayMode: "textarea" } }),
    deal: (0, import_fields32.relationship)({ ref: "Deal" }),
    property: (0, import_fields32.relationship)({ ref: "Property" }),
    agent: (0, import_fields32.relationship)({ ref: "User" }),
    ledgerEntries: (0, import_fields32.relationship)({ ref: "CommissionLedgerEntry.commission", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/SavedSearch.ts
var import_core31 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var SavedSearch = (0, import_core31.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadSavedSearches }
  },
  hooks: createTenantOwnedHooks({ listKey: "SavedSearch", users: ["user"], required: ["user"] }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "user", "city", "minPrice", "maxPrice", "alertsEnabled"] }
  },
  fields: {
    brokerage: (0, import_fields33.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields33.text)({ validation: { isRequired: true } }),
    city: (0, import_fields33.text)(),
    state: (0, import_fields33.text)(),
    propertyType: (0, import_fields33.text)(),
    minPrice: money({ precision: 12, scale: 2 }),
    maxPrice: money({ precision: 12, scale: 2 }),
    minBedrooms: (0, import_fields33.integer)(),
    minBathrooms: (0, import_fields33.decimal)({ precision: 4, scale: 1 }),
    minSquareFeet: (0, import_fields33.integer)(),
    keywords: (0, import_fields33.text)(),
    alertsEnabled: (0, import_fields33.checkbox)({ defaultValue: true }),
    lastNotifiedAt: (0, import_fields33.timestamp)(),
    user: (0, import_fields33.relationship)({ ref: "User" }),
    ...trackingFields
  }
});

// features/keystone/models/MarketComp.ts
var import_core32 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var MarketComp = (0, import_core32.list)({
  access: {
    operation: {
      query: permissions.canViewMarketIntelligence,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: () => false
    },
    filter: { query: rules.canReadSubjectPropertyChildren, update: rules.canManageSubjectPropertyChildren, delete: rules.canManageSubjectPropertyChildren },
    item: { create: canCreateForManagedSubjectProperty }
  },
  hooks: createTenantOwnedHooks({ listKey: "MarketComp", parents: { subjectProperty: "Property" }, required: ["subjectProperty"], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["addressLine1", "status", "salePrice", "soldAt", "subjectProperty"] }
  },
  fields: {
    addressLine1: (0, import_fields34.text)({ validation: { isRequired: true } }),
    city: (0, import_fields34.text)(),
    state: (0, import_fields34.text)(),
    postalCode: (0, import_fields34.text)(),
    status: (0, import_fields34.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "sold"
    }),
    listPrice: money({ precision: 12, scale: 2 }),
    salePrice: money({ precision: 12, scale: 2 }),
    soldAt: (0, import_fields34.timestamp)(),
    bedrooms: (0, import_fields34.integer)(),
    bathrooms: (0, import_fields34.decimal)({ precision: 4, scale: 1 }),
    squareFeet: (0, import_fields34.integer)(),
    distanceMiles: (0, import_fields34.decimal)({ precision: 6, scale: 2 }),
    sourceUrl: (0, import_fields34.text)(),
    notes: (0, import_fields34.text)({ ui: { displayMode: "textarea" } }),
    subjectProperty: (0, import_fields34.relationship)({ ref: "Property", access: { update: () => false } }),
    neighborhood: (0, import_fields34.relationship)({ ref: "Neighborhood.marketComps" }),
    ...trackingFields
  }
});

// features/keystone/models/Neighborhood.ts
var import_core33 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var Neighborhood = (0, import_core33.list)({
  access: {
    operation: {
      query: () => false,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "city", "state", "medianSalePrice", "activeListings"] }
  },
  fields: {
    name: (0, import_fields35.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields35.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    city: (0, import_fields35.text)({ validation: { isRequired: true } }),
    state: (0, import_fields35.text)({ validation: { isRequired: true } }),
    overview: (0, import_fields35.text)({ ui: { displayMode: "textarea" } }),
    schoolDistrict: (0, import_fields35.text)(),
    walkScore: (0, import_fields35.integer)(),
    transitScore: (0, import_fields35.integer)(),
    medianSalePrice: money({ precision: 12, scale: 2 }),
    medianRent: money({ precision: 12, scale: 2 }),
    activeListings: (0, import_fields35.integer)({ defaultValue: 0 }),
    averageDaysOnMarket: (0, import_fields35.integer)(),
    marketComps: (0, import_fields35.relationship)({ ref: "MarketComp.neighborhood", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/AgentTeam.ts
var import_core34 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
var teamHooks = createTenantOwnedHooks({ listKey: "AgentTeam", users: ["leadAgent"], manyUsers: ["members"], protectDelete: true });
var AgentTeam = (0, import_core34.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
      delete: rules.canAccessBrokerageRecords
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage
    }
  },
  hooks: {
    resolveInput: teamHooks.resolveInput,
    validateInput: async (args) => {
      await teamHooks.validateInput(args);
      validateRequiredToOneRelationship({
        operation: args.operation,
        inputData: args.inputData,
        field: "brokerage",
        addValidationError: args.addValidationError
      });
    },
    beforeOperation: teamHooks.beforeOperation,
    afterOperation: teamHooks.afterOperation
  },
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["name", "teamType", "status", "leadAgent"] }
  },
  fields: {
    brokerage: (0, import_fields36.relationship)({ ref: "Brokerage.teams", access: { update: () => false } }),
    name: (0, import_fields36.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields36.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    teamType: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Rental", value: "rental" },
        { label: "Operations", value: "operations" }
      ],
      defaultValue: "listing"
    }),
    status: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active"
    }),
    description: (0, import_fields36.text)({ ui: { displayMode: "textarea" } }),
    leadAgent: (0, import_fields36.relationship)({ ref: "User" }),
    members: (0, import_fields36.relationship)({ ref: "User", many: true }),
    leads: (0, import_fields36.relationship)({ ref: "Lead.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    leadRoutingRules: (0, import_fields36.relationship)({ ref: "LeadRoutingRule.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    deals: (0, import_fields36.relationship)({ ref: "Deal.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/AgentTask.ts
var import_core35 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var AgentTask = (0, import_core35.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageLeads,
      delete: () => false
    },
    filter: { query: rules.canReadAgentTasks, update: rules.canReadAgentTasks },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "AgentTask", parents: { property: "Property", lead: "Lead", deal: "Deal" }, users: ["assignedAgent"], protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "status", "priority", "dueAt", "assignedAgent"] }
  },
  fields: {
    brokerage: (0, import_fields37.relationship)({ ref: "Brokerage", access: { update: () => false } }),
    title: (0, import_fields37.text)({ validation: { isRequired: true } }),
    status: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "In Progress", value: "in_progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Done", value: "done" }
      ],
      defaultValue: "open",
      access: { create: () => false, update: () => false }
    }),
    priority: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" }
      ],
      defaultValue: "normal"
    }),
    dueAt: (0, import_fields37.timestamp)(),
    completedAt: (0, import_fields37.timestamp)({ access: { create: () => false, update: () => false } }),
    notes: (0, import_fields37.text)({ ui: { displayMode: "textarea" } }),
    assignedAgent: (0, import_fields37.relationship)({ ref: "User", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    property: (0, import_fields37.relationship)({ ref: "Property", access: { update: () => false } }),
    lead: (0, import_fields37.relationship)({ ref: "Lead", access: { update: () => false } }),
    deal: (0, import_fields37.relationship)({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/ListingEngagementAuthority.ts
var import_core36 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var ListingEngagementAuthority = (0, import_core36.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingEngagementAuthority",
    parents: { property: "Property", supersedes: "ListingEngagementAuthority" },
    users: ["assignedPractitioner", "recordedBy"],
    required: ["property", "assignedPractitioner", "recordedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "property", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields38.relationship)({ ref: "Brokerage.listingEngagementAuthorities" }),
    authorityNumber: (0, import_fields38.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    property: (0, import_fields38.relationship)({ ref: "Property.listingEngagementAuthorities" }),
    assignedPractitioner: (0, import_fields38.relationship)({ ref: "User.listingEngagementAuthorities" }),
    status: (0, import_fields38.select)({
      type: "enum",
      options: [
        { label: "Executed", value: "executed" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields38.text)({ validation: { isRequired: true } }),
    effectiveFrom: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    exclusive: (0, import_fields38.checkbox)({ defaultValue: false }),
    marketingAuthorized: (0, import_fields38.checkbox)({ defaultValue: false }),
    showingAuthorized: (0, import_fields38.checkbox)({ defaultValue: false }),
    sellerPartySummary: (0, import_fields38.json)(),
    signatoryCapacity: (0, import_fields38.text)({ validation: { isRequired: true } }),
    documentSha256: (0, import_fields38.text)({ validation: { isRequired: true } }),
    documentProviderReference: (0, import_fields38.text)(),
    supersedes: (0, import_fields38.relationship)({ ref: "ListingEngagementAuthority.supersededBy" }),
    supersededBy: (0, import_fields38.relationship)({ ref: "ListingEngagementAuthority.supersedes", many: true }),
    reason: (0, import_fields38.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields38.relationship)({ ref: "User.recordedListingEngagementAuthorities" }),
    recordedAt: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/ListingPublicationAuthority.ts
var import_core37 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var ListingPublicationAuthority = (0, import_core37.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingPublicationAuthority",
    parents: { property: "Property", engagement: "ListingEngagementAuthority", supersedes: "ListingPublicationAuthority" },
    users: ["recordedBy"],
    required: ["property", "engagement", "recordedBy"],
    coherentWith: { field: "engagement", listKey: "ListingEngagementAuthority", matches: { property: "property" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "property", "destination", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields39.relationship)({ ref: "Brokerage.listingPublicationAuthorities" }),
    authorityNumber: (0, import_fields39.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    property: (0, import_fields39.relationship)({ ref: "Property.listingPublicationAuthorities" }),
    engagement: (0, import_fields39.relationship)({ ref: "ListingEngagementAuthority" }),
    destination: (0, import_fields39.select)({
      type: "enum",
      options: [
        { label: "Public website", value: "public_site" },
        { label: "MLS submission", value: "mls" },
        { label: "IDX display", value: "idx" },
        { label: "Syndication", value: "syndication" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields39.select)({
      type: "enum",
      options: [
        { label: "Authorized", value: "authorized" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    authorityBasis: (0, import_fields39.text)({ validation: { isRequired: true } }),
    localRuleReference: (0, import_fields39.text)(),
    dataUseGrantReference: (0, import_fields39.text)(),
    supersedes: (0, import_fields39.relationship)({ ref: "ListingPublicationAuthority.supersededBy" }),
    supersededBy: (0, import_fields39.relationship)({ ref: "ListingPublicationAuthority.supersedes", many: true }),
    reason: (0, import_fields39.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields39.relationship)({ ref: "User.recordedListingPublicationAuthorities" }),
    recordedAt: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/PractitionerLicenseAuthority.ts
var import_core38 = require("@keystone-6/core");
var import_fields40 = require("@keystone-6/core/fields");
var PractitionerLicenseAuthority = (0, import_core38.list)({
  access: {
    operation: { query: permissions.canManagePeople, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "PractitionerLicenseAuthority",
    users: ["practitioner", "verifiedBy"],
    parents: { supersedes: "PractitionerLicenseAuthority" },
    required: ["practitioner", "verifiedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["licenseNumber", "practitioner", "jurisdictionCode", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields40.relationship)({ ref: "Brokerage.practitionerLicenseAuthorities" }),
    practitioner: (0, import_fields40.relationship)({ ref: "User.practitionerLicenseAuthorities" }),
    licenseNumber: (0, import_fields40.text)({ validation: { isRequired: true } }),
    licenseType: (0, import_fields40.select)({
      type: "enum",
      options: [
        { label: "Broker", value: "broker" },
        { label: "Associate broker", value: "associate_broker" },
        { label: "Sales agent", value: "sales_agent" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields40.text)({ validation: { isRequired: true } }),
    status: (0, import_fields40.select)({
      type: "enum",
      options: [
        { label: "Verified active", value: "verified_active" },
        { label: "Restricted", value: "restricted" },
        { label: "Inactive", value: "inactive" },
        { label: "Expired", value: "expired" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    verificationSource: (0, import_fields40.text)({ validation: { isRequired: true } }),
    restrictions: (0, import_fields40.text)({ ui: { displayMode: "textarea" } }),
    supersedes: (0, import_fields40.relationship)({ ref: "PractitionerLicenseAuthority.supersededBy" }),
    supersededBy: (0, import_fields40.relationship)({ ref: "PractitionerLicenseAuthority.supersedes", many: true }),
    reason: (0, import_fields40.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    verifiedBy: (0, import_fields40.relationship)({ ref: "User.verifiedPractitionerLicenses" }),
    ...trackingFields
  }
});

// features/keystone/models/RepresentationAuthority.ts
var import_core39 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");
var RepresentationAuthority = (0, import_core39.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "RepresentationAuthority",
    parents: { lead: "Lead", property: "Property", deal: "Deal", supersedes: "RepresentationAuthority" },
    users: ["practitioner", "recordedBy"],
    required: ["lead", "practitioner", "recordedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "lead", "side", "relationshipType", "status", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields41.relationship)({ ref: "Brokerage.representationAuthorities" }),
    authorityNumber: (0, import_fields41.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    lead: (0, import_fields41.relationship)({ ref: "Lead.representationAuthorities" }),
    property: (0, import_fields41.relationship)({ ref: "Property.representationAuthorities" }),
    deal: (0, import_fields41.relationship)({ ref: "Deal.representationAuthorities" }),
    practitioner: (0, import_fields41.relationship)({ ref: "User.representationAuthorities" }),
    side: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Buyer", value: "buyer" },
        { label: "Seller", value: "seller" }
      ],
      validation: { isRequired: true }
    }),
    relationshipType: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Exclusive agency", value: "exclusive_agency" },
        { label: "Non-exclusive agency", value: "nonexclusive_agency" },
        { label: "Transaction brokerage/facilitation", value: "transaction_brokerage" },
        { label: "Customer assistance only", value: "customer_assistance" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields41.text)({ validation: { isRequired: true } }),
    status: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Executed", value: "executed" },
        { label: "Terminated", value: "terminated" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    scopeSummary: (0, import_fields41.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    documentSha256: (0, import_fields41.text)({ validation: { isRequired: true } }),
    disclosureVersion: (0, import_fields41.text)({ validation: { isRequired: true } }),
    consentRecordedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    supersedes: (0, import_fields41.relationship)({ ref: "RepresentationAuthority.supersededBy" }),
    supersededBy: (0, import_fields41.relationship)({ ref: "RepresentationAuthority.supersedes", many: true }),
    reason: (0, import_fields41.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields41.relationship)({ ref: "User.recordedRepresentationAuthorities" }),
    recordedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/DocumentEvidenceEvent.ts
var import_core40 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");
var DocumentEvidenceEvent = (0, import_core40.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "DocumentEvidenceEvent",
    parents: { document: "DealDocument", deal: "Deal", offer: "Offer" },
    users: ["actor"],
    required: ["document", "deal", "actor"],
    coherentWith: { field: "document", listKey: "DealDocument", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["eventKey", "document", "eventType", "occurredAt", "provider"] }
  },
  fields: {
    brokerage: (0, import_fields42.relationship)({ ref: "Brokerage.documentEvidenceEvents" }),
    eventKey: (0, import_fields42.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    document: (0, import_fields42.relationship)({ ref: "DealDocument.evidenceEvents" }),
    deal: (0, import_fields42.relationship)({ ref: "Deal.documentEvidenceEvents" }),
    offer: (0, import_fields42.relationship)({ ref: "Offer.documentEvidenceEvents" }),
    eventType: (0, import_fields42.select)({
      type: "enum",
      options: [
        { label: "Generated", value: "generated" },
        { label: "Signed", value: "signed" },
        { label: "Delivered", value: "delivered" },
        { label: "Received", value: "received" },
        { label: "Presented", value: "presented" },
        { label: "Acknowledged", value: "acknowledged" },
        { label: "Voided", value: "voided" }
      ],
      validation: { isRequired: true }
    }),
    documentSha256: (0, import_fields42.text)({ validation: { isRequired: true } }),
    templateSha256: (0, import_fields42.text)({ validation: { isRequired: true } }),
    certificateSha256: (0, import_fields42.text)(),
    recipients: (0, import_fields42.json)(),
    channel: (0, import_fields42.select)({
      type: "enum",
      options: [
        { label: "E-sign provider", value: "esign" },
        { label: "Email", value: "email" },
        { label: "Secure portal", value: "portal" },
        { label: "In person", value: "in_person" },
        { label: "Other approved channel", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    provider: (0, import_fields42.text)({ validation: { isRequired: true } }),
    providerReference: (0, import_fields42.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields42.timestamp)({ validation: { isRequired: true } }),
    providerReportedAt: (0, import_fields42.timestamp)(),
    acknowledgedAt: (0, import_fields42.timestamp)(),
    acknowledgementReference: (0, import_fields42.text)(),
    reason: (0, import_fields42.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    actor: (0, import_fields42.relationship)({ ref: "User.recordedDocumentEvidenceEvents" }),
    ...trackingFields
  }
});

// features/keystone/models/CommissionLedgerEntry.ts
var import_core41 = require("@keystone-6/core");
var import_fields43 = require("@keystone-6/core/fields");
var CommissionLedgerEntry = (0, import_core41.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "CommissionLedgerEntry",
    parents: { commission: "Commission", deal: "Deal", reverses: "CommissionLedgerEntry" },
    users: ["payeeUser", "preparedBy", "approvedBy"],
    required: ["commission", "deal", "preparedBy"],
    coherentWith: { field: "commission", listKey: "Commission", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["entryKey", "commission", "entryType", "amountCents", "currencyCode", "occurredAt"] }
  },
  fields: {
    brokerage: (0, import_fields43.relationship)({ ref: "Brokerage.commissionLedgerEntries" }),
    entryKey: (0, import_fields43.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    batchKey: (0, import_fields43.text)({ validation: { isRequired: true } }),
    commission: (0, import_fields43.relationship)({ ref: "Commission.ledgerEntries" }),
    deal: (0, import_fields43.relationship)({ ref: "Deal.commissionLedgerEntries" }),
    entryType: (0, import_fields43.select)({
      type: "enum",
      options: [
        { label: "Allocation", value: "allocation" },
        { label: "Allocation approval", value: "allocation_approval" },
        { label: "Receipt", value: "receipt" },
        { label: "Reversal", value: "reversal" },
        { label: "Reconciliation", value: "reconciliation" }
      ],
      validation: { isRequired: true }
    }),
    allocationType: (0, import_fields43.select)({
      type: "enum",
      options: [
        { label: "Brokerage", value: "brokerage" },
        { label: "Agent", value: "agent" },
        { label: "Team", value: "team" },
        { label: "Referral", value: "referral" },
        { label: "Fee/adjustment", value: "fee" },
        { label: "Unallocated", value: "unallocated" }
      ]
    }),
    amountCents: (0, import_fields43.bigInt)({ validation: { isRequired: true } }),
    currencyCode: (0, import_fields43.text)({ validation: { isRequired: true } }),
    payeeUser: (0, import_fields43.relationship)({ ref: "User.commissionLedgerEntries" }),
    payeeLabel: (0, import_fields43.text)(),
    externalReference: (0, import_fields43.text)(),
    sourceDocumentSha256: (0, import_fields43.text)(),
    ledgerStateHash: (0, import_fields43.text)({ ui: { description: "Digest of financial facts at reconciliation; legacy entries require new reconciliation." } }),
    reverses: (0, import_fields43.relationship)({ ref: "CommissionLedgerEntry.reversedBy" }),
    reversedBy: (0, import_fields43.relationship)({ ref: "CommissionLedgerEntry.reverses", many: true, access: { create: () => false, update: () => false } }),
    reason: (0, import_fields43.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    preparedBy: (0, import_fields43.relationship)({ ref: "User.preparedCommissionLedgerEntries" }),
    approvedBy: (0, import_fields43.relationship)({ ref: "User.approvedCommissionLedgerEntries" }),
    occurredAt: (0, import_fields43.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/RetentionPolicy.ts
var import_core42 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");
var RetentionPolicy = (0, import_core42.list)({
  access: {
    operation: { query: permissions.canManageBrokerageSettings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "RetentionPolicy",
    parents: { supersedes: "RetentionPolicy" },
    users: ["approvedBy"],
    required: ["approvedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["policyKey", "retentionClass", "jurisdictionCode", "effectiveFrom", "retentionDays"] }
  },
  fields: {
    brokerage: (0, import_fields44.relationship)({ ref: "Brokerage.retentionPolicies" }),
    policyKey: (0, import_fields44.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    retentionClass: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Transaction file", value: "transaction_file" },
        { label: "Listing without close", value: "listing_no_close" },
        { label: "Consent/suppression proof", value: "consent_proof" },
        { label: "Security/access incident", value: "security_incident" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields44.text)({ validation: { isRequired: true } }),
    triggerType: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Deal closed", value: "deal_closed" },
        { label: "Listing ended", value: "listing_ended" },
        { label: "Document signed", value: "document_signed" },
        { label: "Manual verified trigger", value: "manual_verified" }
      ],
      validation: { isRequired: true }
    }),
    retentionDays: (0, import_fields44.integer)({ validation: { isRequired: true, min: 1, max: 36500 } }),
    disposition: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Tombstone and request object deletion", value: "tombstone_delete" },
        { label: "Archive", value: "archive" },
        { label: "Review required", value: "review" }
      ],
      validation: { isRequired: true }
    }),
    legalBasis: (0, import_fields44.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    effectiveFrom: (0, import_fields44.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields44.timestamp)(),
    supersedes: (0, import_fields44.relationship)({ ref: "RetentionPolicy.supersededBy" }),
    supersededBy: (0, import_fields44.relationship)({ ref: "RetentionPolicy.supersedes", many: true }),
    approvedBy: (0, import_fields44.relationship)({ ref: "User.approvedRetentionPolicies" }),
    approvedAt: (0, import_fields44.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields44.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/TransactionFileEvent.ts
var import_core43 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");
var TransactionFileEvent = (0, import_core43.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "TransactionFileEvent",
    parents: { deal: "Deal", document: "DealDocument", policy: "RetentionPolicy", reverses: "TransactionFileEvent" },
    users: ["actor", "approvedBy"],
    required: ["deal", "actor"],
    coherentWith: { field: "document", listKey: "DealDocument", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["eventKey", "deal", "document", "eventType", "occurredAt"] }
  },
  fields: {
    brokerage: (0, import_fields45.relationship)({ ref: "Brokerage.transactionFileEvents" }),
    eventKey: (0, import_fields45.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    deal: (0, import_fields45.relationship)({ ref: "Deal.transactionFileEvents" }),
    document: (0, import_fields45.relationship)({ ref: "DealDocument.transactionFileEvents" }),
    policy: (0, import_fields45.relationship)({ ref: "RetentionPolicy" }),
    eventType: (0, import_fields45.select)({
      type: "enum",
      options: [
        { label: "Retention assigned", value: "retention_assigned" },
        { label: "Legal hold placed", value: "hold_placed" },
        { label: "Legal hold released", value: "hold_released" },
        { label: "Export manifested", value: "export_manifested" },
        { label: "Disposition requested", value: "disposition_requested" },
        { label: "Tombstoned", value: "tombstoned" }
      ],
      validation: { isRequired: true }
    }),
    triggerAt: (0, import_fields45.timestamp)(),
    disposeAfter: (0, import_fields45.timestamp)(),
    holdKey: (0, import_fields45.text)(),
    manifestKey: (0, import_fields45.text)(),
    manifestSha256: (0, import_fields45.text)(),
    manifestItems: (0, import_fields45.json)(),
    documentSha256: (0, import_fields45.text)(),
    externalDeletionReference: (0, import_fields45.text)(),
    reverses: (0, import_fields45.relationship)({ ref: "TransactionFileEvent.reversedBy" }),
    reversedBy: (0, import_fields45.relationship)({ ref: "TransactionFileEvent.reverses", many: true }),
    reason: (0, import_fields45.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    actor: (0, import_fields45.relationship)({ ref: "User.recordedTransactionFileEvents" }),
    approvedBy: (0, import_fields45.relationship)({ ref: "User.approvedTransactionFileEvents" }),
    occurredAt: (0, import_fields45.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  DomainAuditEvent,
  DomainOutboxEvent,
  Brokerage,
  BrokerageMembership,
  BrokerageSettings,
  User,
  Role,
  Property,
  Lead,
  Showing,
  Deal,
  SavedProperty,
  LeadActivity,
  LeadRoutingRule,
  PropertyMedia,
  PropertyInspection,
  Offer,
  DealDocument,
  Commission,
  SavedSearch,
  MarketComp,
  Neighborhood,
  AgentTeam,
  AgentTask,
  SavedSearchAlert,
  Disclosure,
  PropertyValuation,
  TransactionMilestone,
  MortgageApplication,
  TitleOrder,
  Escrow,
  ShowingFeedback,
  OpenHouse,
  SourceFeed,
  ListingSyndication,
  ListingEngagementAuthority,
  ListingPublicationAuthority,
  PractitionerLicenseAuthority,
  RepresentationAuthority,
  DocumentEvidenceEvent,
  CommissionLedgerEntry,
  RetentionPolicy,
  TransactionFileEvent
};
for (const model of Object.values(models)) {
  const fields = model.fields;
  for (const key of Object.keys(fields)) fields[key] = staticFieldUi(fields[key]);
}

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/publicBrokerageIdentity.ts
async function publicBrokerageIdentity(_root, { brokerageSlug }, context) {
  const slug = String(brokerageSlug || "").trim().toLowerCase();
  if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("A valid brokerage slug is required.");
  const settings = await context.sudo().query.BrokerageSettings.findMany({
    where: {
      key: { in: [`${slug}:primary`, ...slug === "juniper-realty" ? ["primary"] : []] },
      brokerage: { slug: { equals: slug }, status: { equals: "active" } }
    },
    take: 1,
    query: "businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail brandHue logoIcon logoColor"
  });
  if (!settings[0]) return { status: "unconfigured", settings: null };
  const identity = settings[0];
  const requiredIdentity = [identity.businessName, identity.marketLabel, identity.city, identity.state, identity.tagline];
  if (requiredIdentity.some((value) => !String(value || "").trim())) return { status: "unconfigured", settings: null };
  return {
    status: "ready",
    settings: {
      businessName: identity.businessName,
      marketLabel: identity.marketLabel,
      city: identity.city,
      state: identity.state,
      tagline: identity.tagline,
      description: identity.description || "",
      equalHousingNotice: identity.equalHousingNotice || "",
      publicPhone: identity.publicPhone || "",
      publicEmail: identity.publicEmail || "",
      brandHue: identity.brandHue,
      logoIcon: sanitizeStoreLogoSvg(identity.logoIcon || ""),
      logoColor: normalizeStoreLogoColor(identity.logoColor)
    }
  };
}

// features/keystone/lib/commandContext.ts
async function lockBrokerageCommand(context, brokerageId) {
  if (!brokerageId || brokerageId.length > 200) throw new Error("An active brokerage is required.");
  await context.prisma.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    `brokerage-command:${brokerageId}`
  );
}
async function freshOperatorCommandContext(context) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId) throw new Error("An active brokerage membership is required.");
  await lockBrokerageCommand(context, brokerageId);
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR NO KEY UPDATE', session.itemId);
  const current = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id name email activeBrokerage { id slug status }
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(brokerageId)} } } }, take: 100) { id status membershipRole isPrimary brokerage { id slug status } }
      role { id name canAccessDashboard canSeeOtherPeople canEditOtherPeople
        canManagePeople canManageRoles canManageListings canManageLeads
        canManageShowings canManageDeals canViewReports canManageOnboarding }`
  });
  const nextSession = { ...session, data: current };
  if (!current || current.id !== session.itemId || activeBrokerageIds(nextSession)[0] !== brokerageId) {
    throw new Error("An active brokerage membership is required.");
  }
  return context.withSession(nextSession);
}
async function decisionRows(list45, args) {
  const rows = [];
  const pageSize = 200;
  const maxRows = 1e4;
  for (let skip = 0; skip <= maxRows; skip += pageSize) {
    const page = await list45.findMany({
      ...args,
      orderBy: args.orderBy || [{ createdAt: "asc" }, { id: "asc" }],
      take: pageSize,
      skip
    });
    if (rows.length + page.length > maxRows) throw new Error("Evidence history requires offline review before this action.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error("Evidence history requires offline review before this action.");
}

// features/keystone/lib/authorityEvidence.ts
var SHA256 = /^[a-f0-9]{64}$/i;
var ListingAuthorityDeniedError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ListingAuthorityDeniedError";
  }
};
function isSha256(value) {
  return SHA256.test(String(value || "").trim());
}
function boundedReason(value) {
  const reason = String(value || "").trim();
  if (!reason || reason.length > 5e3) throw new Error("A bounded reason is required.");
  return reason;
}
function boundedIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key || key.length > 120) throw new Error("A bounded idempotency key is required.");
  return key;
}
function authorityIsEffective(item, at2 = /* @__PURE__ */ new Date()) {
  const from = new Date(item?.effectiveFrom || 0);
  const through = new Date(item?.effectiveThrough || 0);
  return Number.isFinite(from.getTime()) && Number.isFinite(through.getTime()) && from <= at2 && through >= at2;
}
async function requirePractitionerLicense(context, input) {
  const rows = await context.sudo().query.PractitionerLicenseAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() }
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough verifiedAt verificationSource restrictions"
  });
  const latest = rows[0];
  const evaluatedAt = input.at || /* @__PURE__ */ new Date();
  if (!latest || latest.status !== "verified_active" || !authorityIsEffective(latest, evaluatedAt) || !latest.verifiedAt || new Date(latest.verifiedAt) > evaluatedAt || !latest.verificationSource) {
    throw new ListingAuthorityDeniedError("A current verified practitioner license is required for this jurisdictional action.");
  }
  return latest;
}
async function requireListingAuthority(context, input) {
  await requirePractitionerLicense(context, input);
  const engagements = await context.sudo().query.ListingEngagementAuthority.findMany({
    where: { brokerage: { id: { equals: input.brokerageId } }, property: { id: { equals: input.propertyId } } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 assignedPractitioner { id }"
  });
  const engagement = engagements[0];
  if (!engagement || engagement.status !== "executed" || !authorityIsEffective(engagement, input.at) || !engagement.marketingAuthorized || input.showingRequired && !engagement.showingAuthorized || !isSha256(engagement.documentSha256) || engagement.assignedPractitioner?.id !== input.practitionerId) {
    throw new ListingAuthorityDeniedError("An effective signed listing engagement with marketing authority is required.");
  }
  const publications = await context.sudo().query.ListingPublicationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      property: { id: { equals: input.propertyId } },
      destination: { equals: input.destination }
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough authorityBasis engagement { id }"
  });
  const publication = publications[0];
  if (!publication || publication.status !== "authorized" || !authorityIsEffective(publication, input.at) || publication.engagement?.id !== engagement.id || !publication.authorityBasis) {
    throw new ListingAuthorityDeniedError(`Effective ${input.destination} publication authority is required.`);
  }
  return { engagement, publication };
}
async function requireRepresentationAuthority(context, input) {
  await requirePractitionerLicense(context, input);
  const rows = await context.sudo().query.RepresentationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      lead: { id: { equals: input.leadId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() },
      side: { equals: input.side },
      ...input.propertyId ? { property: { id: { equals: input.propertyId } } } : {}
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status relationshipType effectiveFrom effectiveThrough documentSha256 consentRecordedAt property { id } deal { id }"
  });
  const authority = rows[0];
  const permittedRelationship = input.allowCustomerAssistance ? ["exclusive_agency", "nonexclusive_agency", "transaction_brokerage", "customer_assistance"].includes(authority?.relationshipType) : ["exclusive_agency", "nonexclusive_agency", "transaction_brokerage"].includes(authority?.relationshipType);
  if (!authority || authority.status !== "executed" || !authorityIsEffective(authority, input.at) || !permittedRelationship || !isSha256(authority.documentSha256) || !authority.consentRecordedAt || input.dealId && authority.deal?.id && authority.deal.id !== input.dealId) {
    throw new Error("An effective jurisdiction-specific representation authority is required for this action.");
  }
  return authority;
}
function evidenceComplete(events, required) {
  if (events.some((event) => event.eventType === "voided")) return false;
  if (!required.every((type) => events.some((event) => event.eventType === type))) return false;
  const hashes = new Set(events.map((event) => event.documentSha256));
  const templates = new Set(events.map((event) => event.templateSha256));
  return hashes.size === 1 && templates.size === 1 && [...hashes].every(isSha256) && [...templates].every(isSha256);
}
async function requireOfferEvidenceChain(context, input) {
  const documents = await decisionRows(context.sudo().query.DealDocument, {
    where: { deal: { id: { equals: input.dealId } }, documentType: { equals: "offer" } },
    orderBy: [{ id: "asc" }],
    query: "id status fileUrl sentAt signedAt createdAt"
  });
  const candidates = [];
  for (const document2 of documents) {
    const history = await decisionRows(context.sudo().query.DocumentEvidenceEvent, {
      where: { document: { id: { equals: document2.id } } },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      query: "id eventType documentSha256 templateSha256 offer { id } recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference"
    });
    const events2 = history.filter((event) => event.offer?.id === input.offerId);
    if (events2.length) candidates.push({ document: document2, history, events: events2 });
  }
  if (!candidates.length) throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
  if (candidates.length > 1) throw new Error("The current offer document version is ambiguous and requires records review.");
  const candidate = candidates[0];
  if (!candidate || candidate.document.status !== "signed" || !candidate.document.fileUrl || !candidate.document.sentAt || !candidate.document.signedAt || !Number.isFinite(new Date(candidate.document.createdAt).getTime()) || !Number.isFinite(new Date(candidate.document.signedAt).getTime()) || candidate.history.some((event) => event.eventType === "voided")) {
    throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
  }
  const { document, events } = candidate;
  const hasRecipients = events.filter((event) => ["delivered", "received", "presented", "acknowledged"].includes(event.eventType)).every((event) => Array.isArray(event.recipients) && event.recipients.length > 0);
  const acknowledged = events.some((event) => event.eventType === "acknowledged" && event.acknowledgedAt && event.acknowledgementReference);
  if (evidenceComplete(events, ["signed", "delivered", "presented", "acknowledged"]) && hasRecipients && acknowledged && events.every((event) => event.provider && event.providerReference)) return { document, events };
  throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
}
async function requireClosingEvidenceChain(context, dealId) {
  const documents = await decisionRows(context.sudo().query.DealDocument, {
    where: { deal: { id: { equals: dealId } }, documentType: { equals: "closing_statement" } },
    orderBy: [{ createdAt: "desc" }, { signedAt: "desc" }, { id: "desc" }],
    query: "id status fileUrl signedAt"
  });
  const document = documents[0];
  if (documents.length !== 1 || document?.status !== "signed" || !document.fileUrl || !document.signedAt || !Number.isFinite(new Date(document.signedAt).getTime())) {
    throw new Error("Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.");
  }
  const events = await decisionRows(context.sudo().query.DocumentEvidenceEvent, {
    where: { document: { id: { equals: document.id } }, deal: { id: { equals: dealId } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    query: "id eventType documentSha256 templateSha256 recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference"
  });
  if (evidenceComplete(events, ["signed", "acknowledged"]) && events.some((event) => event.eventType === "acknowledged" && event.acknowledgedAt && event.acknowledgementReference)) return { document, events };
  throw new Error("Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.");
}

// features/keystone/lib/publicListingPagination.ts
var import_graphql = require("graphql");
var PUBLIC_LISTING_CANDIDATE_BATCH_SIZE = 25;
var PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT = 250;
var PUBLIC_LISTING_SCAN_OVERFLOW_MARKER = "PUBLIC_LISTING_SCAN_OVERFLOW";
var PublicListingScanOverflowError = class extends import_graphql.GraphQLError {
  constructor() {
    super(`${PUBLIC_LISTING_SCAN_OVERFLOW_MARKER}: Narrow the search to verify eligible inventory safely.`, {
      extensions: { code: PUBLIC_LISTING_SCAN_OVERFLOW_MARKER }
    });
    this.name = "PublicListingScanOverflowError";
  }
};
async function collectEligiblePage({
  take,
  skip,
  fetchCandidates,
  isEligible,
  candidateBatchSize = PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
  candidateScanLimit = PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT
}) {
  if (!Number.isSafeInteger(take) || take < 1 || take > 100) throw new Error("Public listing page size is invalid.");
  if (!Number.isSafeInteger(skip) || skip < 0 || skip > 1e4) throw new Error("Public listing offset is invalid.");
  if (!Number.isSafeInteger(candidateBatchSize) || candidateBatchSize < 1) throw new Error("Public listing candidate batch is invalid.");
  if (!Number.isSafeInteger(candidateScanLimit) || candidateScanLimit < 1) throw new Error("Public listing candidate budget is invalid.");
  const items = [];
  let candidatesScanned = 0;
  let eligibleSkipped = 0;
  while (candidatesScanned < candidateScanLimit) {
    const batchLimit = Math.min(candidateBatchSize, candidateScanLimit - candidatesScanned);
    const candidates = await fetchCandidates(candidatesScanned, batchLimit);
    if (candidates.length > batchLimit) throw new Error("Public listing candidate reader exceeded its bound.");
    if (candidates.length === 0) {
      return { items, candidatesScanned };
    }
    for (const candidate of candidates) {
      candidatesScanned += 1;
      if (!await isEligible(candidate)) continue;
      if (eligibleSkipped < skip) {
        eligibleSkipped += 1;
        continue;
      }
      items.push(candidate);
      if (items.length === take) {
        return { items, candidatesScanned };
      }
    }
    if (candidates.length < batchLimit) {
      return { items, candidatesScanned };
    }
  }
  const overflowProbe = await fetchCandidates(candidatesScanned, 1);
  if (overflowProbe.length > 1) throw new Error("Public listing overflow probe exceeded its bound.");
  if (overflowProbe.length > 0) throw new PublicListingScanOverflowError();
  return { items, candidatesScanned };
}

// features/keystone/mutations/publicStorefront.ts
var PUBLIC_STATUSES = ["active", "coming_soon"];
var PUBLIC_LISTING_MEDIA_LIMIT = 20;
var PUBLIC_LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription description
  addressLine1 addressLine2 city state postalCode neighborhood
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl
  primaryImageUrl
  brokerage { id }
  assignedAgent { id name email phone brokerageTitle avatarUrl brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }
`;
function clean(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function boundedText(value, label, max = 120) {
  const text44 = clean(value);
  if (text44.length > max) throw new Error(`${label} is too long.`);
  return text44;
}
function boundedMoney(value) {
  const amount = clean(value);
  if (amount && !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw new Error("Price filters must be positive decimal amounts.");
  return amount;
}
function validBrokerageSlug(value) {
  const slug = clean(value).toLowerCase();
  if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("A valid brokerage slug is required.");
  return slug;
}
function buildPublicListingWhere(brokerageSlug, filters = {}) {
  const q = boundedText(filters.q, "Search");
  const city = boundedText(filters.city, "City", 80);
  const propertyType = boundedText(filters.propertyType, "Property type", 40);
  const minPrice = boundedMoney(filters.minPrice);
  const maxPrice = boundedMoney(filters.maxPrice);
  const where = {
    status: { in: [...PUBLIC_STATUSES] },
    brokerage: { slug: { equals: validBrokerageSlug(brokerageSlug) }, status: { equals: "active" } }
  };
  const and = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { addressLine1: { contains: q, mode: "insensitive" } },
        { postalCode: { contains: q, mode: "insensitive" } }
      ]
    });
  }
  if (city) and.push({ city: { contains: city, mode: "insensitive" } });
  if (filters.listingType) where.listingType = { equals: filters.listingType };
  if (propertyType) where.propertyType = { equals: propertyType };
  if (filters.bedrooms != null) {
    if (!Number.isInteger(filters.bedrooms) || filters.bedrooms < 0 || filters.bedrooms > 20) throw new Error("Bedrooms must be an integer from 0 to 20.");
    where.bedrooms = { gte: filters.bedrooms };
  }
  if (minPrice || maxPrice) {
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) throw new Error("Minimum price cannot exceed maximum price.");
    where.price = { ...minPrice ? { gte: minPrice } : {}, ...maxPrice ? { lte: maxPrice } : {} };
  }
  if (and.length) where.AND = and;
  return where;
}
function publicImagePath(value) {
  const path = clean(value);
  return path.startsWith("/images/real-estate/") ? path : "";
}
function toPublicAgent(agent, brokerageId) {
  if (!agent || !(agent.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return null;
  return {
    name: agent.name || "",
    email: agent.email || "",
    phone: agent.phone || "",
    brokerageTitle: agent.brokerageTitle || "",
    imagePath: publicImagePath(agent.avatarUrl)
  };
}
function toPublicListing(property, media, openHouses) {
  return {
    id: property.id,
    title: property.title,
    slug: property.slug,
    status: property.status,
    listingType: property.listingType,
    propertyType: property.propertyType || "",
    shortDescription: property.shortDescription || "",
    description: property.description || "",
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 || "",
    city: property.city,
    state: property.state,
    postalCode: property.postalCode || "",
    neighborhood: property.neighborhood || "",
    price: String(property.price),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms == null ? "" : String(property.bathrooms),
    squareFeet: property.squareFeet,
    lotSizeSquareFeet: property.lotSizeSquareFeet,
    yearBuilt: property.yearBuilt,
    hoaFee: property.hoaFee == null ? "" : String(property.hoaFee),
    availableAt: property.availableAt || "",
    isFeatured: Boolean(property.isFeatured),
    virtualTourUrl: property.virtualTourUrl || "",
    imagePath: publicImagePath(property.primaryImageUrl),
    assignedAgent: toPublicAgent(property.assignedAgent, property.brokerage.id),
    openHouses: openHouses.map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      hostName: item.hostAgent?.name || ""
    })),
    media: media.map((item) => ({
      title: item.title,
      mediaType: item.mediaType,
      imagePath: publicImagePath(item.url),
      externalUrl: publicImagePath(item.url) ? "" : item.url,
      altText: item.altText || "",
      caption: item.caption || "",
      sortOrder: item.sortOrder || 0,
      isHero: Boolean(item.isHero)
    }))
  };
}
async function findPublicMedia(context, propertyId) {
  return context.sudo().query.PropertyMedia.findMany({
    where: { property: { id: { equals: propertyId } } },
    orderBy: [{ isHero: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: PUBLIC_LISTING_MEDIA_LIMIT,
    query: "title mediaType url altText caption sortOrder isHero"
  });
}
async function findPublicOpenHouses(context, propertyId, brokerageId) {
  return context.sudo().query.OpenHouse.findMany({
    where: {
      property: { id: { equals: propertyId } },
      status: { equals: "scheduled" },
      endsAt: { gte: (/* @__PURE__ */ new Date()).toISOString() }
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 10,
    query: "id title startsAt endsAt hostAgent { name brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }"
  }).then((items) => items.map((item) => ({
    ...item,
    hostAgent: (item.hostAgent?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active") ? item.hostAgent : null
  })));
}
async function hasPublicListingAuthority(context, property) {
  try {
    await requireListingAuthority(context, {
      brokerageId: property.brokerage.id,
      propertyId: property.id,
      practitionerId: property.assignedAgent?.id || "",
      jurisdictionCode: property.state,
      destination: "public_site"
    });
    return true;
  } catch (error) {
    if (error instanceof ListingAuthorityDeniedError) return false;
    throw error;
  }
}
async function publicRealEstateListings(_root, { brokerageSlug, filters = {}, take = 24, skip = 0 }, context) {
  const boundedTake = Number.isInteger(take) ? Math.min(Math.max(take, 1), 100) : 24;
  const boundedSkip = Number.isInteger(skip) ? Math.min(Math.max(skip, 0), 1e4) : 0;
  const where = buildPublicListingWhere(brokerageSlug, filters);
  const page = await collectEligiblePage({
    take: boundedTake,
    skip: boundedSkip,
    candidateBatchSize: PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
    candidateScanLimit: PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT,
    fetchCandidates: (candidateSkip, candidateTake) => context.sudo().query.Property.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: candidateTake,
      skip: candidateSkip,
      query: PUBLIC_LISTING_QUERY
    }),
    isEligible: (property) => hasPublicListingAuthority(context, property)
  });
  const listings = [];
  for (const property of page.items) {
    const [media, openHouses] = await Promise.all([
      findPublicMedia(context, property.id),
      findPublicOpenHouses(context, property.id, property.brokerage.id)
    ]);
    listings.push(toPublicListing(property, media, openHouses));
  }
  return listings;
}
async function publicRealEstateListing(_root, { brokerageSlug, slug }, context) {
  const properties = await context.sudo().query.Property.findMany({
    where: { ...buildPublicListingWhere(brokerageSlug), slug: { equals: clean(slug) } },
    take: 1,
    query: PUBLIC_LISTING_QUERY
  });
  const property = properties[0];
  if (!property) return null;
  if (!await hasPublicListingAuthority(context, property)) return null;
  const [media, openHouses] = await Promise.all([
    findPublicMedia(context, property.id),
    findPublicOpenHouses(context, property.id, property.brokerage.id)
  ]);
  return toPublicListing(property, media, openHouses);
}

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/lib/propertyLock.ts
async function lockPropertyForDecision(context, id, brokerageId) {
  if (!id || !brokerageId) throw new Error("Property scope is required.");
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "Property" WHERE "id" = $1 AND "brokerage" = $2 FOR NO KEY UPDATE', id, brokerageId);
}
async function lockAndRefreshProperty(context, id, brokerageId) {
  await lockPropertyForDecision(context, id, brokerageId);
  const property = await context.sudo().query.Property.findOne({ where: { id }, query: "id state brokerage { id } assignedAgent { id }" });
  if (!property || property.brokerage?.id !== brokerageId) throw new Error("Property is unavailable in the current brokerage.");
  return property;
}

// features/lib/date-time.ts
function commandText(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "";
  return String(value ?? "").trim();
}
function explicitDateTimeToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

// features/keystone/lib/showingReviewRevision.ts
async function showingReviewRevision(context, item) {
  const auditCount = await context.sudo().query.DomainAuditEvent.count({ where: {
    brokerage: { id: { equals: item.brokerage.id } },
    aggregateType: { equals: "showing" },
    aggregateId: { equals: item.id }
  } });
  if (!Number.isSafeInteger(auditCount) || auditCount < 0) throw new Error("Showing revision evidence is unavailable.");
  return domainPayloadHash({
    version: 1,
    id: item.id,
    brokerageId: item.brokerage.id,
    auditCount,
    status: item.status,
    updatedAt: item.updatedAt || null,
    showingType: item.showingType || null,
    scheduledStart: item.scheduledStart || null,
    scheduledEnd: item.scheduledEnd || null,
    assignedAgentId: item.assignedAgent?.id || null,
    leadId: item.lead?.id || null,
    propertyId: item.property?.id || null,
    notes: item.notes || "",
    feedback: item.feedback || ""
  });
}

// features/keystone/lib/showingAssociations.ts
var SHOWING_IDENTITY_QUERY = `id brokerage { id status } assignedAgent { id }
  lead { id brokerage { id status } } property { id brokerage { id status } }`;
function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
function tenantIdentity(value, brokerageId) {
  return record(value) && identifier(value.id) && record(value.brokerage) && value.brokerage.id === brokerageId && value.brokerage.status === "active";
}
function sameShowingIdentity(value, header) {
  return record(value) && value.id === header.id && tenantIdentity(value, header.brokerage.id) && tenantIdentity(value.lead, header.brokerage.id) && value.lead.id === header.lead.id && tenantIdentity(value.property, header.brokerage.id) && value.property.id === header.property.id && (value.assignedAgent === null ? header.assignedAgent === null : record(value.assignedAgent) && value.assignedAgent.id === header.assignedAgent?.id);
}
async function activeShowingAgent(context, agentId, brokerageId) {
  if (agentId === null) return true;
  if (!identifier(agentId)) return false;
  const user = await context.sudo().query.User.findOne({ where: { id: agentId }, query: `id
    brokerageMemberships(where: { status: { equals: active }, brokerage: { id: { equals: ${JSON.stringify(brokerageId)} }, status: { equals: active } } }, take: 1) { status brokerage { id status } }` });
  if (user?.id !== agentId || !Array.isArray(user.brokerageMemberships) || user.brokerageMemberships.length > 1) return false;
  return user.brokerageMemberships.some((membership) => record(membership) && membership.status === "active" && record(membership.brokerage) && membership.brokerage.id === brokerageId && membership.brokerage.status === "active");
}
async function scopedShowingIdentity(context, id, purpose = "showing") {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!identifier(id) || !session?.itemId || !brokerageId || !session.data.role?.canManageShowings) return null;
  const item = await context.sudo().query.Showing.findOne({ where: { id }, query: SHOWING_IDENTITY_QUERY });
  if (!record(item) || item.id !== id || !tenantIdentity(item, brokerageId) || !tenantIdentity(item.lead, brokerageId) || !tenantIdentity(item.property, brokerageId) || !(item.assignedAgent === null || record(item.assignedAgent) && identifier(item.assignedAgent.id))) return null;
  const header = item;
  if (purpose === "showing" && !session.data.role.canManagePeople && header.assignedAgent?.id !== session.itemId) return null;
  if (!await activeShowingAgent(context, header.assignedAgent?.id || null, brokerageId)) return null;
  return header;
}
async function scopedSchedulingIdentity(context, leadId, propertyId, requireCurrentInterest = true) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageShowings || !identifier(leadId) || !identifier(propertyId)) return null;
  const lead = await context.sudo().query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id status } assignedAgent { id } property { id }" });
  if (!record(lead) || lead.id !== leadId || !tenantIdentity(lead, brokerageId) || !(lead.assignedAgent === null || record(lead.assignedAgent) && identifier(lead.assignedAgent.id))) return null;
  if (!session.data.role.canManagePeople && record(lead.assignedAgent) && lead.assignedAgent.id !== session.itemId) return null;
  if (requireCurrentInterest && (!record(lead.property) || lead.property.id !== propertyId)) return null;
  const property = await context.sudo().query.Property.findOne({ where: { id: propertyId }, query: "id brokerage { id status }" });
  if (!tenantIdentity(property, brokerageId) || property.id !== propertyId) return null;
  return { lead, property, brokerageId };
}

// features/keystone/lib/showingEventScope.ts
function record2(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
var SHOWING_EVENT_HEADER_QUERY = "id eventKey eventType requestHash payloadHash aggregateType aggregateId brokerage { id }";
function showingEventPayloadMatches(header, event) {
  if (!record2(header) || !record2(event) || !record2(event.payload) || typeof header.payloadHash !== "string" || event.id !== header.id || event.requestHash !== header.requestHash || event.payloadHash !== header.payloadHash) return false;
  const payload = event.payload;
  if (!record2(header.brokerage) || !record2(event.brokerage) || !record2(payload.aggregate) || event.brokerage.id !== header.brokerage.id || payload.brokerageId !== header.brokerage.id || payload.eventKey !== header.eventKey || payload.eventType !== header.eventType || payload.aggregate.type !== header.aggregateType || payload.aggregate.id !== header.aggregateId) return false;
  try {
    return domainPayloadHash(payload) === header.payloadHash;
  } catch {
    return false;
  }
}
async function ownedShowingEventHeader(context, event, input) {
  const session = context.session;
  if (!session?.itemId || !record2(event) || event.eventKey !== input.eventKey || event.eventType !== input.eventType || typeof event.payloadHash !== "string" || !/^[a-f0-9]{64}$/.test(event.payloadHash) || event.aggregateType !== "showing" || typeof event.aggregateId !== "string" || !record2(event.brokerage)) return false;
  const header = await scopedShowingIdentity(context, event.aggregateId, input.purpose);
  if (!header || event.brokerage.id !== header.brokerage.id || input.leadId !== void 0 && header.lead.id !== input.leadId || input.propertyId !== void 0 && header.property.id !== input.propertyId) return false;
  const audit = await context.sudo().query.DomainAuditEvent.findOne({
    where: { eventKey: `${input.eventKey}:audit` },
    query: "id brokerage { id } actor { id } aggregateType aggregateId"
  });
  return Boolean(audit?.brokerage?.id === header.brokerage.id && audit.actor?.id === session.itemId && audit.aggregateType === "showing" && audit.aggregateId === header.id);
}

// features/keystone/mutations/showingJourney.ts
function showingScopeAllows(context, item) {
  const session = context.session;
  return Boolean(session?.itemId && session.data?.role?.canManageShowings && activeBrokerageIds(session).includes(item?.brokerage?.id) && (session.data.role.canManagePeople || item.assignedAgent?.id === session.itemId));
}
async function ownsShowingScheduleReceipt(scoped, event, leadId, propertyId) {
  const session = scoped.session;
  const payload = event?.payload;
  if (!session?.data?.role?.canManageShowings || payload?.actorId !== session?.itemId || event?.brokerage?.id !== activeBrokerageIds(session)[0] || payload?.brokerageId !== event.brokerage.id || payload?.eventType !== "showing.scheduled" || payload?.aggregate?.type !== "showing" || payload?.request?.leadId !== leadId || payload?.request?.propertyId !== propertyId || domainPayloadHash(payload.request) !== event.requestHash || payload?.result?.ok !== true || typeof payload.result.itemId !== "string" || !payload.result.itemId || payload.aggregate.id !== payload.result.itemId) return false;
  const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId, false);
  if (!identity || identity.brokerageId !== event.brokerage.id) return false;
  const showing = await scopedShowingIdentity(scoped, payload.result.itemId, "owned_receipt");
  return Boolean(showing && showing.lead.id === leadId && showing.property.id === propertyId);
}
function showingSnapshot(property, input, capturedAt) {
  return {
    version: 1,
    capturedAt,
    ...input,
    propertyId: property.id,
    listingTitle: property.title || "",
    listingSlug: property.slug || "",
    addressLine1: property.addressLine1 || "",
    city: property.city || "",
    state: property.state || "",
    listingType: property.listingType || "",
    price: property.price == null ? null : String(property.price),
    propertyUpdatedAt: property.updatedAt || null
  };
}
async function scheduledShowingReceipt(_root, { data }, context) {
  const session = context.session;
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null;
  const leadId = String(data.leadId || "").trim(), propertyId = String(data.propertyId || "").trim();
  const key = String(data.idempotencyKey || "").trim();
  if (!leadId || leadId.length > 200 || !propertyId || propertyId.length > 200 || !key || key.length > 120) return null;
  const request = {
    leadId,
    propertyId,
    assignedAgentId: String(data.assignedAgentId || "").trim(),
    scheduledStart: String(data.scheduledStart || "").trim(),
    notes: String(data.notes || "").trim(),
    ...data.originalActorId == null && data.originalBrokerageId == null ? {} : {
      originalActorId: String(data.originalActorId || "").trim(),
      originalBrokerageId: String(data.originalBrokerageId || "").trim()
    }
  };
  if (request.assignedAgentId.length > 200 || request.scheduledStart.length > 100 || request.notes.length > 5e3) return null;
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    if (request.originalActorId !== void 0 && (request.originalActorId !== scoped.session?.itemId || request.originalBrokerageId !== activeBrokerageIds(scoped.session)[0])) return null;
    if (!await scopedSchedulingIdentity(scoped, leadId, propertyId, false)) return null;
    const eventKey = `command:lead:${leadId}:schedule-showing:${key}`;
    const eventHeader = await scoped.sudo().query.DomainOutboxEvent.findOne({ where: { eventKey }, query: SHOWING_EVENT_HEADER_QUERY });
    if (!eventHeader || eventHeader.requestHash !== domainPayloadHash(request) || !await ownedShowingEventHeader(scoped, eventHeader, { eventKey, eventType: "showing.scheduled", purpose: "owned_receipt", leadId, propertyId })) return null;
    const event = await scoped.sudo().query.DomainOutboxEvent.findOne({
      where: { eventKey: `command:lead:${leadId}:schedule-showing:${key}` },
      query: "id requestHash payloadHash payload brokerage { id }"
    });
    if (!showingEventPayloadMatches(eventHeader, event) || event.requestHash !== domainPayloadHash(request) || !await ownsShowingScheduleReceipt(scoped, event, leadId, propertyId)) return null;
    const receipt = event.payload?.result?.receipt || (event.payload?.result?.ok === true ? {
      version: 1,
      showingId: event.payload.result.itemId,
      leadId: event.payload?.request?.leadId,
      propertyId: event.payload?.request?.propertyId
    } : null);
    if (event.payload?.result?.ok !== true || typeof receipt?.showingId !== "string" || !receipt.showingId.trim() || receipt.showingId.length > 200 || event.payload?.aggregate?.type !== "showing" || receipt.version !== 1 || receipt.leadId !== leadId || receipt.propertyId !== propertyId || receipt.showingId !== event.payload?.result?.itemId || event.payload?.aggregate?.id !== receipt.showingId) return null;
    const showing = await scopedShowingIdentity(scoped, receipt.showingId, "owned_receipt");
    if (!showing || showing.brokerage.id !== event.brokerage.id || showing.lead.id !== leadId || showing.property.id !== propertyId) return null;
    return { version: 1, showingId: showing.id, leadId, propertyId };
  }, { timeout: 3e4 });
}
var DETAIL_QUERY = `id status showingType scheduledStart scheduledEnd notes feedback createdAt updatedAt
  brokerage { id status } assignedAgent { id }
  property { id brokerage { id status } title slug addressLine1 city state price listingType }
  lead { id brokerage { id status } name email phone status intent }`;
async function scopedShowingPresentation(context, id) {
  const current = context.session;
  const header = await scopedShowingIdentity(context, id);
  if (!header) return null;
  const sudo = context.sudo();
  const item = (await sudo.query.Showing.findMany({
    where: { AND: [
      { id: { equals: id } },
      { brokerage: { id: { in: activeBrokerageIds(current) } } },
      { lead: { id: { equals: header.lead.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: "active" } } } },
      { property: { id: { equals: header.property.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: "active" } } } },
      ...!current.data.role.canManagePeople ? [{ assignedAgent: { id: { equals: current.itemId } } }] : []
    ] },
    take: 1,
    query: DETAIL_QUERY
  }))[0];
  if (!item || !sameShowingIdentity(item, header) || !showingScopeAllows(context, item)) return null;
  const profile = header.assignedAgent ? await context.query.User.findOne({
    where: { id: header.assignedAgent.id },
    query: "id name email phone"
  }) : null;
  if (profile && profile.id !== header.assignedAgent?.id) return null;
  const showing = {
    id: item.id,
    status: item.status,
    showingType: item.showingType,
    scheduledStart: item.scheduledStart,
    scheduledEnd: item.scheduledEnd,
    notes: item.notes,
    feedback: item.feedback,
    createdAt: item.createdAt,
    lead: { id: item.lead.id, name: item.lead.name, email: item.lead.email, phone: item.lead.phone, status: item.lead.status, intent: item.lead.intent },
    property: {
      id: item.property.id,
      title: item.property.title,
      slug: item.property.slug,
      addressLine1: item.property.addressLine1,
      city: item.property.city,
      state: item.property.state,
      price: item.property.price,
      listingType: item.property.listingType
    },
    assignedAgent: header.assignedAgent ? { id: header.assignedAgent.id, name: profile?.name || "", email: profile?.email || null, phone: profile?.phone || null } : null
  };
  return { header, item, showing };
}
async function platformShowingDetail(_root, { id, before }, context) {
  const session = context.session;
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null;
  if (!id || id.length > 200 || before && before.length > 200) throw new Error("Invalid showing/history identity.");
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const current = scoped.session;
    if (!current?.data?.role?.canManageShowings) return null;
    const view = await scopedShowingPresentation(scoped, id);
    if (!view) return null;
    const { item, showing } = view;
    const sudo = scoped.sudo();
    const where = { brokerage: { id: { equals: item.brokerage.id } }, aggregateType: { equals: "showing" }, aggregateId: { equals: id } };
    let anchor = null;
    if (before) {
      anchor = await sudo.query.DomainAuditEvent.findOne({ where: { id: before }, query: "id occurredAt brokerage { id } aggregateType aggregateId" });
      if (!anchor || anchor.brokerage?.id !== item.brokerage.id || anchor.aggregateType !== "showing" || anchor.aggregateId !== id) throw new Error("Invalid showing history cursor.");
    }
    const rows = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, ...anchor ? [{ OR: [
        { occurredAt: { lt: anchor.occurredAt } },
        { occurredAt: { equals: anchor.occurredAt }, id: { lt: anchor.id } }
      ] }] : []] },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 51,
      query: "id action occurredAt beforeState afterState"
    });
    const origins = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, { action: { in: ["request", "schedule"] } }] },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: 1,
      query: "afterState"
    });
    const snapshot = origins[0]?.afterState?.snapshot;
    const validSnapshot = snapshot?.version === 1 && snapshot.propertyId === item.property?.id && snapshot.leadId === item.lead?.id;
    return {
      showing,
      updatedAt: item.updatedAt,
      revision: await showingReviewRevision(scoped, item),
      snapshot: validSnapshot ? snapshot : null,
      history: rows.slice(0, 50).map((row) => ({
        id: row.id,
        action: row.action,
        occurredAt: row.occurredAt,
        fromStatus: row.beforeState?.status || null,
        toStatus: row.afterState?.status || null
      })),
      nextHistoryCursor: rows.length > 50 ? rows[49].id : null
    };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/leadCapture.ts
function normalizeLeadEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizeLeadPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length >= 7 ? national : "";
}
function leadIdentityKey(email, phone) {
  const normalizedEmail = normalizeLeadEmail(email);
  if (normalizedEmail) return `email:${normalizedEmail}`;
  const normalizedPhone = normalizeLeadPhone(phone);
  return normalizedPhone ? `phone:${normalizedPhone}` : null;
}
async function capturePublicLead(context, input) {
  const identityKey = leadIdentityKey(input.email, input.phone);
  if (!identityKey) throw new Error("A valid lead email or phone number is required.");
  const sudo = context.sudo();
  await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `public-lead:${input.propertyId}:${identityKey}`);
  const existing = await sudo.query.Lead.findMany({
    where: {
      identityKey: { equals: identityKey },
      property: { id: { equals: input.propertyId } },
      status: { notIn: ["closed", "lost"] }
    },
    orderBy: [{ createdAt: "asc" }],
    take: 1,
    query: "id status assignedAgent { id }"
  });
  if (existing[0]) return { lead: existing[0], reused: true, identityKey };
  const lead = await sudo.query.Lead.createOne({
    data: {
      identityKey,
      name: input.name,
      email: normalizeLeadEmail(input.email),
      phone: String(input.phone || "").trim(),
      intent: input.intent,
      source: input.source,
      status: input.status,
      message: input.message,
      property: { connect: { id: input.propertyId } },
      ...input.assignedAgentId ? { assignedAgent: { connect: { id: input.assignedAgentId } } } : {}
    },
    query: "id status assignedAgent { id }"
  });
  return { lead, reused: false, identityKey };
}

// features/keystone/mutations/requestPropertyShowing.ts
function clean2(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function validContact(email, phone) {
  const emailValid = !email || email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = !phone || phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  return emailValid && phoneValid && Boolean(email || phone);
}
function validDate(value) {
  const iso = explicitDateTimeToIso(value);
  return iso ? new Date(iso) : null;
}
async function findRoutingAgentId(context, property) {
  const rules2 = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: "active" }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: "asc" }],
    take: 50,
    query: "intent source city state postalCode isFallback assignedAgent { id }"
  });
  const matching = rules2.find(
    (rule) => rule.assignedAgent?.id && (!rule.intent || rule.intent === "any" || rule.intent === (property.listingType === "rent" ? "rent" : "buy")) && (!rule.source || rule.source === "any" || rule.source === "website") && (!rule.city || rule.city.toLowerCase() === property.city.toLowerCase()) && (!rule.state || rule.state.toLowerCase() === property.state.toLowerCase()) && (!rule.postalCode || rule.postalCode === property.postalCode)
  );
  const fallback = rules2.find((rule) => rule.isFallback && rule.assignedAgent?.id);
  return matching?.assignedAgent?.id || property.assignedAgent?.id || fallback?.assignedAgent?.id || null;
}
async function requestPropertyShowing(_root, { data }, context) {
  const brokerageSlug = clean2(data.brokerageSlug).toLowerCase();
  const propertyId = clean2(data.propertyId);
  const name = clean2(data.name);
  const email = clean2(data.email);
  const phone = clean2(data.phone);
  const requestedStart = validDate(clean2(data.requestedStart));
  const message = clean2(data.message);
  if (data.showingType && !["in_person", "virtual"].includes(data.showingType)) {
    return { ok: false, message: "Choose an in-person or virtual showing request.", leadId: null, showingId: null };
  }
  const showingType = data.showingType === "virtual" ? "virtual" : "in_person";
  const key = clean2(data.idempotencyKey);
  if (key && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) {
    return { ok: false, message: "A valid showing request key is required.", leadId: null, showingId: null };
  }
  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || !name || name.length > 120 || message.length > 5e3 || !validContact(email, phone) || !requestedStart) {
    return { ok: false, message: "Add a listing, valid requested time, name, and email or phone.", leadId: null, showingId: null };
  }
  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: "active" } }, take: 1, query: "id" });
  if (!brokerages[0]) return { ok: false, message: "This listing is unavailable.", leadId: null, showingId: null };
  return context.transaction(async (transactionContext) => {
    const context2 = transactionContext;
    await lockBrokerageCommand(context2, brokerages[0].id);
    await lockPropertyForDecision(context2, propertyId, brokerages[0].id);
    const customerId = context2.session?.itemId || null;
    if (customerId) {
      const customer = await context2.sudo().query.User.findOne({ where: { id: customerId }, query: "id activeBrokerage { id }" });
      if (customer?.activeBrokerage?.id !== brokerages[0].id) return { ok: false, message: "Sign in with an account for this brokerage.", leadId: null, showingId: null };
    }
    const request = { propertyId, name, email: email.toLowerCase(), phone, requestedStart: requestedStart.toISOString(), showingType, message, ...customerId ? { customerId } : {} };
    const eventKey = key ? `public-showing-intent:${brokerages[0].id}:${domainPayloadHash(key)}` : null;
    const requestReference = eventKey ? domainPayloadHash(eventKey) : null;
    if (eventKey) {
      const existing = await context2.sudo().query.DomainOutboxEvent.findOne({ where: { eventKey }, query: "id requestHash brokerage { id }" });
      if (existing) {
        if (existing.brokerage?.id !== brokerages[0].id || existing.requestHash !== domainPayloadHash(request)) {
          return { ok: false, message: "This request key was already used with different details. Contact the brokerage about the original request.", leadId: null, showingId: null };
        }
        return { ok: true, message: "Showing request already received. The advisor must still confirm availability.", leadId: null, showingId: null, requestReference };
      }
    }
    if (requestedStart.getTime() <= Date.now() || requestedStart.getTime() > Date.now() + 365 * 24 * 60 * 6e4) {
      return { ok: false, message: "Choose a requested showing time in the future.", leadId: null, showingId: null };
    }
    const properties = await context2.sudo().query.Property.findMany({
      where: {
        id: { equals: propertyId },
        brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } }
      },
      take: 1,
      query: "id title slug status listingType addressLine1 city state postalCode price updatedAt brokerage { id } assignedAgent { id }"
    });
    const property = properties[0];
    if (!property || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This listing is no longer accepting showing requests.", leadId: null, showingId: null };
    }
    try {
      await requireListingAuthority(context2, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || "", jurisdictionCode: property.state, destination: "public_site", showingRequired: true });
    } catch {
      return { ok: false, message: "This listing is not currently authorized for public showing requests.", leadId: null, showingId: null };
    }
    const settings = await context2.sudo().query.BrokerageSettings.findMany({
      where: { key: { in: [`${brokerageSlug}:primary`, ...brokerageSlug === "juniper-realty" ? ["primary"] : []] }, brokerage: { id: { equals: property.brokerage.id } } },
      take: 1,
      query: "showingDurationMinutes"
    });
    const duration = Math.min(Math.max(settings[0]?.showingDurationMinutes || 60, 15), 240);
    const scheduledEnd = new Date(requestedStart.getTime() + duration * 6e4);
    const immutableContext = [
      `Public showing request for ${property.title} (${property.slug}).`,
      `Requested start: ${requestedStart.toISOString()}.`,
      message ? `Customer note: ${message}` : ""
    ].filter(Boolean).join("\n");
    const assignedAgentId = await findRoutingAgentId(transactionContext, property);
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent: property.listingType === "rent" ? "rent" : "buy",
      source: "website",
      status: "new",
      message: immutableContext,
      propertyId: property.id,
      assignedAgentId
    });
    const exact = await transactionContext.sudo().query.Showing.findMany({
      where: {
        lead: { id: { equals: capture.lead.id } },
        property: { id: { equals: property.id } },
        scheduledStart: { equals: requestedStart.toISOString() },
        status: { in: ["requested", "scheduled"] },
        // Never attach or disclose another account's/guest's request by email.
        ...customerId ? { customer: { id: { equals: customerId } } } : { customer: null }
      },
      take: 1,
      query: "id"
    });
    if (exact.length) {
      if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
        eventKey,
        eventType: "showing.request_intent_received",
        brokerageId: property.brokerage.id,
        aggregateType: "showing",
        aggregateId: exact[0].id,
        action: "request_receipt",
        request,
        after: { requestReference, receiptState: "received", reusedShowing: true }
      });
      return { ok: true, message: "Showing request already received. The assigned agent will confirm availability.", leadId: null, showingId: null, ...eventKey ? { requestReference } : {} };
    }
    const recent = await transactionContext.sudo().query.Showing.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, createdAt: { gte: new Date(Date.now() - 60 * 6e4).toISOString() } },
      take: 5,
      query: "id"
    });
    if (recent.length >= 5) return { ok: false, message: "Unable to accept this request. Please contact the brokerage directly.", leadId: null, showingId: null };
    if (capture.reused) {
      await transactionContext.sudo().query.Lead.updateOne({
        where: { id: capture.lead.id },
        data: {
          ...!capture.lead.assignedAgent?.id && assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}
        },
        query: "id"
      });
    }
    const showing = await transactionContext.sudo().query.Showing.createOne({
      data: {
        status: "requested",
        showingType,
        scheduledStart: requestedStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        notes: immutableContext,
        ...customerId ? { customer: { connect: { id: customerId } } } : {},
        requestSnapshot: showingSnapshot(property, { leadId: capture.lead.id, assignedAgentId, scheduledStart: requestedStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), showingType, notes: message }, (/* @__PURE__ */ new Date()).toISOString()),
        property: { connect: { id: property.id } },
        lead: { connect: { id: capture.lead.id } },
        ...assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}
      },
      query: "id"
    });
    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        activityType: "showing_requested",
        direction: "inbound",
        channel: "website",
        subject: capture.reused ? "Repeat contact showing request received" : "Public showing request received",
        body: immutableContext,
        occurredAt: (/* @__PURE__ */ new Date()).toISOString(),
        lead: { connect: { id: capture.lead.id } },
        property: { connect: { id: property.id } },
        showing: { connect: { id: showing.id } },
        ...assignedAgentId ? { agent: { connect: { id: assignedAgentId } } } : {}
      },
      query: "id"
    });
    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-showing:${showing.id}`,
      eventType: "showing.requested",
      brokerageId: property.brokerage.id,
      aggregateType: "showing",
      aggregateId: showing.id,
      action: "request",
      request: { propertyId, requestedStart: requestedStart.toISOString(), showingType, identityKey: capture.identityKey },
      before: null,
      after: {
        leadId: capture.lead.id,
        showingId: showing.id,
        activityId: activity.id,
        reusedLead: capture.reused,
        status: "requested",
        snapshot: showingSnapshot(property, {
          leadId: capture.lead.id,
          assignedAgentId,
          scheduledStart: requestedStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          showingType,
          notes: message
        }, (/* @__PURE__ */ new Date()).toISOString())
      }
    });
    if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey,
      eventType: "showing.request_intent_received",
      brokerageId: property.brokerage.id,
      aggregateType: "showing",
      aggregateId: showing.id,
      action: "request_receipt",
      request,
      after: { requestReference, receiptState: "received" }
    });
    return {
      ok: true,
      ...eventKey ? { requestReference } : {},
      message: "Showing requested. The assigned agent will confirm the appointment.",
      leadId: null,
      showingId: null
    };
  }, { timeout: 3e4 });
}

// features/keystone/lib/leadBoardCursor.ts
var INVALID_LEAD_CURSOR = "Invalid, stale, or mismatched Lead page cursor.";
function leadCursorBinding(scope2) {
  return domainPayloadHash(scope2);
}
function encodeLeadCursor(row, binding) {
  if (!row.id || row.id.length > 200 || !Number.isFinite(new Date(row.at).getTime())) throw new Error(INVALID_LEAD_CURSOR);
  return Buffer.from(JSON.stringify({ version: 1, ...row, binding }), "utf8").toString("base64url");
}
function decodeLeadCursor(value, binding) {
  try {
    if (typeof value !== "string" || !value || value.length > 2048) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const row = parsed;
    if (row.version !== 1 || row.binding !== binding || typeof row.id !== "string" || !row.id || row.id.length > 200 || typeof row.at !== "string" || new Date(row.at).toISOString() !== row.at) throw new Error();
    return { id: row.id, at: row.at };
  } catch {
    throw new Error(INVALID_LEAD_CURSOR);
  }
}

// features/keystone/mutations/leadJourney.ts
var HEADER = "id brokerage { id status } assignedAgent { id } property { id brokerage { id status } } createdAt status";
function record3(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function actorScope(context) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageLeads) throw new Error("Lead workspace unavailable.");
  return { session, brokerageId, actorId: session.itemId, managesAll: Boolean(session.data.role.canManagePeople) };
}
function leadWhere(context) {
  const scope2 = actorScope(context);
  return {
    brokerage: { id: { equals: scope2.brokerageId }, status: { equals: "active" } },
    ...!scope2.managesAll ? { assignedAgent: { id: { equals: scope2.actorId } } } : {}
  };
}
async function validHeader(context, value) {
  const scope2 = actorScope(context);
  if (!tenantIdentity(value, scope2.brokerageId) || !record3(value) || typeof value.createdAt !== "string" || !Number.isFinite(new Date(value.createdAt).getTime()) || typeof value.status !== "string" || !(value.property === null || tenantIdentity(value.property, scope2.brokerageId)) || !(value.assignedAgent === null || record3(value.assignedAgent) && typeof value.assignedAgent.id === "string" && value.assignedAgent.id)) return null;
  const header = value;
  if (!scope2.managesAll && header.assignedAgent?.id !== scope2.actorId) return null;
  if (header.assignedAgent) {
    const agent = await context.sudo().query.User.findOne({ where: { id: header.assignedAgent.id }, query: `id
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(scope2.brokerageId)} } } }, take: 1) { brokerage { id status } }` });
    if (agent?.id !== header.assignedAgent.id || !Array.isArray(agent.brokerageMemberships) || agent.brokerageMemberships.length !== 1 || agent.brokerageMemberships[0]?.brokerage?.id !== scope2.brokerageId || agent.brokerageMemberships[0]?.brokerage?.status !== "active") return null;
  }
  return header;
}
async function scopedLeadHeader(context, id) {
  if (!id || id.length > 200) return null;
  const row = (await context.sudo().query.Lead.findMany({ where: { AND: [leadWhere(context), { id: { equals: id } }] }, take: 1, query: HEADER }))[0];
  if (row?.id !== id) return null;
  return validHeader(context, row);
}
async function privateLead(context, header) {
  const row = await context.query.Lead.findOne({ where: { id: header.id }, query: `id brokerage { id }
    name email phone status intent source message lastContactedAt createdAt updatedAt
    property { id title slug city state price listingType } assignedAgent { id name email } showingsCount` });
  if (!row || row.id !== header.id || row.brokerage?.id !== header.brokerage.id) throw new Error("Lead detail unavailable.");
  if (row.property && row.property.id !== header.property?.id) throw new Error("Lead detail unavailable.");
  if (row.assignedAgent && row.assignedAgent.id !== header.assignedAgent?.id) throw new Error("Lead detail unavailable.");
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    intent: row.intent,
    source: row.source,
    message: row.message,
    lastContactedAt: row.lastContactedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    property: row.property ? {
      id: row.property.id,
      title: row.property.title,
      slug: row.property.slug,
      city: row.property.city,
      state: row.property.state,
      price: row.property.price,
      listingType: row.property.listingType
    } : header.property ? { id: header.property.id, title: "", slug: null, city: null, state: null, price: null, listingType: null } : null,
    assignedAgent: row.assignedAgent ? { id: row.assignedAgent.id, name: row.assignedAgent.name, email: row.assignedAgent.email } : header.assignedAgent ? { id: header.assignedAgent.id, name: "", email: "" } : null,
    showingsCount: row.showingsCount,
    activities: [],
    activityAccess: actorScope(context).managesAll ? "available" : "restricted"
  };
}
var ACTIVITY_HEADER = "id occurredAt brokerage { id } lead { id } property { id brokerage { id status } } showing { id brokerage { id status } lead { id brokerage { id status } } property { id brokerage { id status } } } agent { id }";
function validActivityHeader(row, header, brokerageId) {
  return record3(row) && typeof row.id === "string" && Boolean(row.id) && typeof row.occurredAt === "string" && Number.isFinite(new Date(row.occurredAt).getTime()) && record3(row.brokerage) && row.brokerage.id === brokerageId && record3(row.lead) && row.lead.id === header.id && (row.property === null || tenantIdentity(row.property, brokerageId)) && (row.showing === null || tenantIdentity(row.showing, brokerageId) && record3(row.showing) && tenantIdentity(row.showing.lead, brokerageId) && row.showing.lead.id === header.id && tenantIdentity(row.showing.property, brokerageId) && (row.property === null || record3(row.property) && row.showing.property.id === row.property.id));
}
async function activities(context, header, take, before) {
  const scope2 = actorScope(context);
  if (!scope2.managesAll) return { items: [], nextCursor: null, access: "restricted" };
  const where = { brokerage: { id: { equals: scope2.brokerageId } }, lead: { id: { equals: header.id } } };
  const binding = leadCursorBinding({ purpose: "lead_activity", actor: scope2.actorId, brokerage: scope2.brokerageId, leadId: header.id, take });
  const cursor = before === void 0 ? null : decodeLeadCursor(before, binding);
  if (cursor) {
    const anchor = (await context.sudo().query.LeadActivity.findMany({ where: { AND: [where, { id: { equals: cursor.id }, occurredAt: { equals: cursor.at } }] }, take: 1, query: ACTIVITY_HEADER }))[0];
    if (anchor?.id !== cursor.id || !validActivityHeader(anchor, header, scope2.brokerageId)) throw new Error(INVALID_LEAD_CURSOR);
  }
  const rows = await context.sudo().query.LeadActivity.findMany({
    where: { AND: [where, ...cursor ? [{ OR: [
      { occurredAt: { lt: cursor.at } },
      { occurredAt: { equals: cursor.at }, id: { lt: cursor.id } }
    ] }] : []] },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
    query: ACTIVITY_HEADER
  });
  for (const row of rows) {
    if (!validActivityHeader(row, header, scope2.brokerageId)) throw new Error("Lead history unavailable.");
  }
  const items = [];
  for (const candidate of rows.slice(0, take)) {
    const row = await context.query.LeadActivity.findOne({ where: { id: candidate.id }, query: "id activityType direction channel subject body occurredAt brokerage { id } lead { id } agent { id name email }" });
    if (!row || row.id !== candidate.id || row.lead?.id !== header.id || row.brokerage?.id !== scope2.brokerageId || row.occurredAt !== candidate.occurredAt || row.agent && row.agent.id !== candidate.agent?.id) throw new Error("Lead history unavailable.");
    items.push({
      id: row.id,
      activityType: row.activityType,
      direction: row.direction,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      occurredAt: row.occurredAt,
      agent: row.agent ? { id: row.agent.id, name: row.agent.name, email: row.agent.email } : null
    });
  }
  const last = rows[Math.min(take, rows.length) - 1];
  return { items, nextCursor: rows.length > take && last ? encodeLeadCursor({ id: last.id, at: last.occurredAt }, binding) : null, access: "available" };
}
async function platformShowingRequestViewer(_root, _args, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const session = scoped.session;
    const brokerageId = activeBrokerageIds(session)[0];
    return session?.itemId && brokerageId && session.data.role?.canManageShowings ? { actorId: session.itemId, brokerageId } : null;
  }, { timeout: 3e4 });
}
async function platformLeadDetail(_root, { id, before }, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const scope2 = actorScope(scoped);
    const header = await scopedLeadHeader(scoped, id);
    if (!header) return null;
    const lead = await privateLead(scoped, header);
    const history = await activities(scoped, header, 50, before ?? void 0);
    return {
      lead: { ...lead, activities: history.items },
      activityAccess: history.access,
      nextActivityCursor: history.nextCursor,
      viewer: { actorId: scope2.actorId, brokerageId: scope2.brokerageId }
    };
  }, { timeout: 3e4 });
}
async function leadWorkspace(args, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const scope2 = actorScope(scoped), status = (args.status || "all").trim(), term = (args.q || "").trim();
    if (!["all", "new", "attempted_contact", "qualified", "tour_scheduled", "offer", "closed", "lost"].includes(status)) throw new Error("Lead workspace unavailable.");
    const after = args.after ?? void 0, before = args.before ?? void 0;
    if (term.length > 120 || after !== void 0 && before !== void 0) throw new Error(INVALID_LEAD_CURSOR);
    const take = Math.min(Math.max(Number(args.take) || 50, 1), 100);
    const filters = [leadWhere(scoped)];
    if (status !== "all") filters.push({ status: { equals: status } });
    if (term) filters.push({ OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { preferredLocation: { contains: term, mode: "insensitive" } }
    ] });
    const binding = leadCursorBinding({ purpose: "lead_board", actor: scope2.actorId, brokerage: scope2.brokerageId, managesAll: scope2.managesAll, status, term, take });
    const backward = before !== void 0;
    const encoded = after ?? before;
    const cursor = encoded === void 0 ? null : decodeLeadCursor(encoded, binding);
    if (cursor) {
      const anchor = (await scoped.sudo().query.Lead.findMany({ where: { AND: [...filters, { id: { equals: cursor.id }, createdAt: { equals: cursor.at } }] }, take: 1, query: HEADER }))[0];
      if (!anchor || !await validHeader(scoped, anchor)) throw new Error(INVALID_LEAD_CURSOR);
    }
    const boundary = cursor ? { OR: [
      { createdAt: { [backward ? "gt" : "lt"]: cursor.at } },
      { createdAt: { equals: cursor.at }, id: { [backward ? "gt" : "lt"]: cursor.id } }
    ] } : null;
    const rows = await scoped.sudo().query.Lead.findMany({
      where: { AND: [...filters, ...boundary ? [boundary] : []] },
      orderBy: [{ createdAt: backward ? "asc" : "desc" }, { id: backward ? "asc" : "desc" }],
      take: take + 1,
      query: HEADER
    });
    const selected = rows.slice(0, take);
    if (cursor && !selected.length) throw new Error(INVALID_LEAD_CURSOR);
    if (backward) selected.reverse();
    const items = [];
    for (const row of selected) {
      const header = await validHeader(scoped, row);
      if (!header) throw new Error("Lead workspace unavailable.");
      const lead = await privateLead(scoped, header);
      const history = await activities(scoped, header, 5);
      items.push({ ...lead, activities: history.items });
    }
    const sample = await scoped.query.Lead.findMany({ where: leadWhere(scoped), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 500, query: "id status identityKey" });
    const buckets = /* @__PURE__ */ new Map();
    for (const row of sample) if (row.identityKey && !["lost", "closed"].includes(row.status)) buckets.set(row.identityKey, [...buckets.get(row.identityKey) || [], row.id]);
    const duplicateGroups = [];
    for (const [key, ids] of [...buckets].filter(([, ids2]) => ids2.length > 1).slice(0, 12)) {
      const candidates = [];
      for (const id of ids) {
        const header = await scopedLeadHeader(scoped, id);
        if (!header) throw new Error("Duplicate scan unavailable.");
        const lead = await privateLead(scoped, header);
        candidates.push({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          source: lead.source,
          createdAt: lead.createdAt,
          assignedAgent: lead.assignedAgent,
          property: lead.property
        });
      }
      duplicateGroups.push({ key: `identity:${key.slice(0, 12)}`, reason: "Matching normalized contact identity", candidates });
    }
    const count = (status2) => sample.filter((row) => row.status === status2).length;
    const first = selected[0], last = selected[selected.length - 1];
    const hasNextPage = backward ? selected.length > 0 : rows.length > take;
    const hasPreviousPage = backward ? rows.length > take : Boolean(cursor && selected.length);
    return {
      items,
      duplicateGroups,
      stats: { total: sample.length, new: count("new"), qualified: count("qualified"), tourScheduled: count("tour_scheduled"), offer: count("offer") },
      viewer: { actorId: scope2.actorId, brokerageId: scope2.brokerageId },
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        nextCursor: hasNextPage && last ? encodeLeadCursor({ id: last.id, at: last.createdAt }, binding) : null,
        previousCursor: hasPreviousPage && first ? encodeLeadCursor({ id: first.id, at: first.createdAt }, binding) : null
      }
    };
  }, { timeout: 3e4 });
}

// features/platform/onboarding/lib/seed.json
var seed_default = {
  version: 1,
  vertical: "openfront-real-estate",
  description: "Dependency-ordered demo seed for a brokerage-owned real-estate runtime: agents, listings, lead routing, leads, showings, and deal pipeline.",
  templateModes: {
    minimal: "One agent, one active listing, one routing rule, one lead, one showing, and one deal for smoke/demo checks.",
    full: "Representative brokerage demo data across buyer, renter, seller, investor, showing, and pipeline workflows."
  },
  dependencyOrder: [
    "brokerages",
    "brokerageSettings",
    "roles",
    "agents",
    "brokerageMemberships",
    "properties",
    "routingRules",
    "leads",
    "leadActivities",
    "showings",
    "deals"
  ],
  sections: {
    brokerages: {
      listKey: "Brokerage",
      description: "Tenant root for Juniper Realty brokerage operations.",
      items: [
        {
          key: "juniper-realty",
          label: "Juniper Realty",
          templates: ["minimal", "full"],
          data: {
            name: "Juniper Realty",
            slug: "juniper-realty",
            status: "active",
            isPrimary: true
          }
        }
      ]
    },
    brokerageSettings: {
      listKey: "BrokerageSettings",
      description: "Persisted public and dashboard identity for Juniper Realty.",
      items: [
        {
          key: "primary",
          label: "Juniper Realty",
          templates: ["minimal", "full"],
          data: {
            brokerage: { connect: { $ref: "brokerages:juniper-realty" } },
            key: "primary",
            businessName: "Juniper Realty",
            marketLabel: "Austin brokerage",
            city: "Austin",
            state: "TX",
            tagline: "Residences across Austin, chosen with care.",
            description: "Boutique representation for buyers, renters, and sellers across Austin.",
            equalHousingNotice: "Equal housing opportunity.",
            publicPhone: "+1 512 555 0100",
            publicEmail: "hello@juniperrealty.local",
            showingDurationMinutes: 60,
            brandHue: 151
          }
        }
      ]
    },
    roles: {
      listKey: "Role",
      description: "Brokerage operator roles used by seeded agents.",
      items: [
        {
          key: "brokerage-admin",
          label: "Brokerage Admin",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Brokerage Admin",
            canSeeOtherPeople: true,
            canEditOtherPeople: true,
            canManagePeople: true,
            canManageRoles: true,
            canAccessDashboard: true,
            canManageListings: true,
            canManageLeads: true,
            canManageShowings: true,
            canManageDeals: true,
            canViewReports: true,
            canManageOnboarding: true
          }
        },
        {
          key: "listing-agent",
          label: "Listing Agent",
          templates: [
            "full"
          ],
          data: {
            name: "Listing Agent",
            canSeeOtherPeople: true,
            canEditOtherPeople: false,
            canManagePeople: false,
            canManageRoles: false,
            canAccessDashboard: true,
            canManageListings: true,
            canManageLeads: true,
            canManageShowings: true,
            canManageDeals: true,
            canViewReports: false,
            canManageOnboarding: false
          }
        },
        {
          key: "brokerage-analyst",
          label: "Brokerage Analyst",
          templates: [
            "full"
          ],
          data: {
            name: "Brokerage Analyst",
            canSeeOtherPeople: true,
            canEditOtherPeople: false,
            canManagePeople: false,
            canManageRoles: false,
            canAccessDashboard: true,
            canManageListings: false,
            canManageLeads: false,
            canManageShowings: false,
            canManageDeals: false,
            canViewReports: true,
            canManageOnboarding: false
          }
        }
      ]
    },
    agents: {
      listKey: "User",
      description: "Seeded brokerage agents. Passwords are local demo-only placeholders for a future runtime seed executor.",
      items: [
        {
          key: "maya-chen",
          label: "Maya Chen",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Maya Chen",
            email: "maya.chen@example.realestate.local",
            password: "OpenfrontDemo2026!",
            phone: "+1 512 555 0101",
            licenseNumber: "TX-RE-482901",
            brokerageTitle: "Managing Broker",
            bio: "Luxury listing specialist and speed-to-lead owner for web inquiries.",
            avatarUrl: "/images/real-estate/agents/maya-chen.svg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:juniper-realty"
              }
            },
            role: {
              connect: {
                $ref: "roles:brokerage-admin"
              }
            }
          }
        },
        {
          key: "omar-patel",
          label: "Omar Patel",
          templates: [
            "full"
          ],
          data: {
            name: "Omar Patel",
            email: "omar.patel@example.realestate.local",
            password: "OpenfrontDemo2026!",
            phone: "+1 512 555 0102",
            licenseNumber: "TX-RE-593144",
            brokerageTitle: "Buyer & Rental Specialist",
            bio: "First-time buyer and rental conversion specialist for Austin neighborhoods.",
            avatarUrl: "/images/real-estate/agents/omar-patel.svg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:juniper-realty"
              }
            },
            role: {
              connect: {
                $ref: "roles:listing-agent"
              }
            }
          }
        },
        {
          key: "evelyn-brooks",
          label: "Evelyn Brooks",
          templates: [
            "full"
          ],
          data: {
            name: "Evelyn Brooks",
            email: "evelyn.brooks@example.realestate.local",
            password: "OpenfrontDemo2026!",
            phone: "+1 512 555 0103",
            licenseNumber: "TX-RE-744209",
            brokerageTitle: "Listing Advisor",
            bio: "Seller intake, pricing strategy, and listing launch operations.",
            avatarUrl: "/images/real-estate/agents/evelyn-brooks.svg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:juniper-realty"
              }
            },
            role: {
              connect: {
                $ref: "roles:listing-agent"
              }
            }
          }
        }
      ]
    },
    brokerageMemberships: {
      listKey: "BrokerageMembership",
      description: "Active Juniper Realty memberships used for tenant-scoped sessions.",
      items: [
        {
          key: "maya-owner",
          label: "Maya Chen owner membership",
          templates: ["minimal", "full"],
          data: {
            membershipKey: "juniper-realty:maya.chen@example.realestate.local",
            brokerage: { connect: { $ref: "brokerages:juniper-realty" } },
            user: { connect: { $ref: "agents:maya-chen" } },
            membershipRole: "owner",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        },
        {
          key: "omar-agent",
          label: "Omar Patel agent membership",
          templates: ["full"],
          data: {
            membershipKey: "juniper-realty:omar.patel@example.realestate.local",
            brokerage: { connect: { $ref: "brokerages:juniper-realty" } },
            user: { connect: { $ref: "agents:omar-patel" } },
            membershipRole: "agent",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        },
        {
          key: "evelyn-agent",
          label: "Evelyn Brooks agent membership",
          templates: ["full"],
          data: {
            membershipKey: "juniper-realty:evelyn.brooks@example.realestate.local",
            brokerage: { connect: { $ref: "brokerages:juniper-realty" } },
            user: { connect: { $ref: "agents:evelyn-brooks" } },
            membershipRole: "agent",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        }
      ]
    },
    properties: {
      listKey: "Property",
      description: "Listing inventory for storefront search, listing detail pages, showing workflows, and deal pipeline demos.",
      items: [
        {
          key: "riverfront-loft-austin",
          label: "Riverfront Loft",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            title: "Riverfront Loft with Skyline Views",
            slug: "riverfront-loft-austin",
            status: "active",
            listingType: "sale",
            propertyType: "condo",
            shortDescription: "Turnkey downtown loft with river views, concierge access, and a walkable entertainment district.",
            description: "A bright two-bedroom residence with floor-to-ceiling glass, covered balcony, chef kitchen, secured parking, and an owner suite facing the river trail.",
            addressLine1: "1428 Water Street",
            addressLine2: "Unit 1704",
            city: "Austin",
            state: "TX",
            postalCode: "78701",
            neighborhood: "Rainey Street Historic District",
            latitude: "30.2568000",
            longitude: "-97.7383000",
            price: "825000.00",
            bedrooms: 2,
            bathrooms: "2.0",
            squareFeet: 1450,
            lotSizeSquareFeet: 0,
            yearBuilt: 2018,
            hoaFee: "684.00",
            availableAt: "2026-07-15T15:00:00.000Z",
            isFeatured: true,
            virtualTourUrl: "https://example.com/tours/riverfront-loft-austin",
            primaryImageUrl: "/images/real-estate/properties/riverfront-loft-austin.svg",
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "hill-country-estate",
          label: "Hill Country Estate",
          templates: [
            "full"
          ],
          data: {
            title: "Hill Country Estate on Two Acres",
            slug: "hill-country-estate",
            status: "active",
            listingType: "sale",
            propertyType: "house",
            shortDescription: "Private hilltop home with guest casita, pool, and panoramic sunset views.",
            description: "Designed for indoor-outdoor entertaining with limestone terraces, a detached guest casita, three-car garage, office, media room, and resort-style pool.",
            addressLine1: "8801 Mesa Ridge Drive",
            city: "Austin",
            state: "TX",
            postalCode: "78733",
            neighborhood: "Westlake Hills",
            latitude: "30.3152000",
            longitude: "-97.8870000",
            price: "1450000.00",
            bedrooms: 5,
            bathrooms: "4.5",
            squareFeet: 4210,
            lotSizeSquareFeet: 87120,
            yearBuilt: 2015,
            hoaFee: "225.00",
            availableAt: "2026-08-01T15:00:00.000Z",
            isFeatured: true,
            virtualTourUrl: "https://example.com/tours/hill-country-estate",
            primaryImageUrl: "/images/real-estate/properties/hill-country-estate.svg",
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "eastside-townhome-rental",
          label: "Eastside Townhome Rental",
          templates: [
            "full"
          ],
          data: {
            title: "Eastside Townhome Near Coffee Row",
            slug: "eastside-townhome-rental",
            status: "coming_soon",
            listingType: "rent",
            propertyType: "townhome",
            shortDescription: "Low-maintenance townhome minutes from transit, restaurants, and the lake trail.",
            description: "Three-level townhome with rooftop deck, attached garage, dedicated office nook, and pet-friendly lease terms.",
            addressLine1: "2409 East 6th Street",
            city: "Austin",
            state: "TX",
            postalCode: "78702",
            neighborhood: "East Cesar Chavez",
            latitude: "30.2601000",
            longitude: "-97.7170000",
            price: "3800.00",
            bedrooms: 3,
            bathrooms: "2.5",
            squareFeet: 1825,
            lotSizeSquareFeet: 1400,
            yearBuilt: 2021,
            availableAt: "2026-08-15T15:00:00.000Z",
            isFeatured: false,
            virtualTourUrl: "https://example.com/tours/eastside-townhome-rental",
            primaryImageUrl: "/images/real-estate/properties/eastside-townhome-rental.svg",
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "mueller-bungalow",
          label: "Mueller Bungalow",
          templates: [
            "full"
          ],
          data: {
            title: "Updated Bungalow Near Mueller Lake",
            slug: "mueller-bungalow",
            status: "pending",
            listingType: "sale",
            propertyType: "house",
            shortDescription: "Charming renovated bungalow with ADU potential and walkable parks.",
            description: "Restored 1940s bungalow with updated systems, screened porch, mature pecan trees, and a detached studio foundation ready for expansion.",
            addressLine1: "4112 Threadgill Avenue",
            city: "Austin",
            state: "TX",
            postalCode: "78723",
            neighborhood: "Mueller",
            latitude: "30.2986000",
            longitude: "-97.7052000",
            price: "645000.00",
            bedrooms: 3,
            bathrooms: "2.0",
            squareFeet: 1560,
            lotSizeSquareFeet: 6250,
            yearBuilt: 1948,
            availableAt: "2026-07-30T15:00:00.000Z",
            isFeatured: false,
            primaryImageUrl: "/images/real-estate/properties/mueller-bungalow.svg",
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        }
      ]
    },
    routingRules: {
      listKey: "LeadRoutingRule",
      description: "Lead assignment rules by intent, source, and geography.",
      items: [
        {
          key: "austin-buyer-web-leads",
          label: "Austin Buyer Web Leads",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Austin buyer web leads",
            status: "active",
            priority: 10,
            intent: "buy",
            source: "website",
            city: "Austin",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "rental-leads",
          label: "Rental Leads",
          templates: [
            "full"
          ],
          data: {
            name: "Austin rental leads",
            status: "active",
            priority: 20,
            intent: "rent",
            source: "any",
            city: "Austin",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "seller-referrals",
          label: "Seller Referrals",
          templates: [
            "full"
          ],
          data: {
            name: "Seller referral intake",
            status: "active",
            priority: 30,
            intent: "sell",
            source: "referral",
            city: "",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        },
        {
          key: "brokerage-fallback",
          label: "Brokerage Fallback",
          templates: [
            "full"
          ],
          data: {
            name: "Brokerage fallback",
            status: "active",
            priority: 900,
            intent: "any",
            source: "any",
            city: "",
            state: "",
            postalCode: "",
            isFallback: true,
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    leads: {
      listKey: "Lead",
      description: "Buyer, renter, seller, and investor leads for CRM queues and reporting.",
      items: [
        {
          key: "sofia-ramirez",
          label: "Sofia Ramirez",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Sofia Ramirez",
            email: "sofia.ramirez@example.com",
            phone: "+1 512 555 0201",
            status: "qualified",
            intent: "buy",
            source: "website",
            budgetMin: "750000",
            budgetMax: "900000",
            preferredLocation: "Downtown Austin, riverfront",
            timeline: "30-45 days",
            message: "Interested in the Riverfront Loft and comparable downtown condos with balcony views.",
            lastContactedAt: "2026-07-08T15:30:00.000Z",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-lee",
          label: "Jordan Lee",
          templates: [
            "full"
          ],
          data: {
            name: "Jordan Lee",
            email: "jordan.lee@example.com",
            phone: "+1 512 555 0202",
            status: "new",
            intent: "rent",
            source: "website",
            budgetMin: "3200",
            budgetMax: "4200",
            preferredLocation: "East Austin",
            timeline: "Move in by September",
            message: "Needs a pet-friendly rental with a garage and office space.",
            lastContactedAt: "2026-07-08T16:15:00.000Z",
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "priya-shah",
          label: "Priya Shah",
          templates: [
            "full"
          ],
          data: {
            name: "Priya Shah",
            email: "priya.shah@example.com",
            phone: "+1 512 555 0203",
            status: "attempted_contact",
            intent: "sell",
            source: "referral",
            budgetMin: null,
            budgetMax: null,
            preferredLocation: "Mueller",
            timeline: "List in 60 days",
            message: "Referral from a past client; wants pricing strategy for a Mueller bungalow.",
            lastContactedAt: "2026-07-07T18:00:00.000Z",
            property: {
              connect: {
                $ref: "properties:mueller-bungalow"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        },
        {
          key: "marcus-green",
          label: "Marcus Green",
          templates: [
            "full"
          ],
          data: {
            name: "Marcus Green",
            email: "marcus.green@example.com",
            phone: "+1 512 555 0204",
            status: "tour_scheduled",
            intent: "invest",
            source: "zillow",
            budgetMin: "1200000",
            budgetMax: "1600000",
            preferredLocation: "West Austin",
            timeline: "This quarter",
            message: "Evaluating luxury rental yield and long-term appreciation near Westlake.",
            lastContactedAt: "2026-07-08T14:00:00.000Z",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    leadActivities: {
      listKey: "LeadActivity",
      description: "Timeline entries that make the lead command center useful immediately after seeding.",
      items: [
        {
          key: "sofia-inquiry",
          label: "Sofia inquiry captured",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            activityType: "inquiry",
            direction: "inbound",
            channel: "website",
            subject: "Listing inquiry",
            body: "Sofia requested a showing for the Riverfront Loft from the public listing page.",
            occurredAt: "2026-07-08T14:55:00.000Z",
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            agent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-rental-note",
          label: "Jordan rental note",
          templates: [
            "full"
          ],
          data: {
            activityType: "note",
            direction: "internal",
            channel: "crm",
            subject: "Rental criteria logged",
            body: "Needs a three-bedroom rental, accepts rooftop stairs, and prefers East Austin restaurants nearby.",
            occurredAt: "2026-07-08T16:20:00.000Z",
            lead: {
              connect: {
                $ref: "leads:jordan-lee"
              }
            },
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            agent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "marcus-showing-scheduled",
          label: "Marcus showing scheduled",
          templates: [
            "full"
          ],
          data: {
            activityType: "showing_scheduled",
            direction: "outbound",
            channel: "email",
            subject: "Estate tour confirmed",
            body: "Confirmed private tour for Saturday morning with investment analysis follow-up.",
            occurredAt: "2026-07-08T14:05:00.000Z",
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            agent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    showings: {
      listKey: "Showing",
      description: "Tour schedule and feedback data for the showings board.",
      items: [
        {
          key: "sofia-riverfront-tour",
          label: "Sofia Riverfront Loft Tour",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            status: "scheduled",
            showingType: "in_person",
            scheduledStart: "2026-07-10T20:00:00.000Z",
            scheduledEnd: "2026-07-10T20:45:00.000Z",
            notes: "Meet in lobby; client cares most about noise level and parking access.",
            feedback: "",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-eastside-preview",
          label: "Jordan Eastside Rental Preview",
          templates: [
            "full"
          ],
          data: {
            status: "requested",
            showingType: "virtual",
            scheduledStart: "2026-07-11T17:30:00.000Z",
            scheduledEnd: "2026-07-11T18:00:00.000Z",
            notes: "Send FaceTime walkthrough link after owner approves pre-market showing.",
            feedback: "",
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            lead: {
              connect: {
                $ref: "leads:jordan-lee"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "marcus-hill-country-tour",
          label: "Marcus Hill Country Tour",
          templates: [
            "full"
          ],
          data: {
            status: "completed",
            showingType: "in_person",
            scheduledStart: "2026-07-06T16:00:00.000Z",
            scheduledEnd: "2026-07-06T17:15:00.000Z",
            notes: "Private showing with rental pro-forma packet.",
            feedback: "Interested if seller will include furniture package and short-term-rental projections.",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    deals: {
      listKey: "Deal",
      description: "Pipeline cards for buyer, seller, and investor follow-through.",
      items: [
        {
          key: "sofia-riverfront-offer",
          label: "Sofia Riverfront Offer",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            title: "Sofia Ramirez \xB7 Riverfront Loft",
            stage: "offer_drafted",
            transactionType: "buyer",
            offerAmount: "805000.00",
            commissionAmount: "24150.00",
            expectedCloseDate: "2026-08-18T15:00:00.000Z",
            nextStep: "Review HOA docs and submit strongest-and-best offer after tour.",
            notes: "Client is pre-approved and can close quickly if parking terms are acceptable.",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "marcus-hill-country-investment",
          label: "Marcus Hill Country Investment",
          templates: [
            "full"
          ],
          data: {
            title: "Marcus Green \xB7 Hill Country Estate",
            stage: "active_search",
            transactionType: "buyer",
            offerAmount: "1375000.00",
            commissionAmount: "41250.00",
            expectedCloseDate: "2026-09-01T15:00:00.000Z",
            nextStep: "Send short-term-rental restrictions summary and furniture package estimate.",
            notes: "Investor wants cap-rate confidence before drafting offer.",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "priya-mueller-listing",
          label: "Priya Mueller Listing Prep",
          templates: [
            "full"
          ],
          data: {
            title: "Priya Shah \xB7 Mueller Listing Prep",
            stage: "prospecting",
            transactionType: "seller",
            offerAmount: "645000.00",
            commissionAmount: "19350.00",
            expectedCloseDate: "2026-10-15T15:00:00.000Z",
            nextStep: "Schedule valuation consult and prepare pricing packet.",
            notes: "Potential seller lead; property is represented as pending sample inventory until listing agreement is signed.",
            property: {
              connect: {
                $ref: "properties:mueller-bungalow"
              }
            },
            lead: {
              connect: {
                $ref: "leads:priya-shah"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        }
      ]
    }
  },
  imagePack: {
    description: "Canonical public image paths for seeded real-estate demo records. These are relative public assets; no uploads are required.",
    properties: [
      {
        key: "riverfront-loft-austin",
        imagePath: "/images/real-estate/properties/riverfront-loft-austin.svg"
      },
      {
        key: "hill-country-estate",
        imagePath: "/images/real-estate/properties/hill-country-estate.svg"
      },
      {
        key: "eastside-townhome-rental",
        imagePath: "/images/real-estate/properties/eastside-townhome-rental.svg"
      },
      {
        key: "mueller-bungalow",
        imagePath: "/images/real-estate/properties/mueller-bungalow.svg"
      }
    ],
    agents: [
      {
        key: "maya-chen",
        imagePath: "/images/real-estate/agents/maya-chen.svg"
      },
      {
        key: "omar-patel",
        imagePath: "/images/real-estate/agents/omar-patel.svg"
      },
      {
        key: "evelyn-brooks",
        imagePath: "/images/real-estate/agents/evelyn-brooks.svg"
      }
    ],
    neighborhoods: [
      {
        key: "rainey-street",
        name: "Rainey Street Historic District",
        imagePath: "/images/real-estate/neighborhoods/rainey-street.svg"
      },
      {
        key: "westlake-hills",
        name: "Westlake Hills",
        imagePath: "/images/real-estate/neighborhoods/westlake-hills.svg"
      },
      {
        key: "east-cesar-chavez",
        name: "East Cesar Chavez",
        imagePath: "/images/real-estate/neighborhoods/east-cesar-chavez.svg"
      },
      {
        key: "mueller",
        name: "Mueller",
        imagePath: "/images/real-estate/neighborhoods/mueller.svg"
      }
    ]
  }
};

// features/platform/onboarding/lib/expansion-seed.json
var expansion_seed_default = {
  version: 1,
  description: "Idempotent operations data pack layered onto the core Openfront Estates brokerage seed.",
  anchors: {
    brokerageSlug: "juniper-realty",
    agentEmail: "maya.chen@example.realestate.local",
    propertySlug: "riverfront-loft-austin",
    leadEmail: "sofia.ramirez@example.com",
    dealTitle: "Sofia Ramirez \xB7 Riverfront Loft",
    showingNotes: "Meet in lobby; client cares most about noise level and parking access."
  },
  records: [
    {
      listKey: "Neighborhood",
      id: "seed-neighborhood-downtown-harbor",
      data: {
        name: "Downtown Harbor",
        slug: "downtown-harbor",
        city: "Austin",
        state: "TX",
        overview: "Walkable waterfront district with mixed-use residences and strong buyer demand.",
        schoolDistrict: "Austin Independent School District",
        walkScore: 91,
        transitScore: 72,
        medianSalePrice: "925000.00",
        medianRent: "4200.00",
        activeListings: 18,
        averageDaysOnMarket: 21
      }
    },
    {
      listKey: "PropertyMedia",
      id: "seed-media-harbor-hero",
      lookup: { title: "Riverfront Loft Hero Photo" },
      data: {
        title: "Riverfront Loft Hero Photo",
        mediaType: "photo",
        url: "/images/real-estate/properties/riverfront-loft-austin.svg",
        altText: "Editorial illustration of the Riverfront Loft residence",
        caption: "Repository-owned hero asset for the Riverfront Loft listing.",
        sortOrder: 1,
        isHero: true,
        property: { $anchor: "property" }
      }
    },
    {
      listKey: "PropertyInspection",
      id: "seed-inspection-harbor-general",
      lookup: { title: "General Inspection - Riverfront Loft" },
      data: {
        title: "General Inspection - Riverfront Loft",
        inspectionType: "general",
        status: "completed",
        scheduledAt: "2026-06-28T18:56:48.359Z",
        completedAt: "2026-06-29T18:56:48.359Z",
        inspectorName: "Marta Ruiz",
        inspectorEmail: "marta.inspect@example.realestate.local",
        estimatedCost: "650.00",
        summary: "Overall good condition with a minor HVAC service recommendation.",
        findings: "HVAC filter overdue; balcony railing has cosmetic wear.",
        property: { $anchor: "property" },
        deal: { $anchor: "deal" }
      }
    },
    {
      listKey: "Offer",
      id: "seed-offer-harbor-001",
      data: {
        offerNumber: "OFFER-HARBOR-001",
        status: "accepted",
        amount: "910000.00",
        earnestMoney: "25000.00",
        financingType: "conventional",
        contingencies: "Inspection and financing contingencies with a 21-day close.",
        submittedAt: "2026-06-24T18:56:48.359Z",
        responseDueAt: "2026-06-26T18:56:48.359Z",
        acceptedAt: "2026-06-27T18:56:48.359Z",
        acceptedSnapshot: {
          version: 1,
          capturedAt: "2026-06-27T18:56:48.359Z",
          offerNumber: "OFFER-HARBOR-001",
          amount: "910000.00",
          earnestMoney: "25000.00",
          financingType: "conventional",
          contingencies: "Inspection and financing contingencies with a 21-day close.",
          submittedAt: "2026-06-24T18:56:48.359Z",
          responseDueAt: "2026-06-26T18:56:48.359Z",
          property: {
            title: "Riverfront Loft with Skyline Views",
            slug: "riverfront-loft-austin",
            addressLine1: "1428 Water Street",
            city: "Austin",
            state: "TX"
          },
          deal: { title: "Sofia Ramirez \xB7 Riverfront Loft" },
          lead: { name: "Sofia Ramirez", email: "sofia.ramirez@example.com" },
          assignedAgent: { name: "Maya Chen" }
        },
        property: { $anchor: "property" },
        deal: { $anchor: "deal" },
        lead: { $anchor: "lead" },
        assignedAgent: { $anchor: "agent" }
      }
    },
    {
      listKey: "DealDocument",
      id: "seed-doc-harbor-disclosure",
      lookup: { title: "Riverfront Loft Seller Disclosure" },
      data: {
        title: "Riverfront Loft Seller Disclosure",
        documentType: "disclosure",
        status: "signed",
        fileUrl: "/documents/real-estate/riverfront-loft-disclosure.pdf",
        requiresSignature: true,
        sentAt: "2026-06-25T18:56:48.359Z",
        signedAt: "2026-06-26T18:56:48.359Z",
        expiresAt: "2026-09-06T18:56:48.359Z",
        notes: "Signed seller disclosure package.",
        deal: { $anchor: "deal" },
        property: { $anchor: "property" },
        uploadedBy: { $anchor: "agent" }
      }
    },
    {
      listKey: "Commission",
      id: "seed-commission-harbor-buy-side",
      lookup: { title: "Riverfront Loft Buyer Side Commission" },
      data: {
        title: "Riverfront Loft Buyer Side Commission",
        status: "approved",
        side: "buyer",
        grossCommission: "27300.00",
        brokerageSplitPercent: "30.00",
        agentSplitPercent: "70.00",
        netCommission: "19110.00",
        notes: "Projected buyer-side commission split.",
        deal: { $anchor: "deal" },
        property: { $anchor: "property" },
        agent: { $anchor: "agent" }
      }
    },
    {
      listKey: "SavedSearch",
      id: "seed-saved-search-downtown-condos",
      lookup: { name: "Downtown Austin residences under 1M" },
      data: {
        name: "Downtown Austin residences under 1M",
        city: "Austin",
        state: "TX",
        propertyType: "Condo",
        minPrice: "650000.00",
        maxPrice: "1000000.00",
        minBedrooms: 2,
        minBathrooms: "2.0",
        minSquareFeet: 900,
        keywords: "waterfront, walkable, balcony",
        alertsEnabled: true,
        lastNotifiedAt: "2026-07-07T18:56:48.359Z",
        brokerage: { $anchor: "brokerage" },
        user: { $anchor: "agent" }
      }
    },
    {
      listKey: "MarketComp",
      id: "seed-comp-waterfront-12b",
      lookup: { addressLine1: "1200 Waterfront Avenue #12B" },
      data: {
        addressLine1: "1200 Waterfront Avenue #12B",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        status: "sold",
        listPrice: "899000.00",
        salePrice: "912000.00",
        soldAt: "2026-05-24T18:56:48.359Z",
        bedrooms: 2,
        bathrooms: "2.0",
        squareFeet: 1120,
        distanceMiles: "0.40",
        sourceUrl: "/listings/riverfront-loft-austin",
        notes: "Closest recent sale in the same waterfront micro-market.",
        subjectProperty: { $anchor: "property" },
        neighborhood: { $record: "seed-neighborhood-downtown-harbor" }
      }
    },
    {
      listKey: "AgentTeam",
      id: "seed-agent-team-harbor",
      data: {
        brokerage: { $anchor: "brokerage" },
        name: "Waterfront Buyer Team",
        slug: "waterfront-buyer-team",
        teamType: "buyer",
        status: "active",
        description: "Buyer agents focused on downtown and waterfront residences.",
        leadAgent: { $anchor: "agent" }
      }
    },
    {
      listKey: "AgentTask",
      id: "seed-agent-task-title-followup",
      lookup: { title: "Confirm title exceptions cleared" },
      data: {
        title: "Confirm title exceptions cleared",
        status: "in_progress",
        priority: "high",
        dueAt: "2026-07-10T18:56:48.359Z",
        notes: "Call the title officer and update the closing checklist.",
        assignedAgent: { $anchor: "agent" },
        property: { $anchor: "property" },
        lead: { $anchor: "lead" },
        deal: { $anchor: "deal" }
      }
    },
    {
      listKey: "ListingSyndication",
      id: "seed-syndication-harbor-mls",
      lookup: { externalListingId: "MLS-HARBOR-001" },
      data: {
        channel: "mls",
        property: { $anchor: "property" },
        status: "published",
        externalListingId: "MLS-HARBOR-001",
        listingUrl: "/listings/riverfront-loft-austin",
        publishedAt: "2026-06-18T18:56:48.359Z",
        lastSyncedAt: "2026-07-08T17:56:48.359Z",
        errorMessage: "",
        metadata: { feed: "local-reso" }
      }
    },
    {
      listKey: "SourceFeed",
      id: "seed-sourcefeed-austin-reso",
      lookup: { name: "Austin RESO Feed" },
      data: {
        name: "Austin RESO Feed",
        provider: "Austin Board of REALTORS",
        feedType: "reso",
        status: "active",
        lastImportedAt: "2026-07-08T18:26:48.359Z",
        recordsImported: 128,
        credentials: { mode: "local-runtime" },
        metadata: { region: "Austin" },
        brokerage: { $anchor: "brokerage" }
      }
    },
    {
      listKey: "OpenHouse",
      id: "seed-openhouse-harbor-saturday",
      lookup: { title: "Saturday Riverfront Loft Open House" },
      data: {
        title: "Saturday Riverfront Loft Open House",
        property: { $anchor: "property" },
        hostAgent: { $anchor: "agent" },
        status: "completed",
        startsAt: "2026-07-02T18:56:48.359Z",
        endsAt: "2026-07-02T20:56:48.359Z",
        attendeeCount: 18,
        notes: "Strong traffic; two repeat visitors requested disclosures.",
        metadata: { weather: "sunny" }
      }
    },
    {
      listKey: "ShowingFeedback",
      id: "seed-feedback-harbor-showing",
      lookup: { showing: { $anchor: "showing" } },
      data: {
        showing: { $anchor: "showing" },
        lead: { $anchor: "lead" },
        property: { $anchor: "property" },
        rating: 5,
        interestLevel: "offer_likely",
        comments: "Loved the balcony and walkability; requested the HOA documents.",
        priceOpinion: "905000.00",
        followUpRequired: true,
        metadata: { source: "agent_app" }
      }
    },
    {
      listKey: "Escrow",
      id: "seed-escrow-harbor",
      data: {
        escrowNumber: "ESC-HARBOR-001",
        deal: { $anchor: "deal" },
        property: { $anchor: "property" },
        status: "pending",
        escrowCompany: "Lone Star Escrow",
        officerName: "Nina Patel",
        officerEmail: "nina.escrow@example.realestate.local",
        openedAt: "2026-06-27T18:56:48.359Z",
        scheduledCloseAt: "2026-07-18T18:56:48.359Z",
        depositAmount: "25000.00",
        metadata: { branch: "downtown" }
      }
    },
    {
      listKey: "TitleOrder",
      id: "seed-title-harbor",
      data: {
        orderNumber: "TITLE-HARBOR-001",
        deal: { $anchor: "deal" },
        property: { $anchor: "property" },
        titleCompany: "Austin Title Company",
        status: "in_review",
        orderedAt: "2026-06-28T18:56:48.359Z",
        exceptions: "Pending HOA lien release confirmation.",
        metadata: { escrow: "seed-escrow-harbor" }
      }
    },
    {
      listKey: "MortgageApplication",
      id: "seed-mortgage-harbor",
      data: {
        applicationNumber: "MORT-HARBOR-001",
        deal: { $anchor: "deal" },
        lead: { $anchor: "lead" },
        lenderName: "Austin Community Credit Union",
        status: "underwriting",
        loanAmount: "728000.00",
        interestRate: "6.375",
        submittedAt: "2026-06-29T18:56:48.359Z",
        metadata: { loanType: "conventional" }
      }
    },
    {
      listKey: "TransactionMilestone",
      id: "seed-milestone-harbor-title",
      lookup: { name: "Title review complete" },
      data: {
        name: "Title review complete",
        deal: { $anchor: "deal" },
        status: "in_progress",
        dueAt: "2026-07-11T18:56:48.359Z",
        assignedTo: { $anchor: "agent" },
        sortOrder: 30,
        notes: "Waiting on HOA lien release confirmation.",
        metadata: { escrowId: "seed-escrow-harbor" }
      }
    },
    {
      listKey: "PropertyValuation",
      id: "seed-valuation-harbor-cma",
      data: {
        valuationNumber: "VAL-HARBOR-001",
        property: { $anchor: "property" },
        valuationType: "cma",
        lowValue: "885000.00",
        estimatedValue: "915000.00",
        highValue: "940000.00",
        performedBy: { $anchor: "agent" },
        valuedAt: "2026-06-20T18:56:48.359Z",
        notes: "CMA based on three waterfront residence comps.",
        metadata: { compCount: 3 }
      }
    },
    {
      listKey: "Disclosure",
      id: "seed-disclosure-harbor-hoa",
      lookup: { title: "HOA Disclosure Packet" },
      data: {
        title: "HOA Disclosure Packet",
        property: { $anchor: "property" },
        deal: { $anchor: "deal" },
        disclosureType: "hoa",
        status: "acknowledged",
        documentUrl: "/documents/real-estate/riverfront-loft-hoa.pdf",
        sentAt: "2026-06-30T18:56:48.359Z",
        acknowledgedAt: "2026-07-01T18:56:48.359Z",
        metadata: { pages: 42 }
      }
    },
    {
      listKey: "SavedSearchAlert",
      id: "seed-alert-downtown-condos",
      lookup: { savedSearch: { $record: "seed-saved-search-downtown-condos" } },
      data: {
        savedSearch: { $record: "seed-saved-search-downtown-condos" },
        user: { $anchor: "agent" },
        status: "active",
        cadence: "daily",
        lastSentAt: "2026-07-07T18:56:48.359Z",
        sentCount: 7,
        metadata: { lastMatch: "seed-media-harbor-hero" }
      }
    }
  ]
};

// features/platform/onboarding/lib/demo-authority-seed.json
var demo_authority_seed_default = {
  notice: "DEMO ONLY / NOT A LICENSE",
  brokerageSlug: "juniper-realty",
  recorderEmail: "maya.chen@example.realestate.local",
  jurisdictionCode: "TX",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveThrough: "2035-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  practitioners: [
    { key: "maya-chen", email: "maya.chen@example.realestate.local", licenseType: "broker" },
    { key: "omar-patel", email: "omar.patel@example.realestate.local", licenseType: "sales_agent" },
    { key: "evelyn-brooks", email: "evelyn.brooks@example.realestate.local", licenseType: "sales_agent" }
  ],
  listings: [
    { key: "riverfront-loft-austin", propertySlug: "riverfront-loft-austin", practitionerKey: "maya-chen" },
    { key: "hill-country-estate", propertySlug: "hill-country-estate", practitionerKey: "maya-chen" },
    { key: "eastside-townhome-rental", propertySlug: "eastside-townhome-rental", practitionerKey: "omar-patel" },
    { key: "mueller-bungalow", propertySlug: "mueller-bungalow", practitionerKey: "evelyn-brooks" }
  ]
};

// features/keystone/onboarding/demo-authority-runtime.ts
var import_node_crypto2 = __toESM(require("node:crypto"));
function list44(context, key) {
  const operations = context.query[key];
  if (!operations) throw new Error(`Demo authority seed requires Keystone list ${key}.`);
  return operations;
}
async function one(context, key, where, query, label) {
  const rows = await list44(context, key).findMany({ where, take: 2, query });
  if (rows.length !== 1) throw new Error(`Demo authority seed requires exactly one ${label}.`);
  return rows[0];
}
function declaration(slug) {
  return `DEMO ONLY / NOT A LICENSE OR SIGNED LISTING AGREEMENT | property:${slug} | fictional Juniper Realty demo inventory`;
}
function sha256(value) {
  return import_node_crypto2.default.createHash("sha256").update(value).digest("hex");
}
function effective(item, status, evaluatedAt) {
  return item?.status === status && new Date(item.effectiveFrom) <= evaluatedAt && new Date(item.effectiveThrough) >= evaluatedAt;
}
async function applyDemoAuthoritySeed(context, seed, log = () => void 0, evaluatedAt = /* @__PURE__ */ new Date()) {
  if (seed.notice !== "DEMO ONLY / NOT A LICENSE" || seed.brokerageSlug !== "juniper-realty") {
    throw new Error("Demo authority seed is restricted to the explicit Juniper non-license fixture.");
  }
  const from = new Date(seed.effectiveFrom), through = new Date(seed.effectiveThrough), verified = new Date(seed.verifiedAt);
  if (![from, through, verified, evaluatedAt].every((date) => Number.isFinite(date.getTime())) || from >= through || verified < from || verified > evaluatedAt) {
    throw new Error("Demo authority seed requires a valid effective and verification interval.");
  }
  const brokerage = await one(context, "Brokerage", { slug: { equals: seed.brokerageSlug } }, "id slug status", "Juniper brokerage");
  const recorder = await one(context, "User", { email: { equals: seed.recorderEmail } }, "id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }", "fixture recorder");
  const recorderAuthorized = recorder.activeBrokerage?.id === brokerage.id && recorder.brokerageMemberships?.some((membership) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === "active");
  if (brokerage.status !== "active" || !recorderAuthorized) {
    const total = seed.practitioners.length + seed.listings.length * 2;
    log("preserve inactive or moved fixture recorder; no authority issued");
    return { created: 0, skipped: 0, blocked: total, total };
  }
  let created = 0, skipped = 0, blocked = 0;
  const practitioners = /* @__PURE__ */ new Map();
  for (const fixture of seed.practitioners) {
    if (!["broker", "associate_broker", "sales_agent"].includes(fixture.licenseType)) throw new Error(`Demo practitioner ${fixture.key} has an invalid fixture license type.`);
    const user = await one(context, "User", { email: { equals: fixture.email } }, "id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }", `fixture practitioner ${fixture.key}`);
    const member = user.activeBrokerage?.id === brokerage.id && user.brokerageMemberships?.some((membership) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === "active");
    if (!member) {
      blocked += 1;
      log(`preserve suspended or moved practitioner ${fixture.key}; no authority issued`);
      continue;
    }
    const licenseNumber = `DEMO-ONLY-NOT-A-LICENSE-${fixture.key.toUpperCase()}`;
    const rows = await list44(context, "PractitionerLicenseAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, practitioner: { id: { equals: user.id } }, jurisdictionCode: { equals: seed.jurisdictionCode } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id licenseNumber status effectiveFrom effectiveThrough verificationSource"
    });
    let license = rows.find((row) => row.licenseNumber === licenseNumber);
    if (!license && rows.length) {
      blocked += 1;
      log(`preserve existing practitioner authority for ${fixture.key}`);
      continue;
    }
    if (!license) {
      license = await list44(context, "PractitionerLicenseAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        practitioner: { connect: { id: user.id } },
        licenseNumber,
        licenseType: fixture.licenseType,
        jurisdictionCode: seed.jurisdictionCode,
        status: "verified_active",
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        verifiedAt: seed.verifiedAt,
        verificationSource: `${seed.notice} \u2014 fictional disposable fixture; no regulator or provider verification performed`,
        restrictions: `${seed.notice}. Fictional demo authority only. Not valid for brokerage, legal, MLS, settlement, or accounting reliance.`,
        reason: `${seed.notice} \u2014 enable fictional disposable public inventory without asserting real licensure.`,
        verifiedBy: { connect: { id: recorder.id } }
      }, query: "id licenseNumber status effectiveFrom effectiveThrough verificationSource" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latest = rows[0] || license;
    if (latest.id === license.id && effective(license, "verified_active", evaluatedAt) && String(license.verificationSource).includes(seed.notice)) {
      practitioners.set(fixture.key, { user, license });
    } else {
      blocked += 1;
      log(`preserve non-current practitioner authority for ${fixture.key}`);
    }
  }
  for (const fixture of seed.listings) {
    const practitioner = practitioners.get(fixture.practitionerKey);
    if (!practitioner) {
      blocked += 2;
      continue;
    }
    const property = await one(context, "Property", { slug: { equals: fixture.propertySlug } }, "id slug state assignedAgent { id } brokerage { id }", `fixture property ${fixture.key}`);
    if (property.brokerage?.id !== brokerage.id || property.assignedAgent?.id !== practitioner.user.id || property.state !== seed.jurisdictionCode) {
      blocked += 2;
      log(`preserve reassigned or moved listing ${fixture.key}; no authority issued`);
      continue;
    }
    const engagementNumber = `DEMO-LE-${fixture.key}`;
    const engagementRows = await list44(context, "ListingEngagementAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }"
    });
    let engagement = engagementRows.find((row) => row.authorityNumber === engagementNumber);
    if (!engagement && engagementRows.length) {
      blocked += 2;
      log(`preserve existing listing authority for ${fixture.key}`);
      continue;
    }
    if (!engagement) {
      const fixtureDeclaration = declaration(fixture.propertySlug);
      engagement = await list44(context, "ListingEngagementAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        authorityNumber: engagementNumber,
        property: { connect: { id: property.id } },
        assignedPractitioner: { connect: { id: practitioner.user.id } },
        status: "executed",
        jurisdictionCode: seed.jurisdictionCode,
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        exclusive: false,
        marketingAuthorized: true,
        showingAuthorized: true,
        sellerPartySummary: { notice: `${seed.notice} / NOT A SIGNED LISTING AGREEMENT`, fixtureDeclaration },
        signatoryCapacity: `${seed.notice} \u2014 no signatory; fictional fixture assertion`,
        documentSha256: sha256(fixtureDeclaration),
        reason: `${seed.notice} \u2014 fictional disposable listing engagement; no seller or provider evidence claimed.`,
        recordedBy: { connect: { id: recorder.id } },
        recordedAt: seed.verifiedAt
      }, query: "id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latestEngagement = engagementRows[0] || engagement;
    if (latestEngagement.id !== engagement.id || !effective(engagement, "executed", evaluatedAt) || !engagement.marketingAuthorized || !engagement.showingAuthorized || engagement.assignedPractitioner?.id !== practitioner.user.id) {
      blocked += 1;
      log(`preserve revoked, expired, or superseding listing engagement for ${fixture.key}`);
      continue;
    }
    const publicationNumber = `DEMO-PA-PUBLIC-${fixture.key}`;
    const publicationRows = await list44(context, "ListingPublicationAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } }, destination: { equals: "public_site" } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }"
    });
    let publication = publicationRows.find((row) => row.authorityNumber === publicationNumber);
    if (!publication && publicationRows.length) {
      blocked += 1;
      log(`preserve existing public publication authority for ${fixture.key}`);
      continue;
    }
    if (!publication) {
      publication = await list44(context, "ListingPublicationAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        authorityNumber: publicationNumber,
        property: { connect: { id: property.id } },
        engagement: { connect: { id: engagement.id } },
        destination: "public_site",
        status: "authorized",
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        authorityBasis: `${seed.notice} \u2014 fictional disposable storefront fixture only`,
        localRuleReference: `${seed.notice} \u2014 no legal or jurisdictional rule assertion`,
        dataUseGrantReference: `${seed.notice} \u2014 fictional local fixture data; no MLS, IDX, syndication, or provider grant`,
        reason: `${seed.notice} \u2014 permit only public_site display and showing ingress for fictional disposable inventory.`,
        recordedBy: { connect: { id: recorder.id } },
        recordedAt: seed.verifiedAt
      }, query: "id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latestPublication = publicationRows[0] || publication;
    if (latestPublication.id !== publication.id || !effective(publication, "authorized", evaluatedAt) || publication.engagement?.id !== engagement.id || !String(publication.authorityBasis).includes(seed.notice)) {
      blocked += 1;
      log(`preserve revoked, expired, or superseding public publication authority for ${fixture.key}`);
    }
  }
  return { created, skipped, blocked, total: seed.practitioners.length + seed.listings.length * 2 };
}

// features/keystone/onboarding/seed-runtime.ts
var import_node_crypto4 = require("node:crypto");

// features/keystone/lib/savedDiscoveryIdentity.ts
var import_node_crypto3 = require("node:crypto");
function savedDiscoveryLockName(kind, brokerageId, userId2, target) {
  const fingerprint = (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify([kind, brokerageId, userId2, target])).digest("hex");
  return `saved-discovery:${kind}:${fingerprint}`;
}
async function lockSavedDiscoveryIdentity(prisma, kind, brokerageId, userId2, target) {
  await prisma.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    savedDiscoveryLockName(kind, brokerageId, userId2, target)
  );
}

// features/keystone/onboarding/seed-runtime.ts
var UNIQUE_LOOKUP_FIELDS = {
  brokerages: ["slug"],
  brokerageSettings: ["key"],
  roles: ["name"],
  agents: ["email"],
  brokerageMemberships: ["membershipKey"],
  properties: ["slug"],
  routingRules: ["name"],
  leads: ["email"],
  leadActivities: ["lead", "subject", "occurredAt"],
  showings: ["lead", "property", "scheduledStart"],
  deals: ["title"]
};
function getCoreRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = value.connect?.$ref;
  return typeof ref === "string" ? ref : null;
}
function resolveCoreRefs(value, ids) {
  const ref = getCoreRef(value);
  if (ref) {
    const id = ids.get(ref);
    if (!id) throw new Error(`Cannot resolve core seed reference ${ref}`);
    return { connect: { id } };
  }
  if (Array.isArray(value)) return value.map((item) => resolveCoreRefs(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveCoreRefs(child, ids)]));
  }
  return value;
}
function equalsFilter(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && "connect" in value) {
    const id = value.connect?.id;
    if (typeof id === "string") return { id: { equals: id } };
  }
  return { equals: value };
}
function requiredConnectId(data, field) {
  const value = data[field];
  const id = value?.connect?.id;
  if (typeof id !== "string" || !id) throw new Error(`Core seed ${field} requires an explicit resolved connection`);
  return id;
}
function buildCoreLookup(sectionName, data) {
  const fields = UNIQUE_LOOKUP_FIELDS[sectionName];
  if (!fields?.length) throw new Error(`No idempotent lookup configured for core seed section ${sectionName}`);
  return Object.fromEntries(fields.map((field) => {
    const value = data[field];
    if (value === void 0 || value === null || value === "") {
      throw new Error(`Cannot build core seed lookup for ${sectionName}: missing ${field}`);
    }
    return [field, equalsFilter(value)];
  }));
}
async function assertNoUnreviewedSeedMembershipLinks(context, seed, template) {
  const agents = seed.sections.agents;
  const memberships = seed.sections.brokerageMemberships;
  if (!agents || !memberships) return;
  const usersList = context.query.User;
  const membershipsList = context.query.BrokerageMembership;
  if (!usersList || !membershipsList) throw new Error("Core seed requires User and BrokerageMembership lists for membership review.");
  const agentsByKey = new Map(agents.items.filter((item) => item.templates?.includes(template) ?? true).map((item) => [item.key, item]));
  for (const item of memberships.items.filter((item2) => item2.templates?.includes(template) ?? true)) {
    const userConnection = item.data.user;
    const reference = userConnection?.connect?.$ref;
    if (typeof reference !== "string" || !reference.startsWith("agents:")) continue;
    const agent = agentsByKey.get(reference.slice("agents:".length));
    if (!agent) continue;
    const email = agent.data.email;
    const membershipKey = item.data.membershipKey;
    if (typeof email !== "string" || !email || typeof membershipKey !== "string" || !membershipKey) {
      throw new Error("Core seed membership requires an explicit agent email and unique key.");
    }
    const existingUsers = await usersList.findMany({ where: { email: { equals: email } }, take: 1, query: "id" });
    if (!existingUsers[0]?.id) continue;
    const existingMemberships = await membershipsList.findMany({
      where: { membershipKey: { equals: membershipKey } },
      take: 1,
      query: "id user { id }"
    });
    const existingMembership = existingMemberships[0];
    const linkedUserId = existingMembership?.user?.id || existingMembership?.user?.connect?.id;
    if (linkedUserId !== existingUsers[0].id) {
      throw new Error("Core seed cannot link an existing user to a brokerage membership; owner review is required.");
    }
  }
}
async function applyCoreSeed(context, seed, template = "full", log = () => void 0) {
  const ids = /* @__PURE__ */ new Map();
  const createdAgentIds = /* @__PURE__ */ new Set();
  await assertNoUnreviewedSeedMembershipLinks(context, seed, template);
  let created = 0;
  let skipped = 0;
  let total = 0;
  for (const sectionName of seed.dependencyOrder) {
    const section = seed.sections[sectionName];
    if (!section) throw new Error(`Core dependencyOrder references missing section ${sectionName}`);
    const list45 = context.query[section.listKey];
    if (!list45) throw new Error(`Keystone list ${section.listKey} is not available on context.query`);
    for (const item of section.items.filter((item2) => item2.templates?.includes(template) ?? true)) {
      total += 1;
      const data = resolveCoreRefs(item.data, ids);
      const refKey = `${sectionName}:${item.key}`;
      const existing = await list45.findMany({ where: buildCoreLookup(sectionName, data), take: 1, query: "id" });
      if (existing[0]?.id) {
        ids.set(refKey, existing[0].id);
        skipped += 1;
        log(`skip existing ${refKey}`);
        continue;
      }
      if (sectionName === "agents") {
        requiredConnectId(data, "activeBrokerage");
        data.password = (0, import_node_crypto4.randomBytes)(32).toString("base64url");
      }
      if (sectionName === "brokerageMemberships") {
        requiredConnectId(data, "brokerage");
        const userId2 = requiredConnectId(data, "user");
        if (!createdAgentIds.has(userId2)) {
          throw new Error("Core seed cannot link an existing user to a brokerage membership; owner review is required.");
        }
      }
      const result = await list45.createOne({ data, query: "id" });
      ids.set(refKey, result.id);
      if (sectionName === "agents") createdAgentIds.add(result.id);
      created += 1;
      log(`created ${refKey} (${result.id})`);
    }
  }
  return { created, skipped, total };
}
async function findAnchor(context, listKey, where, label) {
  const list45 = context.query[listKey];
  if (!list45) throw new Error(`Keystone list ${listKey} is not available on context.query`);
  const rows = await list45.findMany({ where, take: 1, query: "id" });
  if (!rows[0]?.id) throw new Error(`Missing core seed anchor: ${label}`);
  return rows[0].id;
}
async function resolveAnchors(context, seed) {
  const anchors = /* @__PURE__ */ new Map();
  anchors.set("brokerage", await findAnchor(context, "Brokerage", { slug: { equals: seed.anchors.brokerageSlug } }, seed.anchors.brokerageSlug));
  anchors.set("agent", await findAnchor(context, "User", { email: { equals: seed.anchors.agentEmail } }, seed.anchors.agentEmail));
  anchors.set("property", await findAnchor(context, "Property", { slug: { equals: seed.anchors.propertySlug } }, seed.anchors.propertySlug));
  anchors.set("lead", await findAnchor(context, "Lead", { email: { equals: seed.anchors.leadEmail } }, seed.anchors.leadEmail));
  anchors.set("deal", await findAnchor(context, "Deal", { title: { equals: seed.anchors.dealTitle } }, seed.anchors.dealTitle));
  anchors.set("showing", await findAnchor(context, "Showing", { notes: { equals: seed.anchors.showingNotes } }, seed.anchors.showingNotes));
  return anchors;
}
function resolveExpansionLinks(value, anchors, records) {
  if (Array.isArray(value)) return value.map((item) => resolveExpansionLinks(item, anchors, records));
  if (value && typeof value === "object") {
    const object = value;
    if (typeof object.$anchor === "string") {
      const id = anchors.get(object.$anchor);
      if (!id) throw new Error(`Unknown or unresolved expansion seed anchor ${object.$anchor}`);
      return { connect: { id } };
    }
    if (typeof object.$record === "string") {
      const id = records.get(object.$record);
      if (!id) throw new Error(`Unknown or unresolved expansion seed record ${object.$record}`);
      return { connect: { id } };
    }
    return Object.fromEntries(Object.entries(object).map(([key, child]) => [key, resolveExpansionLinks(child, anchors, records)]));
  }
  return value;
}
async function applyExpansionSeed(context, seed, log = () => void 0) {
  const anchors = await resolveAnchors(context, seed);
  const recordIds = /* @__PURE__ */ new Map();
  let created = 0;
  let skipped = 0;
  for (const record4 of seed.records) {
    const list45 = context.query[record4.listKey];
    if (!list45) throw new Error(`Keystone list ${record4.listKey} is not available on context.query`);
    const data = resolveExpansionLinks(record4.data, anchors, recordIds);
    let lookupWhere;
    let take = 1;
    if (record4.listKey === "SavedSearch") {
      const brokerageId = requiredConnectId(data, "brokerage");
      const userId2 = requiredConnectId(data, "user");
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name) throw new Error(`Expansion record ${record4.id} requires a saved-search name.`);
      if (!context.prisma) throw new Error("Saved-search seed requires a transaction-bound advisory lock client.");
      data.name = name;
      await lockSavedDiscoveryIdentity(context.prisma, "search", brokerageId, userId2, name);
      lookupWhere = {
        brokerage: { id: { equals: brokerageId } },
        user: { id: { equals: userId2 } },
        name: { equals: name }
      };
      take = 2;
    } else {
      const lookupData = resolveExpansionLinks(record4.lookup || record4.data, anchors, recordIds);
      lookupWhere = Object.fromEntries(
        Object.entries(lookupData).filter(([field]) => record4.lookup ? true : field === "slug" || field.endsWith("Number")).map(([field, value]) => [field, equalsFilter(value)])
      );
    }
    if (!Object.keys(lookupWhere).length) throw new Error(`Expansion record ${record4.id} has no idempotent lookup`);
    const existing = await list45.findMany({ where: lookupWhere, take, query: "id" });
    if (record4.listKey === "SavedSearch" && existing.length > 1) {
      throw new Error("Duplicate saved-search records require records review.");
    }
    if (existing[0]?.id) {
      recordIds.set(record4.id, existing[0].id);
      skipped += 1;
      log(`skip existing ${record4.listKey}:${record4.id}`);
      continue;
    }
    if (record4.listKey === "Offer" && data.status === "accepted") {
      const dealId = requiredConnectId(data, "deal");
      const accepted = await list45.findMany({
        where: { deal: { id: { equals: dealId } }, status: { equals: "accepted" } },
        take: 2,
        query: "id offerNumber"
      });
      if (accepted.length) {
        throw new Error("Expansion seed cannot add an accepted offer to a deal that already has an accepted offer; owner review is required.");
      }
    }
    const result = await list45.createOne({ data, query: "id" });
    recordIds.set(record4.id, result.id);
    created += 1;
    log(`created ${record4.listKey}:${record4.id} (${result.id})`);
  }
  return { created, skipped, total: seed.records.length };
}

// features/keystone/onboarding/run-onboarding.ts
async function runRealEstateOnboarding(context, template = "full") {
  const core = await applyCoreSeed(context, seed_default, template);
  const selectedAgents = new Set(seed_default.sections.agents.items.filter((item) => item.templates.includes(template)).map((item) => item.data.email));
  const selectedProperties = new Set(seed_default.sections.properties.items.filter((item) => item.templates.includes(template)).map((item) => item.data.slug));
  await applyDemoAuthoritySeed(context, {
    ...demo_authority_seed_default,
    practitioners: demo_authority_seed_default.practitioners.filter((item) => selectedAgents.has(item.email)),
    listings: demo_authority_seed_default.listings.filter((item) => selectedProperties.has(item.propertySlug))
  });
  const expansion = template === "full" ? await applyExpansionSeed(context, expansion_seed_default) : { created: 0, skipped: 0, total: 0 };
  return { core, expansion };
}

// features/keystone/mutations/runRealEstateOnboarding.ts
function onboardingSession(context) {
  const session = context.session;
  const fixtureMembership = session?.data?.brokerageMemberships?.find(
    (membership) => membership.status === "active" && membership.brokerage?.status === "active" && membership.brokerage?.slug === "juniper-realty" && ["owner", "admin"].includes(membership.membershipRole)
  );
  if (!session?.itemId || !session.data?.role?.canManageOnboarding || !fixtureMembership || !activeBrokerageIds(session).includes(fixtureMembership.brokerage.id)) {
    throw new Error("Juniper Realty owner or administrator access is required for this fixture onboarding.");
  }
  return session;
}
async function runRealEstateOnboardingTransaction(context, seedRunner = void 0, template = "full") {
  const session = onboardingSession(context);
  return context.transaction(async (transactionContext) => {
    const sessionContext = await freshOperatorCommandContext(transactionContext.withSession(session));
    const currentSession = onboardingSession(sessionContext);
    const sudo = sessionContext.sudo();
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "onboarding:juniper-realty");
    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: "in_progress" }
    });
    const result = await (seedRunner || ((seedContext) => runRealEstateOnboarding(seedContext, template)))(sudo);
    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: "completed" }
    });
    return { completed: true, status: "completed", ...result };
  }, { timeout: 12e4 });
}
async function runRealEstateOnboardingMutation(_root, { template = "full" }, context) {
  if (template !== "full" && template !== "minimal") throw new Error("Invalid brokerage setup template.");
  return runRealEstateOnboardingTransaction(context, void 0, template);
}
async function dismissRealEstateOnboarding(_root, _args, context) {
  const session = onboardingSession(context);
  await context.sudo().db.User.updateOne({
    where: { id: session.itemId },
    data: { onboardingStatus: "dismissed" }
  });
  return { completed: false, status: "dismissed", core: null, expansion: null };
}

// features/keystone/lib/aggregateLock.ts
var direct = /* @__PURE__ */ new Set(["Lead", "Property", "Showing", "Deal", "Offer", "Commission", "AgentTask", "DealDocument", "TransactionMilestone", "SavedSearchAlert", "SourceFeed", "ListingSyndication", "CommissionLedgerEntry", "BrokerageMembership"]);
var throughDeal = /* @__PURE__ */ new Set(["Disclosure", "PropertyInspection"]);
async function lockAggregate(context, list45, id, brokerageId) {
  if (!id || !brokerageId) throw new Error("A scoped aggregate identity is required.");
  if (direct.has(list45)) {
    await context.prisma.$executeRawUnsafe(`SELECT "id" FROM "${list45}" WHERE "id"=$1 AND "brokerage"=$2 FOR NO KEY UPDATE`, id, brokerageId);
  } else if (throughDeal.has(list45)) {
    await context.prisma.$executeRawUnsafe(`SELECT target."id" FROM "${list45}" target JOIN "Deal" parent ON target."deal"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target`, id, brokerageId);
  } else if (list45 === "OpenHouse") {
    await context.prisma.$executeRawUnsafe('SELECT target."id" FROM "OpenHouse" target JOIN "Property" parent ON target."property"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target', id, brokerageId);
  } else throw new Error("Unsupported controlled aggregate lock.");
}
var aggregateLists = {
  lead: "Lead",
  property: "Property",
  showing: "Showing",
  deal: "Deal",
  offer: "Offer",
  commission: "Commission",
  document: "DealDocument",
  "agent-task": "AgentTask",
  inspection: "PropertyInspection",
  "saved-search-alert": "SavedSearchAlert",
  "source-feed": "SourceFeed",
  "listing-syndication": "ListingSyndication"
};
async function lockCommandAggregate(context, lockKey, brokerageId) {
  const parts = lockKey.split(":");
  let list45, id;
  if (parts[0] === "aggregate" && parts.length === 3) {
    list45 = aggregateLists[parts[1]];
    id = parts[2];
  } else if (parts[0] === "ledger" && parts[1] === "commission" && parts.length === 3) {
    list45 = "Commission";
    id = parts[2];
  } else if (parts[0] === "ledger-entry" && parts.length === 2) {
    list45 = "CommissionLedgerEntry";
    id = parts[1];
  } else if (parts[0] === "evidence" && parts[1] === "document" && parts.length === 3) {
    list45 = "DealDocument";
    id = parts[2];
  } else if (parts[0] === "authority" && parts[1] === "listing" && parts.length === 3) {
    list45 = "Property";
    id = parts[2];
  } else if (parts[0] === "authority" && parts[1] === "representation" && parts.length === 3) {
    list45 = "Lead";
    id = parts[2];
  } else if (parts[0] === "membership" && parts.length === 2) {
    list45 = "BrokerageMembership";
    id = parts[1];
  }
  if (list45 && id) await lockAggregate(context, list45, id, brokerageId);
}

// features/keystone/lib/commissionState.ts
function decimalCommissionCents(value) {
  const match = String(value ?? "").trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Commission gross amount is invalid.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
}
function commissionBatchState(entries, batchKey2, gross) {
  const financial = entries.filter((entry) => ["allocation", "allocation_approval", "receipt", "reversal"].includes(entry.entryType));
  const rows = financial.filter((entry) => entry.batchKey === batchKey2);
  const sources = new Map(rows.map((row) => [row.id, row]));
  const reversed = /* @__PURE__ */ new Set();
  let allocations = BigInt(0), receipts = BigInt(0), valid = true;
  const currencies = new Set(rows.map((row) => row.currencyCode));
  for (const row of rows) {
    const amount = BigInt(row.amountCents);
    if (row.entryType === "allocation") allocations += amount;
    if (row.entryType === "receipt") receipts += amount;
    if (row.entryType === "reversal") {
      const source = sources.get(row.reverses?.id);
      if (!source || !["allocation", "receipt"].includes(source.entryType) || reversed.has(source.id) || amount !== -BigInt(source.amountCents)) valid = false;
      else {
        reversed.add(source.id);
        if (source.entryType === "allocation") allocations += amount;
        else receipts += amount;
      }
    }
  }
  const separatelyApproved = rows.some((row) => row.entryType === "allocation_approval" && row.preparedBy?.id && row.approvedBy?.id && row.preparedBy.id !== row.approvedBy.id);
  const validAllocations = valid && separatelyApproved && currencies.size === 1 && allocations === gross;
  const ledgerStateHash = domainPayloadHash([...financial].sort((a, b) => a.id.localeCompare(b.id)).map((row) => ({
    id: row.id,
    batchKey: row.batchKey,
    entryType: row.entryType,
    amountCents: String(row.amountCents),
    currencyCode: row.currencyCode,
    reverses: row.reverses?.id || null,
    preparedBy: row.preparedBy?.id || null,
    approvedBy: row.approvedBy?.id || null,
    externalReference: row.externalReference || "",
    sourceDocumentSha256: row.sourceDocumentSha256 || ""
  })));
  return { validAllocations, validReceipts: validAllocations && receipts === gross, ledgerStateHash, currencyCode: rows[0]?.currencyCode || "", allocationNet: allocations, receiptNet: receipts };
}
function activeAllocationBatches(entries) {
  const allocations = entries.filter((row) => row.entryType === "allocation");
  const reversed = new Set(entries.filter((row) => row.entryType === "reversal" && allocations.some((source) => source.id === row.reverses?.id && BigInt(row.amountCents) === -BigInt(source.amountCents))).map((row) => row.reverses.id));
  return new Set(allocations.filter((row) => !reversed.has(row.id)).map((row) => row.batchKey));
}
async function commissionDecisionEntries(context, commissionId) {
  return decisionRows(context.sudo().query.CommissionLedgerEntry, {
    where: { commission: { id: { equals: commissionId } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    query: "id batchKey entryType amountCents currencyCode ledgerStateHash externalReference sourceDocumentSha256 reverses { id } preparedBy { id } approvedBy { id }"
  });
}
async function requireCurrentCommissionState(context, commissionId, grossValue, requireReconciled) {
  const entries = await commissionDecisionEntries(context, commissionId);
  const gross = decimalCommissionCents(grossValue);
  const activeBatches = activeAllocationBatches(entries);
  if (activeBatches.size !== 1) throw new Error("A single current allocation batch is required; reverse or review conflicting batches before approval or payment recording.");
  const candidates = entries.filter((row) => row.entryType === (requireReconciled ? "reconciliation" : "allocation_approval")).reverse();
  for (const candidate of candidates) {
    if (!activeBatches.has(candidate.batchKey)) continue;
    const state = commissionBatchState(entries, candidate.batchKey, gross);
    if (!state.validAllocations) continue;
    if (requireReconciled && (!state.validReceipts || !candidate.externalReference || candidate.ledgerStateHash !== state.ledgerStateHash)) continue;
    return { batchKey: candidate.batchKey, ...state };
  }
  throw new Error(requireReconciled ? "Current, separately approved and reconciled allocation/receipt evidence is required. Reconcile again after ledger changes." : "A current cent-conserving allocation batch approved by a different authority is required.");
}

// features/keystone/lib/showingPolicy.ts
var showingTransitions = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["completed", "no_show", "cancelled"],
  completed: [],
  no_show: ["scheduled"],
  cancelled: ["requested", "scheduled"]
};
function leadStatusAfterShowing(current, next) {
  if (next === "scheduled" && current === "qualified") return "tour_scheduled";
  return current;
}
async function reconcileLeadStatusAfterShowing(context, input) {
  const { currentLeadStatus, nextShowingStatus, brokerageId, leadId, showingId } = input;
  const scheduledStatus = leadStatusAfterShowing(currentLeadStatus, nextShowingStatus);
  if (scheduledStatus !== currentLeadStatus) return scheduledStatus;
  if (currentLeadStatus !== "tour_scheduled" || !["completed", "cancelled", "no_show"].includes(nextShowingStatus)) return currentLeadStatus;
  if (!brokerageId || !leadId || !showingId) throw new Error("Showing-to-lead reconciliation requires scoped showing relationships.");
  const otherScheduledShowings = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: brokerageId } } },
      { lead: { id: { equals: leadId } } },
      { status: { equals: "scheduled" } },
      { id: { not: { equals: showingId } } }
    ] },
    take: 1,
    query: "id"
  });
  return otherScheduledShowings.length ? "tour_scheduled" : "qualified";
}
function showingInterval(startValue, durationMinutes, now = Date.now()) {
  const start = new Date(String(startValue || ""));
  if (!Number.isFinite(start.getTime()) || start.getTime() <= now || start.getTime() > now + 365 * 864e5) {
    throw new Error("Choose a showing time in the future, within one year.");
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error("Showing duration must be between 15 and 240 minutes.");
  }
  return { scheduledStart: start.toISOString(), scheduledEnd: new Date(start.getTime() + durationMinutes * 6e4).toISOString() };
}
async function requireAvailableShowingSlot(context, input) {
  const start = new Date(input.scheduledStart), end = new Date(input.scheduledEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 240 * 6e4) {
    throw new Error("A valid showing start and end are required.");
  }
  const conflicts = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: input.brokerageId } }, status: { equals: "scheduled" } },
      { OR: [{ property: { id: { equals: input.propertyId } } }, { assignedAgent: { id: { equals: input.agentId } } }] },
      { scheduledStart: { lt: input.scheduledEnd } },
      { OR: [
        { scheduledEnd: { gt: input.scheduledStart } },
        // Legacy records with no end conservatively reserve the maximum duration.
        { scheduledEnd: { equals: null }, scheduledStart: { gt: new Date(start.getTime() - 240 * 6e4).toISOString() } }
      ] },
      ...input.excludeId ? [{ id: { not: { equals: input.excludeId } } }] : []
    ] },
    take: 1,
    query: "id"
  });
  if (conflicts.length) throw new Error("The property or advisor already has a confirmed showing during this time. Choose another time.");
}

// features/keystone/mutations/operatorLifecycle.ts
var transitions = {
  lead: { new: ["attempted_contact", "qualified", "lost"], attempted_contact: ["qualified", "lost"], qualified: ["offer", "lost"], tour_scheduled: ["qualified", "offer", "lost"], offer: ["closed", "lost"], closed: [], lost: ["qualified"] },
  property: { draft: ["coming_soon", "active", "off_market"], coming_soon: ["active", "off_market"], active: ["pending", "sold", "rented", "off_market"], pending: ["active", "sold", "rented", "off_market"], sold: ["off_market"], rented: ["off_market"], off_market: ["draft", "coming_soon", "active"] },
  showing: showingTransitions,
  openHouse: { scheduled: ["completed", "cancelled"], completed: [], cancelled: [] },
  deal: { prospecting: ["active_search", "closed_lost"], active_search: ["offer_drafted", "closed_lost"], offer_drafted: ["active_search", "under_contract", "closed_lost"], under_contract: ["inspection", "financing", "closed_won", "closed_lost"], inspection: ["under_contract", "financing", "closed_won", "closed_lost"], financing: ["under_contract", "inspection", "closed_won", "closed_lost"], closed_won: [], closed_lost: [] },
  offer: { draft: ["submitted", "withdrawn"], submitted: ["countered", "accepted", "rejected", "withdrawn"], countered: ["submitted", "accepted", "rejected", "withdrawn"], accepted: [], rejected: [], withdrawn: [] },
  commission: { projected: ["approved"], approved: ["paid", "clawed_back"], paid: ["clawed_back"], clawed_back: [] },
  disclosure: { draft: ["sent", "expired"], sent: ["acknowledged", "expired"], acknowledged: [], expired: ["draft", "sent"] },
  milestone: { not_started: ["in_progress", "blocked", "complete"], in_progress: ["blocked", "complete"], blocked: ["in_progress", "complete"], complete: ["in_progress"] }
};
var config = {
  lead: { list: "Lead", field: "status", read: "id status brokerage { id } assignedAgent { id }" },
  property: { list: "Property", field: "status", read: "id status state brokerage { id } assignedAgent { id }" },
  showing: { list: "Showing", field: "status", read: "id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }" },
  openHouse: { list: "OpenHouse", field: "status", read: "id status property { id brokerage { id } assignedAgent { id } } hostAgent { id }" },
  deal: { list: "Deal", field: "stage", read: "id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt closedSnapshot nextStep notes brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state }" },
  offer: { list: "Offer", field: "status", read: "id offerNumber version parentOffer { id offerNumber version } status amount earnestMoney financingType contingencies submittedAt responseDueAt acceptedAt acceptedSnapshot brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state } deal { id title transactionType }" },
  commission: { list: "Commission", field: "status", read: "id status grossCommission brokerage { id } agent { id } deal { id stage transactionType brokerage { id } lead { id } } property { id state brokerage { id } }" },
  disclosure: { list: "Disclosure", field: "status", read: "id status deal { brokerage { id } assignedAgent { id } } property { brokerage { id } assignedAgent { id } }" },
  milestone: { list: "TransactionMilestone", field: "status", read: "id status assignedTo { id } deal { brokerage { id } assignedAgent { id } }" }
};
function role(context) {
  return context.session?.data?.role || {};
}
function sessionId(context) {
  return context.session?.itemId;
}
function hasDomainPermission(context, domain) {
  const currentRole = role(context);
  return domain === "lead" ? Boolean(currentRole.canManageLeads) : domain === "property" ? Boolean(currentRole.canManageListings) : domain === "showing" ? Boolean(currentRole.canManageShowings) : domain === "openHouse" ? Boolean(currentRole.canManageShowings) : Boolean(currentRole.canManageDeals);
}
function itemBrokerageId(item) {
  return item.brokerage?.id || item.deal?.brokerage?.id || item.property?.brokerage?.id || null;
}
function representationSide(transactionType) {
  return ["seller", "landlord"].includes(String(transactionType || "")) ? "seller" : "buyer";
}
function permitted(context, domain, item) {
  const currentRole = role(context);
  const userId2 = sessionId(context);
  if (!userId2 || !hasDomainPermission(context, domain)) return false;
  const brokerageId = itemBrokerageId(item);
  if (brokerageId && !activeBrokerageIds(context.session).includes(brokerageId)) return false;
  if (currentRole.canManagePeople) return true;
  const ownerId = item.assignedAgent?.id || item.agent?.id || item.assignedTo?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id;
  return ownerId === userId2;
}
function safeString(value) {
  return String(value || "").trim();
}
function transitionUpdate(domain, next, item, now, evidenceVersion = null) {
  const definition = config[domain];
  const update = { [definition.field]: next };
  if (domain === "lead") update.lastContactedAt = now;
  if (domain === "deal" && ["closed_won", "closed_lost"].includes(next)) {
    update.closedAt = now;
    if (!item.closedSnapshot) {
      update.closedSnapshot = normalizeDomainJson({
        version: 1,
        capturedAt: now,
        outcome: next,
        title: item.title,
        transactionType: item.transactionType,
        offerAmount: item.offerAmount,
        commissionAmount: item.commissionAmount,
        expectedCloseDate: item.expectedCloseDate,
        nextStep: item.nextStep,
        notes: item.notes,
        property: item.property || null,
        lead: item.lead || null,
        assignedAgent: item.assignedAgent || null,
        evidenceVersion
      });
    }
  }
  if (domain === "offer") {
    if (next === "submitted") update.submittedAt = now;
    if (next === "accepted") {
      update.acceptedAt = now;
      if (!item.acceptedSnapshot) {
        update.acceptedSnapshot = normalizeDomainJson({
          version: item.version || 1,
          parentOffer: item.parentOffer || null,
          capturedAt: now,
          offerNumber: item.offerNumber,
          amount: item.amount,
          earnestMoney: item.earnestMoney,
          financingType: item.financingType,
          contingencies: item.contingencies,
          submittedAt: item.submittedAt,
          responseDueAt: item.responseDueAt,
          property: item.property || null,
          deal: item.deal || null,
          lead: item.lead || null,
          assignedAgent: item.assignedAgent || null,
          evidenceVersion
        });
      }
    }
  }
  if (domain === "commission") update.paidAt = next === "paid" ? now : null;
  if (domain === "disclosure") {
    if (next === "sent") update.sentAt = now;
    if (next === "acknowledged") update.acknowledgedAt = now;
  }
  if (domain === "milestone") update.completedAt = next === "complete" ? now : null;
  return update;
}
async function transitionInContext(context, domain, data) {
  const id = safeString(data.id);
  const next = safeString(data.status);
  const commandKey = safeString(data.idempotencyKey);
  const definition = config[domain];
  const request = {
    domain,
    id,
    status: next,
    note: safeString(data.note),
    ...data.expectedStatus != null ? { expectedStatus: data.expectedStatus } : {},
    ...data.expectedUpdatedAt != null ? { expectedUpdatedAt: data.expectedUpdatedAt } : {},
    ...data.expectedRevision != null ? { expectedRevision: data.expectedRevision } : {}
  };
  const eventKey = `command:${domain}:${id}:${commandKey}`;
  const sudo = context.sudo();
  const supportsEvents = typeof sudo.prisma?.$executeRawUnsafe === "function" && typeof sudo.query?.DomainOutboxEvent?.findOne === "function" && typeof sudo.query?.DomainOutboxEvent?.createOne === "function" && typeof sudo.query?.DomainAuditEvent?.createOne === "function";
  if (!supportsEvents) return { ok: false, message: "Transitions are temporarily unavailable.", itemId: null, status: null, replayed: false };
  let showingReplay = null;
  const showingHeader = domain === "showing" ? await scopedShowingIdentity(context, id) : null;
  if (domain === "showing" && !showingHeader) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
  if (supportsEvents) {
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `aggregate:${domain}:${id}`);
    const candidate = await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey }, query: domain === "showing" ? SHOWING_EVENT_HEADER_QUERY : "id requestHash payload brokerage { id }" });
    if (candidate && domain === "showing" && !await ownedShowingEventHeader(context, candidate, { eventKey, eventType: "showing.status_changed", purpose: "showing" })) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
    if (candidate && domain === "showing" && candidate.requestHash !== domainPayloadHash(request)) return { ok: false, message: "This idempotency key was already used with different transition input.", itemId: null, status: null, replayed: false };
    const existing = candidate && domain === "showing" ? await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey }, query: "id requestHash payloadHash payload brokerage { id }" }) : candidate;
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash || domain === "showing" && !showingEventPayloadMatches(candidate, existing))) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
    if (existing) {
      if (!activeBrokerageIds(context.session).includes(existing.brokerage?.id)) {
        return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
      }
      if (existing.requestHash !== domainPayloadHash(request)) {
        throw new Error("Domain command idempotency key was reused with different input");
      }
      if (domain === "showing") showingReplay = existing;
      else return { ...existing.payload?.result || {}, replayed: true };
    }
  }
  await lockAggregate(context, definition.list, id, activeBrokerageIds(context.session)[0]);
  if (domain === "property") await lockPropertyForDecision(context, id, activeBrokerageIds(context.session)[0]);
  let item = await sudo.query[definition.list].findOne({ where: { id }, query: definition.read });
  if (!item || showingHeader && !sameShowingIdentity(item, showingHeader)) return { ok: false, message: "The requested record was not found.", itemId: null, status: null, replayed: false };
  if (!permitted(context, domain, item)) return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
  if (domain !== "property" && item.property?.id) {
    await lockPropertyForDecision(context, item.property.id, itemBrokerageId(item));
    item = await sudo.query[definition.list].findOne({ where: { id }, query: definition.read });
    if (!item || !permitted(context, domain, item) || showingHeader && !sameShowingIdentity(item, showingHeader)) return { ok: false, message: "The requested record changed or is unavailable.", itemId: null, status: null, replayed: false };
  }
  if (showingReplay) {
    if (showingReplay.payload?.actorId !== sessionId(context) || showingReplay.payload?.aggregate?.type !== "showing" || showingReplay.payload.aggregate.id !== id || showingReplay.payload?.request?.id !== id || showingReplay.payload?.request?.domain !== "showing" || showingReplay.payload?.result?.itemId !== id || showingReplay.payload?.result?.ok !== true || showingReplay.payload?.result?.status !== next || showingReplay.payload?.before?.lead?.id !== showingHeader?.lead.id || showingReplay.payload?.before?.property?.id !== showingHeader?.property.id) return { ok: false, message: "You are not authorized to replay this command.", itemId: null, status: null, replayed: false };
    return { ...showingReplay.payload?.result || {}, replayed: true };
  }
  if (domain === "showing" && (data.expectedStatus != null && item.status !== data.expectedStatus || data.expectedUpdatedAt != null && item.updatedAt !== data.expectedUpdatedAt || data.expectedRevision != null && await showingReviewRevision(context, item) !== data.expectedRevision)) {
    return { ok: false, message: "The showing changed after review. Refresh before submitting a new decision.", itemId: id, status: item.status, replayed: false };
  }
  let evidenceVersion = null;
  const bindEvidence = (chain) => ({ documentId: chain.document.id, documentSha256: chain.events[0]?.documentSha256, templateSha256: chain.events[0]?.templateSha256, eventIds: chain.events.map((event) => event.id) });
  const brokerageId = itemBrokerageId(item);
  const practitionerId = item.assignedAgent?.id || item.agent?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id;
  if (domain === "property" && ["coming_soon", "active"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.state) return { ok: false, message: "Listing publication requires assigned practitioner and jurisdiction authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireListingAuthority(context, { brokerageId, propertyId: id, practitionerId, jurisdictionCode: item.state, destination: "public_site" });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Listing publication authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "showing" && next === "scheduled" && ["closed", "lost"].includes(item.lead?.status)) {
    return { ok: false, message: "Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.", itemId: id, status: item.status, replayed: false };
  }
  if (domain === "showing" && ["scheduled", "completed"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Showing confirmation requires practitioner, jurisdiction, and relationship authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, practitionerId, jurisdictionCode: item.property.state, side: "buyer", allowCustomerAssistance: true });
      if (next === "scheduled") {
        const duration = item.scheduledEnd ? (new Date(item.scheduledEnd).getTime() - new Date(item.scheduledStart).getTime()) / 6e4 : 60;
        const interval = showingInterval(item.scheduledStart, duration);
        await requireAvailableShowingSlot(context, { brokerageId, propertyId: item.property.id, agentId: practitionerId, ...interval, excludeId: id });
        item.scheduledEnd = interval.scheduledEnd;
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Showing authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "offer" && ["submitted", "accepted"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Offer transition requires practitioner, jurisdiction, and representation authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: item.deal?.id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.deal?.transactionType) });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Offer authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "deal" && ["under_contract", "inspection", "financing", "closed_won"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Deal transition requires practitioner, jurisdiction, and representation authority.", itemId: id, status: item.stage, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.transactionType) });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Deal authority is required.", itemId: id, status: item.stage, replayed: false };
    }
  }
  if (domain === "commission" && ["approved", "paid"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.property?.state) return { ok: false, message: "Commission transition requires current practitioner authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requirePractitionerLicense(context, { brokerageId, practitionerId, jurisdictionCode: item.property.state });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Commission authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (supportsEvents && domain === "offer" && item.deal?.id) {
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `aggregate:deal:${item.deal.id}`);
  }
  if (domain === "offer" && next === "accepted" && item.deal?.id) {
    const accepted = await sudo.query.Offer.findMany({ where: { AND: [{ deal: { id: { equals: item.deal.id } } }, { status: { equals: "accepted" } }, { id: { not: { equals: id } } }] }, take: 1, query: "id offerNumber" });
    if (accepted.length) return { ok: false, message: `Deal already has accepted offer ${accepted[0].offerNumber}.`, itemId: id, status: item.status, replayed: false };
    try {
      evidenceVersion = bindEvidence(await requireOfferEvidenceChain(context, { dealId: item.deal.id, offerId: id }));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete offer evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "deal" && next === "closed_won") {
    const acceptedOffers = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: id } }, status: { equals: "accepted" } }, take: 1, query: "id offerNumber" });
    if (!acceptedOffers.length) return { ok: false, message: "A closed-won deal requires an accepted offer.", itemId: id, status: item.stage, replayed: false };
    try {
      await requireOfferEvidenceChain(context, { dealId: id, offerId: acceptedOffers[0].id });
      evidenceVersion = bindEvidence(await requireClosingEvidenceChain(context, id));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.stage, replayed: false };
    }
  }
  if (domain === "property" && next === "sold") {
    const closedDeals = await sudo.query.Deal.findMany({ where: { property: { id: { equals: id } }, stage: { equals: "closed_won" } }, take: 1, query: "id" });
    if (!closedDeals.length) return { ok: false, message: "A sold listing requires a closed-won deal.", itemId: id, status: item.status, replayed: false };
    try {
      await requireClosingEvidenceChain(context, closedDeals[0].id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "commission" && next === "paid" && item.deal?.stage !== "closed_won") return { ok: false, message: "A paid commission requires a closed-won deal.", itemId: id, status: item.status, replayed: false };
  if (domain === "commission" && ["approved", "paid"].includes(next)) {
    try {
      await requireCurrentCommissionState(context, id, item.grossCommission, next === "paid");
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Current commission evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "commission" && next === "paid") {
    try {
      await requireClosingEvidenceChain(context, item.deal.id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  const current = item[definition.field];
  if (current === next) return { ok: true, message: "The record is already in that status.", itemId: id, status: current, replayed: true };
  if (!transitions[domain][current]?.includes(next)) {
    return { ok: false, message: `Cannot transition ${domain} from ${current} to ${next}.`, itemId: id, status: current, replayed: false };
  }
  const nextLeadStatus = domain === "showing" && item.lead?.id ? await reconcileLeadStatusAfterShowing(context, {
    currentLeadStatus: item.lead.status,
    nextShowingStatus: next,
    brokerageId,
    leadId: item.lead.id,
    showingId: id
  }) : null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const update = transitionUpdate(domain, next, item, now, evidenceVersion);
  if (domain === "showing" && next === "scheduled") update.scheduledEnd = item.scheduledEnd;
  await sudo.query[definition.list].updateOne({ where: { id }, data: update, query: `id ${definition.field}` });
  if (domain === "showing" && item.lead?.id && nextLeadStatus !== null && nextLeadStatus !== item.lead.status) {
    await sudo.query.Lead.updateOne({ where: { id: item.lead.id }, data: { status: nextLeadStatus }, query: "id" });
  }
  if (domain === "offer" && next === "accepted" && item.deal?.id) {
    await sudo.query.Deal.updateOne({ where: { id: item.deal.id }, data: { offerAmount: item.amount }, query: "id" });
  }
  const leadId = domain === "lead" ? id : item.lead?.id;
  if (leadId) {
    await sudo.query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: leadId } },
        ...item.property?.id ? { property: { connect: { id: item.property.id } } } : {},
        ...domain === "showing" ? { showing: { connect: { id } } } : {},
        agent: { connect: { id: sessionId(context) } },
        activityType: "status_change",
        direction: "internal",
        channel: "crm",
        subject: `${domain} status changed`,
        body: [data.note ? safeString(data.note) : "", `${current} \u2192 ${next}`].filter(Boolean).join("\n"),
        occurredAt: now
      },
      query: "id"
    });
  }
  const result = { ok: true, message: `${domain} transitioned to ${next}.`, itemId: id, status: next, replayed: false };
  if (supportsEvents && brokerageId) {
    await enqueueDomainEvent(sudo, {
      eventKey,
      eventType: `${domain}.status_changed`,
      brokerageId,
      aggregateType: domain,
      aggregateId: id,
      actorId: sessionId(context),
      action: "transition",
      request,
      before: { ...item, [definition.field]: current },
      after: result,
      occurredAt: now
    });
  }
  return result;
}
async function transition(context, domain, data) {
  const id = safeString(data.id);
  const next = safeString(data.status);
  const key = safeString(data.idempotencyKey);
  if (!id || id.length > 200 || !next || next.length > 80 || safeString(data.note).length > 5e3 || !key || key.length > 120) return { ok: false, message: "A record, target status, and bounded idempotency key are required.", itemId: null, status: null, replayed: false };
  if (!sessionId(context) || !hasDomainPermission(context, domain)) {
    return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
  }
  if (typeof context.transaction !== "function") {
    return { ok: false, message: "Transitions are temporarily unavailable.", itemId: null, status: null, replayed: false };
  }
  return context.transaction(async (transactionContext) => {
    const sessionContext = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext);
    if (!hasDomainPermission(sessionContext, domain)) return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
    return transitionInContext(sessionContext, domain, data);
  }, { timeout: 3e4 });
}
var transitionLeadStatus = (_root, { data }, context) => transition(context, "lead", data);
var transitionPropertyStatus = (_root, { data }, context) => transition(context, "property", data);
var transitionOpenHouseStatus = (_root, { data }, context) => transition(context, "openHouse", data);
var transitionShowingStatus = (_root, { data }, context) => transition(context, "showing", data);
async function reviewShowingCommand(_root, { data }, context) {
  if (!data.expectedStatus || !data.expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(data.expectedRevision || "") || !Number.isFinite(new Date(data.expectedUpdatedAt).getTime())) {
    return { ok: false, message: "Refresh the showing and review its current version before deciding.", itemId: null, status: null, replayed: false };
  }
  return transition(context, "showing", data);
}
var transitionOfferStatus = (_root, { data }, context) => transition(context, "offer", data);
var transitionDealStage = (_root, { data }, context) => transition(context, "deal", data);
var transitionCommissionStatus = (_root, { data }, context) => transition(context, "commission", data);
var transitionDisclosureStatus = (_root, { data }, context) => transition(context, "disclosure", data);
var transitionTransactionMilestoneStatus = (_root, { data }, context) => transition(context, "milestone", data);

// features/keystone/mutations/savedDiscovery.ts
function userId(context) {
  return context.session?.itemId;
}
function clean3(value) {
  return String(value || "").trim();
}
function unauthenticated() {
  return { ok: false, message: "Sign in to save property discovery preferences.", itemId: null };
}
function savedPropertyStatus(value) {
  return value && ["saved", "interested", "hidden"].includes(value) ? value : "saved";
}
async function withSavedDiscoveryLock(context, kind, target, execute) {
  return context.transaction(async (transactionContext) => {
    const scoped = await freshOperatorCommandContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext
    );
    const currentUserId = userId(scoped);
    const brokerageId = activeBrokerageIds(scoped.session)[0];
    if (!currentUserId || !brokerageId) throw new Error("An active brokerage membership is required.");
    await lockSavedDiscoveryIdentity(scoped.sudo().prisma, kind, brokerageId, currentUserId, target);
    return execute(scoped, currentUserId, brokerageId);
  }, { timeout: 3e4 });
}
async function withSavedDiscoveryRecordLock(context, kind, recordId, notFoundMessage, readIdentity, remove) {
  const notFound = () => ({ ok: false, message: notFoundMessage, itemId: null });
  return context.transaction(async (transactionContext) => {
    const scoped = await freshOperatorCommandContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext
    );
    const currentUserId = userId(scoped);
    const brokerageId = activeBrokerageIds(scoped.session)[0];
    if (!currentUserId || !brokerageId) return notFound();
    const beforeLock = await readIdentity(scoped, recordId);
    if (!isOwnedRecordIdentity(beforeLock, recordId, currentUserId, brokerageId)) return notFound();
    await lockSavedDiscoveryIdentity(scoped.sudo().prisma, kind, brokerageId, currentUserId, beforeLock.target);
    const afterLock = await readIdentity(scoped, recordId);
    if (!isOwnedRecordIdentity(afterLock, recordId, currentUserId, brokerageId) || !sameRecordIdentity(beforeLock, afterLock)) {
      return notFound();
    }
    return remove(scoped, afterLock.itemId);
  }, { timeout: 3e4 });
}
function isOwnedRecordIdentity(identity, recordId, currentUserId, brokerageId) {
  return Boolean(identity && identity.itemId === recordId && identity.userId === currentUserId && identity.brokerageId === brokerageId && identity.target);
}
function sameRecordIdentity(left, right) {
  return left.itemId === right.itemId && left.userId === right.userId && left.brokerageId === right.brokerageId && left.target === right.target;
}
async function savePropertyForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const propertyId = clean3(data.propertyId);
  if (!propertyId) return { ok: false, message: "Choose a property to save.", itemId: null };
  if (!activeBrokerageIds(context.session).length) return { ok: false, message: "This property is not available to save.", itemId: null };
  const savedStatus = savedPropertyStatus(data.status);
  return withSavedDiscoveryLock(context, "property", propertyId, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated();
    const sudo = scoped.sudo();
    const property = await sudo.query.Property.findOne({ where: { id: propertyId }, query: "id status brokerage { id }" });
    if (!property || property.brokerage?.id !== brokerageId || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This property is not available to save.", itemId: null };
    }
    const existing = await sudo.query.SavedProperty.findMany({
      where: { user: { id: { equals: lockedUserId } }, property: { id: { equals: propertyId } } },
      take: 2,
      query: "id"
    });
    if (existing.length > 1) return { ok: false, message: "Duplicate saved-property records require records review.", itemId: null };
    if (existing[0]?.id) {
      const item2 = await sudo.query.SavedProperty.updateOne({
        where: { id: existing[0].id },
        data: { status: savedStatus, notes: clean3(data.notes) },
        query: "id"
      });
      return { ok: true, message: "Saved property updated.", itemId: item2.id };
    }
    const item = await sudo.query.SavedProperty.createOne({
      data: {
        status: savedStatus,
        notes: clean3(data.notes),
        property: { connect: { id: propertyId } },
        user: { connect: { id: lockedUserId } }
      },
      query: "id"
    });
    return { ok: true, message: "Property saved.", itemId: item.id };
  });
}
async function removeSavedPropertyForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const id = clean3(data.savedPropertyId);
  if (!id || !activeBrokerageIds(context.session).length) return { ok: false, message: "Saved property not found.", itemId: null };
  return withSavedDiscoveryRecordLock(
    context,
    "property",
    id,
    "Saved property not found.",
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedProperty.findOne({
        where: { id: recordId },
        query: "id user { id } property { id brokerage { id status } }"
      });
      const propertyId = typeof item?.property?.id === "string" ? item.property.id : "";
      const brokerage = item?.property?.brokerage;
      if (!item?.id || !item.user?.id || !propertyId || clean3(propertyId) !== propertyId || !brokerage?.id || brokerage.status !== "active") return null;
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: propertyId };
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedProperty.deleteOne({ where: { id: recordId }, query: "id" });
      return { ok: true, message: "Saved property removed.", itemId: recordId };
    }
  );
}
async function saveSearchForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const name = clean3(data.name);
  if (!name) return { ok: false, message: "Name the search before saving it.", itemId: null };
  if (!activeBrokerageIds(context.session).length) return { ok: false, message: "An active brokerage membership is required.", itemId: null };
  return withSavedDiscoveryLock(context, "search", name, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated();
    const sudo = scoped.sudo();
    const existing = await sudo.query.SavedSearch.findMany({
      where: { brokerage: { id: { equals: brokerageId } }, user: { id: { equals: lockedUserId } }, name: { equals: name } },
      take: 2,
      query: "id"
    });
    if (existing.length > 1) return { ok: false, message: "Duplicate saved-search records require records review.", itemId: null };
    const values = {
      name,
      city: clean3(data.city),
      state: clean3(data.state),
      propertyType: clean3(data.propertyType),
      minPrice: clean3(data.minPrice) || null,
      maxPrice: clean3(data.maxPrice) || null,
      minBedrooms: data.minBedrooms ?? null,
      minBathrooms: clean3(data.minBathrooms) || null,
      minSquareFeet: data.minSquareFeet ?? null,
      keywords: clean3(data.keywords),
      alertsEnabled: data.alertsEnabled ?? true
    };
    if (existing[0]?.id) {
      const item2 = await sudo.query.SavedSearch.updateOne({ where: { id: existing[0].id }, data: values, query: "id" });
      return { ok: true, message: "Saved search updated.", itemId: item2.id };
    }
    const item = await sudo.query.SavedSearch.createOne({
      data: { ...values, brokerage: { connect: { id: brokerageId } }, user: { connect: { id: lockedUserId } } },
      query: "id"
    });
    return { ok: true, message: "Search saved.", itemId: item.id };
  });
}
async function deleteSavedSearchForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const id = clean3(data.savedSearchId);
  if (!id || !activeBrokerageIds(context.session).length) return { ok: false, message: "Saved search not found.", itemId: null };
  return withSavedDiscoveryRecordLock(
    context,
    "search",
    id,
    "Saved search not found.",
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedSearch.findOne({
        where: { id: recordId },
        query: "id name user { id } brokerage { id status }"
      });
      const name = typeof item?.name === "string" ? item.name : "";
      const brokerage = item?.brokerage;
      if (!item?.id || !name || clean3(name) !== name || !item.user?.id || !brokerage?.id || brokerage.status !== "active") return null;
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: name };
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedSearch.deleteOne({ where: { id: recordId }, query: "id" });
      return { ok: true, message: "Saved search deleted.", itemId: recordId };
    }
  );
}

// features/keystone/mutations/submitListingInquiry.ts
function clean4(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function validContact2(email, phone) {
  const emailValid = !email || email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = !phone || phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  return emailValid && phoneValid && Boolean(email || phone);
}
function normalizeIntent(intent) {
  const value = clean4(intent);
  return ["buy", "rent", "sell", "invest", "unknown"].includes(value) ? value : "unknown";
}
function matchesRule(rule, property, intent) {
  if (!rule.assignedAgent?.id) return false;
  if (rule.intent && rule.intent !== "any" && rule.intent !== intent) return false;
  if (rule.source && rule.source !== "any" && rule.source !== "website") return false;
  if (rule.city && property?.city && rule.city.toLowerCase() !== property.city.toLowerCase()) return false;
  if (rule.state && property?.state && rule.state.toLowerCase() !== property.state.toLowerCase()) return false;
  if (rule.postalCode && property?.postalCode && rule.postalCode !== property.postalCode) return false;
  return true;
}
async function findRoutingAgentId2(context, property, intent) {
  const rules2 = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: "active" }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: "asc" }],
    take: 50,
    query: "id intent source city state postalCode isFallback assignedAgent { id }"
  });
  const matchingRule = rules2.find((rule) => matchesRule(rule, property, intent));
  const fallbackRule = rules2.find((rule) => rule.isFallback && rule.assignedAgent?.id);
  return matchingRule?.assignedAgent?.id || property?.assignedAgent?.id || fallbackRule?.assignedAgent?.id || null;
}
async function submitListingInquiry(root, { data }, context) {
  const brokerageSlug = clean4(data.brokerageSlug).toLowerCase();
  const propertyId = clean4(data.propertyId);
  const name = clean4(data.name);
  const email = clean4(data.email);
  const phone = clean4(data.phone);
  const message = clean4(data.message);
  const preferredTime = clean4(data.preferredTime);
  const intent = normalizeIntent(data.intent);
  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug)) {
    return { ok: false, message: "Choose a listing before sending an inquiry.", leadId: null };
  }
  if (!name || name.length > 120 || message.length > 5e3 || preferredTime.length > 200 || !validContact2(email, phone)) {
    return {
      ok: false,
      message: "Add your name and either an email or phone number so an agent can follow up.",
      leadId: null
    };
  }
  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: "active" } }, take: 1, query: "id" });
  if (!brokerages[0]) return { ok: false, message: "This listing is unavailable.", leadId: null };
  return context.transaction(async (transactionContext) => {
    const context2 = transactionContext;
    await lockBrokerageCommand(context2, brokerages[0].id);
    await lockPropertyForDecision(context2, propertyId, brokerages[0].id);
    const properties = await context2.sudo().query.Property.findMany({
      where: {
        id: { equals: propertyId },
        brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } }
      },
      take: 1,
      query: "id title status city state postalCode brokerage { id } assignedAgent { id }"
    });
    const property = properties[0];
    if (!property || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This listing is no longer accepting inquiries.", leadId: null };
    }
    try {
      await requireListingAuthority(context2, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || "", jurisdictionCode: property.state, destination: "public_site" });
    } catch {
      return { ok: false, message: "This listing is not currently authorized for public inquiry.", leadId: null };
    }
    const body = [
      message || "Website listing inquiry",
      preferredTime ? `Preferred showing time: ${preferredTime}` : ""
    ].filter(Boolean).join("\n\n");
    const assignedAgentId = await findRoutingAgentId2(transactionContext, property, intent);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent,
      source: "website",
      status: "new",
      message: body,
      propertyId,
      assignedAgentId
    });
    const recent = await transactionContext.sudo().query.LeadActivity.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, activityType: { equals: "inquiry" }, occurredAt: { gte: new Date(Date.now() - 60 * 6e4).toISOString() } },
      take: 5,
      query: "id"
    });
    if (recent.length >= 5) return { ok: false, message: "Unable to accept this request. Please contact the brokerage directly.", leadId: null };
    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: capture.lead.id } },
        property: { connect: { id: propertyId } },
        activityType: "inquiry",
        direction: "inbound",
        channel: "website",
        subject: capture.reused ? "Repeat website listing inquiry matched" : assignedAgentId ? "Website listing inquiry routed" : "Website listing inquiry",
        body: `${body}${assignedAgentId ? "\n\nAuto-routed by lead routing rules/property agent." : ""}`,
        occurredAt: now
      },
      query: "id"
    });
    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-inquiry:${activity.id}`,
      eventType: "lead.inquiry_captured",
      brokerageId: property.brokerage.id,
      aggregateType: "lead",
      aggregateId: capture.lead.id,
      action: "capture_inquiry",
      request: { propertyId, intent, identityKey: capture.identityKey },
      before: null,
      after: { leadId: capture.lead.id, activityId: activity.id, reused: capture.reused }
    });
    return {
      ok: true,
      message: "Inquiry sent. An agent will follow up with next steps shortly.",
      leadId: null
    };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/controlledEvidenceCommand.ts
function evidenceActorId(context) {
  return context.session?.itemId;
}
function evidenceRole(context) {
  return context.session?.data?.role || {};
}
function evidenceBrokerageId(context) {
  return activeBrokerageIds(context.session)[0];
}
async function runControlledEvidenceCommand(context, options) {
  const actor = evidenceActorId(context);
  const brokerageId = evidenceBrokerageId(context);
  const role5 = evidenceRole(context);
  if (!actor || !brokerageId || !role5[options.permission] || options.managerRequired && !role5.canManagePeople) {
    return { ok: false, message: "Access denied.", itemId: null, replayed: false };
  }
  if (!options.eventKey || options.eventKey.length > 240 || !options.lockKey || options.lockKey.length > 240) {
    return { ok: false, message: "A bounded command key is required.", itemId: null, replayed: false };
  }
  return context.transaction(async (transactionContext) => {
    const scoped = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext);
    const currentRole = evidenceRole(scoped);
    if (!currentRole[options.permission] || options.managerRequired && !currentRole.canManagePeople) {
      return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    }
    const sudo = scoped.sudo();
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", options.lockKey);
    await lockCommandAggregate(scoped, options.lockKey, evidenceBrokerageId(scoped));
    if (options.authorizeTarget && !await options.authorizeTarget(scoped)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    const candidate = await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey: options.eventKey }, query: options.authorizeReplayHeader ? SHOWING_EVENT_HEADER_QUERY : "id requestHash payload brokerage { id }" });
    if (candidate && options.authorizeReplayHeader && !await options.authorizeReplayHeader(scoped, candidate)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    if (candidate && options.authorizeReplayHeader && candidate.requestHash !== domainPayloadHash(options.request)) throw new Error("Domain command idempotency key was reused with different input");
    const existing = candidate && options.authorizeReplayHeader ? await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey: options.eventKey }, query: "id requestHash payloadHash payload brokerage { id }" }) : candidate;
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash || options.authorizeReplayHeader && !showingEventPayloadMatches(candidate, existing))) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    if (existing) {
      if (existing.brokerage?.id !== evidenceBrokerageId(scoped)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
      if (existing.requestHash !== domainPayloadHash(options.request)) throw new Error("Domain command idempotency key was reused with different input");
      if (options.authorizeReplay && !await options.authorizeReplay(scoped, existing)) {
        return { ok: false, message: "Access denied.", itemId: null, replayed: false };
      }
      return { ...existing.payload?.result || {}, replayed: true };
    }
    const executed = await options.execute(scoped);
    if (!executed.result.ok) return { ...executed.result, replayed: false };
    await enqueueDomainEvent(sudo, { eventKey: options.eventKey, request: options.request, ...executed.event });
    return { ...executed.result, replayed: false };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/operatorCommands.ts
function actorId(context) {
  return context.session?.itemId;
}
function role2(context) {
  return context.session?.data?.role || {};
}
function authorized(context, brokerageId, permission, ownerId) {
  const actor = actorId(context);
  if (!actor || !role2(context)[permission] || !activeBrokerageIds(context.session).includes(brokerageId)) return false;
  return Boolean(role2(context).canManagePeople || !ownerId || ownerId === actor);
}
function validMoney(value) {
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(value);
}
async function command(context, options) {
  return runControlledEvidenceCommand(context, options);
}
async function inviteBrokerageMemberCommand(_root, { data }, context) {
  const brokerageId = commandText(data.brokerageId), name = commandText(data.name), email = commandText(data.email).toLowerCase(), password2 = String(data.temporaryPassword || ""), roleName = commandText(data.roleName), membershipRole = commandText(data.membershipRole), key = commandText(data.idempotencyKey);
  const allowedRoles = ["Brokerage Admin", "Listing Agent", "Brokerage Analyst"];
  const allowedMemberships = ["admin", "team_lead", "agent", "coordinator", "analyst"];
  if (!brokerageId || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || password2.length < 12 || password2.length > 200 || !allowedRoles.includes(roleName) || !allowedMemberships.includes(membershipRole) || !key) {
    return { ok: false, message: "Valid member details, a 12+ character temporary password, and idempotency key are required.", itemId: null, replayed: false };
  }
  const actorMembership = context.session?.data?.brokerageMemberships?.find((membership) => membership.brokerage?.id === brokerageId && membership.status === "active" && membership.brokerage?.status === "active");
  if (!actorMembership || !["owner", "admin"].includes(actorMembership.membershipRole) || !role2(context).canManageRoles) return { ok: false, message: "Brokerage owner or administrator role authority is required.", itemId: null, replayed: false };
  if ((roleName === "Brokerage Admin" || membershipRole === "admin") && actorMembership.membershipRole !== "owner") return { ok: false, message: "Only a brokerage owner can add another administrator.", itemId: null, replayed: false };
  const request = { brokerageId, name, email, password: password2, roleName, membershipRole };
  return command(context, {
    eventKey: `command:brokerage:${brokerageId}:invite-member:${key}`,
    lockKey: `membership:${brokerageId}:${email}`,
    permission: "canManagePeople",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [brokerage, existingUsers, roles] = await Promise.all([
        sudo.query.Brokerage.findOne({ where: { id: brokerageId }, query: "id slug status" }),
        sudo.query.User.findMany({ where: { email: { equals: email } }, take: 1, query: "id" }),
        sudo.query.Role.findMany({ where: { name: { equals: roleName } }, take: 2, query: "id name" })
      ]);
      if (!brokerage || brokerage.status !== "active" || !activeBrokerageIds(scoped.session).includes(brokerage.id)) return { result: { ok: false, message: "Brokerage not found or access denied.", itemId: null }, event: null };
      if (existingUsers.length) return { result: { ok: false, message: "That email already belongs to an account; membership linking requires owner review.", itemId: null }, event: null };
      if (roles.length !== 1) return { result: { ok: false, message: "The selected immutable role template is unavailable.", itemId: null }, event: null };
      const user = await sudo.query.User.createOne({ data: { name, email, password: password2, role: { connect: { id: roles[0].id } }, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: "not_started" }, query: "id name email" });
      const membership = await sudo.query.BrokerageMembership.createOne({ data: { membershipKey: `${brokerage.slug}:${email}`, brokerage: { connect: { id: brokerage.id } }, user: { connect: { id: user.id } }, membershipRole, status: "active", isPrimary: true, joinedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Brokerage member created. Share the temporary password through an approved private channel.", itemId: user.id };
      return { result, event: { eventType: "brokerage.member_created", brokerageId: brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "create_member", before: null, after: { ...result, email, roleName, membershipRole } } };
    }
  });
}
async function suspendBrokerageMemberCommand(_root, { data }, context) {
  const membershipId = commandText(data.membershipId), key = commandText(data.idempotencyKey);
  if (!membershipId || !key) return { ok: false, message: "Membership and idempotency key are required.", itemId: null, replayed: false };
  return command(context, {
    eventKey: `command:membership:${membershipId}:suspend:${key}`,
    lockKey: `membership:${membershipId}`,
    permission: "canManagePeople",
    request: { membershipId },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const membership = await sudo.query.BrokerageMembership.findOne({ where: { id: membershipId }, query: "id status membershipRole brokerage { id } user { id email }" });
      const actorMembership = scoped.session?.data?.brokerageMemberships?.find((item) => item.brokerage?.id === membership?.brokerage?.id && item.status === "active" && item.brokerage?.status === "active");
      if (!membership || !actorMembership || !["owner", "admin"].includes(actorMembership.membershipRole) || !activeBrokerageIds(scoped.session).includes(membership.brokerage?.id) || membership.user?.id === actorId(scoped)) return { result: { ok: false, message: "Membership not found or access denied.", itemId: null }, event: null };
      if (membership.membershipRole === "owner") {
        if (actorMembership.membershipRole !== "owner") return { result: { ok: false, message: "Only an owner can suspend another owner.", itemId: null }, event: null };
        const owners = await sudo.query.BrokerageMembership.findMany({ where: { brokerage: { id: { equals: membership.brokerage.id } }, membershipRole: { equals: "owner" }, status: { equals: "active" }, id: { not: { equals: membership.id } } }, take: 1, query: "id" });
        if (!owners.length) return { result: { ok: false, message: "The last active brokerage owner cannot be suspended.", itemId: null }, event: null };
      }
      if (membership.status === "suspended") return { result: { ok: true, message: "Membership is already suspended.", itemId: membership.id }, event: { eventType: "brokerage.member_suspension_replayed", brokerageId: membership.brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "suspend_member", before: { status: "suspended" }, after: { status: "suspended" } } };
      await sudo.query.BrokerageMembership.updateOne({ where: { id: membership.id }, data: { status: "suspended", isPrimary: false }, query: "id" });
      const result = { ok: true, message: "Membership suspended; its next request will fail active-membership authorization.", itemId: membership.id };
      return { result, event: { eventType: "brokerage.member_suspended", brokerageId: membership.brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "suspend_member", before: { status: membership.status }, after: { ...result, status: "suspended" } } };
    }
  });
}
async function updateDealFinancialTermsCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), offerAmount = commandText(data.offerAmount), commissionAmount = commandText(data.commissionAmount), key = commandText(data.idempotencyKey);
  if (!dealId || !key || !validMoney(offerAmount) || commissionAmount && !validMoney(commissionAmount)) {
    return { ok: false, message: "Deal, valid financial terms, and idempotency key are required.", itemId: null, replayed: false };
  }
  if (!role2(context).canManagePeople) return { ok: false, message: "Brokerage manager access is required.", itemId: null, replayed: false };
  const request = { dealId, offerAmount, commissionAmount };
  return command(context, {
    eventKey: `command:deal:${dealId}:financial-terms:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id stage offerAmount commissionAmount brokerage { id }" });
      if (!deal || !authorized(scoped, deal.brokerage?.id, "canManageDeals") || !role2(scoped).canManagePeople) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      const accepted = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: dealId } }, status: { equals: "accepted" } }, take: 1, query: "id" });
      if (["closed_won", "closed_lost"].includes(deal.stage) || accepted.length) return { result: { ok: false, message: "Accepted or closed financial terms require an append-only correction, not editing.", itemId: null }, event: null };
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { offerAmount, commissionAmount: commissionAmount || null }, query: "id" });
      const result = { ok: true, message: "Deal financial terms recorded.", itemId: dealId };
      return { result, event: { eventType: "deal.financial_terms_updated", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: dealId, actorId: actorId(scoped), action: "update_financial_terms", before: { offerAmount: deal.offerAmount, commissionAmount: deal.commissionAmount }, after: { ...result, offerAmount, commissionAmount: commissionAmount || null } } };
    }
  });
}
async function updateDealNextStepCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), nextStep = commandText(data.nextStep), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!dealId || !nextStep || nextStep.length > 500 || notes.length > 1e4 || !key) return { ok: false, message: "Deal, next step, and idempotency key are required.", itemId: null, replayed: false };
  const request = { dealId, nextStep, notes };
  return command(context, {
    eventKey: `command:deal:${dealId}:next-step:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id nextStep notes brokerage { id } assignedAgent { id }" });
      if (!deal || !authorized(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { nextStep, notes }, query: "id" });
      const result = { ok: true, message: "Next step saved.", itemId: dealId };
      return { result, event: { eventType: "deal.next_step_updated", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: dealId, actorId: actorId(scoped), action: "update_next_step", before: { nextStep: deal.nextStep, notes: deal.notes }, after: result } };
    }
  });
}
async function completeShowingWithFeedback(_root, { data }, context) {
  const showingId = commandText(data.showingId), feedback = commandText(data.feedback), key = commandText(data.idempotencyKey);
  if (!showingId || !feedback || feedback.length > 1e4 || !key) return { ok: false, message: "Showing, feedback, and idempotency key are required.", itemId: null, replayed: false };
  const request = {
    showingId,
    feedback,
    ...data.expectedStatus != null ? { expectedStatus: commandText(data.expectedStatus) } : {},
    ...data.expectedUpdatedAt != null ? { expectedUpdatedAt: commandText(data.expectedUpdatedAt) } : {},
    ...data.expectedRevision != null ? { expectedRevision: commandText(data.expectedRevision) } : {}
  };
  return command(context, {
    eventKey: `command:showing:${showingId}:feedback:${key}`,
    lockKey: `aggregate:showing:${showingId}`,
    permission: "canManageShowings",
    request,
    authorizeTarget: async (scoped) => Boolean(await scopedShowingIdentity(scoped, showingId)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:showing:${showingId}:feedback:${key}`, eventType: "showing.completed_with_feedback", purpose: "showing" }),
    authorizeReplay: async (scoped, existing) => {
      if (existing.payload?.actorId !== actorId(scoped) || existing.payload?.aggregate?.type !== "showing" || existing.payload.aggregate.id !== showingId || existing.payload?.request?.showingId !== showingId || existing.payload?.result?.itemId !== showingId || existing.payload?.result?.ok !== true) return false;
      const header = await scopedShowingIdentity(scoped, showingId);
      if (!header || existing.payload.result.subject?.showingId !== showingId || existing.payload.result.subject?.leadId !== header.lead.id || existing.payload.result.subject?.propertyId !== header.property.id) return false;
      const showing = await scoped.sudo().query.Showing.findOne({ where: { id: showingId }, query: "id brokerage { id } assignedAgent { id }" });
      return Boolean(showing && authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id));
    },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const header = await scopedShowingIdentity(scoped, showingId);
      if (!header) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      await lockPropertyForDecision(scoped, header.property.id, header.brokerage.id);
      const showing = await sudo.query.Showing.findOne({ where: { id: showingId }, query: "id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }" });
      if (!sameShowingIdentity(showing, header)) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      if (!showing || !authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id)) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      if (data.expectedStatus != null && showing.status !== commandText(data.expectedStatus) || data.expectedUpdatedAt != null && showing.updatedAt !== commandText(data.expectedUpdatedAt) || data.expectedRevision != null && await showingReviewRevision(scoped, showing) !== commandText(data.expectedRevision)) {
        return { result: { ok: false, message: "The showing changed after review. Refresh before saving feedback.", itemId: showingId }, event: null };
      }
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: showing.brokerage.id, leadId: showing.lead?.id, propertyId: showing.property?.id, practitionerId: showing.assignedAgent?.id || actorId(scoped), jurisdictionCode: showing.property?.state, side: "buyer", allowCustomerAssistance: true });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Practitioner authority is required.", itemId: showingId }, event: null };
      }
      if (showing.status !== "scheduled") return { result: { ok: false, message: `Cannot complete showing from ${showing.status}.`, itemId: showingId }, event: null };
      const nextLeadStatus = showing.lead?.id ? await reconcileLeadStatusAfterShowing(scoped, {
        currentLeadStatus: showing.lead.status,
        nextShowingStatus: "completed",
        brokerageId: showing.brokerage.id,
        leadId: showing.lead.id,
        showingId
      }) : void 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.Showing.updateOne({ where: { id: showingId }, data: { feedback, status: "completed" }, query: "id" });
      if (showing.lead?.id) {
        await sudo.query.Lead.updateOne({ where: { id: showing.lead.id }, data: { status: nextLeadStatus || showing.lead.status, lastContactedAt: now }, query: "id" });
        await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: showing.brokerage.id } }, lead: { connect: { id: showing.lead.id } }, ...showing.property?.id ? { property: { connect: { id: showing.property.id } } } : {}, showing: { connect: { id: showingId } }, agent: { connect: { id: actorId(scoped) } }, activityType: "showing_feedback", direction: "internal", channel: "crm", subject: "Showing feedback", body: feedback, occurredAt: now }, query: "id" });
      }
      const result = { ok: true, message: "Feedback saved and showing completed.", itemId: showingId };
      return { result, event: { eventType: "showing.completed_with_feedback", brokerageId: showing.brokerage.id, aggregateType: "showing", aggregateId: showingId, actorId: actorId(scoped), action: "complete_with_feedback", before: { status: showing.status, feedback: showing.feedback }, after: { ...result, status: "completed", subject: { showingId, leadId: header.lead.id, propertyId: header.property.id } } } };
    }
  });
}
async function addLeadActivityCommand(_root, { data }, context) {
  const leadId = commandText(data.leadId), body = commandText(data.body), key = commandText(data.idempotencyKey);
  if (!leadId || !body || body.length > 1e4 || commandText(data.subject).length > 200 || !key) return { ok: false, message: "Lead, body, and idempotency key are required.", itemId: null, replayed: false };
  const request = { leadId, propertyId: commandText(data.propertyId), activityType: commandText(data.activityType) || "note", direction: commandText(data.direction) || "internal", channel: commandText(data.channel) || "crm", subject: commandText(data.subject), body };
  return command(context, {
    eventKey: `command:lead:${leadId}:activity:${key}`,
    lockKey: `aggregate:lead:${leadId}`,
    permission: "canManageLeads",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const lead = await sudo.query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id } assignedAgent { id } property { id }" });
      if (!lead || !authorized(scoped, lead.brokerage?.id, "canManageLeads", lead.assignedAgent?.id)) return { result: { ok: false, message: "Lead not found or access denied.", itemId: null }, event: null };
      const activity = await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, ...request.propertyId ? { property: { connect: { id: request.propertyId } } } : {}, agent: { connect: { id: actorId(scoped) } }, activityType: request.activityType, direction: request.direction, channel: request.channel, subject: request.subject || "CRM note", body, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Activity saved.", itemId: activity.id };
      return { result, event: { eventType: "lead.activity_added", brokerageId: lead.brokerage.id, aggregateType: "lead", aggregateId: leadId, actorId: actorId(scoped), action: "add_activity", before: null, after: result } };
    }
  });
}
async function scheduleShowingForLeadCommand(_root, { data }, context) {
  const leadId = commandText(data.leadId), propertyId = commandText(data.propertyId), assignedAgentId = commandText(data.assignedAgentId), scheduledStart = commandText(data.scheduledStart), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!leadId || !propertyId || !scheduledStart || notes.length > 5e3 || !key || !Number.isFinite(new Date(scheduledStart).getTime())) return { ok: false, message: "Lead, property, valid schedule, and idempotency key are required.", itemId: null, replayed: false };
  const originalScope = data.originalActorId == null && data.originalBrokerageId == null ? null : { originalActorId: commandText(data.originalActorId), originalBrokerageId: commandText(data.originalBrokerageId) };
  if (originalScope && (!originalScope.originalActorId || !originalScope.originalBrokerageId)) return { ok: false, message: "Original request scope is unavailable.", itemId: null, replayed: false };
  const request = { leadId, propertyId, assignedAgentId, scheduledStart, notes, ...originalScope || {} };
  return command(context, {
    eventKey: `command:lead:${leadId}:schedule-showing:${key}`,
    lockKey: `aggregate:lead:${leadId}`,
    permission: "canManageShowings",
    request,
    authorizeTarget: async (scoped) => (!originalScope || originalScope.originalActorId === actorId(scoped) && originalScope.originalBrokerageId === activeBrokerageIds(scoped.session)[0]) && Boolean(await scopedSchedulingIdentity(scoped, leadId, propertyId, false)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:lead:${leadId}:schedule-showing:${key}`, eventType: "showing.scheduled", purpose: "owned_receipt", leadId, propertyId }),
    authorizeReplay: (scoped, existing) => ownsShowingScheduleReceipt(scoped, existing, leadId, propertyId),
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId);
      if (!identity) return { result: { ok: false, message: "Lead/property not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      await lockPropertyForDecision(scoped, propertyId, identity.brokerageId);
      const [lead, property] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: "id status brokerage { id } assignedAgent { id } property { id }" }),
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id title slug addressLine1 city state listingType price updatedAt brokerage { id } assignedAgent { id }" })
      ]);
      if (!lead || lead.id !== leadId || !property || property.id !== propertyId || lead.brokerage?.id !== identity.brokerageId || property.brokerage?.id !== identity.brokerageId || !authorized(scoped, lead.brokerage?.id, "canManageShowings", lead.assignedAgent?.id)) return { result: { ok: false, message: "Lead/property not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      if (lead.property?.id !== property.id) return { result: { ok: false, message: "The showing property must match the lead\u2019s recorded listing interest.", itemId: null }, event: null };
      if (lead.status === "closed" || lead.status === "lost") return { result: { ok: false, message: "Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.", itemId: null }, event: null };
      const agentId = assignedAgentId || lead.assignedAgent?.id || property.assignedAgent?.id;
      if (agentId) {
        const agent = await sudo.query.User.findOne({ where: { id: agentId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" });
        if (!(agent?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === lead.brokerage.id && membership.brokerage?.status === "active")) return { result: { ok: false, message: "Assigned agent is outside the brokerage.", itemId: null }, event: null };
        try {
          await requireRepresentationAuthority(scoped, { brokerageId: lead.brokerage.id, leadId, propertyId, practitionerId: agentId, jurisdictionCode: property.state, side: "buyer", allowCustomerAssistance: true });
        } catch (error) {
          return { result: { ok: false, message: error instanceof Error ? error.message : "Showing authority is required.", itemId: null }, event: null };
        }
      } else return { result: { ok: false, message: "An authorized practitioner assignment is required.", itemId: null }, event: null };
      const settings = await sudo.query.BrokerageSettings.findMany({ where: { brokerage: { id: { equals: lead.brokerage.id } } }, take: 1, query: "showingDurationMinutes" });
      const interval = showingInterval(scheduledStart, settings[0]?.showingDurationMinutes || 60);
      await requireAvailableShowingSlot(scoped, { brokerageId: lead.brokerage.id, propertyId, agentId, ...interval });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const showing = await sudo.query.Showing.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, status: "scheduled", showingType: "in_person", ...interval, notes, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, assignedAgent: { connect: { id: agentId } } }, query: "id" });
      await sudo.query.Lead.updateOne({ where: { id: leadId }, data: { status: leadStatusAfterShowing(lead.status, "scheduled"), lastContactedAt: now }, query: "id" });
      await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, showing: { connect: { id: showing.id } }, ...agentId ? { agent: { connect: { id: agentId } } } : {}, activityType: "showing_scheduled", direction: "internal", channel: "crm", subject: "Showing scheduled", body: notes, occurredAt: now }, query: "id" });
      const result = { ok: true, message: "Showing scheduled and lead updated.", itemId: showing.id };
      const receipt = { version: 1, showingId: showing.id, leadId, propertyId };
      const snapshot = showingSnapshot(property, { leadId, assignedAgentId: agentId, ...interval, showingType: "in_person", notes }, now);
      return { result, event: { eventType: "showing.scheduled", brokerageId: lead.brokerage.id, aggregateType: "showing", aggregateId: showing.id, actorId: actorId(scoped), action: "schedule", before: null, after: { ...result, status: "scheduled", receipt, snapshot } } };
    }
  });
}
async function resolveDuplicateLeadCommand(_root, { data }, context) {
  const primaryLeadId = commandText(data.primaryLeadId), duplicateLeadId = commandText(data.duplicateLeadId), note = commandText(data.note), key = commandText(data.idempotencyKey);
  if (!primaryLeadId || !duplicateLeadId || primaryLeadId === duplicateLeadId || note.length > 5e3 || !key) return { ok: false, message: "Two different leads and an idempotency key are required.", itemId: null, replayed: false };
  const request = { primaryLeadId, duplicateLeadId, note };
  return command(context, {
    eventKey: `command:lead:${duplicateLeadId}:merge:${key}`,
    lockKey: `aggregate:lead:${duplicateLeadId}`,
    permission: "canManageLeads",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [primary, duplicate] = await Promise.all([primaryLeadId, duplicateLeadId].map((id) => sudo.query.Lead.findOne({ where: { id }, query: "id name identityKey status brokerage { id } assignedAgent { id } property { id }" })));
      if (!primary || !duplicate || primary.brokerage?.id !== duplicate.brokerage?.id || !authorized(scoped, primary.brokerage?.id, "canManageLeads", primary.assignedAgent?.id) || !authorized(scoped, duplicate.brokerage?.id, "canManageLeads", duplicate.assignedAgent?.id)) return { result: { ok: false, message: "Leads not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      if (primary.identityKey !== duplicate.identityKey) return { result: { ok: false, message: "Lead identities do not match.", itemId: null }, event: null };
      const now = (/* @__PURE__ */ new Date()).toISOString(), body = note || `Merged duplicate ${duplicateLeadId} into ${primaryLeadId}`;
      await sudo.query.Lead.updateOne({ where: { id: duplicateLeadId }, data: { status: "lost", lastContactedAt: now }, query: "id" });
      for (const lead of [primary, duplicate]) await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: primary.brokerage.id } }, lead: { connect: { id: lead.id } }, agent: { connect: { id: actorId(scoped) } }, activityType: "system", direction: "internal", channel: "crm", subject: lead.id === primaryLeadId ? "Duplicate merged" : "Marked duplicate", body, occurredAt: now }, query: "id" });
      const result = { ok: true, message: "Duplicate resolved and timelines updated.", itemId: primaryLeadId };
      return { result, event: { eventType: "lead.duplicate_resolved", brokerageId: primary.brokerage.id, aggregateType: "lead", aggregateId: primaryLeadId, actorId: actorId(scoped), action: "resolve_duplicate", before: { duplicateStatus: duplicate.status }, after: result } };
    }
  });
}

// features/keystone/mutations/domainOutbox.ts
async function domainOutboxEventStatus(_root, { eventKey }, context) {
  if (!context.session?.itemId) return null;
  return context.query.DomainOutboxEvent.findOne({
    where: { eventKey: String(eventKey || "").trim() },
    query: "id eventKey eventType aggregateType aggregateId status attempts replayCount availableAt occurredAt dispatchedAt lastError"
  });
}
async function replayDomainOutboxEvent(_root, { eventId }, context) {
  const role5 = context.session?.data?.role;
  if (!context.session?.itemId || !role5?.canViewReports) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
  return context.transaction(async (transactionContext) => {
    const scoped = transactionContext.withSession(context.session);
    const sudo = scoped.sudo();
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `outbox-replay:${eventId}`);
    const event = await sudo.query.DomainOutboxEvent.findOne({ where: { id: eventId }, query: "id status replayCount brokerage { id }" });
    if (!event || !activeBrokerageIds(scoped.session).includes(event.brokerage?.id)) return { ok: false, message: "Event not found or access denied.", itemId: null, replayed: false };
    if (event.status === "pending") return { ok: true, message: "Event is already pending.", itemId: event.id, replayed: true };
    if (!["failed", "dispatched"].includes(event.status)) return { ok: false, message: `Cannot replay event from ${event.status}.`, itemId: event.id, replayed: false };
    await sudo.query.DomainOutboxEvent.updateOne({ where: { id: event.id }, data: { status: "pending", replayCount: Number(event.replayCount || 0) + 1, availableAt: (/* @__PURE__ */ new Date()).toISOString(), lastError: "" }, query: "id" });
    await sudo.query.DomainAuditEvent.createOne({ data: { eventKey: `outbox:${event.id}:replay:${Number(event.replayCount || 0) + 1}`, brokerage: { connect: { id: event.brokerage.id } }, aggregateType: "domainOutboxEvent", aggregateId: normalizeDomainIdentifier(event.id, "Outbox event identifier"), action: "replay", actor: { connect: { id: context.session.itemId } }, beforeState: normalizeDomainJson({ status: event.status, replayCount: event.replayCount }), afterState: normalizeDomainJson({ status: "pending", replayCount: Number(event.replayCount || 0) + 1 }), occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
    return { ok: true, message: "Event queued for replay.", itemId: event.id, replayed: false };
  }, { timeout: 3e4 });
}

// features/keystone/lib/listingBoardCursor.ts
var import_node_crypto5 = require("node:crypto");
var INVALID_LISTING_CURSOR = "Invalid, stale, or mismatched Listing page cursor.";
function listingCursorFingerprint(binding) {
  return (0, import_node_crypto5.createHash)("sha256").update(JSON.stringify(binding)).digest("base64url");
}
function encodeListingCursor(cursor, fingerprint) {
  const date = new Date(cursor.updatedAt);
  if (!cursor.id || cursor.id.length > 200 || !Number.isFinite(date.getTime())) throw new Error(INVALID_LISTING_CURSOR);
  const payload = { version: 1, id: cursor.id, updatedAt: date.toISOString(), fingerprint };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decodeListingCursor(value, expectedFingerprint) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const payload = JSON.parse(bytes.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const candidate = payload;
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null;
    if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 200) return null;
    if (typeof candidate.updatedAt !== "string") return null;
    const date = new Date(candidate.updatedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.updatedAt) return null;
    return { id: candidate.id, updatedAt: candidate.updatedAt };
  } catch {
    return null;
  }
}

// features/keystone/lib/showingDateRange.ts
function showingDateRange(range, now = /* @__PURE__ */ new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (range === "upcoming") return { gte: now.toISOString() };
  if (range === "past") return { lt: start.toISOString() };
  if (!range || range === "all") return null;
  const end = new Date(start);
  if (range === "today") end.setUTCDate(end.getUTCDate() + 1);
  else if (range === "week") end.setUTCDate(end.getUTCDate() + 7);
  else if (range === "month") end.setUTCDate(end.getUTCDate() + 30);
  else return { gte: start.toISOString() };
  return { gte: start.toISOString(), lt: end.toISOString() };
}

// features/keystone/lib/showingBoardCursor.ts
var import_node_crypto6 = require("node:crypto");
var INVALID_SHOWING_CURSOR = "Invalid, stale, or mismatched Showing page cursor.";
function showingCursorFingerprint(binding) {
  return (0, import_node_crypto6.createHash)("sha256").update(JSON.stringify(binding)).digest("base64url");
}
function encodeShowingCursor(cursor, fingerprint) {
  const payload = { version: 1, ...cursor, fingerprint };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decodeShowingCursor(value, expectedFingerprint) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const payload = JSON.parse(bytes.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const candidate = payload;
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null;
    if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 200) return null;
    if (typeof candidate.scheduledStart !== "string") return null;
    const date = new Date(candidate.scheduledStart);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.scheduledStart) return null;
    return { id: candidate.id, scheduledStart: candidate.scheduledStart };
  } catch {
    return null;
  }
}

// features/keystone/mutations/platformProjections.ts
function clean5(value) {
  return String(value || "").trim();
}
function role3(context) {
  return context.session?.data?.role || {};
}
function actorId2(context) {
  return context.session?.itemId;
}
function scope(context, permission) {
  const ids = activeBrokerageIds(context.session);
  if (!actorId2(context) || !role3(context)[permission] || !ids.length) throw new Error("Access denied.");
  return { ids, actor: actorId2(context), managesAll: Boolean(role3(context).canManagePeople) };
}
function assignmentWhere(context, permission) {
  const current = scope(context, permission);
  return {
    current,
    where: current.managesAll ? { brokerage: { id: { in: current.ids } } } : { AND: [{ brokerage: { id: { in: current.ids } } }, { assignedAgent: { id: { equals: current.actor } } }] }
  };
}
function textFilter(term, fields) {
  if (!term) return null;
  if (term.length > 120) throw new Error("Search term is too long.");
  return { OR: fields.map((field) => {
    let filter = { contains: term, mode: "insensitive" };
    for (const key of field.split(".").reverse()) filter = { [key]: filter };
    return filter;
  }) };
}
async function platformContacts(_root, args, context) {
  return leadWorkspace(args, context);
}
var LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription addressLine1 city state postalCode price bedrooms bathrooms squareFeet isFeatured primaryImageUrl updatedAt
  assignedAgent { id name email }
  leadsCount showingsCount
`;
async function platformListings(_root, { status, q, take = 60, after, before }, context) {
  const current = scope(context, "canManageListings");
  const { ids } = current;
  const pageSize = Math.min(Math.max(Number(take) || 60, 1), 100);
  const filters = [{ brokerage: { id: { in: ids } } }];
  const normalizedStatus = clean5(status), term = clean5(q);
  if (normalizedStatus && normalizedStatus !== "all") filters.push({ status: { equals: normalizedStatus } });
  const search = textFilter(term, ["title", "addressLine1", "city", "postalCode"]);
  if (search) filters.push(search);
  const hasAfter = after !== void 0 && after !== null;
  const hasBefore = before !== void 0 && before !== null;
  if (hasAfter && hasBefore) throw new Error(INVALID_LISTING_CURSOR);
  const fingerprint = listingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...ids].sort(),
    permission: "canManageListings",
    status: normalizedStatus && normalizedStatus !== "all" ? normalizedStatus : "all",
    search: term,
    pageSize
  });
  const cursorValue = hasAfter ? after : hasBefore ? before : null;
  const cursor = cursorValue === null ? null : decodeListingCursor(cursorValue, fingerprint);
  if (cursorValue !== null && !cursor) throw new Error(INVALID_LISTING_CURSOR);
  const sudo = context.sudo();
  if (cursor) {
    const anchor = await sudo.query.Property.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { updatedAt: { equals: cursor.updatedAt } }] },
      take: 1,
      query: "id updatedAt"
    });
    if (!anchor.length) throw new Error(INVALID_LISTING_CURSOR);
  }
  const boundary = cursor ? hasAfter ? { OR: [
    { updatedAt: { lt: cursor.updatedAt } },
    { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { lt: cursor.id } }] }
  ] } : { OR: [
    { updatedAt: { gt: cursor.updatedAt } },
    { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { gt: cursor.id } }] }
  ] } : null;
  const orderBy = hasBefore ? [{ updatedAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }];
  const found = await sudo.query.Property.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: LISTING_QUERY
  });
  const hasMoreInDirection = found.length > pageSize;
  const pageRows = found.slice(0, pageSize);
  if (cursor && !pageRows.length) throw new Error(INVALID_LISTING_CURSOR);
  const items = hasBefore ? pageRows.reverse() : pageRows;
  const pageInfo = {
    hasNextPage: hasBefore ? items.length > 0 : hasMoreInDirection,
    hasPreviousPage: hasBefore ? hasMoreInDirection : hasAfter && items.length > 0,
    nextCursor: null,
    previousCursor: null
  };
  pageInfo.nextCursor = pageInfo.hasNextPage && items.length ? encodeListingCursor(items[items.length - 1], fingerprint) : null;
  pageInfo.previousCursor = pageInfo.hasPreviousPage && items.length ? encodeListingCursor(items[0], fingerprint) : null;
  const scoped = await sudo.query.Property.findMany({ where: { brokerage: { id: { in: ids } } }, take: 500, query: "id status price listingType" });
  const count = (value) => scoped.filter((item) => item.status === value).length;
  return { items, pageInfo, stats: { total: scoped.length, active: count("active"), comingSoon: count("coming_soon"), pending: count("pending"), sold: count("sold"), offMarket: count("off_market") } };
}
async function platformShowings(_root, { status, range, q, take, after, before }, context) {
  return context.transaction(async (tx) => showingWorkspace({ status, range, q, take, after, before }, await freshOperatorCommandContext(tx.withSession(context.session))), { timeout: 3e4 });
}
async function showingWorkspace({ status, range, q, take = 80, after, before }, context) {
  const { where: brokerageWhere, current } = assignmentWhere(context, "canManageShowings");
  const filters = [brokerageWhere];
  const normalizedStatus = clean5(status), normalizedRange = clean5(range) || "upcoming", term = clean5(q);
  const pageSize = Math.min(Math.max(Number(take) || 80, 1), 100);
  const date = showingDateRange(normalizedRange);
  if (normalizedStatus && normalizedStatus !== "all") filters.push({ status: { equals: normalizedStatus } });
  if (date) filters.push({ scheduledStart: date });
  const search = textFilter(term, ["property.title", "property.addressLine1", "property.city", "lead.name", "lead.email", "assignedAgent.name"]);
  if (search) filters.push(search);
  const hasAfter = after !== void 0 && after !== null;
  const hasBefore = before !== void 0 && before !== null;
  if (hasAfter && hasBefore) throw new Error(INVALID_SHOWING_CURSOR);
  const fingerprint = showingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...current.ids].sort(),
    managesAll: current.managesAll,
    permission: "canManageShowings",
    status: normalizedStatus && normalizedStatus !== "all" ? normalizedStatus : "all",
    range: normalizedRange,
    search: term,
    pageSize
  });
  const cursorValue = hasAfter ? after : hasBefore ? before : null;
  const cursor = cursorValue === null ? null : decodeShowingCursor(cursorValue, fingerprint);
  if (cursorValue !== null && !cursor) throw new Error(INVALID_SHOWING_CURSOR);
  const sudo = context.sudo();
  if (cursor) {
    const anchor = await sudo.query.Showing.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { scheduledStart: { equals: cursor.scheduledStart } }] },
      take: 1,
      query: "id scheduledStart"
    });
    if (!anchor.length || !await scopedShowingIdentity(context, cursor.id)) throw new Error(INVALID_SHOWING_CURSOR);
  }
  const boundary = cursor ? hasAfter ? { OR: [
    { scheduledStart: { gt: cursor.scheduledStart } },
    { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { gt: cursor.id } }] }
  ] } : { OR: [
    { scheduledStart: { lt: cursor.scheduledStart } },
    { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { lt: cursor.id } }] }
  ] } : null;
  const orderBy = hasBefore ? [{ scheduledStart: "desc" }, { id: "desc" }] : [{ scheduledStart: "asc" }, { id: "asc" }];
  const found = await sudo.query.Showing.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: "id scheduledStart brokerage { id }"
  });
  const hasMoreInDirection = found.length > pageSize;
  const pageRows = found.slice(0, pageSize);
  if (cursor && !pageRows.length) throw new Error(INVALID_SHOWING_CURSOR);
  const orderedRows = hasBefore ? pageRows.reverse() : pageRows;
  const items = [];
  for (const candidate of orderedRows) {
    const view = await scopedShowingPresentation(context, candidate.id);
    if (!view || view.showing.scheduledStart !== candidate.scheduledStart) throw new Error("Showing workspace unavailable.");
    items.push(view.showing);
  }
  const hasPreviousPage = hasBefore ? hasMoreInDirection : hasAfter;
  const hasNextPage = hasBefore ? true : hasMoreInDirection;
  const pageInfo = {
    hasNextPage,
    hasPreviousPage,
    nextCursor: hasNextPage && items.length ? encodeShowingCursor(items[items.length - 1], fingerprint) : null,
    previousCursor: hasPreviousPage && items.length ? encodeShowingCursor(items[0], fingerprint) : null
  };
  const scoped = await sudo.query.Showing.findMany({ where: brokerageWhere, take: 500, query: "id status" });
  const count = (value) => scoped.filter((item) => item.status === value).length;
  return { items, pageInfo, stats: { total: scoped.length, requested: count("requested"), scheduled: count("scheduled"), completed: count("completed"), noShow: count("no_show"), cancelled: count("cancelled") } };
}
var DEAL_QUERY = `
  id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt nextStep notes createdAt updatedAt
  property { id title city state price listingType }
  lead { id name email phone status }
  assignedAgent { id name email }
  assignedTeam { id name }
`;
async function platformPipeline(_root, _args, context) {
  const { where } = assignmentWhere(context, "canManageDeals");
  const sudo = context.sudo();
  const items = await sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 200, query: DEAL_QUERY });
  const count = (value) => items.filter((item) => item.stage === value).length;
  const projectedCommission = sumMoney(items.filter((item) => item.stage !== "closed_lost").map((item) => item.commissionAmount || "0"));
  return { items, stats: { total: items.length, open: items.filter((item) => !["closed_won", "closed_lost"].includes(item.stage)).length, underContract: count("under_contract"), closedWon: count("closed_won"), closedLost: count("closed_lost"), projectedCommission: String(projectedCommission) } };
}
async function platformReports(_root, _args, context) {
  const current = scope(context, "canViewReports");
  if (!current.managesAll) throw new Error("Access denied.");
  const where = { brokerage: { id: { in: current.ids } } };
  const sudo = context.sudo();
  const [leads, showings, deals, activeListings, pendingListings] = await Promise.all([
    sudo.query.Lead.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 250, query: "id source status assignedAgent { id name }" }),
    sudo.query.Showing.findMany({ where, orderBy: [{ scheduledStart: "desc" }], take: 250, query: "id status assignedAgent { id name }" }),
    sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 250, query: "id stage commissionAmount assignedAgent { id name }" }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: "active" } }] } }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: "pending" } }] } })
  ]);
  return { leads, showings, deals, activeListings, pendingListings };
}
async function platformPeople(_root, _args, context) {
  const { ids } = scope(context, "canManagePeople");
  const sudo = context.sudo();
  const [agents, teams] = await Promise.all([
    sudo.query.User.findMany({
      where: { brokerageMemberships: { some: { status: { equals: "active" }, brokerage: { id: { in: ids } } } } },
      orderBy: [{ name: "asc" }],
      take: 100,
      query: "id name email phone licenseNumber brokerageTitle avatarUrl onboardingStatus role { id name } brokerageMemberships(where: { status: { equals: active } }) { id membershipRole isPrimary brokerage { id name slug } } assignedPropertiesCount assignedLeadsCount assignedShowingsCount assignedDealsCount"
    }),
    sudo.query.AgentTeam.findMany({
      where: { brokerage: { id: { in: ids } } },
      orderBy: [{ name: "asc" }],
      take: 100,
      query: "id name slug teamType status description leadAgent { id name email } members { id name email } leadsCount dealsCount"
    })
  ]);
  return {
    agents: agents.map((agent) => ({
      ...agent,
      memberships: (agent.brokerageMemberships || []).filter((membership) => ids.includes(membership.brokerage?.id)),
      listingCount: agent.assignedPropertiesCount || 0,
      leadCount: agent.assignedLeadsCount || 0,
      showingCount: agent.assignedShowingsCount || 0,
      dealCount: agent.assignedDealsCount || 0
    })),
    teams: teams.map((team) => ({ ...team, leadCount: team.leadsCount || 0, dealCount: team.dealsCount || 0 }))
  };
}
async function platformOperations(_root, _args, context) {
  if (!role3(context).canManagePeople) throw new Error("Access denied.");
  const dealScope = assignmentWhere(context, "canManageDeals");
  const listingScope = scope(context, "canManageListings");
  const leadScope = scope(context, "canManageLeads");
  const sudo = context.sudo();
  const [offers, transactions, commissions, savedSearches, alerts, feeds, queue, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorityRows, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerRows, retentionPolicies, transactionFileEvents] = await Promise.all([
    sudo.query.Offer.findMany({ where: dealScope.where, orderBy: [{ createdAt: "desc" }], take: 30, query: "id offerNumber version status amount earnestMoney financingType contingencies submittedAt responseDueAt createdAt parentOffer { id offerNumber } deal { id title } property { id title } lead { id name } assignedAgent { id name }" }),
    sudo.query.Deal.findMany({ where: dealScope.where, orderBy: [{ updatedAt: "desc" }], take: 30, query: "id title stage expectedCloseDate property { id title } lead { id name } assignedAgent { id name }" }),
    sudo.query.Commission.findMany({ where: dealScope.current.managesAll ? { brokerage: { id: { in: dealScope.current.ids } } } : { AND: [{ brokerage: { id: { in: dealScope.current.ids } } }, { agent: { id: { equals: dealScope.current.actor } } }] }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id title status side grossCommission brokerageSplitPercent agentSplitPercent netCommission paidAt deal { id title } agent { id name }" }),
    sudo.query.SavedSearch.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id name city state propertyType minPrice maxPrice minBedrooms alertsEnabled lastNotifiedAt user { id name email }" }),
    sudo.query.SavedSearchAlert.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id status cadence lastSentAt sentCount savedSearch { id name } user { id name email }" }),
    sudo.query.SourceFeed.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id name provider feedType status lastImportedAt recordsImported" }),
    sudo.query.DomainOutboxEvent.findMany({ where: { AND: [{ brokerage: { id: { in: [.../* @__PURE__ */ new Set([...dealScope.current.ids, ...listingScope.ids, ...leadScope.ids])] } } }, { OR: [{ eventType: { startsWith: "integration." } }, { eventType: { startsWith: "saved_search." } }] }] }, orderBy: [{ occurredAt: "desc" }], take: 30, query: "id eventKey eventType aggregateType aggregateId status attempts replayCount availableAt occurredAt lastError" }),
    sudo.query.PropertyInspection.findMany({ where: { OR: [{ deal: { brokerage: { id: { in: dealScope.current.ids } } } }, { property: { brokerage: { id: { in: dealScope.current.ids } } } }] }, orderBy: [{ scheduledAt: "asc" }], take: 50, query: "id title inspectionType status scheduledAt completedAt inspectorName estimatedCost summary findings property { id title } deal { id title }" }),
    sudo.query.OpenHouse.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ startsAt: "asc" }], take: 50, query: "id title status startsAt endsAt attendeeCount notes property { id title } hostAgent { id name }" }),
    sudo.query.Disclosure.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id title disclosureType status documentUrl sentAt acknowledgedAt deal { id title } property { id title }" }),
    sudo.query.MortgageApplication.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id applicationNumber lenderName status loanAmount interestRate submittedAt decisionAt deal { id title } lead { id name }" }),
    sudo.query.TitleOrder.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id orderNumber titleCompany status orderedAt clearedAt exceptions deal { id title } property { id title }" }),
    sudo.query.Escrow.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id escrowNumber status escrowCompany officerName openedAt scheduledCloseAt closedAt depositAmount deal { id title } property { id title }" }),
    sudo.query.MarketComp.findMany({ where: { subjectProperty: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ soldAt: "desc" }], take: 50, query: "id addressLine1 city state status listPrice salePrice soldAt bedrooms bathrooms squareFeet distanceMiles subjectProperty { id title } neighborhood { id name }" }),
    sudo.query.PropertyValuation.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ valuedAt: "desc" }], take: 50, query: "id valuationNumber valuationType lowValue estimatedValue highValue valuedAt notes property { id title } performedBy { id name }" }),
    sudo.query.ListingSyndication.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ updatedAt: "desc" }], take: 100, query: "id channel status externalListingId listingUrl errorMessage property { id title slug }" }),
    sudo.query.AgentTask.findMany({ where: leadScope.ids.length ? { brokerage: { id: { in: leadScope.ids } } } : { id: { equals: "" } }, orderBy: [{ dueAt: "asc" }], take: 100, query: "id title status priority dueAt completedAt notes assignedAgent { id name } property { id title } lead { id name } deal { id title }" }),
    sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber status jurisdictionCode effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 property { id title } assignedPractitioner { id name email }" }),
    sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber destination status effectiveFrom effectiveThrough authorityBasis property { id title } engagement { id }" }),
    sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id licenseNumber licenseType jurisdictionCode status effectiveFrom effectiveThrough verifiedAt verificationSource practitioner { id name email }" }),
    sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber side relationshipType jurisdictionCode status effectiveFrom effectiveThrough disclosureVersion lead { id name } property { id title } deal { id title } practitioner { id name email }" }),
    sudo.query.DocumentEvidenceEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 100, query: "id eventKey eventType documentSha256 templateSha256 channel provider providerReference occurredAt acknowledgedAt document { id title } offer { id offerNumber }" }),
    sudo.query.CommissionLedgerEntry.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 150, query: "id entryKey batchKey entryType allocationType amountCents currencyCode payeeLabel externalReference occurredAt commission { id } preparedBy { id name } approvedBy { id name }" }),
    sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 50, query: "id policyKey retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough" }),
    sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 150, query: "id eventKey eventType triggerAt disposeAfter holdKey manifestKey manifestSha256 documentSha256 externalDeletionReference reason occurredAt deal { id title } document { id title }" })
  ]);
  const dealIds = transactions.map((deal) => deal.id);
  const [milestones, documents] = dealIds.length ? await Promise.all([
    sudo.query.TransactionMilestone.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ sortOrder: "asc" }], take: 500, query: "id name status dueAt completedAt sortOrder notes deal { id } assignedTo { id name }" }),
    sudo.query.DealDocument.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ createdAt: "desc" }], take: 500, query: "id title documentType status requiresSignature sentAt signedAt expiresAt deal { id }" })
  ]) : [[], []];
  const transactionDetails = transactions.map((deal) => ({
    ...deal,
    milestones: milestones.filter((item) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }) => item),
    documents: documents.filter((item) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }) => item)
  }));
  const listingPublicationAuthorities = listingPublicationAuthorityRows.map((item) => ({ ...item, engagementId: item.engagement?.id || null }));
  const commissionLedgerEntries = commissionLedgerRows.map((item) => ({ ...item, amountCents: String(item.amountCents), commissionId: item.commission?.id }));
  return { offers, transactions: transactionDetails, commissions, savedSearches, alerts, feeds, queue, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorities, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerEntries, retentionPolicies, transactionFileEvents };
}

// features/keystone/mutations/platformStorefrontSettings.ts
var SETTINGS_SELECTION = "id businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail showingDurationMinutes brandHue logoIcon logoColor";
function activeBrokerageScope(context) {
  const ids = activeBrokerageIds(context.session);
  const selected = context.session?.data.activeBrokerage;
  if (ids.length !== 1 || !selected || selected.id !== ids[0] || selected.status !== "active") {
    throw new Error("An active brokerage is required.");
  }
  return { id: ids[0], slug: selected.slug };
}
async function findScopedSettings(context, brokerageId) {
  const rows = await context.query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: brokerageId } } },
    orderBy: [{ id: "asc" }],
    take: 2,
    query: SETTINGS_SELECTION
  });
  if (rows.length > 1) throw new Error("Multiple storefront settings records require administrator review.");
  return rows[0] || null;
}
function requiredText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}
function optionalText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}
function normalizeInput(input) {
  const showingDurationMinutes = Number(input.showingDurationMinutes);
  if (!Number.isInteger(showingDurationMinutes) || showingDurationMinutes < 15 || showingDurationMinutes > 240) {
    throw new Error("Showing duration must be between 15 and 240 minutes.");
  }
  return {
    businessName: requiredText(input.businessName, "Business name", 120),
    marketLabel: requiredText(input.marketLabel, "Market label", 120),
    city: requiredText(input.city, "City", 120),
    state: requiredText(input.state, "State", 80),
    tagline: requiredText(input.tagline, "Tagline", 220),
    description: optionalText(input.description, "Description", 1e3),
    equalHousingNotice: optionalText(input.equalHousingNotice, "Equal housing notice", 240),
    publicPhone: optionalText(input.publicPhone, "Public phone", 80),
    publicEmail: (() => {
      const email = optionalText(input.publicEmail, "Public email", 320).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Public email must be valid.");
      return email;
    })(),
    showingDurationMinutes,
    brandHue: normalizeStorefrontBrandHue(input.brandHue),
    logoIcon: (() => {
      const raw = String(input.logoIcon || "");
      const safe = sanitizeStoreLogoSvg(raw);
      if (raw.trim() && !safe) throw new Error("Logo SVG is not allowed.");
      return safe;
    })(),
    logoColor: normalizeStoreLogoColor(input.logoColor)
  };
}
async function platformStorefrontSettings(_root, _args, context) {
  if (!permissions.canManageOnboarding({ session: context.session })) throw new Error("Not authorized to view storefront settings.");
  const brokerage = activeBrokerageScope(context);
  const settings = await findScopedSettings(context, brokerage.id);
  return settings ? { status: "ready", settings } : { status: "unconfigured", settings: null };
}
async function updatePlatformStorefrontSettings(_root, { data }, context) {
  if (!permissions.canManageBrokerageSettings({ session: context.session })) throw new Error("Not authorized to update storefront settings.");
  const brokerage = activeBrokerageScope(context);
  const normalized = normalizeInput(data);
  const settings = await context.transaction(async (tx) => {
    const existing = await findScopedSettings(tx, brokerage.id);
    if (existing) {
      return tx.query.BrokerageSettings.updateOne({
        where: { id: existing.id },
        data: normalized,
        query: SETTINGS_SELECTION
      });
    }
    return tx.query.BrokerageSettings.createOne({
      data: {
        ...normalized,
        key: `${brokerage.slug}:primary`,
        brokerage: { connect: { id: brokerage.id } }
      },
      query: SETTINGS_SELECTION
    });
  });
  return { status: "ready", settings };
}

// features/keystone/mutations/customerAccount.ts
async function registerRealEstateCustomer(_root, { data }, context) {
  const name = String(data.name || "").trim(), email = String(data.email || "").trim().toLowerCase(), password2 = String(data.password || "");
  const slug = String(data.brokerageSlug || "").trim();
  if (!name || name.length > 120 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password2.length < 12 || password2.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { ok: false, message: "Enter a name, valid email, and a password of at least 12 characters." };
  try {
    return await context.transaction(async (tx) => {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `customer-registration:${email}`);
      const sudo = tx.sudo();
      const brokerage = (await sudo.query.Brokerage.findMany({ where: { slug: { equals: slug }, status: { equals: "active" } }, take: 1, query: "id" }))[0];
      if (!brokerage || await sudo.query.User.count({}) === 0 || await sudo.query.User.findOne({ where: { email }, query: "id" })) return { ok: false, message: "Account could not be created. Sign in or use another email." };
      await sudo.query.User.createOne({ data: { name, email, password: password2, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: "dismissed" }, query: "id" });
      return { ok: true, message: "Account created." };
    });
  } catch {
    return { ok: false, message: "Account could not be created. Sign in or use another email." };
  }
}
async function customerShowingHistory(_root, { brokerageSlug, id }, context) {
  const actor = context.session?.itemId;
  if (!actor) throw new Error("Sign in to view your showings.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80 || id && id.length > 200) throw new Error("Showings unavailable.");
  const rows = await context.sudo().query.Showing.findMany({
    where: {
      customer: { id: { equals: actor } },
      brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } },
      ...id ? { id: { equals: id } } : {}
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    query: "id status showingType scheduledStart scheduledEnd requestSnapshot"
  });
  return rows.map((row) => {
    const snapshot = row.requestSnapshot && typeof row.requestSnapshot === "object" && !Array.isArray(row.requestSnapshot) ? row.requestSnapshot : {};
    return {
      id: row.id,
      status: row.status,
      showingType: row.showingType,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      listingTitle: typeof snapshot.listingTitle === "string" ? snapshot.listingTitle : "Residence",
      listingSlug: typeof snapshot.listingSlug === "string" ? snapshot.listingSlug : "",
      requestedStart: typeof snapshot.scheduledStart === "string" ? snapshot.scheduledStart : row.scheduledStart
    };
  });
}

// features/keystone/mutations/platformCommands.ts
var import_node_crypto7 = __toESM(require("node:crypto"));
function actorId3(context) {
  return context.session?.itemId;
}
function role4(context) {
  return context.session?.data?.role || {};
}
function validKey(value) {
  return Boolean(value && value.length <= 120);
}
function validMoney2(value) {
  return /^\d{1,10}(\.\d{1,2})?$/.test(value);
}
function authorized2(context, brokerageId, permission, ownerId) {
  return Boolean(actorId3(context) && role4(context)[permission] && activeBrokerageIds(context.session).includes(brokerageId) && (role4(context).canManagePeople || !ownerId || ownerId === actorId3(context)));
}
async function runCommand(context, options) {
  return runControlledEvidenceCommand(context, options);
}
async function createOfferCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), amount = commandText(data.amount), earnestMoney = commandText(data.earnestMoney), financingType = commandText(data.financingType) || "conventional", contingencies = commandText(data.contingencies), responseDueAt = commandText(data.responseDueAt), key = commandText(data.idempotencyKey);
  if (!dealId || !validMoney2(amount) || !["cash", "conventional", "fha", "va", "other"].includes(financingType) || contingencies.length > 1e4 || responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime()) || !validKey(key)) return { ok: false, message: "Deal, valid amount, and bounded idempotency key are required.", itemId: null, replayed: false };
  if (earnestMoney && !validMoney2(earnestMoney)) return { ok: false, message: "Earnest money must be a valid amount.", itemId: null, replayed: false };
  const request = { dealId, amount, earnestMoney, financingType, contingencies, responseDueAt };
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:create-offer:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id title stage brokerage { id } property { id } lead { id } assignedAgent { id }" });
      if (!deal || !authorized2(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      if (["closed_won", "closed_lost"].includes(deal.stage)) return { result: { ok: false, message: "Closed transactions cannot receive new offers.", itemId: null }, event: null };
      const suffix2 = import_node_crypto7.default.createHash("sha256").update(`${dealId}:${key}`).digest("hex").slice(0, 16).toUpperCase();
      const offer = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, offerNumber: `OFF-${suffix2}`, status: "draft", amount, earnestMoney: earnestMoney || null, financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: dealId } }, property: { connect: { id: deal.property.id } }, lead: { connect: { id: deal.lead.id } }, ...deal.assignedAgent?.id ? { assignedAgent: { connect: { id: deal.assignedAgent.id } } } : {} }, query: "id offerNumber status" });
      const result = { ok: true, message: "Offer draft created.", itemId: offer.id };
      return { result, event: { eventType: "offer.draft_created", brokerageId: deal.brokerage.id, aggregateType: "offer", aggregateId: offer.id, actorId: actorId3(scoped), action: "create_draft", before: null, after: { ...result, offerNumber: offer.offerNumber } } };
    }
  });
}
async function createCounterOfferCommand(_root, { data }, context) {
  const offerId = commandText(data.offerId), amount = commandText(data.amount), responseDueAt = commandText(data.responseDueAt), contingencies = commandText(data.contingencies), key = commandText(data.idempotencyKey);
  if (!offerId || !validMoney2(amount) || contingencies.length > 1e4 || responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime()) || !validKey(key)) return { ok: false, message: "Offer, valid amount, and bounded idempotency key are required.", itemId: null, replayed: false };
  const request = { offerId, amount, responseDueAt, contingencies };
  return runCommand(context, {
    eventKey: `command:offer:${offerId}:counter:${key}`,
    lockKey: `aggregate:offer:${offerId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const source = await sudo.query.Offer.findOne({ where: { id: offerId }, query: "id offerNumber version status earnestMoney financingType brokerage { id } deal { id transactionType } property { id state } lead { id } assignedAgent { id }" });
      if (!source || !authorized2(scoped, source.brokerage?.id, "canManageDeals", source.assignedAgent?.id)) return { result: { ok: false, message: "Offer not found or access denied.", itemId: null }, event: null };
      source.property = await lockAndRefreshProperty(scoped, source.property.id, source.brokerage.id);
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: source.brokerage.id, leadId: source.lead.id, propertyId: source.property.id, dealId: source.deal.id, practitionerId: source.assignedAgent?.id || actorId3(scoped), jurisdictionCode: source.property.state, side: ["seller", "landlord"].includes(source.deal.transactionType) ? "seller" : "buyer" });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Negotiation authority is required.", itemId: source.id }, event: null };
      }
      if (!["submitted", "countered"].includes(source.status)) return { result: { ok: false, message: `Cannot counter an offer from ${source.status}.`, itemId: source.id }, event: null };
      const suffix2 = import_node_crypto7.default.createHash("sha256").update(key).digest("hex").slice(0, 6).toUpperCase();
      const counter = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: source.brokerage.id } }, offerNumber: `${source.offerNumber}-C${suffix2}`, version: Number(source.version || 1) + 1, parentOffer: { connect: { id: source.id } }, status: "draft", amount, earnestMoney: source.earnestMoney, financingType: source.financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: source.deal.id } }, property: { connect: { id: source.property.id } }, lead: { connect: { id: source.lead.id } }, ...source.assignedAgent?.id ? { assignedAgent: { connect: { id: source.assignedAgent.id } } } : {} }, query: "id offerNumber" });
      await sudo.query.Offer.updateOne({ where: { id: source.id }, data: { status: "countered" }, query: "id" });
      const result = { ok: true, message: "Counteroffer draft created.", itemId: counter.id };
      return { result, event: { eventType: "offer.counter_created", brokerageId: source.brokerage.id, aggregateType: "offer", aggregateId: counter.id, actorId: actorId3(scoped), action: "counter", before: { sourceOfferId: source.id, sourceStatus: source.status }, after: { ...result, offerNumber: counter.offerNumber } } };
    }
  });
}
async function createChecklistItemCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), name = commandText(data.name), dueAt = commandText(data.dueAt), assignedToId = commandText(data.assignedToId), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!dealId || !name || name.length > 160 || notes.length > 5e3 || dueAt && !Number.isFinite(new Date(dueAt).getTime()) || !validKey(key)) return { ok: false, message: "Deal, bounded checklist name, and idempotency key are required.", itemId: null, replayed: false };
  const request = { dealId, name, dueAt, assignedToId, notes };
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:checklist:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id } assignedAgent { id }" });
      if (!deal || !authorized2(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      const item = await sudo.query.TransactionMilestone.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, deal: { connect: { id: deal.id } }, name, status: "not_started", dueAt: dueAt || null, notes, ...assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {} }, query: "id" });
      const result = { ok: true, message: "Checklist item added.", itemId: item.id };
      return { result, event: { eventType: "transaction.checklist_item_created", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: deal.id, actorId: actorId3(scoped), action: "create_checklist_item", before: null, after: result } };
    }
  });
}
async function transitionDocumentCommand(_root, { data }, context) {
  const documentId = commandText(data.documentId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { draft: ["archived"], sent: ["archived"], signed: ["archived"], archived: [] };
  if (!documentId || !status || !validKey(key)) return { ok: false, message: "Document, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { documentId, status };
  return runCommand(context, {
    eventKey: `command:document:${documentId}:status:${key}`,
    lockKey: `aggregate:document:${documentId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const document = await sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id status brokerage { id } deal { id assignedAgent { id } }" });
      if (!document || !authorized2(scoped, document.brokerage?.id, "canManageDeals", document.deal?.assignedAgent?.id)) return { result: { ok: false, message: "Document not found or access denied.", itemId: null }, event: null };
      if (!allowed[document.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition document from ${document.status} to ${status}.`, itemId: document.id }, event: null };
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.DealDocument.updateOne({ where: { id: document.id }, data: { status, ...status === "sent" ? { sentAt: now } : {}, ...status === "signed" ? { signedAt: now } : {} }, query: "id" });
      const result = { ok: true, message: "Document status updated.", itemId: document.id };
      return { result, event: { eventType: "transaction.document_transitioned", brokerageId: document.brokerage.id, aggregateType: "dealDocument", aggregateId: document.id, actorId: actorId3(scoped), action: "transition", before: { status: document.status }, after: { ...result, status } } };
    }
  });
}
async function transitionAgentTaskCommand(_root, { data }, context) {
  const taskId = commandText(data.taskId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { open: ["in_progress", "blocked", "done"], in_progress: ["open", "blocked", "done"], blocked: ["open", "in_progress", "done"], done: ["open"] };
  if (!taskId || !status || !validKey(key)) return { ok: false, message: "Task, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { taskId, status };
  return runCommand(context, { eventKey: `command:agent-task:${taskId}:status:${key}`, lockKey: `aggregate:agent-task:${taskId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const task = await sudo.query.AgentTask.findOne({ where: { id: taskId }, query: "id status brokerage { id } assignedAgent { id }" });
    if (!task || !authorized2(scoped, task.brokerage?.id, "canManageLeads", task.assignedAgent?.id)) return { result: { ok: false, message: "Task not found or access denied.", itemId: null }, event: null };
    if (task.status === status) return { result: { ok: true, message: "Task already has that status.", itemId: task.id }, event: { eventType: "agent_task.transition_replayed", brokerageId: task.brokerage.id, aggregateType: "agentTask", aggregateId: task.id, actorId: actorId3(scoped), action: "transition", before: { status }, after: { status } } };
    if (!allowed[task.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition task from ${task.status} to ${status}.`, itemId: task.id }, event: null };
    const completedAt = status === "done" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    await sudo.query.AgentTask.updateOne({ where: { id: task.id }, data: { status, completedAt }, query: "id" });
    const result = { ok: true, message: "Task status updated.", itemId: task.id };
    return { result, event: { eventType: "agent_task.transitioned", brokerageId: task.brokerage.id, aggregateType: "agentTask", aggregateId: task.id, actorId: actorId3(scoped), action: "transition", before: { status: task.status }, after: { ...result, status, completedAt } } };
  } });
}
async function transitionInspectionCommand(_root, { data }, context) {
  const inspectionId = commandText(data.inspectionId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { scheduled: ["completed", "needs_follow_up", "waived"], needs_follow_up: ["completed", "waived"], completed: ["needs_follow_up"], waived: [] };
  if (!inspectionId || !status || !validKey(key)) return { ok: false, message: "Inspection, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { inspectionId, status };
  return runCommand(context, { eventKey: `command:inspection:${inspectionId}:status:${key}`, lockKey: `aggregate:inspection:${inspectionId}`, permission: "canManageDeals", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const inspection = await sudo.query.PropertyInspection.findOne({ where: { id: inspectionId }, query: "id status deal { id brokerage { id } assignedAgent { id } } property { id brokerage { id } assignedAgent { id } }" });
    const brokerageId = inspection?.deal?.brokerage?.id || inspection?.property?.brokerage?.id;
    const ownerId = inspection?.deal?.assignedAgent?.id || inspection?.property?.assignedAgent?.id;
    if (!inspection || !brokerageId || !authorized2(scoped, brokerageId, "canManageDeals", ownerId)) return { result: { ok: false, message: "Inspection not found or access denied.", itemId: null }, event: null };
    if (inspection.status === status) return { result: { ok: true, message: "Inspection already has that status.", itemId: inspection.id }, event: { eventType: "inspection.transition_replayed", brokerageId, aggregateType: "propertyInspection", aggregateId: inspection.id, actorId: actorId3(scoped), action: "transition", before: { status }, after: { status } } };
    if (!allowed[inspection.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition inspection from ${inspection.status} to ${status}.`, itemId: inspection.id }, event: null };
    const completedAt = status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    await sudo.query.PropertyInspection.updateOne({ where: { id: inspection.id }, data: { status, completedAt }, query: "id" });
    const result = { ok: true, message: "Inspection status updated.", itemId: inspection.id };
    return { result, event: { eventType: "inspection.transitioned", brokerageId, aggregateType: "propertyInspection", aggregateId: inspection.id, actorId: actorId3(scoped), action: "transition", before: { status: inspection.status }, after: { ...result, status, completedAt } } };
  } });
}
async function updateSavedSearchAlertCommand(_root, { data }, context) {
  const alertId = commandText(data.alertId), status = commandText(data.status), cadence = commandText(data.cadence), key = commandText(data.idempotencyKey);
  if (!alertId || !["active", "paused", "unsubscribed"].includes(status) || !["instant", "daily", "weekly"].includes(cadence) || !validKey(key)) return { ok: false, message: "Alert, valid preference, and idempotency key are required.", itemId: null, replayed: false };
  const request = { alertId, status, cadence };
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:preference:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: "id status cadence brokerage { id } user { id }" });
    if (!alert || !authorized2(scoped, alert.brokerage?.id, "canManageLeads", alert.user?.id)) return { result: { ok: false, message: "Alert not found or access denied.", itemId: null }, event: null };
    await sudo.query.SavedSearchAlert.updateOne({ where: { id: alert.id }, data: { status, cadence }, query: "id" });
    const result = { ok: true, message: "Alert preference updated.", itemId: alert.id };
    return { result, event: { eventType: "saved_search.preference_updated", brokerageId: alert.brokerage.id, aggregateType: "savedSearchAlert", aggregateId: alert.id, actorId: actorId3(scoped), action: "update_preference", before: { status: alert.status, cadence: alert.cadence }, after: { ...result, status, cadence } } };
  } });
}
async function queueSavedSearchAlertCommand(_root, { data }, context) {
  const alertId = commandText(data.alertId), key = commandText(data.idempotencyKey);
  if (!alertId || !validKey(key)) return { ok: false, message: "Alert and idempotency key are required.", itemId: null, replayed: false };
  const request = { alertId };
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:queue:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: "id status brokerage { id } savedSearch { id } user { id }" });
    if (!alert || alert.status !== "active" || !authorized2(scoped, alert.brokerage?.id, "canManageLeads", alert.user?.id)) return { result: { ok: false, message: "Active alert not found or access denied.", itemId: null }, event: null };
    const result = { ok: true, message: "Saved-search delivery intent recorded; no email or alert provider was executed.", itemId: alert.id };
    return { result, event: { eventType: "saved_search.alert_queued", brokerageId: alert.brokerage.id, aggregateType: "savedSearchAlert", aggregateId: alert.id, actorId: actorId3(scoped), action: "queue_alert", before: null, after: result } };
  } });
}
async function transitionListingSyndicationCommand(_root, { data }, context) {
  const syndicationId = commandText(data.syndicationId), status = commandText(data.status), providerReference = commandText(data.providerReference), reason = commandText(data.reason), key = commandText(data.idempotencyKey);
  const allowed = { draft: ["published", "error", "removed"], published: ["error", "removed"], error: ["published", "removed"], removed: [] };
  if (!syndicationId || !status || providerReference.length > 500 || !reason || reason.length > 5e3 || !validKey(key)) return { ok: false, message: "Syndication, status, reason, and bounded idempotency key are required.", itemId: null, replayed: false };
  const request = { syndicationId, status, providerReference, reason };
  return runCommand(context, { eventKey: `command:listing-syndication:${syndicationId}:status:${key}`, lockKey: `aggregate:listing-syndication:${syndicationId}`, permission: "canManageListings", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const item = await sudo.query.ListingSyndication.findOne({ where: { id: syndicationId }, query: "id status channel brokerage { id } property { id state assignedAgent { id } }" });
    if (!item || !authorized2(scoped, item.brokerage?.id, "canManageListings", item.property?.assignedAgent?.id)) return { result: { ok: false, message: "Syndication not found or access denied.", itemId: null }, event: null };
    item.property = await lockAndRefreshProperty(scoped, item.property.id, item.brokerage.id);
    if (!authorized2(scoped, item.brokerage.id, "canManageListings", item.property.assignedAgent?.id)) return { result: { ok: false, message: "Syndication authority changed.", itemId: null }, event: null };
    if (!allowed[item.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition syndication from ${item.status} to ${status}.`, itemId: item.id }, event: null };
    if (status === "published") {
      const destination = item.channel === "mls" ? "mls" : item.channel === "website" ? "public_site" : "syndication";
      try {
        await requireListingAuthority(scoped, { brokerageId: item.brokerage.id, propertyId: item.property.id, practitionerId: item.property.assignedAgent?.id || "", jurisdictionCode: item.property.state, destination });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Publication authority is required.", itemId: item.id }, event: null };
      }
    }
    await sudo.query.ListingSyndication.updateOne({ where: { id: item.id }, data: { status, ...status === "published" || status === "removed" ? { errorMessage: null } : {}, ...status === "error" ? { errorMessage: reason } : {}, metadata: { providerReference: providerReference || null, evidenceOnly: true } }, query: "id" });
    const message = status === "published" ? "Local publication report recorded; provider publication was not executed or independently acknowledged." : status === "removed" ? "Local removal report recorded; provider removal was not executed or independently acknowledged." : "Local provider error report recorded; no provider response was independently verified.";
    const result = { ok: true, message, itemId: item.id };
    return { result, event: { eventType: "listing_syndication.local_status_reported", brokerageId: item.brokerage.id, aggregateType: "listingSyndication", aggregateId: item.id, actorId: actorId3(scoped), action: "record_local_status", before: { status: item.status }, after: { ...result, status, providerReference, verification: "unverified" } } };
  } });
}
async function queueSourceImportCommand(_root, { data }, context) {
  const sourceFeedId = commandText(data.sourceFeedId), mode = commandText(data.mode) || "incremental", key = commandText(data.idempotencyKey);
  if (!sourceFeedId || !["incremental", "full", "dry_run"].includes(mode) || !validKey(key)) return { ok: false, message: "Source feed, valid mode, and idempotency key are required.", itemId: null, replayed: false };
  const request = { sourceFeedId, mode };
  return runCommand(context, { eventKey: `command:source-feed:${sourceFeedId}:import:${key}`, lockKey: `aggregate:source-feed:${sourceFeedId}`, permission: "canManageListings", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const feed = await sudo.query.SourceFeed.findOne({ where: { id: sourceFeedId }, query: "id name status brokerage { id }" });
    if (!feed || feed.status !== "active" || !authorized2(scoped, feed.brokerage?.id, "canManageListings")) return { result: { ok: false, message: "Active source feed not found or access denied.", itemId: null }, event: null };
    const result = { ok: true, message: `${mode.replace("_", " ")} import request recorded; no provider adapter was executed.`, itemId: feed.id };
    return { result, event: { eventType: "integration.import_queued", brokerageId: feed.brokerage.id, aggregateType: "sourceFeed", aggregateId: feed.id, actorId: actorId3(scoped), action: "queue_import", before: null, after: { ...result, mode } } };
  } });
}

// features/keystone/mutations/authorityCommands.ts
var import_node_crypto8 = __toESM(require("node:crypto"));
function clean6(value) {
  return String(value || "").trim();
}
function timestamp36(value, label) {
  const date = new Date(clean6(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date.toISOString();
}
function effectiveRange(fromValue, throughValue) {
  const effectiveFrom = timestamp36(fromValue, "Effective from");
  const effectiveThrough = timestamp36(throughValue, "Effective through");
  if (new Date(effectiveFrom) >= new Date(effectiveThrough)) throw new Error("Effective through must be after effective from.");
  return { effectiveFrom, effectiveThrough };
}
function suffix(key) {
  return import_node_crypto8.default.createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase();
}
async function recordPractitionerLicenseAuthorityCommand(_root, { data }, context) {
  const practitionerId = clean6(data.practitionerId), licenseNumber = clean6(data.licenseNumber), licenseType = clean6(data.licenseType), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), status = clean6(data.status), verificationSource = clean6(data.verificationSource), restrictions = clean6(data.restrictions), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  const verifiedAt = timestamp36(data.verifiedAt, "Verified at");
  if (new Date(verifiedAt) > /* @__PURE__ */ new Date()) throw new Error("License verification time cannot be in the future.");
  if (!practitionerId || !licenseNumber || licenseNumber.length > 120 || !["broker", "associate_broker", "sales_agent"].includes(licenseType) || !/^[A-Z]{2}(?:-[A-Z0-9-]{1,20})?$/.test(jurisdictionCode) || !["verified_active", "restricted", "inactive", "expired", "suspended", "revoked"].includes(status) || !verificationSource || verificationSource.length > 500 || restrictions.length > 5e3) throw new Error("Valid bounded practitioner-license evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { practitionerId, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:license:${practitionerId}:${jurisdictionCode}:${key}`,
    lockKey: `authority:license:${practitionerId}:${jurisdictionCode}`,
    permission: "canManagePeople",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [practitioner, prior] = await Promise.all([
        sudo.query.User.findOne({ where: { id: practitionerId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" }),
        sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, practitioner: { id: { equals: practitionerId } }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!(practitioner?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return { result: { ok: false, message: "Practitioner is not an active brokerage member.", itemId: null }, event: null };
      const item = await sudo.query.PractitionerLicenseAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, practitioner: { connect: { id: practitionerId } }, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, verifiedBy: { connect: { id: evidenceActorId(scoped) } } }, query: "id" });
      const result = { ok: true, message: "Practitioner license authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.practitioner_license_recorded", brokerageId, aggregateType: "practitionerLicenseAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, practitionerId, jurisdictionCode, status } } };
    }
  });
}
async function recordListingEngagementAuthorityCommand(_root, { data }, context) {
  const propertyId = clean6(data.propertyId), practitionerId = clean6(data.practitionerId), status = clean6(data.status), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), signatoryCapacity = clean6(data.signatoryCapacity), documentSha256 = clean6(data.documentSha256).toLowerCase(), providerReference = clean6(data.providerReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  if (!propertyId || !practitionerId || !["executed", "revoked", "expired"].includes(status) || !jurisdictionCode || !signatoryCapacity || signatoryCapacity.length > 500 || !isSha256(documentSha256) || providerReference.length > 500) throw new Error("Valid listing-engagement authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const sellerPartySummary = normalizeDomainJson(data.sellerPartySummary || null);
  const request = { propertyId, practitionerId, status, jurisdictionCode, ...range, exclusive: Boolean(data.exclusive), marketingAuthorized: Boolean(data.marketingAuthorized), showingAuthorized: Boolean(data.showingAuthorized), sellerPartySummary, signatoryCapacity, documentSha256, providerReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-engagement:${propertyId}:${key}`,
    lockKey: `authority:listing:${propertyId}`,
    permission: "canManageListings",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [property, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id state brokerage { id } assignedAgent { id }" }),
        sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!property || property.brokerage?.id !== brokerageId || property.assignedAgent?.id !== practitionerId || property.state.toUpperCase() !== jurisdictionCode) return { result: { ok: false, message: "Property, practitioner, and jurisdiction authority do not align.", itemId: null }, event: null };
      if (status === "executed") await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode });
      const item = await sudo.query.ListingEngagementAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `LE-${suffix(key)}`, property: { connect: { id: propertyId } }, assignedPractitioner: { connect: { id: practitionerId } }, status, jurisdictionCode, ...range, exclusive: request.exclusive, marketingAuthorized: request.marketingAuthorized, showingAuthorized: request.showingAuthorized, sellerPartySummary: request.sellerPartySummary, signatoryCapacity, documentSha256, documentProviderReference: providerReference, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Listing engagement authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.listing_engagement_recorded", brokerageId, aggregateType: "listingEngagementAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, propertyId, status } } };
    }
  });
}
async function recordListingPublicationAuthorityCommand(_root, { data }, context) {
  const propertyId = clean6(data.propertyId), engagementId = clean6(data.engagementId), destination = clean6(data.destination), status = clean6(data.status), authorityBasis = clean6(data.authorityBasis), localRuleReference = clean6(data.localRuleReference), dataUseGrantReference = clean6(data.dataUseGrantReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  if (!propertyId || !engagementId || !["public_site", "mls", "idx", "syndication"].includes(destination) || !["authorized", "revoked", "expired"].includes(status) || !authorityBasis || authorityBasis.length > 1e3 || localRuleReference.length > 500 || dataUseGrantReference.length > 500) throw new Error("Valid publication-authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { propertyId, engagementId, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-publication:${propertyId}:${destination}:${key}`,
    lockKey: `authority:listing:${propertyId}`,
    permission: "canManageListings",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [property, engagement, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id brokerage { id }" }),
        sudo.query.ListingEngagementAuthority.findOne({ where: { id: engagementId }, query: "id status effectiveFrom effectiveThrough marketingAuthorized brokerage { id } property { id }" }),
        sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } }, destination: { equals: destination } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!property || property.brokerage?.id !== brokerageId || !engagement || engagement.brokerage?.id !== brokerageId || engagement.property?.id !== propertyId || new Date(range.effectiveFrom) < new Date(engagement.effectiveFrom) || new Date(range.effectiveThrough) > new Date(engagement.effectiveThrough) || status === "authorized" && (engagement.status !== "executed" || !engagement.marketingAuthorized)) return { result: { ok: false, message: "An aligned executed listing engagement is required.", itemId: null }, event: null };
      const item = await sudo.query.ListingPublicationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `PA-${suffix(key)}`, property: { connect: { id: propertyId } }, engagement: { connect: { id: engagementId } }, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Listing publication authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.listing_publication_recorded", brokerageId, aggregateType: "listingPublicationAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, propertyId, destination, status } } };
    }
  });
}
async function recordRepresentationAuthorityCommand(_root, { data }, context) {
  const leadId = clean6(data.leadId), propertyId = clean6(data.propertyId), dealId = clean6(data.dealId), practitionerId = clean6(data.practitionerId), side = clean6(data.side), relationshipType = clean6(data.relationshipType), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), status = clean6(data.status), scopeSummary = clean6(data.scopeSummary), documentSha256 = clean6(data.documentSha256).toLowerCase(), disclosureVersion = clean6(data.disclosureVersion), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  const consentRecordedAt = timestamp36(data.consentRecordedAt, "Consent recorded at");
  if (!leadId || !practitionerId || !["buyer", "seller"].includes(side) || !["exclusive_agency", "nonexclusive_agency", "transaction_brokerage", "customer_assistance"].includes(relationshipType) || !["executed", "terminated", "expired"].includes(status) || !jurisdictionCode || !scopeSummary || scopeSummary.length > 5e3 || !isSha256(documentSha256) || !disclosureVersion || disclosureVersion.length > 300) throw new Error("Valid representation-authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { leadId, propertyId, dealId, practitionerId, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:representation:${leadId}:${key}`,
    lockKey: `authority:representation:${leadId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [lead, property, deal, prior] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id }" }),
        propertyId ? sudo.query.Property.findOne({ where: { id: propertyId }, query: "id state brokerage { id }" }) : null,
        dealId ? sudo.query.Deal.findOne({ where: { id: dealId }, query: "id transactionType brokerage { id } lead { id } property { id }" }) : null,
        sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, lead: { id: { equals: leadId } }, practitioner: { id: { equals: practitionerId } }, side: { equals: side } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!lead || lead.brokerage?.id !== brokerageId || propertyId && (!property || property.brokerage?.id !== brokerageId || property.state.toUpperCase() !== jurisdictionCode) || dealId && (!deal || deal.brokerage?.id !== brokerageId || deal.lead?.id !== leadId || propertyId && deal.property?.id !== propertyId)) return { result: { ok: false, message: "Representation parties and scope do not align within the brokerage.", itemId: null }, event: null };
      if (status === "executed") await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode });
      const item = await sudo.query.RepresentationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `RA-${suffix(key)}`, lead: { connect: { id: leadId } }, ...propertyId ? { property: { connect: { id: propertyId } } } : {}, ...dealId ? { deal: { connect: { id: dealId } } } : {}, practitioner: { connect: { id: practitionerId } }, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Representation authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.representation_recorded", brokerageId, aggregateType: "representationAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, leadId, side, status } } };
    }
  });
}

// features/keystone/mutations/documentEvidenceCommands.ts
var import_node_crypto9 = __toESM(require("node:crypto"));
function clean7(value) {
  return commandText(value);
}
function validTimestamp(value, required = true) {
  const raw = clean7(value);
  if (!raw && !required) return "";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error("A valid evidence timestamp is required.");
  return date.toISOString();
}
function validateRecipients(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) throw new Error("One to 25 bounded evidence recipients are required.");
  return value.map((recipient) => {
    const name = clean7(recipient?.name), address = clean7(recipient?.address), role5 = clean7(recipient?.role);
    if (!name || name.length > 160 || !address || address.length > 320 || !role5 || role5.length > 100) throw new Error("Each evidence recipient requires bounded name, address, and role values.");
    return { name, address, role: role5 };
  });
}
async function appendDocumentEvidenceEventCommand(_root, { data }, context) {
  const documentId = clean7(data.documentId), offerId = clean7(data.offerId), eventType = clean7(data.eventType), documentSha256 = clean7(data.documentSha256).toLowerCase(), templateSha256 = clean7(data.templateSha256).toLowerCase(), certificateSha256 = clean7(data.certificateSha256).toLowerCase(), channel = clean7(data.channel), provider = clean7(data.provider), providerReference = clean7(data.providerReference), acknowledgementReference = clean7(data.acknowledgementReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const occurredAt = validTimestamp(data.occurredAt);
  const providerReportedAt = validTimestamp(data.providerReportedAt, false);
  const acknowledgedAt = validTimestamp(data.acknowledgedAt, false);
  const recipients = validateRecipients(data.recipients);
  const allowedEvents = ["generated", "signed", "delivered", "received", "presented", "acknowledged", "voided"];
  const allowedChannels = ["esign", "email", "portal", "in_person", "other"];
  if (!documentId || !allowedEvents.includes(eventType) || !isSha256(documentSha256) || !isSha256(templateSha256) || eventType === "signed" && !isSha256(certificateSha256) || !allowedChannels.includes(channel) || !provider || provider.length > 160 || !providerReference || providerReference.length > 500 || eventType === "acknowledged" && (!acknowledgedAt || !acknowledgementReference)) throw new Error("Complete immutable document evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { documentId, offerId, eventType, documentSha256, templateSha256, certificateSha256, recipients, channel, provider, providerReference, occurredAt, providerReportedAt, acknowledgedAt, acknowledgementReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:document-evidence:${documentId}:${key}`,
    lockKey: `evidence:document:${documentId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [document, offer, prior] = await Promise.all([
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id documentType brokerage { id } deal { id assignedAgent { id } }" }),
        offerId ? sudo.query.Offer.findOne({ where: { id: offerId }, query: "id deal { id } brokerage { id }" }) : null,
        decisionRows(sudo.query.DocumentEvidenceEvent, { where: { document: { id: { equals: documentId } } }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }], query: "id eventType documentSha256 templateSha256 occurredAt" })
      ]);
      const actor = evidenceActorId(scoped);
      if (!document || document.brokerage?.id !== brokerageId || !evidenceRole(scoped).canManagePeople && document.deal?.assignedAgent?.id !== actor || offerId && (!offer || offer.brokerage?.id !== brokerageId || offer.deal?.id !== document.deal?.id)) return { result: { ok: false, message: "Document, offer, or assignment scope is invalid.", itemId: null }, event: null };
      if (prior.some((event) => event.eventType !== "voided" && (event.documentSha256 !== documentSha256 || event.templateSha256 !== templateSha256))) return { result: { ok: false, message: "Evidence hashes do not match the immutable document version.", itemId: null }, event: null };
      const eventTypes = new Set(prior.map((event) => event.eventType));
      const predecessor = { signed: "generated", delivered: "signed", received: "delivered", presented: "received", acknowledged: "presented" };
      if (predecessor[eventType] && !eventTypes.has(predecessor[eventType])) return { result: { ok: false, message: `${eventType} evidence requires prior ${predecessor[eventType]} evidence.`, itemId: null }, event: null };
      if (eventTypes.has("voided") && eventType !== "voided") return { result: { ok: false, message: "Voided document evidence cannot be extended.", itemId: null }, event: null };
      if (prior.length && new Date(occurredAt) < new Date(prior[prior.length - 1].occurredAt)) return { result: { ok: false, message: "Evidence chronology cannot move backward.", itemId: null }, event: null };
      const eventKey = `DE-${import_node_crypto9.default.createHash("sha256").update(`${documentId}:${key}`).digest("hex").slice(0, 24)}`;
      const item = await sudo.query.DocumentEvidenceEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey, document: { connect: { id: documentId } }, deal: { connect: { id: document.deal.id } }, ...offerId ? { offer: { connect: { id: offerId } } } : {}, eventType, documentSha256, templateSha256, certificateSha256: certificateSha256 || null, recipients, channel, provider, providerReference, occurredAt, providerReportedAt: providerReportedAt || null, acknowledgedAt: acknowledgedAt || null, acknowledgementReference: acknowledgementReference || null, reason, actor: { connect: { id: actor } } }, query: "id" });
      if (eventType === "signed") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: "signed", signedAt: occurredAt }, query: "id" });
      if (eventType === "delivered") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { sentAt: occurredAt }, query: "id" });
      if (eventType === "voided") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: "archived" }, query: "id" });
      const result = { ok: true, message: "Immutable document evidence appended; provider and legal effect remain externally authoritative.", itemId: item.id };
      return { result, event: { eventType: `document_evidence.${eventType}`, brokerageId, aggregateType: "dealDocument", aggregateId: documentId, actorId: actor, action: eventType, before: prior[prior.length - 1] || null, after: { ...result, documentSha256, templateSha256, providerReference } } };
    }
  });
}

// features/keystone/mutations/commissionLedgerCommands.ts
var import_node_crypto10 = __toESM(require("node:crypto"));
function clean8(value) {
  return String(value || "").trim();
}
function cents(value, label, allowZero = false) {
  const raw = clean8(value);
  if (!/^-?\d{1,18}$/.test(raw)) throw new Error(`${label} must be an integer cent amount.`);
  const amount = BigInt(raw);
  if (!allowZero && amount <= BigInt(0) || allowZero && amount < BigInt(0)) throw new Error(`${label} must be ${allowZero ? "non-negative" : "positive"}.`);
  return amount;
}
function commissionDecimalToCents(value) {
  const raw = clean8(value);
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Commission gross amount is invalid.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
}
function commissionCentsConserve(expected, amounts) {
  return amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0)) === expected;
}
function currency(value) {
  const code = clean8(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("A three-letter currency code is required.");
  return code;
}
function batchKey(commissionId, key) {
  return `CB-${import_node_crypto10.default.createHash("sha256").update(`${commissionId}:${key}`).digest("hex").slice(0, 20)}`;
}
async function loadCommission(scoped, commissionId) {
  return scoped.sudo().query.Commission.findOne({ where: { id: commissionId }, query: "id status grossCommission brokerage { id } deal { id stage } agent { id }" });
}
function commissionAuthorized(scoped, commission) {
  const actor = evidenceActorId(scoped);
  return commission?.brokerage?.id === evidenceBrokerageId(scoped) && (evidenceRole(scoped).canManagePeople || commission.agent?.id === actor);
}
async function proposeCommissionAllocationCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), code = currency(data.currencyCode), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 50) throw new Error("One to 50 commission allocation lines are required.");
  const lines = data.lines.map((line) => {
    const allocationType = clean8(line.allocationType), amountCents = cents(line.amountCents, "Allocation amount"), payeeUserId = clean8(line.payeeUserId), payeeLabel = clean8(line.payeeLabel);
    if (!["brokerage", "agent", "team", "referral", "fee", "unallocated"].includes(allocationType) || !payeeUserId && !payeeLabel || payeeLabel.length > 300) throw new Error("Each allocation requires a type, positive cents, and payee.");
    return { allocationType, amountCents: amountCents.toString(), payeeUserId, payeeLabel };
  });
  const brokerageId = evidenceBrokerageId(context) || "", batch = batchKey(commissionId, key);
  const request = { commissionId, currencyCode: code, lines, reason, batch };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:allocation:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission) || !["projected", "approved"].includes(commission.status)) return { result: { ok: false, message: "Commission is unavailable for allocation.", itemId: null }, event: null };
      if (activeAllocationBatches(await commissionDecisionEntries(scoped, commissionId)).size) return { result: { ok: false, message: "Reverse or review the existing allocation before proposing another batch.", itemId: null }, event: null };
      const grossCents = commissionDecimalToCents(commission.grossCommission);
      const allocationTotal = lines.reduce((sum, line) => sum + BigInt(line.amountCents), BigInt(0));
      if (!commissionCentsConserve(grossCents, lines.map((line) => line.amountCents))) return { result: { ok: false, message: `Allocation cents must conserve the gross commission (${grossCents}).`, itemId: null }, event: null };
      for (const line of lines) {
        if (line.payeeUserId) {
          const payee = await sudo.query.User.findOne({ where: { id: line.payeeUserId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" });
          if (!(payee?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return { result: { ok: false, message: "An allocation payee is outside the active brokerage.", itemId: null }, event: null };
        }
      }
      const created = [];
      for (const [index, line] of lines.entries()) {
        created.push(await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:allocation:${index + 1}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "allocation", allocationType: line.allocationType, amountCents: line.amountCents, currencyCode: code, ...line.payeeUserId ? { payeeUser: { connect: { id: line.payeeUserId } } } : {}, payeeLabel: line.payeeLabel, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" }));
      }
      const result = { ok: true, message: "Cent-conserving commission allocation proposal appended.", itemId: created[0].id };
      return { result, event: { eventType: "commission.allocation_proposed", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "propose_allocation", before: null, after: { ...result, batchKey: batch, grossCents: grossCents.toString(), lineCount: created.length } } };
    }
  });
}
async function approveCommissionAllocationCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch) throw new Error("Commission and allocation batch are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:approve-allocation:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId), actor = evidenceActorId(scoped);
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: "Commission is unavailable.", itemId: null }, event: null };
      const [allocations, approvals] = await Promise.all([
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation" } }, take: 100, query: "id amountCents currencyCode preparedBy { id }" }),
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation_approval" } }, take: 1, query: "id" })
      ]);
      if (!allocations.length || approvals.length) return { result: { ok: false, message: "Allocation batch is missing or already approved.", itemId: null }, event: null };
      if (allocations.some((entry) => entry.preparedBy?.id === actor)) return { result: { ok: false, message: "Allocation approver must differ from its preparer.", itemId: null }, event: null };
      const total = allocations.reduce((sum, entry) => sum + BigInt(entry.amountCents), BigInt(0));
      if (!commissionCentsConserve(commissionDecimalToCents(commission.grossCommission), allocations.map((entry) => entry.amountCents)) || new Set(allocations.map((entry) => entry.currencyCode)).size !== 1) return { result: { ok: false, message: "Allocation batch does not conserve commission cents or currency.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:approval:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "allocation_approval", amountCents: "0", currencyCode: allocations[0].currencyCode, reason, preparedBy: { connect: { id: allocations[0].preparedBy.id } }, approvedBy: { connect: { id: actor } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Commission allocation batch approved by a separate authority.", itemId: item.id };
      return { result, event: { eventType: "commission.allocation_approved", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: actor, action: "approve_allocation", before: null, after: { ...result, batchKey: batch, totalCents: total.toString() } } };
    }
  });
}
async function recordCommissionReceiptCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), amount = cents(data.amountCents, "Receipt amount"), code = currency(data.currencyCode), externalReference = clean8(data.externalReference), sourceDocumentSha256 = clean8(data.sourceDocumentSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch || !externalReference || externalReference.length > 500 || !isSha256(sourceDocumentSha256)) throw new Error("Receipt requires an approved batch, external reference, and source-document hash.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:receipt:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission) || commission.deal?.stage !== "closed_won") return { result: { ok: false, message: "A closed-won commission is required.", itemId: null }, event: null };
      if (["paid", "clawed_back"].includes(commission.status)) return { result: { ok: false, message: "Terminal commission receipt changes require a reviewed correction; no receipt was appended.", itemId: null }, event: null };
      const approvals = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation_approval" } }, take: 1, query: "id currencyCode" });
      if (!approvals.length || approvals[0].currencyCode !== code) return { result: { ok: false, message: "A matching approved allocation batch is required.", itemId: null }, event: null };
      const duplicates = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, entryType: { equals: "receipt" }, externalReference: { equals: externalReference } }, take: 1, query: "id" });
      if (duplicates.length) return { result: { ok: false, message: "This external receipt reference is already recorded.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:receipt:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "receipt", amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "External commission receipt evidence appended; no funds were moved.", itemId: item.id };
      return { result, event: { eventType: "commission.receipt_recorded", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "record_receipt", before: null, after: { ...result, amountCents: amount.toString(), externalReference } } };
    }
  });
}
async function reverseCommissionLedgerEntryCommand(_root, { data }, context) {
  const entryId = clean8(data.entryId), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!entryId) throw new Error("Ledger entry is required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { entryId, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission-ledger:${entryId}:reverse:${key}`,
    lockKey: `ledger-entry:${entryId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const entry = await sudo.query.CommissionLedgerEntry.findOne({ where: { id: entryId }, query: "id entryKey batchKey entryType amountCents currencyCode brokerage { id } commission { id } deal { id } preparedBy { id }" });
      if (!entry || entry.brokerage?.id !== brokerageId || !["allocation", "receipt"].includes(entry.entryType)) return { result: { ok: false, message: "Reversible ledger entry not found.", itemId: null }, event: null };
      const existing = await sudo.query.CommissionLedgerEntry.findMany({ where: { reverses: { id: { equals: entry.id } }, entryType: { equals: "reversal" } }, take: 1, query: "id" });
      if (existing.length) return { result: { ok: false, message: "Ledger entry already has a reversal.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${entry.entryKey}:reversal:${key}`, batchKey: entry.batchKey, commission: { connect: { id: entry.commission.id } }, deal: { connect: { id: entry.deal.id } }, entryType: "reversal", amountCents: (-BigInt(entry.amountCents)).toString(), currencyCode: entry.currencyCode, reverses: { connect: { id: entry.id } }, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const commission = await loadCommission(scoped, entry.commission.id);
      if (commission?.status === "paid") await sudo.query.Commission.updateOne({ where: { id: commission.id }, data: { status: "clawed_back" }, query: "id" });
      const result = { ok: true, message: "Append-only commission reversal recorded; previous reconciliation is no longer current.", itemId: item.id };
      return { result, event: { eventType: "commission.entry_reversed", brokerageId, aggregateType: "commission", aggregateId: entry.commission.id, actorId: evidenceActorId(scoped), action: "reverse_entry", before: entry, after: result } };
    }
  });
}
async function reconcileCommissionLedgerCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), externalReference = clean8(data.externalReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch || !externalReference || externalReference.length > 500) throw new Error("Commission, batch, and accounting reconciliation reference are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, externalReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:reconcile:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: "Commission is unavailable.", itemId: null }, event: null };
      const entries = await commissionDecisionEntries(scoped, commissionId);
      const gross = commissionDecimalToCents(commission.grossCommission);
      const state = commissionBatchState(entries, batch, gross);
      if (!state.validReceipts) return { result: { ok: false, message: `Reconciliation requires separately approved allocations and conserved allocation/receipt cents (${gross}).`, itemId: null }, event: null };
      const code = state.currencyCode;
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:reconciliation:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "reconciliation", amountCents: "0", currencyCode: code, ledgerStateHash: state.ledgerStateHash, externalReference, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Commission ledger reconciled with cent conservation; accounting remains authoritative.", itemId: item.id };
      return { result, event: { eventType: "commission.reconciled", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "reconcile", before: null, after: { ...result, grossCents: gross.toString(), externalReference } } };
    }
  });
}

// features/keystone/mutations/retentionCommands.ts
var import_node_crypto11 = __toESM(require("node:crypto"));
function at(value, label) {
  const date = new Date(commandText(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date;
}
function policySuffix(key) {
  return import_node_crypto11.default.createHash("sha256").update(key).digest("hex").slice(0, 16);
}
function transactionManifestSha256(manifestKey, dealId, items) {
  const canonicalItems = [...items].sort((left, right) => left.documentId.localeCompare(right.documentId));
  return import_node_crypto11.default.createHash("sha256").update(canonicalDomainJson({ manifestKey, dealId, items: canonicalItems })).digest("hex");
}
async function recordRetentionPolicyCommand(_root, { data }, context) {
  const retentionClass = commandText(data.retentionClass), jurisdictionCode = commandText(data.jurisdictionCode).toUpperCase(), triggerType = commandText(data.triggerType), retentionDays = Number(data.retentionDays), disposition = commandText(data.disposition), legalBasis = commandText(data.legalBasis), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const effectiveFrom = at(data.effectiveFrom, "Effective from").toISOString(), effectiveThrough = commandText(data.effectiveThrough) ? at(data.effectiveThrough, "Effective through").toISOString() : "";
  if (!["transaction_file", "listing_no_close", "consent_proof", "security_incident"].includes(retentionClass) || !jurisdictionCode || !["deal_closed", "listing_ended", "document_signed", "manual_verified"].includes(triggerType) || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500 || !["tombstone_delete", "archive", "review"].includes(disposition) || !legalBasis || legalBasis.length > 5e3 || effectiveThrough && new Date(effectiveThrough) <= new Date(effectiveFrom)) throw new Error("Valid effective-dated retention policy evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:retention-policy:${retentionClass}:${jurisdictionCode}:${key}`,
    lockKey: `retention-policy:${brokerageId}:${retentionClass}:${jurisdictionCode}`,
    permission: "canManageOnboarding",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const prior = await sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { equals: brokerageId } }, retentionClass: { equals: retentionClass }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" });
      const item = await sudo.query.RetentionPolicy.createOne({ data: { brokerage: { connect: { id: brokerageId } }, policyKey: `RP-${retentionClass}-${jurisdictionCode}-${policySuffix(key)}`, retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough: effectiveThrough || null, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, approvedBy: { connect: { id: evidenceActorId(scoped) } }, approvedAt: (/* @__PURE__ */ new Date()).toISOString(), reason }, query: "id" });
      const result = { ok: true, message: "Immutable effective-dated retention policy appended.", itemId: item.id };
      return { result, event: { eventType: "retention.policy_recorded", brokerageId, aggregateType: "retentionPolicy", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record_policy", before: prior[0] || null, after: { ...result, retentionClass, jurisdictionCode } } };
    }
  });
}
async function assignTransactionFileRetentionCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), documentId = commandText(data.documentId), policyId = commandText(data.policyId), documentSha256 = commandText(data.documentSha256).toLowerCase(), triggerAt = at(data.triggerAt, "Retention trigger").toISOString(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !documentId || !policyId || !isSha256(documentSha256)) throw new Error("Deal, document, policy, and checksum are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, documentId, policyId, documentSha256, triggerAt, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${documentId}:assign-retention:${key}`,
    lockKey: `transaction-file:${documentId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [deal, document, policy, evidence] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: "id stage closedAt property { state } brokerage { id }" }),
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id status signedAt createdAt deal { id } brokerage { id }" }),
        sudo.query.RetentionPolicy.findOne({ where: { id: policyId }, query: "id retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough brokerage { id }" }),
        sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: documentId } }, documentSha256: { equals: documentSha256 } }, take: 1, query: "id" })
      ]);
      const trigger = new Date(triggerAt), policyEffective = policy && new Date(policy.effectiveFrom) <= trigger && (!policy.effectiveThrough || new Date(policy.effectiveThrough) >= trigger);
      const triggerValid = policy?.triggerType === "deal_closed" ? ["closed_won", "closed_lost"].includes(deal?.stage) && Boolean(deal?.closedAt) && trigger.getTime() === new Date(deal.closedAt).getTime() : policy?.triggerType === "document_signed" ? ["signed", "archived"].includes(document?.status) && Boolean(document?.signedAt) && trigger.getTime() === new Date(document.signedAt).getTime() : policy?.triggerType === "manual_verified" && trigger.getTime() >= new Date(document?.createdAt).getTime() && trigger.getTime() <= Date.now();
      if (policy?.retentionClass !== "transaction_file" || policy?.jurisdictionCode !== String(deal?.property?.state || "").toUpperCase()) return { result: { ok: false, message: "The transaction-file policy must match the listing jurisdiction.", itemId: null }, event: null };
      if (!deal || !document || document.deal?.id !== dealId || deal.brokerage?.id !== brokerageId || document.brokerage?.id !== brokerageId || !policy || policy.brokerage?.id !== brokerageId || !policyEffective || !triggerValid || !evidence.length) return { result: { ok: false, message: "Retention assignment lacks coherent trigger, policy, checksum evidence, or brokerage scope.", itemId: null }, event: null };
      const disposeAfter = new Date(trigger.getTime() + Number(policy.retentionDays) * 24 * 60 * 6e4).toISOString();
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `TF-${policySuffix(`${documentId}:${key}`)}`, deal: { connect: { id: dealId } }, document: { connect: { id: documentId } }, policy: { connect: { id: policyId } }, eventType: "retention_assigned", triggerAt, disposeAfter, documentSha256, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Transaction-file retention trigger and disposition date recorded.", itemId: item.id };
      return { result, event: { eventType: "retention.assigned", brokerageId, aggregateType: "dealDocument", aggregateId: documentId, actorId: evidenceActorId(scoped), action: "assign_retention", before: null, after: { ...result, triggerAt, disposeAfter, documentSha256 } } };
    }
  });
}
async function recordTransactionLegalHoldCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), documentId = commandText(data.documentId), holdKey = commandText(data.holdKey), action = commandText(data.action), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !holdKey || holdKey.length > 160 || !["place", "release"].includes(action)) throw new Error("Deal, bounded hold key, and hold action are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, documentId, holdKey, action, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:legal-hold:${holdKey}:${action}:${key}`,
    lockKey: `legal-hold:${brokerageId}:${holdKey}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [deal, document, prior] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id }" }),
        documentId ? sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id deal { id } brokerage { id }" }) : null,
        sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { equals: brokerageId } }, holdKey: { equals: holdKey }, eventType: { in: ["hold_placed", "hold_released"] } }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1, query: "id eventType deal { id } document { id }" })
      ]);
      if (prior[0] && (prior[0].deal?.id !== dealId || (prior[0].document?.id || "") !== documentId)) return { result: { ok: false, message: "A hold key cannot be moved to another transaction or document.", itemId: null }, event: null };
      if (!deal || deal.brokerage?.id !== brokerageId || documentId && (!document || document.brokerage?.id !== brokerageId || document.deal?.id !== dealId) || action === "place" && prior[0]?.eventType === "hold_placed" || action === "release" && prior[0]?.eventType !== "hold_placed") return { result: { ok: false, message: "Legal-hold state or transaction-file scope is invalid.", itemId: null }, event: null };
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `HOLD-${policySuffix(`${holdKey}:${action}:${key}`)}`, deal: { connect: { id: dealId } }, ...documentId ? { document: { connect: { id: documentId } } } : {}, eventType: action === "place" ? "hold_placed" : "hold_released", holdKey, ...prior[0]?.id ? { reverses: { connect: { id: prior[0].id } } } : {}, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: `Legal hold ${action === "place" ? "placed" : "released"} without deleting transaction evidence.`, itemId: item.id };
      return { result, event: { eventType: `retention.hold_${action === "place" ? "placed" : "released"}`, brokerageId, aggregateType: "deal", aggregateId: dealId, actorId: evidenceActorId(scoped), action: `hold_${action}`, before: prior[0] || null, after: { ...result, holdKey, documentId: documentId || null } } };
    }
  });
}
async function createTransactionExportManifestCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), manifestKey = commandText(data.manifestKey), manifestSha256 = commandText(data.manifestSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !manifestKey || manifestKey.length > 200 || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 500) throw new Error("Deal, manifest key, and one to 500 checksummed items are required.");
  const items = data.items.map((item) => ({ documentId: commandText(item.documentId), sha256: commandText(item.sha256).toLowerCase() })).sort((left, right) => left.documentId.localeCompare(right.documentId));
  if (items.some((item) => !item.documentId || !isSha256(item.sha256))) throw new Error("Every export item requires a document and SHA-256 checksum.");
  const computedHash = transactionManifestSha256(manifestKey, dealId, items);
  if (manifestSha256 !== computedHash) throw new Error("Export manifest checksum does not match its canonical contents.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, manifestKey, manifestSha256, items, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${dealId}:manifest:${key}`,
    lockKey: `transaction-file-manifest:${dealId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id }" });
      if (!deal || deal.brokerage?.id !== brokerageId) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      for (const entry of items) {
        const [document, evidence] = await Promise.all([
          sudo.query.DealDocument.findOne({ where: { id: entry.documentId }, query: "id deal { id } brokerage { id }" }),
          sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: entry.documentId } }, documentSha256: { equals: entry.sha256 } }, take: 1, query: "id" })
        ]);
        if (!document || document.deal?.id !== dealId || document.brokerage?.id !== brokerageId || !evidence.length) return { result: { ok: false, message: "Manifest contains an unscoped or unverified document checksum.", itemId: null }, event: null };
      }
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `MANIFEST-${policySuffix(`${manifestKey}:${key}`)}`, deal: { connect: { id: dealId } }, eventType: "export_manifested", manifestKey, manifestSha256, manifestItems: items, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Immutable checksummed transaction export manifest appended.", itemId: item.id };
      return { result, event: { eventType: "retention.export_manifested", brokerageId, aggregateType: "deal", aggregateId: dealId, actorId: evidenceActorId(scoped), action: "manifest_export", before: null, after: { ...result, manifestKey, manifestSha256, itemCount: items.length } } };
    }
  });
}

// features/keystone/mutations/index.ts
var graphql8 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql8`
      type PlatformPerson { id: ID! name: String! email: String phone: String }
      type PlatformPropertySummary { id: ID! title: String! slug: String city: String state: String addressLine1: String price: String listingType: String }
      type PlatformLeadSummary { id: ID! name: String! email: String phone: String status: String intent: String }
      type PlatformActivity { id: ID! activityType: String! direction: String channel: String subject: String body: String occurredAt: String agent: PlatformPerson }
      type PlatformContact { id: ID! name: String! email: String phone: String status: String! intent: String source: String message: String lastContactedAt: String createdAt: String updatedAt: String activityAccess: String! property: PlatformPropertySummary assignedAgent: PlatformPerson showingsCount: Int activities: [PlatformActivity!]! }
      type PlatformContactCandidate { id: ID! name: String! email: String phone: String status: String! source: String createdAt: String assignedAgent: PlatformPerson property: PlatformPropertySummary }
      type PlatformDuplicateGroup { key: String! reason: String! candidates: [PlatformContactCandidate!]! }
      type PlatformContactStats { total: Int! new: Int! qualified: Int! tourScheduled: Int! offer: Int! }
      type PlatformOperatorViewer { actorId: ID! brokerageId: ID! }
      type PlatformContactPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformContactWorkspace { items: [PlatformContact!]! duplicateGroups: [PlatformDuplicateGroup!]! stats: PlatformContactStats! pageInfo: PlatformContactPageInfo! viewer: PlatformOperatorViewer! }
      type PlatformLeadDetail { lead: PlatformContact! activityAccess: String! nextActivityCursor: String viewer: PlatformOperatorViewer! }

      type PlatformListing { id: ID! title: String! slug: String! status: String! listingType: String propertyType: String shortDescription: String addressLine1: String city: String state: String postalCode: String price: String bedrooms: Int bathrooms: String squareFeet: Int isFeatured: Boolean primaryImageUrl: String updatedAt: String assignedAgent: PlatformPerson leadsCount: Int showingsCount: Int }
      type PlatformListingStats { total: Int! active: Int! comingSoon: Int! pending: Int! sold: Int! offMarket: Int! }
      type PlatformListingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformListingWorkspace { items: [PlatformListing!]! stats: PlatformListingStats! pageInfo: PlatformListingPageInfo! }

      type PlatformShowing { id: ID! status: String! showingType: String scheduledStart: String! scheduledEnd: String notes: String feedback: String createdAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson }
      type ShowingCommandReceipt { version: Int! showingId: ID! leadId: ID! propertyId: ID! }
      type ShowingSourceSnapshot { version: Int! capturedAt: String! propertyId: ID! leadId: ID! assignedAgentId: ID scheduledStart: String! scheduledEnd: String! showingType: String! listingTitle: String! listingSlug: String! addressLine1: String! city: String! state: String! listingType: String! price: String notes: String! propertyUpdatedAt: String }
      type ShowingHistoryEntry { id: ID! action: String! occurredAt: String! fromStatus: String toStatus: String }
      type PlatformShowingDetail { showing: PlatformShowing! updatedAt: String! revision: String! snapshot: ShowingSourceSnapshot history: [ShowingHistoryEntry!]! nextHistoryCursor: String }
      type PlatformShowingStats { total: Int! requested: Int! scheduled: Int! completed: Int! noShow: Int! cancelled: Int! }
      type PlatformShowingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformShowingWorkspace { items: [PlatformShowing!]! stats: PlatformShowingStats! pageInfo: PlatformShowingPageInfo! }

      type PlatformDeal { id: ID! title: String! stage: String! transactionType: String offerAmount: String commissionAmount: String expectedCloseDate: String closedAt: String nextStep: String notes: String createdAt: String updatedAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson assignedTeam: PlatformTeam }
      type PlatformTeam { id: ID! name: String! }
      type PlatformPipelineStats { total: Int! open: Int! underContract: Int! closedWon: Int! closedLost: Int! projectedCommission: String! }
      type PlatformPipelineWorkspace { items: [PlatformDeal!]! stats: PlatformPipelineStats! }

      type PlatformMembership { id: ID! membershipRole: String! isPrimary: Boolean! brokerage: PlatformBrokerageRef }
      type PlatformBrokerageRef { id: ID! name: String! slug: String! }
      type PlatformAgent { id: ID! name: String! email: String phone: String licenseNumber: String brokerageTitle: String avatarUrl: String onboardingStatus: String role: PlatformRoleRef memberships: [PlatformMembership!]! listingCount: Int! leadCount: Int! showingCount: Int! dealCount: Int! }
      type PlatformRoleRef { id: ID! name: String! }
      type PlatformAgentTeam { id: ID! name: String! slug: String! teamType: String! status: String! description: String leadAgent: PlatformPerson members: [PlatformPerson!]! leadCount: Int! dealCount: Int! }
      type PlatformPeopleWorkspace { agents: [PlatformAgent!]! teams: [PlatformAgentTeam!]! }

      type PlatformOfferRef { id: ID! offerNumber: String! }
      type PlatformOffer { id: ID! offerNumber: String! version: Int! parentOffer: PlatformOfferRef status: String! amount: String earnestMoney: String financingType: String contingencies: String submittedAt: String responseDueAt: String createdAt: String deal: PlatformDealRef property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson }
      type PlatformDealRef { id: ID! title: String! }
      type PlatformPropertyRef { id: ID! title: String! }
      type PlatformLeadRef { id: ID! name: String! }
      type PlatformMilestone { id: ID! name: String! status: String! dueAt: String completedAt: String sortOrder: Int notes: String assignedTo: PlatformPerson }
      type PlatformDocument { id: ID! title: String! documentType: String! status: String! requiresSignature: Boolean! sentAt: String signedAt: String expiresAt: String }
      type PlatformTransaction { id: ID! title: String! stage: String! expectedCloseDate: String property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson milestones: [PlatformMilestone!]! documents: [PlatformDocument!]! }
      type PlatformCommission { id: ID! title: String! status: String! side: String! grossCommission: String brokerageSplitPercent: String agentSplitPercent: String netCommission: String paidAt: String deal: PlatformDealRef agent: PlatformPerson }
      type PlatformSavedSearch { id: ID! name: String! city: String state: String propertyType: String minPrice: String maxPrice: String minBedrooms: Int alertsEnabled: Boolean! lastNotifiedAt: String user: PlatformPerson }
      type PlatformSavedSearchAlert { id: ID! status: String! cadence: String! lastSentAt: String sentCount: Int savedSearch: PlatformSearchRef user: PlatformPerson }
      type PlatformSearchRef { id: ID! name: String! }
      type PlatformSourceFeed { id: ID! name: String! provider: String feedType: String! status: String! lastImportedAt: String recordsImported: Int }
      type PlatformQueueItem { id: ID! eventKey: String! eventType: String! aggregateType: String! aggregateId: String! status: String! attempts: Int replayCount: Int availableAt: String occurredAt: String! lastError: String }
      type PlatformDisclosure { id: ID! title: String! disclosureType: String! status: String! documentUrl: String sentAt: String acknowledgedAt: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformMortgageEvidence { id: ID! applicationNumber: String! lenderName: String status: String! loanAmount: String interestRate: String submittedAt: String decisionAt: String deal: PlatformDealRef lead: PlatformLeadRef }
      type PlatformTitleEvidence { id: ID! orderNumber: String! titleCompany: String status: String! orderedAt: String clearedAt: String exceptions: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformEscrowEvidence { id: ID! escrowNumber: String! status: String! escrowCompany: String officerName: String openedAt: String scheduledCloseAt: String closedAt: String depositAmount: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformOpenHouse { id: ID! title: String! status: String! startsAt: String! endsAt: String! attendeeCount: Int notes: String property: PlatformPropertyRef hostAgent: PlatformPerson }
      type PlatformInspection { id: ID! title: String! inspectionType: String! status: String! scheduledAt: String completedAt: String inspectorName: String estimatedCost: String summary: String findings: String property: PlatformPropertyRef deal: PlatformDealRef }
      type PlatformMarketComp { id: ID! addressLine1: String! city: String state: String status: String! listPrice: String salePrice: String soldAt: String bedrooms: Int bathrooms: String squareFeet: Int distanceMiles: String subjectProperty: PlatformPropertyRef neighborhood: PlatformNeighborhoodRef }
      type PlatformNeighborhoodRef { id: ID! name: String! }
      type PlatformValuation { id: ID! valuationNumber: String! valuationType: String! lowValue: String estimatedValue: String highValue: String valuedAt: String notes: String property: PlatformPropertyRef performedBy: PlatformPerson }
      type PlatformSyndication { id: ID! channel: String! status: String! externalListingId: String listingUrl: String publishedAt: String lastSyncedAt: String errorMessage: String property: PlatformPropertySummary }
      type PlatformAgentTask { id: ID! title: String! status: String! priority: String! dueAt: String completedAt: String notes: String assignedAgent: PlatformPerson property: PlatformPropertyRef lead: PlatformLeadRef deal: PlatformDealRef }
      type PlatformReportLead { id: ID! source: String status: String! assignedAgent: PlatformPerson }
      type PlatformReportShowing { id: ID! status: String! assignedAgent: PlatformPerson }
      type PlatformReportDeal { id: ID! stage: String! commissionAmount: String assignedAgent: PlatformPerson }
      type PlatformReportsWorkspace { leads: [PlatformReportLead!]! showings: [PlatformReportShowing!]! deals: [PlatformReportDeal!]! activeListings: Int! pendingListings: Int! }
      type PlatformListingEngagementAuthority { id: ID! authorityNumber: String! status: String! jurisdictionCode: String! effectiveFrom: String! effectiveThrough: String! marketingAuthorized: Boolean! showingAuthorized: Boolean! documentSha256: String! property: PlatformPropertyRef practitioner: PlatformPerson }
      type PlatformListingPublicationAuthority { id: ID! authorityNumber: String! destination: String! status: String! effectiveFrom: String! effectiveThrough: String! authorityBasis: String! property: PlatformPropertyRef engagementId: ID }
      type PlatformPractitionerLicenseAuthority { id: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! verifiedAt: String! verificationSource: String! practitioner: PlatformPerson }
      type PlatformRepresentationAuthority { id: ID! authorityNumber: String! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! disclosureVersion: String! lead: PlatformLeadRef property: PlatformPropertyRef deal: PlatformDealRef practitioner: PlatformPerson }
      type PlatformDocumentEvidenceEvent { id: ID! eventKey: String! eventType: String! documentSha256: String! templateSha256: String! channel: String! provider: String! providerReference: String! occurredAt: String! acknowledgedAt: String document: PlatformDocumentRef offer: PlatformOfferRef }
      type PlatformDocumentRef { id: ID! title: String! }
      type PlatformCommissionLedgerEntry { id: ID! entryKey: String! batchKey: String! entryType: String! allocationType: String amountCents: String! currencyCode: String! payeeLabel: String externalReference: String occurredAt: String! commissionId: ID! preparedBy: PlatformPerson approvedBy: PlatformPerson }
      type PlatformRetentionPolicy { id: ID! policyKey: String! retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! effectiveFrom: String! effectiveThrough: String }
      type PlatformTransactionFileEvent { id: ID! eventKey: String! eventType: String! triggerAt: String disposeAfter: String holdKey: String manifestKey: String manifestSha256: String documentSha256: String externalDeletionReference: String reason: String! occurredAt: String! deal: PlatformDealRef document: PlatformDocumentRef }

      type PlatformOperationsWorkspace { offers: [PlatformOffer!]! transactions: [PlatformTransaction!]! commissions: [PlatformCommission!]! savedSearches: [PlatformSavedSearch!]! alerts: [PlatformSavedSearchAlert!]! feeds: [PlatformSourceFeed!]! queue: [PlatformQueueItem!]! inspections: [PlatformInspection!]! openHouses: [PlatformOpenHouse!]! disclosures: [PlatformDisclosure!]! mortgages: [PlatformMortgageEvidence!]! titleOrders: [PlatformTitleEvidence!]! escrows: [PlatformEscrowEvidence!]! comps: [PlatformMarketComp!]! valuations: [PlatformValuation!]! syndications: [PlatformSyndication!]! tasks: [PlatformAgentTask!]! listingEngagementAuthorities: [PlatformListingEngagementAuthority!]! listingPublicationAuthorities: [PlatformListingPublicationAuthority!]! practitionerLicenses: [PlatformPractitionerLicenseAuthority!]! representationAuthorities: [PlatformRepresentationAuthority!]! documentEvidenceEvents: [PlatformDocumentEvidenceEvent!]! commissionLedgerEntries: [PlatformCommissionLedgerEntry!]! retentionPolicies: [PlatformRetentionPolicy!]! transactionFileEvents: [PlatformTransactionFileEvent!]! }

      input PublicRealEstateListingFilters {
        q: String
        city: String
        listingType: String
        propertyType: String
        minPrice: String
        maxPrice: String
        bedrooms: Int
      }

      type PublicRealEstateAgent {
        name: String!
        email: String!
        phone: String!
        brokerageTitle: String!
        imagePath: String!
      }

      type PublicRealEstateMedia {
        title: String!
        mediaType: String!
        imagePath: String!
        externalUrl: String!
        altText: String!
        caption: String!
        sortOrder: Int!
        isHero: Boolean!
      }

      type PublicOpenHouse {
        id: ID!
        title: String!
        startsAt: String!
        endsAt: String!
        hostName: String!
      }

      type PublicRealEstateListing {
        id: ID!
        title: String!
        slug: String!
        status: String!
        listingType: String!
        propertyType: String!
        shortDescription: String!
        description: String!
        addressLine1: String!
        addressLine2: String!
        city: String!
        state: String!
        postalCode: String!
        neighborhood: String!
        price: String!
        bedrooms: Int
        bathrooms: String!
        squareFeet: Int
        lotSizeSquareFeet: Int
        yearBuilt: Int
        hoaFee: String!
        availableAt: String!
        isFeatured: Boolean!
        virtualTourUrl: String!
        imagePath: String!
        assignedAgent: PublicRealEstateAgent
        media: [PublicRealEstateMedia!]!
        openHouses: [PublicOpenHouse!]!
      }

      input SubmitListingInquiryInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        intent: String
        message: String
        preferredTime: String
      }

      type SubmitListingInquiryResult {
        ok: Boolean!
        message: String!
      }

      input RequestPropertyShowingInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        requestedStart: String!
        showingType: String
        message: String
        idempotencyKey: String
      }

      type RequestPropertyShowingResult {
        ok: Boolean!
        message: String!
        requestReference: String
      }

      type CustomerRegistrationResult { ok: Boolean! message: String! }
      input RealEstateCustomerInput { name: String! email: String! password: String! brokerageSlug: String! }
      type CustomerShowing { id: ID! status: String! showingType: String! scheduledStart: String! scheduledEnd: String listingTitle: String! listingSlug: String! requestedStart: String! }

      type PublicBrokerageIdentity {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PublicBrokerageIdentityState {
        status: String!
        settings: PublicBrokerageIdentity
      }

      type PlatformStorefrontSettings {
        id: ID!
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PlatformStorefrontSettingsState {
        status: String!
        settings: PlatformStorefrontSettings
      }

      input PlatformStorefrontSettingsInput {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int!
        logoIcon: String
        logoColor: String
      }

      input ShowingReviewInput { id: ID! status: String! expectedStatus: String! expectedUpdatedAt: String! expectedRevision: String! note: String idempotencyKey: String! }
      input OperatorTransitionInput {
        id: ID!
        status: String!
        note: String
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
      }

      type OperatorTransitionResult {
        ok: Boolean!
        message: String!
        itemId: ID
        status: String
        replayed: Boolean!
      }

      type OperatorCommandResult {
        ok: Boolean!
        message: String!
        itemId: ID
        replayed: Boolean!
      }

      input CreateOfferCommandInput { dealId: ID! amount: String! earnestMoney: String financingType: String contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateCounterOfferCommandInput { offerId: ID! amount: String! contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateChecklistItemCommandInput { dealId: ID! name: String! dueAt: DateTime assignedToId: ID notes: String idempotencyKey: String! }
      input TransitionDocumentCommandInput { documentId: ID! status: String! idempotencyKey: String! }
      input TransitionAgentTaskCommandInput { taskId: ID! status: String! idempotencyKey: String! }
      input TransitionInspectionCommandInput { inspectionId: ID! status: String! idempotencyKey: String! }
      input UpdateSavedSearchAlertCommandInput { alertId: ID! status: String! cadence: String! idempotencyKey: String! }
      input QueueSavedSearchAlertCommandInput { alertId: ID! idempotencyKey: String! }
      input QueueSourceImportCommandInput { sourceFeedId: ID! mode: String! idempotencyKey: String! }
      input TransitionListingSyndicationCommandInput { syndicationId: ID! status: String! providerReference: String reason: String! idempotencyKey: String! }

      input RecordPractitionerLicenseAuthorityInput { practitionerId: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! verifiedAt: DateTime! verificationSource: String! restrictions: String reason: String! idempotencyKey: String! }
      input RecordListingEngagementAuthorityInput { propertyId: ID! practitionerId: ID! status: String! jurisdictionCode: String! effectiveFrom: DateTime! effectiveThrough: DateTime! exclusive: Boolean marketingAuthorized: Boolean showingAuthorized: Boolean sellerPartySummary: JSON signatoryCapacity: String! documentSha256: String! providerReference: String reason: String! idempotencyKey: String! }
      input RecordListingPublicationAuthorityInput { propertyId: ID! engagementId: ID! destination: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! authorityBasis: String! localRuleReference: String dataUseGrantReference: String reason: String! idempotencyKey: String! }
      input RecordRepresentationAuthorityInput { leadId: ID! propertyId: ID dealId: ID practitionerId: ID! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! scopeSummary: String! documentSha256: String! disclosureVersion: String! consentRecordedAt: DateTime! reason: String! idempotencyKey: String! }

      input AppendDocumentEvidenceEventInput { documentId: ID! offerId: ID eventType: String! documentSha256: String! templateSha256: String! certificateSha256: String recipients: JSON! channel: String! provider: String! providerReference: String! occurredAt: DateTime! providerReportedAt: DateTime acknowledgedAt: DateTime acknowledgementReference: String reason: String! idempotencyKey: String! }

      input CommissionAllocationLineInput { allocationType: String! amountCents: String! payeeUserId: ID payeeLabel: String }
      input ProposeCommissionAllocationInput { commissionId: ID! currencyCode: String! lines: [CommissionAllocationLineInput!]! reason: String! idempotencyKey: String! }
      input ApproveCommissionAllocationInput { commissionId: ID! batchKey: String! reason: String! idempotencyKey: String! }
      input RecordCommissionReceiptInput { commissionId: ID! batchKey: String! amountCents: String! currencyCode: String! externalReference: String! sourceDocumentSha256: String! reason: String! idempotencyKey: String! }
      input ReverseCommissionLedgerEntryInput { entryId: ID! reason: String! idempotencyKey: String! }
      input ReconcileCommissionLedgerInput { commissionId: ID! batchKey: String! externalReference: String! reason: String! idempotencyKey: String! }

      input RecordRetentionPolicyInput { retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! legalBasis: String! effectiveFrom: DateTime! effectiveThrough: DateTime reason: String! idempotencyKey: String! }
      input AssignTransactionFileRetentionInput { dealId: ID! documentId: ID! policyId: ID! documentSha256: String! triggerAt: DateTime! reason: String! idempotencyKey: String! }
      input RecordTransactionLegalHoldInput { dealId: ID! documentId: ID holdKey: String! action: String! reason: String! idempotencyKey: String! }
      input TransactionExportManifestItemInput { documentId: ID! sha256: String! }
      input CreateTransactionExportManifestInput { dealId: ID! manifestKey: String! manifestSha256: String! items: [TransactionExportManifestItemInput!]! reason: String! idempotencyKey: String! }
      input InviteBrokerageMemberInput {
        brokerageId: ID!
        name: String!
        email: String!
        temporaryPassword: String!
        roleName: String!
        membershipRole: String!
        idempotencyKey: String!
      }

      input SuspendBrokerageMemberInput { membershipId: ID! idempotencyKey: String! }

      input UpdateDealFinancialTermsInput {
        dealId: ID!
        offerAmount: String!
        commissionAmount: String
        idempotencyKey: String!
      }

      input UpdateDealNextStepInput {
        dealId: ID!
        nextStep: String!
        notes: String
        idempotencyKey: String!
      }

      input CompleteShowingWithFeedbackInput {
        showingId: ID!
        feedback: String!
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
        expectedRevision: String
      }

      input ScheduleShowingForLeadInput {
        originalActorId: ID
        originalBrokerageId: ID
        leadId: ID!
        propertyId: ID!
        assignedAgentId: ID
        scheduledStart: DateTime!
        notes: String
        idempotencyKey: String!
      }

      input AddLeadActivityCommandInput {
        leadId: ID!
        propertyId: ID
        activityType: String
        direction: String
        channel: String
        subject: String
        body: String!
        idempotencyKey: String!
      }

      input ResolveDuplicateLeadInput {
        primaryLeadId: ID!
        duplicateLeadId: ID!
        note: String
        idempotencyKey: String!
      }

      type DomainOutboxEventStatus {
        id: ID!
        eventKey: String!
        eventType: String!
        aggregateType: String!
        aggregateId: String!
        status: String!
        attempts: Int
        replayCount: Int
        availableAt: DateTime
        occurredAt: DateTime!
        dispatchedAt: DateTime
        lastError: String
      }

      input SavePropertyForCurrentUserInput {
        propertyId: ID!
        status: SavedPropertyStatusType
        notes: String
      }

      input SavedPropertyIdInput {
        savedPropertyId: ID!
      }

      input SaveSearchForCurrentUserInput {
        name: String!
        city: String
        state: String
        propertyType: String
        minPrice: String
        maxPrice: String
        minBedrooms: Int
        minBathrooms: String
        minSquareFeet: Int
        keywords: String
        alertsEnabled: Boolean
      }

      input SavedSearchIdInput {
        savedSearchId: ID!
      }

      type SavedDiscoveryResult {
        ok: Boolean!
        message: String!
        itemId: ID
      }

      type OnboardingSeedSummary {
        created: Int!
        skipped: Int!
        total: Int!
      }

      type RealEstateOnboardingResult {
        completed: Boolean!
        status: String!
        core: OnboardingSeedSummary
        expansion: OnboardingSeedSummary
      }

      type Query {
        redirectToInit: Boolean
        publicBrokerageIdentity(brokerageSlug: String!): PublicBrokerageIdentityState!
        customerShowingHistory(brokerageSlug: String!, id: ID): [CustomerShowing!]!
        publicRealEstateListings(brokerageSlug: String!, filters: PublicRealEstateListingFilters, take: Int = 24, skip: Int = 0): [PublicRealEstateListing!]!
        publicRealEstateListing(brokerageSlug: String!, slug: String!): PublicRealEstateListing
        domainOutboxEventStatus(eventKey: String!): DomainOutboxEventStatus
        platformContacts(status: String = "all", q: String, take: Int = 50, after: String, before: String): PlatformContactWorkspace!
        platformLeadDetail(id: ID!, before: String): PlatformLeadDetail
        platformShowingRequestViewer: PlatformOperatorViewer
        platformListings(status: String = "all", q: String, take: Int = 60, after: String, before: String): PlatformListingWorkspace!
        scheduledShowingReceipt(data: ScheduleShowingForLeadInput!): ShowingCommandReceipt
        platformShowingDetail(id: ID!, before: String): PlatformShowingDetail
        platformShowings(status: String = "all", range: String = "upcoming", q: String, take: Int = 80, after: String, before: String): PlatformShowingWorkspace!
        platformPipeline: PlatformPipelineWorkspace!
        platformPeople: PlatformPeopleWorkspace!
        platformReports: PlatformReportsWorkspace!
        platformOperations: PlatformOperationsWorkspace!
        platformStorefrontSettings: PlatformStorefrontSettingsState!
      }

      type Mutation {
        submitListingInquiry(data: SubmitListingInquiryInput!): SubmitListingInquiryResult!
        requestPropertyShowing(data: RequestPropertyShowingInput!): RequestPropertyShowingResult!
        transitionLeadStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionPropertyStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionShowingStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        reviewShowingCommand(data: ShowingReviewInput!): OperatorTransitionResult!
        transitionOpenHouseStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionOfferStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDealStage(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionCommissionStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDisclosureStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionTransactionMilestoneStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        createOfferCommand(data: CreateOfferCommandInput!): OperatorCommandResult!
        createCounterOfferCommand(data: CreateCounterOfferCommandInput!): OperatorCommandResult!
        createChecklistItemCommand(data: CreateChecklistItemCommandInput!): OperatorCommandResult!
        transitionDocumentCommand(data: TransitionDocumentCommandInput!): OperatorCommandResult!
        transitionAgentTaskCommand(data: TransitionAgentTaskCommandInput!): OperatorCommandResult!
        transitionInspectionCommand(data: TransitionInspectionCommandInput!): OperatorCommandResult!
        updateSavedSearchAlertCommand(data: UpdateSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSavedSearchAlertCommand(data: QueueSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSourceImportCommand(data: QueueSourceImportCommandInput!): OperatorCommandResult!
        transitionListingSyndicationCommand(data: TransitionListingSyndicationCommandInput!): OperatorCommandResult!
        recordPractitionerLicenseAuthorityCommand(data: RecordPractitionerLicenseAuthorityInput!): OperatorCommandResult!
        recordListingEngagementAuthorityCommand(data: RecordListingEngagementAuthorityInput!): OperatorCommandResult!
        recordListingPublicationAuthorityCommand(data: RecordListingPublicationAuthorityInput!): OperatorCommandResult!
        recordRepresentationAuthorityCommand(data: RecordRepresentationAuthorityInput!): OperatorCommandResult!
        appendDocumentEvidenceEventCommand(data: AppendDocumentEvidenceEventInput!): OperatorCommandResult!
        proposeCommissionAllocationCommand(data: ProposeCommissionAllocationInput!): OperatorCommandResult!
        approveCommissionAllocationCommand(data: ApproveCommissionAllocationInput!): OperatorCommandResult!
        recordCommissionReceiptCommand(data: RecordCommissionReceiptInput!): OperatorCommandResult!
        reverseCommissionLedgerEntryCommand(data: ReverseCommissionLedgerEntryInput!): OperatorCommandResult!
        reconcileCommissionLedgerCommand(data: ReconcileCommissionLedgerInput!): OperatorCommandResult!
        recordRetentionPolicyCommand(data: RecordRetentionPolicyInput!): OperatorCommandResult!
        assignTransactionFileRetentionCommand(data: AssignTransactionFileRetentionInput!): OperatorCommandResult!
        recordTransactionLegalHoldCommand(data: RecordTransactionLegalHoldInput!): OperatorCommandResult!
        createTransactionExportManifestCommand(data: CreateTransactionExportManifestInput!): OperatorCommandResult!
        inviteBrokerageMemberCommand(data: InviteBrokerageMemberInput!): OperatorCommandResult!
        suspendBrokerageMemberCommand(data: SuspendBrokerageMemberInput!): OperatorCommandResult!
        updateDealFinancialTermsCommand(data: UpdateDealFinancialTermsInput!): OperatorCommandResult!
        updateDealNextStepCommand(data: UpdateDealNextStepInput!): OperatorCommandResult!
        completeShowingWithFeedback(data: CompleteShowingWithFeedbackInput!): OperatorCommandResult!
        scheduleShowingForLeadCommand(data: ScheduleShowingForLeadInput!): OperatorCommandResult!
        addLeadActivityCommand(data: AddLeadActivityCommandInput!): OperatorCommandResult!
        resolveDuplicateLeadCommand(data: ResolveDuplicateLeadInput!): OperatorCommandResult!
        replayDomainOutboxEvent(eventId: ID!): OperatorCommandResult!
        savePropertyForCurrentUser(data: SavePropertyForCurrentUserInput!): SavedDiscoveryResult!
        removeSavedPropertyForCurrentUser(data: SavedPropertyIdInput!): SavedDiscoveryResult!
        saveSearchForCurrentUser(data: SaveSearchForCurrentUserInput!): SavedDiscoveryResult!
        deleteSavedSearchForCurrentUser(data: SavedSearchIdInput!): SavedDiscoveryResult!
        runRealEstateOnboarding(template: String = "full"): RealEstateOnboardingResult!
        dismissRealEstateOnboarding: RealEstateOnboardingResult!
        updatePlatformStorefrontSettings(data: PlatformStorefrontSettingsInput!): PlatformStorefrontSettingsState!
        registerRealEstateCustomer(data: RealEstateCustomerInput!): CustomerRegistrationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        publicBrokerageIdentity,
        customerShowingHistory,
        publicRealEstateListings,
        publicRealEstateListing,
        domainOutboxEventStatus,
        platformContacts,
        platformLeadDetail,
        platformShowingRequestViewer,
        platformListings,
        platformShowings,
        platformShowingDetail,
        scheduledShowingReceipt,
        platformPipeline,
        platformPeople,
        platformReports,
        platformOperations,
        platformStorefrontSettings
      },
      Mutation: {
        submitListingInquiry,
        requestPropertyShowing,
        transitionLeadStatus,
        transitionPropertyStatus,
        transitionShowingStatus,
        reviewShowingCommand,
        transitionOpenHouseStatus,
        transitionOfferStatus,
        transitionDealStage,
        transitionCommissionStatus,
        transitionDisclosureStatus,
        transitionTransactionMilestoneStatus,
        createOfferCommand,
        createCounterOfferCommand,
        createChecklistItemCommand,
        transitionDocumentCommand,
        transitionAgentTaskCommand,
        transitionInspectionCommand,
        updateSavedSearchAlertCommand,
        queueSavedSearchAlertCommand,
        queueSourceImportCommand,
        transitionListingSyndicationCommand,
        recordPractitionerLicenseAuthorityCommand,
        recordListingEngagementAuthorityCommand,
        recordListingPublicationAuthorityCommand,
        recordRepresentationAuthorityCommand,
        appendDocumentEvidenceEventCommand,
        proposeCommissionAllocationCommand,
        approveCommissionAllocationCommand,
        recordCommissionReceiptCommand,
        reverseCommissionLedgerEntryCommand,
        reconcileCommissionLedgerCommand,
        recordRetentionPolicyCommand,
        assignTransactionFileRetentionCommand,
        recordTransactionLegalHoldCommand,
        createTransactionExportManifestCommand,
        inviteBrokerageMemberCommand,
        suspendBrokerageMemberCommand,
        updateDealFinancialTermsCommand,
        updateDealNextStepCommand,
        completeShowingWithFeedback,
        scheduleShowingForLeadCommand,
        addLeadActivityCommand,
        resolveDuplicateLeadCommand,
        replayDomainOutboxEvent,
        savePropertyForCurrentUser,
        removeSavedPropertyForCurrentUser,
        saveSearchForCurrentUser,
        deleteSavedSearchForCurrentUser,
        runRealEstateOnboarding: runRealEstateOnboardingMutation,
        dismissRealEstateOnboarding,
        updatePlatformStorefrontSettings,
        registerRealEstateCustomer
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  throw new Error("SMTP_STORE_LINK is required before password reset email can be sent.");
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const origin = new URL(frontendUrl);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("Password reset origin must use HTTPS in production.");
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("SMTP delivery is not configured.");
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${origin.origin}/dashboard/reset?token=${encodeURIComponent(resetToken)}`
    })
  });
}

// features/keystone/lib/initialOwnerBootstrap.ts
var BROKERAGE_SLUG = "juniper-realty";
var MEMBERSHIP_KEY = `${BROKERAGE_SLUG}:initial-owner`;
var ROLE_NAME = "Admin";
var roleData = {
  name: ROLE_NAME,
  canSeeOtherPeople: true,
  canEditOtherPeople: true,
  canManagePeople: true,
  canManageRoles: true,
  canAccessDashboard: true,
  canManageListings: true,
  canManageLeads: true,
  canManageShowings: true,
  canManageDeals: true,
  canViewReports: true,
  canManageOnboarding: true
};
function exactlyOne(items, label) {
  if (items.length > 1) throw new Error(`Initial owner bootstrap found more than one ${label}; owner review is required.`);
  return items[0];
}
async function createInitialOwner(context, data) {
  if (process.env.NODE_ENV === "production") {
    const allowedEmail = process.env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
    if (process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED !== "true" || !allowedEmail || data.email.trim().toLowerCase() !== allowedEmail) {
      throw new Error("Initial owner bootstrap is disabled for this request.");
    }
  }
  return context.transaction(async (transactionContext) => {
    const sudo = transactionContext.sudo();
    await sudo.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "bootstrap:initial-owner"
    );
    if (await sudo.db.User.count()) {
      throw new Error("Initial items can only be created when no users exist.");
    }
    const brokerageMatches = await sudo.query.Brokerage.findMany({
      where: { slug: { equals: BROKERAGE_SLUG } },
      take: 2,
      query: "id name slug status isPrimary"
    });
    let brokerage = await exactlyOne(brokerageMatches, "Juniper Realty brokerage");
    if (brokerage) {
      brokerage = await sudo.db.Brokerage.updateOne({
        where: { id: brokerage.id },
        data: { name: "Juniper Realty", status: "active", isPrimary: true }
      });
    } else {
      brokerage = await sudo.db.Brokerage.createOne({
        data: { name: "Juniper Realty", slug: BROKERAGE_SLUG, status: "active", isPrimary: true }
      });
    }
    const roleMatches = await sudo.query.Role.findMany({
      where: { name: { equals: ROLE_NAME } },
      take: 2,
      query: "id name"
    });
    let role5 = await exactlyOne(roleMatches, "Admin role");
    role5 = role5 ? await sudo.db.Role.updateOne({ where: { id: role5.id }, data: roleData }) : await sudo.db.Role.createOne({ data: roleData });
    const existingMemberships = await sudo.query.BrokerageMembership.findMany({
      where: { membershipKey: { equals: MEMBERSHIP_KEY } },
      take: 2,
      query: "id brokerage { id } user { id }"
    });
    if (existingMemberships.length) {
      throw new Error("Initial owner membership exists without a user; owner review is required.");
    }
    const user = await sudo.db.User.createOne({
      data: {
        ...data,
        role: { connect: { id: role5.id } },
        activeBrokerage: { connect: { id: brokerage.id } },
        onboardingStatus: "not_started"
      }
    });
    const membership = await sudo.db.BrokerageMembership.createOne({
      data: {
        membershipKey: MEMBERSHIP_KEY,
        brokerage: { connect: { id: brokerage.id } },
        user: { connect: { id: user.id } },
        membershipRole: "owner",
        status: "active",
        isPrimary: true,
        joinedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const memberships = await sudo.query.BrokerageMembership.findMany({
      where: { user: { id: { equals: user.id } } },
      take: 2,
      query: "id membershipRole status isPrimary brokerage { id } user { id }"
    });
    if (await sudo.db.User.count() !== 1 || memberships.length !== 1 || memberships[0].id !== membership.id || memberships[0].brokerage?.id !== brokerage.id || memberships[0].user?.id !== user.id || memberships[0].membershipRole !== "owner" || memberships[0].status !== "active" || !memberships[0].isPrimary) {
      throw new Error("Initial owner bootstrap invariant failed; the transaction was rolled back.");
    }
    return user;
  }, { timeout: 3e4 });
}
function installInitialOwnerResolver(schema) {
  const field = schema.getMutationType()?.getFields()?.createInitialUser;
  if (!field) throw new Error("Keystone createInitialUser mutation is unavailable.");
  field.resolve = async (_root, { data }, context) => {
    if (!context.sessionStrategy) throw new Error("No session implementation available on context.");
    const item = await createInitialOwner(context, data);
    const sessionToken = await context.sessionStrategy.start({
      data: { listKey: "User", itemId: item.id.toString() },
      context
    });
    if (typeof sessionToken !== "string" || !sessionToken.length) throw new Error("Failed to start session.");
    return { item, sessionToken };
  };
  return schema;
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var requiredBrokerageModels = [
  "AgentTask",
  "DealDocument",
  "SavedSearch",
  "SavedSearchAlert",
  "SourceFeed",
  "TransactionMilestone"
];
function enforceRequiredBrokerageRelations(schema) {
  let next = schema;
  for (const model of requiredBrokerageModels) {
    const blockPattern = new RegExp(`(model ${model} \\{[\\s\\S]*?\\n\\})`);
    const match = next.match(blockPattern);
    if (!match) throw new Error(`Generated Prisma model ${model} is missing.`);
    const updated = match[1].replace(/brokerage(\s+)Brokerage\?(\s+)@relation/, "brokerage$1Brokerage$2@relation").replace(/brokerageId(\s+)String\?(\s+)@map\("brokerage"\)/, 'brokerageId$1String$2@map("brokerage")');
    if (updated === match[1]) throw new Error(`Generated Prisma model ${model} no longer has the expected brokerage relation shape.`);
    next = next.replace(match[1], updated);
  }
  return next;
}
function sessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production.");
  return "local-test-only-session-secret-change-before-production";
}
var sessionConfig = {
  maxAge: 60 * 60 * 8,
  secret: sessionSecret()
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The generated createInitialUser resolver is replaced below so the user,
    // authority roots, required membership, and active brokerage commit together.
    itemData: {}
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    activeBrokerage { id slug status }
    brokerageMemberships {
      id
      membershipRole
      status
      isPrimary
      brokerage { id slug status }
    }
    role {
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageListings
      canManageLeads
      canManageShowings
      canManageDeals
      canViewReports
      canManageOnboarding
    }
  `
});
var keystone_default = withAuth(
  (0, import_core44.config)({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaSchema: (schema) => preserveLegacyMoneyColumns(enforceRequiredBrokerageRelations(schema))
    },
    lists: models,
    ui: {
      isAccessAllowed: ({ session }) => Boolean(session?.data.role?.canAccessDashboard && activeBrokerageIds(session).length)
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema: (schema) => installInitialOwnerResolver(extendGraphqlSchema(schema))
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
