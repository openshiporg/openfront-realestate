-- Non-destructive: DomainOutboxEvent becomes CommandReceipt, an idempotency ledger.
-- Rows are kept. Only the delivery-state columns (never used by any worker) are dropped.
ALTER TABLE "DomainOutboxEvent" RENAME TO "CommandReceipt";

ALTER TABLE "CommandReceipt" RENAME CONSTRAINT "DomainOutboxEvent_pkey" TO "CommandReceipt_pkey";
ALTER TABLE "CommandReceipt" RENAME CONSTRAINT "DomainOutboxEvent_brokerage_fkey" TO "CommandReceipt_brokerage_fkey";
ALTER TABLE "CommandReceipt" RENAME CONSTRAINT "DomainOutboxEvent_brokerage_required" TO "CommandReceipt_brokerage_required";

ALTER INDEX "DomainOutboxEvent_eventKey_key" RENAME TO "CommandReceipt_eventKey_key";
ALTER INDEX "DomainOutboxEvent_eventType_idx" RENAME TO "CommandReceipt_eventType_idx";
ALTER INDEX "DomainOutboxEvent_brokerage_idx" RENAME TO "CommandReceipt_brokerage_idx";
ALTER INDEX "DomainOutboxEvent_aggregateType_idx" RENAME TO "CommandReceipt_aggregateType_idx";
ALTER INDEX "DomainOutboxEvent_aggregateId_idx" RENAME TO "CommandReceipt_aggregateId_idx";
ALTER INDEX "DomainOutboxEvent_occurredAt_idx" RENAME TO "CommandReceipt_occurredAt_idx";

DROP INDEX "DomainOutboxEvent_status_idx";
DROP INDEX "DomainOutboxEvent_availableAt_idx";
ALTER TABLE "CommandReceipt"
  DROP COLUMN "status",
  DROP COLUMN "attempts",
  DROP COLUMN "replayCount",
  DROP COLUMN "availableAt",
  DROP COLUMN "dispatchedAt",
  DROP COLUMN "lastError";
DROP TYPE "DomainOutboxEventStatusType";

-- Immutability: receipts can never be updated (identity/payload) or deleted.
DROP TRIGGER "DomainOutboxEvent_immutable_update" ON "CommandReceipt";
DROP TRIGGER "DomainOutboxEvent_no_delete" ON "CommandReceipt";
DROP FUNCTION real_estate_protect_outbox_event();

CREATE OR REPLACE FUNCTION real_estate_protect_command_receipt() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Command receipts cannot be deleted'; END IF;
  IF NEW."eventKey" IS DISTINCT FROM OLD."eventKey"
    OR NEW."eventType" IS DISTINCT FROM OLD."eventType"
    OR NEW."brokerage" IS DISTINCT FROM OLD."brokerage"
    OR NEW."aggregateType" IS DISTINCT FROM OLD."aggregateType"
    OR NEW."aggregateId" IS DISTINCT FROM OLD."aggregateId"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash"
    OR NEW."payload" IS DISTINCT FROM OLD."payload"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
  THEN RAISE EXCEPTION 'Command receipt identity and payload are immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CommandReceipt_immutable_update" BEFORE UPDATE ON "CommandReceipt" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_command_receipt();
CREATE TRIGGER "CommandReceipt_no_delete" BEFORE DELETE ON "CommandReceipt" FOR EACH ROW EXECUTE FUNCTION real_estate_protect_command_receipt();
