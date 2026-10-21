-- CreateEnum
CREATE TYPE "ListingEngagementAuthorityStatusType" AS ENUM ('executed', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "ListingPublicationAuthorityDestinationType" AS ENUM ('public_site', 'mls', 'idx', 'syndication');

-- CreateEnum
CREATE TYPE "ListingPublicationAuthorityStatusType" AS ENUM ('authorized', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PractitionerLicenseAuthorityLicenseTypeType" AS ENUM ('broker', 'associate_broker', 'sales_agent');

-- CreateEnum
CREATE TYPE "PractitionerLicenseAuthorityStatusType" AS ENUM ('verified_active', 'restricted', 'inactive', 'expired', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "RepresentationAuthoritySideType" AS ENUM ('buyer', 'seller');

-- CreateEnum
CREATE TYPE "RepresentationAuthorityRelationshipTypeType" AS ENUM ('exclusive_agency', 'nonexclusive_agency', 'transaction_brokerage', 'customer_assistance');

-- CreateEnum
CREATE TYPE "RepresentationAuthorityStatusType" AS ENUM ('executed', 'terminated', 'expired');

-- CreateEnum
CREATE TYPE "DocumentEvidenceEventEventTypeType" AS ENUM ('generated', 'signed', 'delivered', 'received', 'presented', 'acknowledged', 'voided');

-- CreateEnum
CREATE TYPE "DocumentEvidenceEventChannelType" AS ENUM ('esign', 'email', 'portal', 'in_person', 'other');

-- CreateEnum
CREATE TYPE "CommissionLedgerEntryEntryTypeType" AS ENUM ('allocation', 'allocation_approval', 'receipt', 'reversal', 'reconciliation');

-- CreateEnum
CREATE TYPE "CommissionLedgerEntryAllocationTypeType" AS ENUM ('brokerage', 'agent', 'team', 'referral', 'fee', 'unallocated');

-- CreateEnum
CREATE TYPE "RetentionPolicyRetentionClassType" AS ENUM ('transaction_file', 'listing_no_close', 'consent_proof', 'security_incident');

-- CreateEnum
CREATE TYPE "RetentionPolicyTriggerTypeType" AS ENUM ('deal_closed', 'listing_ended', 'document_signed', 'manual_verified');

-- CreateEnum
CREATE TYPE "RetentionPolicyDispositionType" AS ENUM ('tombstone_delete', 'archive', 'review');

-- CreateEnum
CREATE TYPE "TransactionFileEventEventTypeType" AS ENUM ('retention_assigned', 'hold_placed', 'hold_released', 'export_manifested', 'disposition_requested', 'tombstoned');

-- CreateTable
CREATE TABLE "ListingEngagementAuthority" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "authorityNumber" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "assignedPractitioner" TEXT,
    "status" "ListingEngagementAuthorityStatusType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveThrough" TIMESTAMP(3) NOT NULL,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "marketingAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "showingAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "sellerPartySummary" JSONB,
    "signatoryCapacity" TEXT NOT NULL DEFAULT '',
    "documentSha256" TEXT NOT NULL DEFAULT '',
    "documentProviderReference" TEXT NOT NULL DEFAULT '',
    "supersedes" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEngagementAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPublicationAuthority" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "authorityNumber" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "engagement" TEXT,
    "destination" "ListingPublicationAuthorityDestinationType" NOT NULL,
    "status" "ListingPublicationAuthorityStatusType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveThrough" TIMESTAMP(3) NOT NULL,
    "authorityBasis" TEXT NOT NULL DEFAULT '',
    "localRuleReference" TEXT NOT NULL DEFAULT '',
    "dataUseGrantReference" TEXT NOT NULL DEFAULT '',
    "supersedes" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPublicationAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerLicenseAuthority" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "practitioner" TEXT,
    "licenseNumber" TEXT NOT NULL DEFAULT '',
    "licenseType" "PractitionerLicenseAuthorityLicenseTypeType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "status" "PractitionerLicenseAuthorityStatusType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveThrough" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationSource" TEXT NOT NULL DEFAULT '',
    "restrictions" TEXT NOT NULL DEFAULT '',
    "supersedes" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerLicenseAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentationAuthority" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "authorityNumber" TEXT NOT NULL DEFAULT '',
    "lead" TEXT,
    "property" TEXT,
    "deal" TEXT,
    "practitioner" TEXT,
    "side" "RepresentationAuthoritySideType" NOT NULL,
    "relationshipType" "RepresentationAuthorityRelationshipTypeType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "status" "RepresentationAuthorityStatusType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveThrough" TIMESTAMP(3) NOT NULL,
    "scopeSummary" TEXT NOT NULL DEFAULT '',
    "documentSha256" TEXT NOT NULL DEFAULT '',
    "disclosureVersion" TEXT NOT NULL DEFAULT '',
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "supersedes" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepresentationAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEvidenceEvent" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "document" TEXT,
    "deal" TEXT,
    "offer" TEXT,
    "eventType" "DocumentEvidenceEventEventTypeType" NOT NULL,
    "documentSha256" TEXT NOT NULL DEFAULT '',
    "templateSha256" TEXT NOT NULL DEFAULT '',
    "certificateSha256" TEXT NOT NULL DEFAULT '',
    "recipients" JSONB,
    "channel" "DocumentEvidenceEventChannelType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "providerReportedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgementReference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEvidenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedgerEntry" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "entryKey" TEXT NOT NULL DEFAULT '',
    "batchKey" TEXT NOT NULL DEFAULT '',
    "commission" TEXT,
    "deal" TEXT,
    "entryType" "CommissionLedgerEntryEntryTypeType" NOT NULL,
    "allocationType" "CommissionLedgerEntryAllocationTypeType",
    "amountCents" BIGINT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "payeeUser" TEXT,
    "payeeLabel" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "sourceDocumentSha256" TEXT NOT NULL DEFAULT '',
    "reverses" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "preparedBy" TEXT,
    "approvedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "policyKey" TEXT NOT NULL DEFAULT '',
    "retentionClass" "RetentionPolicyRetentionClassType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "triggerType" "RetentionPolicyTriggerTypeType" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "disposition" "RetentionPolicyDispositionType" NOT NULL,
    "legalBasis" TEXT NOT NULL DEFAULT '',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveThrough" TIMESTAMP(3),
    "supersedes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionFileEvent" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "document" TEXT,
    "policy" TEXT,
    "eventType" "TransactionFileEventEventTypeType" NOT NULL,
    "triggerAt" TIMESTAMP(3),
    "disposeAfter" TIMESTAMP(3),
    "holdKey" TEXT NOT NULL DEFAULT '',
    "manifestKey" TEXT NOT NULL DEFAULT '',
    "manifestSha256" TEXT NOT NULL DEFAULT '',
    "manifestItems" JSONB,
    "documentSha256" TEXT NOT NULL DEFAULT '',
    "externalDeletionReference" TEXT NOT NULL DEFAULT '',
    "reverses" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "approvedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionFileEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingEngagementAuthority_authorityNumber_key" ON "ListingEngagementAuthority"("authorityNumber");

-- CreateIndex
CREATE INDEX "ListingEngagementAuthority_brokerage_idx" ON "ListingEngagementAuthority"("brokerage");

-- CreateIndex
CREATE INDEX "ListingEngagementAuthority_property_idx" ON "ListingEngagementAuthority"("property");

-- CreateIndex
CREATE INDEX "ListingEngagementAuthority_assignedPractitioner_idx" ON "ListingEngagementAuthority"("assignedPractitioner");

-- CreateIndex
CREATE INDEX "ListingEngagementAuthority_supersedes_idx" ON "ListingEngagementAuthority"("supersedes");

-- CreateIndex
CREATE INDEX "ListingEngagementAuthority_recordedBy_idx" ON "ListingEngagementAuthority"("recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ListingPublicationAuthority_authorityNumber_key" ON "ListingPublicationAuthority"("authorityNumber");

-- CreateIndex
CREATE INDEX "ListingPublicationAuthority_brokerage_idx" ON "ListingPublicationAuthority"("brokerage");

-- CreateIndex
CREATE INDEX "ListingPublicationAuthority_property_idx" ON "ListingPublicationAuthority"("property");

-- CreateIndex
CREATE INDEX "ListingPublicationAuthority_engagement_idx" ON "ListingPublicationAuthority"("engagement");

-- CreateIndex
CREATE INDEX "ListingPublicationAuthority_supersedes_idx" ON "ListingPublicationAuthority"("supersedes");

-- CreateIndex
CREATE INDEX "ListingPublicationAuthority_recordedBy_idx" ON "ListingPublicationAuthority"("recordedBy");

-- CreateIndex
CREATE INDEX "PractitionerLicenseAuthority_brokerage_idx" ON "PractitionerLicenseAuthority"("brokerage");

-- CreateIndex
CREATE INDEX "PractitionerLicenseAuthority_practitioner_idx" ON "PractitionerLicenseAuthority"("practitioner");

-- CreateIndex
CREATE INDEX "PractitionerLicenseAuthority_supersedes_idx" ON "PractitionerLicenseAuthority"("supersedes");

-- CreateIndex
CREATE INDEX "PractitionerLicenseAuthority_verifiedBy_idx" ON "PractitionerLicenseAuthority"("verifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentationAuthority_authorityNumber_key" ON "RepresentationAuthority"("authorityNumber");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_brokerage_idx" ON "RepresentationAuthority"("brokerage");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_lead_idx" ON "RepresentationAuthority"("lead");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_property_idx" ON "RepresentationAuthority"("property");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_deal_idx" ON "RepresentationAuthority"("deal");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_practitioner_idx" ON "RepresentationAuthority"("practitioner");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_supersedes_idx" ON "RepresentationAuthority"("supersedes");

-- CreateIndex
CREATE INDEX "RepresentationAuthority_recordedBy_idx" ON "RepresentationAuthority"("recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEvidenceEvent_eventKey_key" ON "DocumentEvidenceEvent"("eventKey");

-- CreateIndex
CREATE INDEX "DocumentEvidenceEvent_brokerage_idx" ON "DocumentEvidenceEvent"("brokerage");

-- CreateIndex
CREATE INDEX "DocumentEvidenceEvent_document_idx" ON "DocumentEvidenceEvent"("document");

-- CreateIndex
CREATE INDEX "DocumentEvidenceEvent_deal_idx" ON "DocumentEvidenceEvent"("deal");

-- CreateIndex
CREATE INDEX "DocumentEvidenceEvent_offer_idx" ON "DocumentEvidenceEvent"("offer");

-- CreateIndex
CREATE INDEX "DocumentEvidenceEvent_actor_idx" ON "DocumentEvidenceEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedgerEntry_entryKey_key" ON "CommissionLedgerEntry"("entryKey");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_brokerage_idx" ON "CommissionLedgerEntry"("brokerage");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_commission_idx" ON "CommissionLedgerEntry"("commission");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_deal_idx" ON "CommissionLedgerEntry"("deal");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_payeeUser_idx" ON "CommissionLedgerEntry"("payeeUser");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_reverses_idx" ON "CommissionLedgerEntry"("reverses");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_preparedBy_idx" ON "CommissionLedgerEntry"("preparedBy");

-- CreateIndex
CREATE INDEX "CommissionLedgerEntry_approvedBy_idx" ON "CommissionLedgerEntry"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_policyKey_key" ON "RetentionPolicy"("policyKey");

-- CreateIndex
CREATE INDEX "RetentionPolicy_brokerage_idx" ON "RetentionPolicy"("brokerage");

-- CreateIndex
CREATE INDEX "RetentionPolicy_supersedes_idx" ON "RetentionPolicy"("supersedes");

-- CreateIndex
CREATE INDEX "RetentionPolicy_approvedBy_idx" ON "RetentionPolicy"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionFileEvent_eventKey_key" ON "TransactionFileEvent"("eventKey");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_brokerage_idx" ON "TransactionFileEvent"("brokerage");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_deal_idx" ON "TransactionFileEvent"("deal");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_document_idx" ON "TransactionFileEvent"("document");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_policy_idx" ON "TransactionFileEvent"("policy");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_reverses_idx" ON "TransactionFileEvent"("reverses");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_actor_idx" ON "TransactionFileEvent"("actor");

-- CreateIndex
CREATE INDEX "TransactionFileEvent_approvedBy_idx" ON "TransactionFileEvent"("approvedBy");

-- AddForeignKey
ALTER TABLE "ListingEngagementAuthority" ADD CONSTRAINT "ListingEngagementAuthority_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEngagementAuthority" ADD CONSTRAINT "ListingEngagementAuthority_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEngagementAuthority" ADD CONSTRAINT "ListingEngagementAuthority_assignedPractitioner_fkey" FOREIGN KEY ("assignedPractitioner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEngagementAuthority" ADD CONSTRAINT "ListingEngagementAuthority_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "ListingEngagementAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEngagementAuthority" ADD CONSTRAINT "ListingEngagementAuthority_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPublicationAuthority" ADD CONSTRAINT "ListingPublicationAuthority_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPublicationAuthority" ADD CONSTRAINT "ListingPublicationAuthority_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPublicationAuthority" ADD CONSTRAINT "ListingPublicationAuthority_engagement_fkey" FOREIGN KEY ("engagement") REFERENCES "ListingEngagementAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPublicationAuthority" ADD CONSTRAINT "ListingPublicationAuthority_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "ListingPublicationAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPublicationAuthority" ADD CONSTRAINT "ListingPublicationAuthority_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerLicenseAuthority" ADD CONSTRAINT "PractitionerLicenseAuthority_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerLicenseAuthority" ADD CONSTRAINT "PractitionerLicenseAuthority_practitioner_fkey" FOREIGN KEY ("practitioner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerLicenseAuthority" ADD CONSTRAINT "PractitionerLicenseAuthority_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "PractitionerLicenseAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerLicenseAuthority" ADD CONSTRAINT "PractitionerLicenseAuthority_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_practitioner_fkey" FOREIGN KEY ("practitioner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "RepresentationAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationAuthority" ADD CONSTRAINT "RepresentationAuthority_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidenceEvent" ADD CONSTRAINT "DocumentEvidenceEvent_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidenceEvent" ADD CONSTRAINT "DocumentEvidenceEvent_document_fkey" FOREIGN KEY ("document") REFERENCES "DealDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidenceEvent" ADD CONSTRAINT "DocumentEvidenceEvent_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidenceEvent" ADD CONSTRAINT "DocumentEvidenceEvent_offer_fkey" FOREIGN KEY ("offer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidenceEvent" ADD CONSTRAINT "DocumentEvidenceEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_commission_fkey" FOREIGN KEY ("commission") REFERENCES "Commission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_payeeUser_fkey" FOREIGN KEY ("payeeUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_reverses_fkey" FOREIGN KEY ("reverses") REFERENCES "CommissionLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_document_fkey" FOREIGN KEY ("document") REFERENCES "DealDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_policy_fkey" FOREIGN KEY ("policy") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_reverses_fkey" FOREIGN KEY ("reverses") REFERENCES "TransactionFileEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFileEvent" ADD CONSTRAINT "TransactionFileEvent_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
