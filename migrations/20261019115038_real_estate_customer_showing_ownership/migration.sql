-- AlterTable
ALTER TABLE "Showing" ADD COLUMN     "customer" TEXT,
ADD COLUMN     "requestSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "Showing_customer_idx" ON "Showing"("customer");

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
