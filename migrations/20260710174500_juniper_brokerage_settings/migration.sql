-- Persist the singleton Juniper Realty public/dashboard identity used by onboarding.
CREATE TABLE "BrokerageSettings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "businessName" TEXT NOT NULL DEFAULT '',
    "marketLabel" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "equalHousingNotice" TEXT NOT NULL DEFAULT '',
    "publicPhone" TEXT NOT NULL DEFAULT '',
    "publicEmail" TEXT NOT NULL DEFAULT '',
    "showingDurationMinutes" INTEGER DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerageSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrokerageSettings_key_key" ON "BrokerageSettings"("key");
