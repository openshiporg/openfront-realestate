/*
  Warnings:

  - The primary key for the `_AgentTeam_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_AgentTeam_members` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "LeadActivityActivityTypeType" ADD VALUE 'showing_requested';

-- AlterTable
ALTER TABLE "CommissionLedgerEntry" ADD COLUMN     "ledgerStateHash" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "_AgentTeam_members" DROP CONSTRAINT "_AgentTeam_members_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_AgentTeam_members_AB_unique" ON "_AgentTeam_members"("A", "B");
