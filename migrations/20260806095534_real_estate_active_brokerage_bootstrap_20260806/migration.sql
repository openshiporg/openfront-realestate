-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeBrokerage" TEXT;

-- Existing users predate the explicit selection field. Select their one active
-- primary membership, or their only active membership. Ambiguous users remain
-- unset so the migration fails closed for owner review instead of guessing.
WITH membership_candidates AS (
  SELECT
    membership."user" AS "userId",
    membership."brokerage" AS "brokerageId",
    COUNT(*) FILTER (WHERE membership."isPrimary") OVER (PARTITION BY membership."user") AS "primaryCount",
    COUNT(*) OVER (PARTITION BY membership."user") AS "activeCount",
    ROW_NUMBER() OVER (
      PARTITION BY membership."user"
      ORDER BY membership."isPrimary" DESC, membership."createdAt" ASC, membership."id" ASC
    ) AS "candidateRank"
  FROM "BrokerageMembership" membership
  JOIN "Brokerage" brokerage ON brokerage."id" = membership."brokerage"
  WHERE membership."status" = 'active'
    AND brokerage."status" = 'active'
)
UPDATE "User" app_user
SET "activeBrokerage" = candidate."brokerageId"
FROM membership_candidates candidate
WHERE app_user."id" = candidate."userId"
  AND candidate."candidateRank" = 1
  AND (candidate."activeCount" = 1 OR candidate."primaryCount" = 1);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "activeBrokerage" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill User.activeBrokerage: each existing user must have exactly one active membership or exactly one active primary membership';
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "User_activeBrokerage_idx" ON "User"("activeBrokerage");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeBrokerage_fkey" FOREIGN KEY ("activeBrokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
