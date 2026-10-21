/*
  Warnings:

  - A unique constraint covering the columns `[membershipKey]` on the table `BrokerageMembership` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BrokerageMembership" ADD COLUMN     "membershipKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageMembership_membershipKey_key" ON "BrokerageMembership"("membershipKey");

-- Backfill the existing Juniper Realty runtime into its tenant without
-- changing customer-facing settings, users, teams, or media references.
INSERT INTO "Brokerage" ("id", "name", "slug", "status", "isPrimary", "createdAt", "updatedAt")
VALUES (
  'brokerage_juniper_realty',
  'Juniper Realty',
  'juniper-realty',
  'active'::"BrokerageStatusType",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "BrokerageSettings"
SET "brokerage" = (
  SELECT "id" FROM "Brokerage" WHERE "slug" = 'juniper-realty'
)
WHERE "brokerage" IS NULL;

UPDATE "AgentTeam"
SET "brokerage" = (
  SELECT "id" FROM "Brokerage" WHERE "slug" = 'juniper-realty'
)
WHERE "brokerage" IS NULL;

INSERT INTO "BrokerageMembership" (
  "id",
  "membershipKey",
  "brokerage",
  "user",
  "membershipRole",
  "status",
  "isPrimary",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'membership_' || md5("User"."id"),
  'juniper-realty:' || lower("User"."email"),
  "Brokerage"."id",
  "User"."id",
  CASE
    WHEN COALESCE("Role"."canManageOnboarding", false)
      THEN 'owner'::"BrokerageMembershipMembershipRoleType"
    ELSE 'agent'::"BrokerageMembershipMembershipRoleType"
  END,
  'active'::"BrokerageMembershipStatusType",
  true,
  COALESCE("User"."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN "Brokerage"
LEFT JOIN "Role" ON "Role"."id" = "User"."role"
WHERE "Brokerage"."slug" = 'juniper-realty'
  AND "User"."email" <> ''
ON CONFLICT ("membershipKey") DO NOTHING;
