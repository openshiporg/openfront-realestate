-- DropForeignKey
ALTER TABLE "AgentTask" DROP CONSTRAINT "AgentTask_brokerage_fkey";

-- DropForeignKey
ALTER TABLE "DealDocument" DROP CONSTRAINT "DealDocument_brokerage_fkey";

-- DropForeignKey
ALTER TABLE "SavedSearch" DROP CONSTRAINT "SavedSearch_brokerage_fkey";

-- DropForeignKey
ALTER TABLE "SavedSearchAlert" DROP CONSTRAINT "SavedSearchAlert_brokerage_fkey";

-- DropForeignKey
ALTER TABLE "SourceFeed" DROP CONSTRAINT "SourceFeed_brokerage_fkey";

-- DropForeignKey
ALTER TABLE "TransactionMilestone" DROP CONSTRAINT "TransactionMilestone_brokerage_fkey";

-- AlterTable
ALTER TABLE "_AgentTeam_members" ADD CONSTRAINT "_AgentTeam_members_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AgentTeam_members_AB_unique";

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

