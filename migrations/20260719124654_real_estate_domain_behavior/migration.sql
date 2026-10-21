-- CreateEnum
CREATE TYPE "DomainOutboxEventStatusType" AS ENUM ('pending', 'processing', 'dispatched', 'failed');

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "assignedTeam" TEXT,
ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedTeam" TEXT,
ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "LeadRoutingRule" ADD COLUMN     "assignedTeam" TEXT,
ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "ListingSyndication" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
ALTER TABLE "Showing" ADD COLUMN     "brokerage" TEXT;

-- CreateTable
CREATE TABLE "DomainAuditEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "brokerage" TEXT,
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "brokerage" TEXT,
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "status" "DomainOutboxEventStatusType" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER DEFAULT 0,
    "replayCount" INTEGER DEFAULT 0,
    "availableAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainAuditEvent_eventKey_key" ON "DomainAuditEvent"("eventKey");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_brokerage_idx" ON "DomainAuditEvent"("brokerage");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_aggregateType_idx" ON "DomainAuditEvent"("aggregateType");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_aggregateId_idx" ON "DomainAuditEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_action_idx" ON "DomainAuditEvent"("action");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_actor_idx" ON "DomainAuditEvent"("actor");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_occurredAt_idx" ON "DomainAuditEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DomainOutboxEvent_eventKey_key" ON "DomainOutboxEvent"("eventKey");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_eventType_idx" ON "DomainOutboxEvent"("eventType");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_brokerage_idx" ON "DomainOutboxEvent"("brokerage");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_aggregateType_idx" ON "DomainOutboxEvent"("aggregateType");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_aggregateId_idx" ON "DomainOutboxEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_status_idx" ON "DomainOutboxEvent"("status");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_availableAt_idx" ON "DomainOutboxEvent"("availableAt");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_occurredAt_idx" ON "DomainOutboxEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "Commission_brokerage_idx" ON "Commission"("brokerage");

-- CreateIndex
CREATE INDEX "Deal_brokerage_idx" ON "Deal"("brokerage");

-- CreateIndex
CREATE INDEX "Deal_assignedTeam_idx" ON "Deal"("assignedTeam");

-- CreateIndex
CREATE INDEX "Lead_brokerage_idx" ON "Lead"("brokerage");

-- CreateIndex
CREATE INDEX "Lead_assignedTeam_idx" ON "Lead"("assignedTeam");

-- CreateIndex
CREATE INDEX "LeadActivity_brokerage_idx" ON "LeadActivity"("brokerage");

-- CreateIndex
CREATE INDEX "LeadRoutingRule_brokerage_idx" ON "LeadRoutingRule"("brokerage");

-- CreateIndex
CREATE INDEX "LeadRoutingRule_assignedTeam_idx" ON "LeadRoutingRule"("assignedTeam");

-- CreateIndex
CREATE INDEX "ListingSyndication_brokerage_idx" ON "ListingSyndication"("brokerage");

-- CreateIndex
CREATE INDEX "Offer_brokerage_idx" ON "Offer"("brokerage");

-- CreateIndex
CREATE INDEX "Property_brokerage_idx" ON "Property"("brokerage");

-- CreateIndex
CREATE INDEX "Showing_brokerage_idx" ON "Showing"("brokerage");

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainOutboxEvent" ADD CONSTRAINT "DomainOutboxEvent_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTeam_fkey" FOREIGN KEY ("assignedTeam") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_assignedTeam_fkey" FOREIGN KEY ("assignedTeam") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_assignedTeam_fkey" FOREIGN KEY ("assignedTeam") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSyndication" ADD CONSTRAINT "ListingSyndication_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill every existing operational aggregate into its current brokerage.
-- New writes are guarded by Keystone tenant hooks and the checks below.
UPDATE "Property" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Property"."brokerage" IS NULL;
UPDATE "Lead" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Lead"."brokerage" IS NULL;
UPDATE "Showing" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Showing"."brokerage" IS NULL;
UPDATE "Deal" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Deal"."brokerage" IS NULL;
UPDATE "LeadActivity" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "LeadActivity"."brokerage" IS NULL;
UPDATE "LeadRoutingRule" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "LeadRoutingRule"."brokerage" IS NULL;
UPDATE "Offer" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Offer"."brokerage" IS NULL;
UPDATE "Commission" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "Commission"."brokerage" IS NULL;
UPDATE "ListingSyndication" SET "brokerage" = b."id" FROM "Brokerage" b WHERE b."slug" = 'juniper-realty' AND "ListingSyndication"."brokerage" IS NULL;

ALTER TABLE "Property" ADD CONSTRAINT "Property_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "ListingSyndication" ADD CONSTRAINT "ListingSyndication_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_brokerage_required" CHECK ("brokerage" IS NOT NULL);
ALTER TABLE "DomainOutboxEvent" ADD CONSTRAINT "DomainOutboxEvent_brokerage_required" CHECK ("brokerage" IS NOT NULL);

-- Immutable transaction evidence and append-only audit rows are protected even
-- from sudo/raw writes. Outbox delivery state may advance, but event identity and
-- payload cannot drift.
CREATE OR REPLACE FUNCTION real_estate_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Domain audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DomainAuditEvent_immutable_update" BEFORE UPDATE ON "DomainAuditEvent" FOR EACH ROW EXECUTE FUNCTION real_estate_reject_audit_mutation();
CREATE TRIGGER "DomainAuditEvent_immutable_delete" BEFORE DELETE ON "DomainAuditEvent" FOR EACH ROW EXECUTE FUNCTION real_estate_reject_audit_mutation();

CREATE OR REPLACE FUNCTION real_estate_protect_outbox_event() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Domain outbox events cannot be deleted'; END IF;
  IF NEW."eventKey" IS DISTINCT FROM OLD."eventKey"
    OR NEW."eventType" IS DISTINCT FROM OLD."eventType"
    OR NEW."brokerage" IS DISTINCT FROM OLD."brokerage"
    OR NEW."aggregateType" IS DISTINCT FROM OLD."aggregateType"
    OR NEW."aggregateId" IS DISTINCT FROM OLD."aggregateId"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash"
    OR NEW."payload" IS DISTINCT FROM OLD."payload"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
  THEN RAISE EXCEPTION 'Domain outbox event identity and payload are immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DomainOutboxEvent_immutable_update" BEFORE UPDATE ON "DomainOutboxEvent" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_outbox_event();
CREATE TRIGGER "DomainOutboxEvent_no_delete" BEFORE DELETE ON "DomainOutboxEvent" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_outbox_event();

CREATE OR REPLACE FUNCTION real_estate_protect_transaction_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD."acceptedSnapshot" IS NOT NULL AND NEW."acceptedSnapshot" IS DISTINCT FROM OLD."acceptedSnapshot" THEN
    RAISE EXCEPTION 'Accepted offer snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Offer_accepted_snapshot_immutable" BEFORE UPDATE ON "Offer" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_transaction_snapshot();

CREATE OR REPLACE FUNCTION real_estate_protect_deal_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD."closedSnapshot" IS NOT NULL AND NEW."closedSnapshot" IS DISTINCT FROM OLD."closedSnapshot" THEN
    RAISE EXCEPTION 'Closed deal snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Deal_closed_snapshot_immutable" BEFORE UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_deal_snapshot();
