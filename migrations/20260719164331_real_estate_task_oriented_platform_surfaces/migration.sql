-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "DealDocument" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "SavedSearchAlert" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "SourceFeed" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "TransactionMilestone" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "parentOffer" TEXT;

-- Backfill workflow ownership from trusted parent relationships or the existing Juniper root.
UPDATE "DealDocument" target SET brokerage = COALESCE(
  (SELECT brokerage FROM "Deal" WHERE id = target.deal),
  (SELECT brokerage FROM "Property" WHERE id = target.property),
  (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1)
) WHERE brokerage IS NULL;
UPDATE "TransactionMilestone" target SET brokerage = COALESCE(
  (SELECT brokerage FROM "Deal" WHERE id = target.deal),
  (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1)
) WHERE brokerage IS NULL;
UPDATE "AgentTask" target SET brokerage = COALESCE(
  (SELECT brokerage FROM "Deal" WHERE id = target.deal),
  (SELECT brokerage FROM "Lead" WHERE id = target.lead),
  (SELECT brokerage FROM "Property" WHERE id = target.property),
  (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1)
) WHERE brokerage IS NULL;
UPDATE "SavedSearch" target SET brokerage = COALESCE(
  (SELECT membership.brokerage FROM "BrokerageMembership" membership WHERE membership.user = target."user" AND membership.status = 'active' ORDER BY membership."isPrimary" DESC, membership."createdAt" ASC LIMIT 1),
  (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1)
) WHERE brokerage IS NULL;
UPDATE "SavedSearchAlert" target SET brokerage = COALESCE(
  (SELECT brokerage FROM "SavedSearch" WHERE id = target."savedSearch"),
  (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1)
) WHERE brokerage IS NULL;
UPDATE "SourceFeed" SET brokerage = (SELECT id FROM "Brokerage" WHERE slug = 'juniper-realty' LIMIT 1) WHERE brokerage IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "AgentTask" WHERE brokerage IS NULL)
    OR EXISTS (SELECT 1 FROM "DealDocument" WHERE brokerage IS NULL)
    OR EXISTS (SELECT 1 FROM "SavedSearch" WHERE brokerage IS NULL)
    OR EXISTS (SELECT 1 FROM "SavedSearchAlert" WHERE brokerage IS NULL)
    OR EXISTS (SELECT 1 FROM "SourceFeed" WHERE brokerage IS NULL)
    OR EXISTS (SELECT 1 FROM "TransactionMilestone" WHERE brokerage IS NULL)
  THEN RAISE EXCEPTION 'Task-oriented workflow brokerage backfill is incomplete';
  END IF;
END $$;

ALTER TABLE "AgentTask" ALTER COLUMN brokerage SET NOT NULL;
ALTER TABLE "DealDocument" ALTER COLUMN brokerage SET NOT NULL;
ALTER TABLE "SavedSearch" ALTER COLUMN brokerage SET NOT NULL;
ALTER TABLE "SavedSearchAlert" ALTER COLUMN brokerage SET NOT NULL;
ALTER TABLE "SourceFeed" ALTER COLUMN brokerage SET NOT NULL;
ALTER TABLE "TransactionMilestone" ALTER COLUMN brokerage SET NOT NULL;

-- CreateIndex
CREATE INDEX "AgentTask_brokerage_idx" ON "AgentTask"("brokerage");

-- CreateIndex
CREATE INDEX "DealDocument_brokerage_idx" ON "DealDocument"("brokerage");

-- CreateIndex
CREATE INDEX "SavedSearch_brokerage_idx" ON "SavedSearch"("brokerage");

-- CreateIndex
CREATE INDEX "SavedSearchAlert_brokerage_idx" ON "SavedSearchAlert"("brokerage");

-- CreateIndex
CREATE INDEX "SourceFeed_brokerage_idx" ON "SourceFeed"("brokerage");

-- CreateIndex
CREATE INDEX "TransactionMilestone_brokerage_idx" ON "TransactionMilestone"("brokerage");

-- CreateIndex
CREATE INDEX "Offer_parentOffer_idx" ON "Offer"("parentOffer");

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_parentOffer_fkey" FOREIGN KEY ("parentOffer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
