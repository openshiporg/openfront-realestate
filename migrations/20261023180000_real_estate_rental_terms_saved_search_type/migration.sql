-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "leaseTerm" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "petPolicy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "securityDeposit" INTEGER;

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "listingType" TEXT NOT NULL DEFAULT '';
