import type { BaseListTypeInfo, FieldTypeFunc } from '@keystone-6/core/types';
import { staticFieldUi } from '../lib/staticFieldUi';
import { DomainAuditEvent } from './DomainAuditEvent';
import { CommandReceipt } from './CommandReceipt';
import { Brokerage } from './Brokerage';
import { BrokerageMembership } from './BrokerageMembership';
import { BrokerageSettings } from './BrokerageSettings';
import { SavedSearchAlert } from './SavedSearchAlert';
import { Disclosure } from './Disclosure';
import { PropertyValuation } from './PropertyValuation';
import { TransactionMilestone } from './TransactionMilestone';
import { MortgageApplication } from './MortgageApplication';
import { TitleOrder } from './TitleOrder';
import { Escrow } from './Escrow';
import { ShowingFeedback } from './ShowingFeedback';
import { OpenHouse } from './OpenHouse';
import { SourceFeed } from './SourceFeed';
import { ListingSyndication } from './ListingSyndication';
import { User } from './User';
import { Role } from './Role';
import { Property } from './Property';
import { Lead } from './Lead';
import { Showing } from './Showing';
import { Deal } from './Deal';
import { SavedProperty } from './SavedProperty';
import { LeadActivity } from './LeadActivity';
import { LeadRoutingRule } from './LeadRoutingRule';
import { PropertyMedia } from './PropertyMedia';
import { PropertyInspection } from './PropertyInspection';
import { Offer } from './Offer';
import { DealDocument } from './DealDocument';
import { Commission } from './Commission';
import { SavedSearch } from './SavedSearch';
import { MarketComp } from './MarketComp';
import { Neighborhood } from './Neighborhood';
import { AgentTeam } from './AgentTeam';
import { AgentTask } from './AgentTask';
import { ListingEngagementAuthority } from './ListingEngagementAuthority';
import { ListingPublicationAuthority } from './ListingPublicationAuthority';
import { PractitionerLicenseAuthority } from './PractitionerLicenseAuthority';
import { RepresentationAuthority } from './RepresentationAuthority';
import { DocumentEvidenceEvent } from './DocumentEvidenceEvent';
import { CommissionLedgerEntry } from './CommissionLedgerEntry';
import { RetentionPolicy } from './RetentionPolicy';
import { TransactionFileEvent } from './TransactionFileEvent';
import { PaymentProvider } from './PaymentProvider';
import { Payment, PaymentWebhookReceipt } from './Payment';

export const models = {
  DomainAuditEvent,
  CommandReceipt,
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
  TransactionFileEvent,
  PaymentProvider,
  Payment,
  PaymentWebhookReceipt,
};

// Where-filters and ordering reach hidden data (counts through a relation, startsWith on a hidden value),
// so a field is filterable/orderable only by sessions that may read it: a relationship needs permission
// to read the target list, and a field with its own read rule uses that rule. Explicit settings win.
function operationQuery(listKey: string) {
  const access = (models as Record<string, any>)[listKey]?.access;
  const operation = typeof access === 'function' ? access : access?.operation;
  const query = typeof operation === 'function' ? operation : operation?.query;
  return typeof query === 'function' ? query : () => query !== false;
}

// A relation filter also needs to see every row of the target list the session reads: a row filter
// narrower than the brokerage (assigned leads only) would let a role count rows it cannot read.
function rowFilterIsBrokerageWide(listKey: string, args: any) {
  const access = (models as Record<string, any>)[listKey]?.access;
  const filter = typeof access === 'function' ? undefined : access?.filter;
  const query = typeof filter === 'function' ? undefined : filter?.query;
  if (query === undefined || query === true) return true;
  const result = typeof query === 'function' ? query({ ...args, operation: 'query', listKey }) : query;
  if (result === true) return true;
  if (!result || typeof result !== 'object') return false;
  const keys = Object.keys(result);
  return keys.length === 1 && (keys[0] === 'brokerage' || keys[0] === 'id' && listKey === 'Brokerage');
}

function readGatedFilters(field: FieldTypeFunc<BaseListTypeInfo>): FieldTypeFunc<BaseListTypeInfo> {
  return meta => {
    const config: any = field(meta);
    const access = config.access;
    const read = typeof access === 'function' ? access : access?.read;
    const target = config.dbField?.kind === 'relation' ? String(config.dbField.list) : null;
    // Free-form blobs (metadata, snapshots, provider data) are never filterable.
    if (config.dbField?.kind === 'scalar' && config.dbField.scalar === 'Json' && config.isFilterable === undefined) {
      return { ...config, isFilterable: false };
    }
    if (!target && read === undefined) return config;
    const allowed = (args: any) => {
      try {
        if (read !== undefined && !(typeof read === 'function' ? read({ ...args, operation: 'query' }) : read)) return false;
        return target ? Boolean(operationQuery(target)({ ...args, operation: 'query', listKey: target })) && rowFilterIsBrokerageWide(target, args) : true;
      } catch {
        return false;
      }
    };
    return {
      ...config,
      ...(config.isFilterable === undefined ? { isFilterable: allowed } : {}),
      ...(config.isOrderable === undefined && !target ? { isOrderable: allowed } : {}),
    };
  };
}

for (const model of Object.values(models)) {
  const fields = model.fields as Record<string, FieldTypeFunc<BaseListTypeInfo>>;
  for (const key of Object.keys(fields)) fields[key] = staticFieldUi(readGatedFilters(fields[key]));
}

export default models;
