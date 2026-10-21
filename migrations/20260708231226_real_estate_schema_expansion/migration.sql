-- CreateEnum
CREATE TYPE "PropertyMediaMediaTypeType" AS ENUM ('photo', 'floor_plan', 'virtual_tour', 'video', 'document');

-- CreateEnum
CREATE TYPE "PropertyInspectionInspectionTypeType" AS ENUM ('general', 'pest', 'roof', 'appraisal', 'walkthrough');

-- CreateEnum
CREATE TYPE "PropertyInspectionStatusType" AS ENUM ('scheduled', 'completed', 'needs_follow_up', 'waived');

-- CreateEnum
CREATE TYPE "OfferStatusType" AS ENUM ('draft', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "OfferFinancingTypeType" AS ENUM ('cash', 'conventional', 'fha', 'va', 'other');

-- CreateEnum
CREATE TYPE "DealDocumentDocumentTypeType" AS ENUM ('listing_agreement', 'offer', 'disclosure', 'inspection_report', 'closing_statement', 'other');

-- CreateEnum
CREATE TYPE "DealDocumentStatusType" AS ENUM ('draft', 'sent', 'signed', 'archived');

-- CreateEnum
CREATE TYPE "CommissionStatusType" AS ENUM ('projected', 'approved', 'paid', 'clawed_back');

-- CreateEnum
CREATE TYPE "CommissionSideType" AS ENUM ('listing', 'buyer', 'referral');

-- CreateEnum
CREATE TYPE "MarketCompStatusType" AS ENUM ('active', 'pending', 'sold', 'expired');

-- CreateEnum
CREATE TYPE "AgentTeamTeamTypeType" AS ENUM ('listing', 'buyer', 'rental', 'operations');

-- CreateEnum
CREATE TYPE "AgentTeamStatusType" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "AgentTaskStatusType" AS ENUM ('open', 'in_progress', 'blocked', 'done');

-- CreateEnum
CREATE TYPE "AgentTaskPriorityType" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "mediaType" "PropertyMediaMediaTypeType" NOT NULL DEFAULT 'photo',
    "url" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "property" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "inspectionType" "PropertyInspectionInspectionTypeType" DEFAULT 'general',
    "status" "PropertyInspectionStatusType" DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "inspectorEmail" TEXT NOT NULL DEFAULT '',
    "estimatedCost" DECIMAL(10,2),
    "summary" TEXT NOT NULL DEFAULT '',
    "findings" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "deal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL DEFAULT '',
    "status" "OfferStatusType" NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "earnestMoney" DECIMAL(12,2),
    "financingType" "OfferFinancingTypeType" DEFAULT 'conventional',
    "contingencies" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "property" TEXT,
    "deal" TEXT,
    "lead" TEXT,
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "documentType" "DealDocumentDocumentTypeType" DEFAULT 'other',
    "status" "DealDocumentStatusType" DEFAULT 'draft',
    "fileUrl" TEXT NOT NULL DEFAULT '',
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "property" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "CommissionStatusType" DEFAULT 'projected',
    "side" "CommissionSideType" DEFAULT 'listing',
    "grossCommission" DECIMAL(12,2) DEFAULT 0.00,
    "brokerageSplitPercent" DECIMAL(5,2) DEFAULT 0.00,
    "agentSplitPercent" DECIMAL(5,2) DEFAULT 0.00,
    "netCommission" DECIMAL(12,2) DEFAULT 0.00,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "deal" TEXT,
    "property" TEXT,
    "agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "propertyType" TEXT NOT NULL DEFAULT '',
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "minBedrooms" INTEGER,
    "minBathrooms" DECIMAL(4,1),
    "minSquareFeet" INTEGER,
    "keywords" TEXT NOT NULL DEFAULT '',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "user" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketComp" (
    "id" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "status" "MarketCompStatusType" DEFAULT 'sold',
    "listPrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "soldAt" TIMESTAMP(3),
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(4,1),
    "squareFeet" INTEGER,
    "distanceMiles" DECIMAL(6,2),
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "subjectProperty" TEXT,
    "neighborhood" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketComp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Neighborhood" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "overview" TEXT NOT NULL DEFAULT '',
    "schoolDistrict" TEXT NOT NULL DEFAULT '',
    "walkScore" INTEGER,
    "transitScore" INTEGER,
    "medianSalePrice" DECIMAL(12,2),
    "medianRent" DECIMAL(12,2),
    "activeListings" INTEGER DEFAULT 0,
    "averageDaysOnMarket" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "teamType" "AgentTeamTeamTypeType" DEFAULT 'listing',
    "status" "AgentTeamStatusType" DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "leadAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "AgentTaskStatusType" DEFAULT 'open',
    "priority" "AgentTaskPriorityType" DEFAULT 'normal',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "assignedAgent" TEXT,
    "property" TEXT,
    "lead" TEXT,
    "deal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgentTeam_members" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AgentTeam_members_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "PropertyMedia_property_idx" ON "PropertyMedia"("property");

-- CreateIndex
CREATE INDEX "PropertyInspection_property_idx" ON "PropertyInspection"("property");

-- CreateIndex
CREATE INDEX "PropertyInspection_deal_idx" ON "PropertyInspection"("deal");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_offerNumber_key" ON "Offer"("offerNumber");

-- CreateIndex
CREATE INDEX "Offer_property_idx" ON "Offer"("property");

-- CreateIndex
CREATE INDEX "Offer_deal_idx" ON "Offer"("deal");

-- CreateIndex
CREATE INDEX "Offer_lead_idx" ON "Offer"("lead");

-- CreateIndex
CREATE INDEX "Offer_assignedAgent_idx" ON "Offer"("assignedAgent");

-- CreateIndex
CREATE INDEX "DealDocument_deal_idx" ON "DealDocument"("deal");

-- CreateIndex
CREATE INDEX "DealDocument_property_idx" ON "DealDocument"("property");

-- CreateIndex
CREATE INDEX "DealDocument_uploadedBy_idx" ON "DealDocument"("uploadedBy");

-- CreateIndex
CREATE INDEX "Commission_deal_idx" ON "Commission"("deal");

-- CreateIndex
CREATE INDEX "Commission_property_idx" ON "Commission"("property");

-- CreateIndex
CREATE INDEX "Commission_agent_idx" ON "Commission"("agent");

-- CreateIndex
CREATE INDEX "SavedSearch_user_idx" ON "SavedSearch"("user");

-- CreateIndex
CREATE INDEX "MarketComp_subjectProperty_idx" ON "MarketComp"("subjectProperty");

-- CreateIndex
CREATE INDEX "MarketComp_neighborhood_idx" ON "MarketComp"("neighborhood");

-- CreateIndex
CREATE UNIQUE INDEX "Neighborhood_slug_key" ON "Neighborhood"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTeam_slug_key" ON "AgentTeam"("slug");

-- CreateIndex
CREATE INDEX "AgentTeam_leadAgent_idx" ON "AgentTeam"("leadAgent");

-- CreateIndex
CREATE INDEX "AgentTask_assignedAgent_idx" ON "AgentTask"("assignedAgent");

-- CreateIndex
CREATE INDEX "AgentTask_property_idx" ON "AgentTask"("property");

-- CreateIndex
CREATE INDEX "AgentTask_lead_idx" ON "AgentTask"("lead");

-- CreateIndex
CREATE INDEX "AgentTask_deal_idx" ON "AgentTask"("deal");

-- CreateIndex
CREATE INDEX "_AgentTeam_members_B_index" ON "_AgentTeam_members"("B");

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_agent_fkey" FOREIGN KEY ("agent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketComp" ADD CONSTRAINT "MarketComp_subjectProperty_fkey" FOREIGN KEY ("subjectProperty") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketComp" ADD CONSTRAINT "MarketComp_neighborhood_fkey" FOREIGN KEY ("neighborhood") REFERENCES "Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTeam" ADD CONSTRAINT "AgentTeam_leadAgent_fkey" FOREIGN KEY ("leadAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentTeam_members" ADD CONSTRAINT "_AgentTeam_members_A_fkey" FOREIGN KEY ("A") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentTeam_members" ADD CONSTRAINT "_AgentTeam_members_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

