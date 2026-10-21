-- Root Prisma 6 requires a primary key for the existing implicit relation.
-- Promote the pre-existing unique index without rewriting/deleting any row.
ALTER TABLE "_AgentTeam_members" ADD CONSTRAINT "_AgentTeam_members_AB_pkey"
  PRIMARY KEY USING INDEX "_AgentTeam_members_AB_unique";
