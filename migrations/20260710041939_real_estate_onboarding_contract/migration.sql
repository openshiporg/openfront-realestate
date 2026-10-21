/*
  Warnings:

  - The primary key for the `_AgentTeam_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_AgentTeam_members` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" DEFAULT 'not_started';

-- AlterTable
ALTER TABLE "_AgentTeam_members" DROP CONSTRAINT "_AgentTeam_members_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_AgentTeam_members_AB_unique" ON "_AgentTeam_members"("A", "B");
