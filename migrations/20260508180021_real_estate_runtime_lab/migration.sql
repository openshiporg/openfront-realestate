/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PropertyStatusType" AS ENUM ('draft', 'coming_soon', 'active', 'pending', 'sold', 'rented', 'off_market');

-- CreateEnum
CREATE TYPE "PropertyListingTypeType" AS ENUM ('sale', 'rent');

-- CreateEnum
CREATE TYPE "PropertyPropertyTypeType" AS ENUM ('house', 'condo', 'townhome', 'multi_family', 'land', 'commercial');

-- CreateEnum
CREATE TYPE "LeadStatusType" AS ENUM ('new', 'attempted_contact', 'qualified', 'tour_scheduled', 'offer', 'closed', 'lost');

-- CreateEnum
CREATE TYPE "LeadIntentType" AS ENUM ('buy', 'rent', 'sell', 'invest', 'unknown');

-- CreateEnum
CREATE TYPE "LeadSourceType" AS ENUM ('website', 'zillow', 'referral', 'open_house', 'phone', 'import');

-- CreateEnum
CREATE TYPE "ShowingStatusType" AS ENUM ('requested', 'scheduled', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "ShowingShowingTypeType" AS ENUM ('in_person', 'virtual', 'open_house');

-- CreateEnum
CREATE TYPE "DealStageType" AS ENUM ('prospecting', 'active_search', 'offer_drafted', 'under_contract', 'inspection', 'financing', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "DealTransactionTypeType" AS ENUM ('buyer', 'seller', 'tenant', 'landlord');

-- CreateEnum
CREATE TYPE "SavedPropertyStatusType" AS ENUM ('saved', 'interested', 'hidden');

-- CreateEnum
CREATE TYPE "LeadActivityActivityTypeType" AS ENUM ('inquiry', 'call', 'email', 'text', 'note', 'status_change', 'showing_scheduled', 'showing_feedback', 'system');

-- CreateEnum
CREATE TYPE "LeadActivityDirectionType" AS ENUM ('inbound', 'outbound', 'internal');

-- CreateEnum
CREATE TYPE "LeadActivityChannelType" AS ENUM ('website', 'phone', 'email', 'sms', 'in_person', 'crm');

-- CreateEnum
CREATE TYPE "LeadRoutingRuleStatusType" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "LeadRoutingRuleIntentType" AS ENUM ('any', 'buy', 'rent', 'sell', 'invest');

-- CreateEnum
CREATE TYPE "LeadRoutingRuleSourceType" AS ENUM ('any', 'website', 'zillow', 'referral', 'open_house', 'phone', 'import');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canManageDeals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLeads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageListings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageShowings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brokerageTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "licenseNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "status" "PropertyStatusType" NOT NULL DEFAULT 'draft',
    "listingType" "PropertyListingTypeType" NOT NULL DEFAULT 'sale',
    "propertyType" "PropertyPropertyTypeType" DEFAULT 'house',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "bedrooms" INTEGER DEFAULT 0,
    "bathrooms" DECIMAL(4,1) DEFAULT 0.0,
    "squareFeet" INTEGER,
    "lotSizeSquareFeet" INTEGER,
    "yearBuilt" INTEGER,
    "hoaFee" DECIMAL(10,2),
    "availableAt" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "virtualTourUrl" TEXT NOT NULL DEFAULT '',
    "primaryImageUrl" TEXT NOT NULL DEFAULT '',
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "status" "LeadStatusType" NOT NULL DEFAULT 'new',
    "intent" "LeadIntentType" DEFAULT 'unknown',
    "source" "LeadSourceType" DEFAULT 'website',
    "budgetMin" TEXT NOT NULL DEFAULT '',
    "budgetMax" TEXT NOT NULL DEFAULT '',
    "preferredLocation" TEXT NOT NULL DEFAULT '',
    "timeline" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "lastContactedAt" TIMESTAMP(3),
    "property" TEXT,
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL,
    "status" "ShowingStatusType" NOT NULL DEFAULT 'requested',
    "showingType" "ShowingShowingTypeType" DEFAULT 'in_person',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "lead" TEXT,
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Showing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "stage" "DealStageType" NOT NULL DEFAULT 'prospecting',
    "transactionType" "DealTransactionTypeType" DEFAULT 'buyer',
    "offerAmount" DECIMAL(12,2),
    "commissionAmount" DECIMAL(12,2),
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "nextStep" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "lead" TEXT,
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProperty" (
    "id" TEXT NOT NULL,
    "status" "SavedPropertyStatusType" DEFAULT 'saved',
    "notes" TEXT NOT NULL DEFAULT '',
    "property" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "activityType" "LeadActivityActivityTypeType" NOT NULL DEFAULT 'note',
    "direction" "LeadActivityDirectionType" DEFAULT 'internal',
    "channel" "LeadActivityChannelType" DEFAULT 'crm',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead" TEXT,
    "property" TEXT,
    "showing" TEXT,
    "agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadRoutingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "LeadRoutingRuleStatusType" DEFAULT 'active',
    "priority" INTEGER DEFAULT 100,
    "intent" "LeadRoutingRuleIntentType" DEFAULT 'any',
    "source" "LeadRoutingRuleSourceType" DEFAULT 'any',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE INDEX "Property_assignedAgent_idx" ON "Property"("assignedAgent");

-- CreateIndex
CREATE INDEX "Lead_property_idx" ON "Lead"("property");

-- CreateIndex
CREATE INDEX "Lead_assignedAgent_idx" ON "Lead"("assignedAgent");

-- CreateIndex
CREATE INDEX "Showing_property_idx" ON "Showing"("property");

-- CreateIndex
CREATE INDEX "Showing_lead_idx" ON "Showing"("lead");

-- CreateIndex
CREATE INDEX "Showing_assignedAgent_idx" ON "Showing"("assignedAgent");

-- CreateIndex
CREATE INDEX "Deal_property_idx" ON "Deal"("property");

-- CreateIndex
CREATE INDEX "Deal_lead_idx" ON "Deal"("lead");

-- CreateIndex
CREATE INDEX "Deal_assignedAgent_idx" ON "Deal"("assignedAgent");

-- CreateIndex
CREATE INDEX "SavedProperty_property_idx" ON "SavedProperty"("property");

-- CreateIndex
CREATE INDEX "SavedProperty_user_idx" ON "SavedProperty"("user");

-- CreateIndex
CREATE INDEX "LeadActivity_lead_idx" ON "LeadActivity"("lead");

-- CreateIndex
CREATE INDEX "LeadActivity_property_idx" ON "LeadActivity"("property");

-- CreateIndex
CREATE INDEX "LeadActivity_showing_idx" ON "LeadActivity"("showing");

-- CreateIndex
CREATE INDEX "LeadActivity_agent_idx" ON "LeadActivity"("agent");

-- CreateIndex
CREATE INDEX "LeadRoutingRule_assignedAgent_idx" ON "LeadRoutingRule"("assignedAgent");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProperty" ADD CONSTRAINT "SavedProperty_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProperty" ADD CONSTRAINT "SavedProperty_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_property_fkey" FOREIGN KEY ("property") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_showing_fkey" FOREIGN KEY ("showing") REFERENCES "Showing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_agent_fkey" FOREIGN KEY ("agent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_assignedAgent_fkey" FOREIGN KEY ("assignedAgent") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
