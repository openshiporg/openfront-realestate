-- Data only. Both statements are guarded and do nothing on other installs.

-- 1. The QA admin account (created outside /dashboard/init) has no role and no
--    brokerage membership, so every dashboard route denies it. Give it an active
--    owner membership in the primary active brokerage, select that brokerage, and
--    attach the Admin role (created only if none exists). Runs only while the account has no membership.
INSERT INTO "BrokerageMembership" (
  "id", "membershipKey", "brokerage", "user", "membershipRole", "status",
  "isPrimary", "joinedAt", "createdAt", "updatedAt"
)
SELECT
  'membership_' || md5("User"."id"),
  "Brokerage"."slug" || ':' || lower("User"."email"),
  "Brokerage"."id",
  "User"."id",
  'owner'::"BrokerageMembershipMembershipRoleType",
  'active'::"BrokerageMembershipStatusType",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN LATERAL (
  SELECT "id", "slug" FROM "Brokerage"
  WHERE "status" = 'active'::"BrokerageStatusType"
  ORDER BY "isPrimary" DESC, "createdAt" ASC
  LIMIT 1
) AS "Brokerage"
WHERE "User"."id" = 'c2806bca129936b531c9327ae'
  AND "User"."email" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "BrokerageMembership" m WHERE m."user" = "User"."id"
  )
ON CONFLICT ("membershipKey") DO NOTHING;

INSERT INTO "Role" (
  "id", "name", "canSeeOtherPeople", "canEditOtherPeople", "canManagePeople",
  "canManageRoles", "canAccessDashboard", "canManageListings", "canManageLeads",
  "canManageShowings", "canManageDeals", "canViewReports", "canManageOnboarding",
  "createdAt", "updatedAt"
)
SELECT 'role_qa_admin_fallback', 'Admin', true, true, true, true, true, true, true, true, true, true, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User" WHERE "id" = 'c2806bca129936b531c9327ae' AND "role" IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "Role" WHERE "canAccessDashboard" AND "canManagePeople" AND "canManageOnboarding"
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"
SET
  "activeBrokerage" = m."brokerage",
  "role" = COALESCE("User"."role", (
    SELECT "id" FROM "Role"
    WHERE "canAccessDashboard" AND "canManagePeople" AND "canManageOnboarding"
    ORDER BY "createdAt" ASC
    LIMIT 1
  ))
FROM "BrokerageMembership" m
WHERE "User"."id" = 'c2806bca129936b531c9327ae'
  AND m."id" = 'membership_' || md5("User"."id")
  AND m."user" = "User"."id";

-- 2. The starter rental was created before the rental-term columns existed, so
--    it promises "pet-friendly lease terms" but shows none. Fill in the starter
--    terms only while all three are still empty.
UPDATE "Property"
SET
  "leaseTerm" = '12 months',
  "securityDeposit" = 3800,
  "petPolicy" = 'Cats and dogs under 40 lb, $500 pet deposit'
WHERE "slug" = 'eastside-townhome-rental'
  AND "leaseTerm" = ''
  AND "petPolicy" = ''
  AND "securityDeposit" IS NULL;
