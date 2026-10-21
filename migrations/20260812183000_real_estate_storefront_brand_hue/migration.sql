-- Add the bounded storefront brand hue with the existing Juniper garden hue as the data-safe default.
ALTER TABLE "BrokerageSettings"
ADD COLUMN "brandHue" INTEGER NOT NULL DEFAULT 151;

ALTER TABLE "BrokerageSettings"
ADD CONSTRAINT "BrokerageSettings_brandHue_range"
CHECK ("brandHue" BETWEEN 0 AND 359);
