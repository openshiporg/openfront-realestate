-- A payment has no provider id until checkout starts; "" would collide on the unique index.
ALTER TABLE "Payment" ALTER COLUMN "providerPaymentId" DROP NOT NULL,
ALTER COLUMN "providerPaymentId" DROP DEFAULT;
UPDATE "Payment" SET "providerPaymentId" = NULL WHERE "providerPaymentId" = '';
