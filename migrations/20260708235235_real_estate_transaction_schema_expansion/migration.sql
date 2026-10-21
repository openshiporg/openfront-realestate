-- CreateEnum
CREATE TYPE "SavedSearchAlertStatusType" AS ENUM ('active', 'paused', 'unsubscribed');

-- CreateEnum
CREATE TYPE "SavedSearchAlertCadenceType" AS ENUM ('instant', 'daily', 'weekly');

-- CreateEnum
CREATE TYPE "DisclosureDisclosureTypeType" AS ENUM ('seller_property', 'lead_paint', 'hoa', 'natural_hazard', 'other');

-- CreateEnum
CREATE TYPE "DisclosureStatusType" AS ENUM ('draft', 'sent', 'acknowledged', 'expired');

-- CreateEnum
CREATE TYPE "PropertyValuationValuationTypeType" AS ENUM ('cma', 'appraisal', 'avm');

-- CreateEnum
CREATE TYPE "TransactionMilestoneStatusType" AS ENUM ('not_started', 'in_progress', 'complete', 'blocked');

-- CreateEnum
CREATE TYPE "MortgageApplicationStatusType" AS ENUM ('started', 'preapproved', 'underwriting', 'approved', 'denied');

-- CreateEnum
CREATE TYPE "TitleOrderStatusType" AS ENUM ('ordered', 'in_review', 'clear', 'exception');

-- CreateEnum
CREATE TYPE "EscrowStatusType" AS ENUM ('opened', 'pending', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "ShowingFeedbackInterestLevelType" AS ENUM ('low', 'medium', 'high', 'offer_likely');

-- CreateEnum
CREATE TYPE "OpenHouseStatusType" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SourceFeedFeedTypeType" AS ENUM ('rets', 'reso', 'csv', 'manual');

-- CreateEnum
CREATE TYPE "SourceFeedStatusType" AS ENUM ('active', 'paused', 'error');

-- CreateEnum
CREATE TYPE "ListingSyndicationChannelType" AS ENUM ('mls', 'zillow', 'realtor', 'website', 'social');

-- CreateEnum
CREATE TYPE "ListingSyndicationStatusType" AS ENUM ('draft', 'published', 'error', 'removed');

-- CreateTable
CREATE TABLE "SavedSearchAlert" (
    "id" TEXT NOT NULL,
    "savedSearch" TEXT,
    "user" TEXT,
    "status" "SavedSearchAlertStatusType" DEFAULT 'active',
    "cadence" "SavedSearchAlertCadenceType" DEFAULT 'daily',
    "lastSentAt" TIMESTAMP(3),
    "sentCount" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disclosure" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "deal" TEXT,
    "disclosureType" "DisclosureDisclosureTypeType" DEFAULT 'other',
    "status" "DisclosureStatusType" DEFAULT 'draft',
    "documentUrl" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyValuation" (
    "id" TEXT NOT NULL,
    "valuationNumber" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "valuationType" "PropertyValuationValuationTypeType" DEFAULT 'cma',
    "lowValue" DECIMAL(12,2),
    "estimatedValue" DECIMAL(12,2),
    "highValue" DECIMAL(12,2),
    "performedBy" TEXT,
    "valuedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionMilestone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "status" "TransactionMilestoneStatusType" DEFAULT 'not_started',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "sortOrder" INTEGER DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortgageApplication" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "lead" TEXT,
    "lenderName" TEXT NOT NULL DEFAULT '',
    "status" "MortgageApplicationStatusType" DEFAULT 'started',
    "loanAmount" DECIMAL(12,2),
    "interestRate" DECIMAL(6,3),
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MortgageApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "property" TEXT,
    "titleCompany" TEXT NOT NULL DEFAULT '',
    "status" "TitleOrderStatusType" DEFAULT 'ordered',
    "orderedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "exceptions" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TitleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "escrowNumber" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "property" TEXT,
    "status" "EscrowStatusType" DEFAULT 'opened',
    "escrowCompany" TEXT NOT NULL DEFAULT '',
    "officerName" TEXT NOT NULL DEFAULT '',
    "officerEmail" TEXT NOT NULL DEFAULT '',
    "openedAt" TIMESTAMP(3),
    "scheduledCloseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "depositAmount" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowingFeedback" (
    "id" TEXT NOT NULL,
    "showing" TEXT,
    "lead" TEXT,
    "property" TEXT,
    "rating" INTEGER,
    "interestLevel" "ShowingFeedbackInterestLevelType" DEFAULT 'medium',
    "comments" TEXT NOT NULL DEFAULT '',
    "priceOpinion" DECIMAL(12,2),
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenHouse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "hostAgent" TEXT,
    "status" "OpenHouseStatusType" DEFAULT 'scheduled',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "attendeeCount" INTEGER DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenHouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "feedType" "SourceFeedFeedTypeType" DEFAULT 'manual',
    "status" "SourceFeedStatusType" DEFAULT 'active',
    "lastImportedAt" TIMESTAMP(3),
    "recordsImported" INTEGER DEFAULT 0,
    "credentials" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSyndication" (
    "id" TEXT NOT NULL,
    "channel" "ListingSyndicationChannelType" DEFAULT 'website',
    "property" TEXT,
    "status" "ListingSyndicationStatusType" DEFAULT 'draft',
    "externalListingId" TEXT NOT NULL DEFAULT '',
    "listingUrl" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingSyndication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearchAlert_savedSearch_idx" ON "SavedSearchAlert"("savedSearch");

-- CreateIndex
CREATE INDEX "SavedSearchAlert_user_idx" ON "SavedSearchAlert"("user");

-- CreateIndex
CREATE INDEX "Disclosure_property_idx" ON "Disclosure"("property");

-- CreateIndex
CREATE INDEX "Disclosure_deal_idx" ON "Disclosure"("deal");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyValuation_valuationNumber_key" ON "PropertyValuation"("valuationNumber");

-- CreateIndex
CREATE INDEX "PropertyValuation_property_idx" ON "PropertyValuation"("property");

-- CreateIndex
CREATE INDEX "PropertyValuation_performedBy_idx" ON "PropertyValuation"("performedBy");

-- CreateIndex
CREATE INDEX "TransactionMilestone_deal_idx" ON "TransactionMilestone"("deal");

-- CreateIndex
CREATE INDEX "TransactionMilestone_assignedTo_idx" ON "TransactionMilestone"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "MortgageApplication_applicationNumber_key" ON "MortgageApplication"("applicationNumber");

-- CreateIndex
CREATE INDEX "MortgageApplication_deal_idx" ON "MortgageApplication"("deal");

-- CreateIndex
CREATE INDEX "MortgageApplication_lead_idx" ON "MortgageApplication"("lead");

-- CreateIndex
CREATE UNIQUE INDEX "TitleOrder_orderNumber_key" ON "TitleOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "TitleOrder_deal_idx" ON "TitleOrder"("deal");

-- CreateIndex
CREATE INDEX "TitleOrder_property_idx" ON "TitleOrder"("property");

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_escrowNumber_key" ON "Escrow"("escrowNumber");

-- CreateIndex
CREATE INDEX "Escrow_deal_idx" ON "Escrow"("deal");

-- CreateIndex
CREATE INDEX "Escrow_property_idx" ON "Escrow"("property");

-- CreateIndex
CREATE INDEX "ShowingFeedback_showing_idx" ON "ShowingFeedback"("showing");

-- CreateIndex
CREATE INDEX "ShowingFeedback_lead_idx" ON "ShowingFeedback"("lead");

-- CreateIndex
CREATE INDEX "ShowingFeedback_property_idx" ON "ShowingFeedback"("property");

-- CreateIndex
CREATE INDEX "OpenHouse_property_idx" ON "OpenHouse"("property");

-- CreateIndex
CREATE INDEX "OpenHouse_hostAgent_idx" ON "OpenHouse"("hostAgent");

-- CreateIndex
CREATE INDEX "ListingSyndication_property_idx" ON "ListingSyndication"("property");

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_savedSearch_fkey" FOREIGN KEY ("savedSearch") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disclosure" ADD CONSTRAINT "Disclosure_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disclosure" ADD CONSTRAINT "Disclosure_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageApplication" ADD CONSTRAINT "MortgageApplication_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageApplication" ADD CONSTRAINT "MortgageApplication_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleOrder" ADD CONSTRAINT "TitleOrder_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleOrder" ADD CONSTRAINT "TitleOrder_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowingFeedback" ADD CONSTRAINT "ShowingFeedback_showing_fkey" FOREIGN KEY ("showing") REFERENCES "Showing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowingFeedback" ADD CONSTRAINT "ShowingFeedback_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowingFeedback" ADD CONSTRAINT "ShowingFeedback_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenHouse" ADD CONSTRAINT "OpenHouse_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenHouse" ADD CONSTRAINT "OpenHouse_hostAgent_fkey" FOREIGN KEY ("hostAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSyndication" ADD CONSTRAINT "ListingSyndication_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

