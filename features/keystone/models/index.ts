import type { BaseListTypeInfo, FieldTypeFunc } from '@keystone-6/core/types';
import { staticFieldUi } from '../lib/staticFieldUi';
import { DomainAuditEvent } from './DomainAuditEvent';
import { DomainOutboxEvent } from './DomainOutboxEvent';
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

export const models = {
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
  TransactionFileEvent,
};

for (const model of Object.values(models)) {
  const fields = model.fields as Record<string, FieldTypeFunc<BaseListTypeInfo>>;
  for (const key of Object.keys(fields)) fields[key] = staticFieldUi(fields[key]);
}

export default models;
