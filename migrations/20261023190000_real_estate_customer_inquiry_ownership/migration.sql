-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "customer" TEXT;

-- CreateIndex
CREATE INDEX "LeadActivity_customer_idx" ON "LeadActivity"("customer");

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
