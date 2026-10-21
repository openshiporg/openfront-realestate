-- Additive integer-money conversion; retain all original values in ignored legacy
-- columns. Fail before DDL/backfill on precision/range errors; no rounding.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Property" WHERE NULLIF("price"::text, '') IS NOT NULL AND ("price"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("price"::text, '')::numeric * 100) <> trunc(NULLIF("price"::text, '')::numeric * 100) OR (NULLIF("price"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Property.price cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Property" WHERE NULLIF("hoaFee"::text, '') IS NOT NULL AND ("hoaFee"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("hoaFee"::text, '')::numeric * 100) <> trunc(NULLIF("hoaFee"::text, '')::numeric * 100) OR (NULLIF("hoaFee"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Property.hoaFee cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "MarketComp" WHERE NULLIF("listPrice"::text, '') IS NOT NULL AND ("listPrice"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("listPrice"::text, '')::numeric * 100) <> trunc(NULLIF("listPrice"::text, '')::numeric * 100) OR (NULLIF("listPrice"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'MarketComp.listPrice cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "MarketComp" WHERE NULLIF("salePrice"::text, '') IS NOT NULL AND ("salePrice"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("salePrice"::text, '')::numeric * 100) <> trunc(NULLIF("salePrice"::text, '')::numeric * 100) OR (NULLIF("salePrice"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'MarketComp.salePrice cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "PropertyValuation" WHERE NULLIF("lowValue"::text, '') IS NOT NULL AND ("lowValue"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("lowValue"::text, '')::numeric * 100) <> trunc(NULLIF("lowValue"::text, '')::numeric * 100) OR (NULLIF("lowValue"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'PropertyValuation.lowValue cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "PropertyValuation" WHERE NULLIF("estimatedValue"::text, '') IS NOT NULL AND ("estimatedValue"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("estimatedValue"::text, '')::numeric * 100) <> trunc(NULLIF("estimatedValue"::text, '')::numeric * 100) OR (NULLIF("estimatedValue"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'PropertyValuation.estimatedValue cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "PropertyValuation" WHERE NULLIF("highValue"::text, '') IS NOT NULL AND ("highValue"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("highValue"::text, '')::numeric * 100) <> trunc(NULLIF("highValue"::text, '')::numeric * 100) OR (NULLIF("highValue"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'PropertyValuation.highValue cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Offer" WHERE NULLIF("amount"::text, '') IS NOT NULL AND ("amount"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("amount"::text, '')::numeric * 100) <> trunc(NULLIF("amount"::text, '')::numeric * 100) OR (NULLIF("amount"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Offer.amount cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Offer" WHERE NULLIF("earnestMoney"::text, '') IS NOT NULL AND ("earnestMoney"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("earnestMoney"::text, '')::numeric * 100) <> trunc(NULLIF("earnestMoney"::text, '')::numeric * 100) OR (NULLIF("earnestMoney"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Offer.earnestMoney cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Commission" WHERE NULLIF("grossCommission"::text, '') IS NOT NULL AND ("grossCommission"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("grossCommission"::text, '')::numeric * 100) <> trunc(NULLIF("grossCommission"::text, '')::numeric * 100) OR (NULLIF("grossCommission"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Commission.grossCommission cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Commission" WHERE NULLIF("netCommission"::text, '') IS NOT NULL AND ("netCommission"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("netCommission"::text, '')::numeric * 100) <> trunc(NULLIF("netCommission"::text, '')::numeric * 100) OR (NULLIF("netCommission"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Commission.netCommission cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "MortgageApplication" WHERE NULLIF("loanAmount"::text, '') IS NOT NULL AND ("loanAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("loanAmount"::text, '')::numeric * 100) <> trunc(NULLIF("loanAmount"::text, '')::numeric * 100) OR (NULLIF("loanAmount"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'MortgageApplication.loanAmount cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Deal" WHERE NULLIF("offerAmount"::text, '') IS NOT NULL AND ("offerAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("offerAmount"::text, '')::numeric * 100) <> trunc(NULLIF("offerAmount"::text, '')::numeric * 100) OR (NULLIF("offerAmount"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Deal.offerAmount cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Deal" WHERE NULLIF("commissionAmount"::text, '') IS NOT NULL AND ("commissionAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("commissionAmount"::text, '')::numeric * 100) <> trunc(NULLIF("commissionAmount"::text, '')::numeric * 100) OR (NULLIF("commissionAmount"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Deal.commissionAmount cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Escrow" WHERE NULLIF("depositAmount"::text, '') IS NOT NULL AND ("depositAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("depositAmount"::text, '')::numeric * 100) <> trunc(NULLIF("depositAmount"::text, '')::numeric * 100) OR (NULLIF("depositAmount"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Escrow.depositAmount cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "ShowingFeedback" WHERE NULLIF("priceOpinion"::text, '') IS NOT NULL AND ("priceOpinion"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("priceOpinion"::text, '')::numeric * 100) <> trunc(NULLIF("priceOpinion"::text, '')::numeric * 100) OR (NULLIF("priceOpinion"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'ShowingFeedback.priceOpinion cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "PropertyInspection" WHERE NULLIF("estimatedCost"::text, '') IS NOT NULL AND ("estimatedCost"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("estimatedCost"::text, '')::numeric * 100) <> trunc(NULLIF("estimatedCost"::text, '')::numeric * 100) OR (NULLIF("estimatedCost"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'PropertyInspection.estimatedCost cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "SavedSearch" WHERE NULLIF("minPrice"::text, '') IS NOT NULL AND ("minPrice"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("minPrice"::text, '')::numeric * 100) <> trunc(NULLIF("minPrice"::text, '')::numeric * 100) OR (NULLIF("minPrice"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'SavedSearch.minPrice cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "SavedSearch" WHERE NULLIF("maxPrice"::text, '') IS NOT NULL AND ("maxPrice"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("maxPrice"::text, '')::numeric * 100) <> trunc(NULLIF("maxPrice"::text, '')::numeric * 100) OR (NULLIF("maxPrice"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'SavedSearch.maxPrice cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Neighborhood" WHERE NULLIF("medianSalePrice"::text, '') IS NOT NULL AND ("medianSalePrice"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("medianSalePrice"::text, '')::numeric * 100) <> trunc(NULLIF("medianSalePrice"::text, '')::numeric * 100) OR (NULLIF("medianSalePrice"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Neighborhood.medianSalePrice cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Neighborhood" WHERE NULLIF("medianRent"::text, '') IS NOT NULL AND ("medianRent"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("medianRent"::text, '')::numeric * 100) <> trunc(NULLIF("medianRent"::text, '')::numeric * 100) OR (NULLIF("medianRent"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Neighborhood.medianRent cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Lead" WHERE "budgetMin" <> '' AND "budgetMin" !~ '^-?[0-9]+([.][0-9]{1,2})?$') THEN RAISE EXCEPTION 'Lead.budgetMin contains a noncanonical monetary value'; END IF;
  IF EXISTS (SELECT 1 FROM "Lead" WHERE NULLIF("budgetMin"::text, '') IS NOT NULL AND ("budgetMin"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("budgetMin"::text, '')::numeric * 100) <> trunc(NULLIF("budgetMin"::text, '')::numeric * 100) OR (NULLIF("budgetMin"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Lead.budgetMin cannot be represented exactly as 64-bit cents'; END IF;
  IF EXISTS (SELECT 1 FROM "Lead" WHERE "budgetMax" <> '' AND "budgetMax" !~ '^-?[0-9]+([.][0-9]{1,2})?$') THEN RAISE EXCEPTION 'Lead.budgetMax contains a noncanonical monetary value'; END IF;
  IF EXISTS (SELECT 1 FROM "Lead" WHERE NULLIF("budgetMax"::text, '') IS NOT NULL AND ("budgetMax"::text IN ('NaN', 'Infinity', '-Infinity') OR (NULLIF("budgetMax"::text, '')::numeric * 100) <> trunc(NULLIF("budgetMax"::text, '')::numeric * 100) OR (NULLIF("budgetMax"::text, '')::numeric * 100) NOT BETWEEN -9223372036854775808 AND 9223372036854775807)) THEN RAISE EXCEPTION 'Lead.budgetMax cannot be represented exactly as 64-bit cents'; END IF;
END $$;

-- AlterTable
ALTER TABLE "BrokerageSettings" ADD COLUMN     "logoColor" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "logoIcon" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "grossCommissionMinor" BIGINT DEFAULT 0,
ADD COLUMN     "netCommissionMinor" BIGINT DEFAULT 0;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "commissionAmountMinor" BIGINT,
ADD COLUMN     "offerAmountMinor" BIGINT;

-- AlterTable
ALTER TABLE "Escrow" ADD COLUMN     "depositAmountMinor" BIGINT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "budgetMaxMinor" BIGINT,
ADD COLUMN     "budgetMinMinor" BIGINT;

-- AlterTable
ALTER TABLE "MarketComp" ADD COLUMN     "listPriceMinor" BIGINT,
ADD COLUMN     "salePriceMinor" BIGINT;

-- AlterTable
ALTER TABLE "MortgageApplication" ADD COLUMN     "loanAmountMinor" BIGINT;

-- AlterTable
ALTER TABLE "Neighborhood" ADD COLUMN     "medianRentMinor" BIGINT,
ADD COLUMN     "medianSalePriceMinor" BIGINT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "amountMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "earnestMoneyMinor" BIGINT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "hoaFeeMinor" BIGINT,
ADD COLUMN     "priceMinor" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PropertyInspection" ADD COLUMN     "estimatedCostMinor" BIGINT;

-- AlterTable
ALTER TABLE "PropertyValuation" ADD COLUMN     "estimatedValueMinor" BIGINT,
ADD COLUMN     "highValueMinor" BIGINT,
ADD COLUMN     "lowValueMinor" BIGINT;

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "maxPriceMinor" BIGINT,
ADD COLUMN     "minPriceMinor" BIGINT;

-- AlterTable
ALTER TABLE "ShowingFeedback" ADD COLUMN     "priceOpinionMinor" BIGINT;

-- Exact nonempty backfill. Immutable historical JSON remains in its original
-- versioned major-unit representation; the public API still returns major units.
UPDATE "Property" SET "priceMinor" = CASE WHEN NULLIF("price"::text, '') IS NULL THEN NULL ELSE (NULLIF("price"::text, '')::numeric * 100)::bigint END;
UPDATE "Property" SET "hoaFeeMinor" = CASE WHEN NULLIF("hoaFee"::text, '') IS NULL THEN NULL ELSE (NULLIF("hoaFee"::text, '')::numeric * 100)::bigint END;
UPDATE "MarketComp" SET "listPriceMinor" = CASE WHEN NULLIF("listPrice"::text, '') IS NULL THEN NULL ELSE (NULLIF("listPrice"::text, '')::numeric * 100)::bigint END;
UPDATE "MarketComp" SET "salePriceMinor" = CASE WHEN NULLIF("salePrice"::text, '') IS NULL THEN NULL ELSE (NULLIF("salePrice"::text, '')::numeric * 100)::bigint END;
UPDATE "PropertyValuation" SET "lowValueMinor" = CASE WHEN NULLIF("lowValue"::text, '') IS NULL THEN NULL ELSE (NULLIF("lowValue"::text, '')::numeric * 100)::bigint END;
UPDATE "PropertyValuation" SET "estimatedValueMinor" = CASE WHEN NULLIF("estimatedValue"::text, '') IS NULL THEN NULL ELSE (NULLIF("estimatedValue"::text, '')::numeric * 100)::bigint END;
UPDATE "PropertyValuation" SET "highValueMinor" = CASE WHEN NULLIF("highValue"::text, '') IS NULL THEN NULL ELSE (NULLIF("highValue"::text, '')::numeric * 100)::bigint END;
UPDATE "Offer" SET "amountMinor" = CASE WHEN NULLIF("amount"::text, '') IS NULL THEN NULL ELSE (NULLIF("amount"::text, '')::numeric * 100)::bigint END;
UPDATE "Offer" SET "earnestMoneyMinor" = CASE WHEN NULLIF("earnestMoney"::text, '') IS NULL THEN NULL ELSE (NULLIF("earnestMoney"::text, '')::numeric * 100)::bigint END;
UPDATE "Commission" SET "grossCommissionMinor" = CASE WHEN NULLIF("grossCommission"::text, '') IS NULL THEN NULL ELSE (NULLIF("grossCommission"::text, '')::numeric * 100)::bigint END;
UPDATE "Commission" SET "netCommissionMinor" = CASE WHEN NULLIF("netCommission"::text, '') IS NULL THEN NULL ELSE (NULLIF("netCommission"::text, '')::numeric * 100)::bigint END;
UPDATE "MortgageApplication" SET "loanAmountMinor" = CASE WHEN NULLIF("loanAmount"::text, '') IS NULL THEN NULL ELSE (NULLIF("loanAmount"::text, '')::numeric * 100)::bigint END;
UPDATE "Deal" SET "offerAmountMinor" = CASE WHEN NULLIF("offerAmount"::text, '') IS NULL THEN NULL ELSE (NULLIF("offerAmount"::text, '')::numeric * 100)::bigint END;
UPDATE "Deal" SET "commissionAmountMinor" = CASE WHEN NULLIF("commissionAmount"::text, '') IS NULL THEN NULL ELSE (NULLIF("commissionAmount"::text, '')::numeric * 100)::bigint END;
UPDATE "Escrow" SET "depositAmountMinor" = CASE WHEN NULLIF("depositAmount"::text, '') IS NULL THEN NULL ELSE (NULLIF("depositAmount"::text, '')::numeric * 100)::bigint END;
UPDATE "ShowingFeedback" SET "priceOpinionMinor" = CASE WHEN NULLIF("priceOpinion"::text, '') IS NULL THEN NULL ELSE (NULLIF("priceOpinion"::text, '')::numeric * 100)::bigint END;
UPDATE "PropertyInspection" SET "estimatedCostMinor" = CASE WHEN NULLIF("estimatedCost"::text, '') IS NULL THEN NULL ELSE (NULLIF("estimatedCost"::text, '')::numeric * 100)::bigint END;
UPDATE "SavedSearch" SET "minPriceMinor" = CASE WHEN NULLIF("minPrice"::text, '') IS NULL THEN NULL ELSE (NULLIF("minPrice"::text, '')::numeric * 100)::bigint END;
UPDATE "SavedSearch" SET "maxPriceMinor" = CASE WHEN NULLIF("maxPrice"::text, '') IS NULL THEN NULL ELSE (NULLIF("maxPrice"::text, '')::numeric * 100)::bigint END;
UPDATE "Neighborhood" SET "medianSalePriceMinor" = CASE WHEN NULLIF("medianSalePrice"::text, '') IS NULL THEN NULL ELSE (NULLIF("medianSalePrice"::text, '')::numeric * 100)::bigint END;
UPDATE "Neighborhood" SET "medianRentMinor" = CASE WHEN NULLIF("medianRent"::text, '') IS NULL THEN NULL ELSE (NULLIF("medianRent"::text, '')::numeric * 100)::bigint END;
UPDATE "Lead" SET "budgetMinMinor" = CASE WHEN NULLIF("budgetMin"::text, '') IS NULL THEN NULL ELSE (NULLIF("budgetMin"::text, '')::numeric * 100)::bigint END;
UPDATE "Lead" SET "budgetMaxMinor" = CASE WHEN NULLIF("budgetMax"::text, '') IS NULL THEN NULL ELSE (NULLIF("budgetMax"::text, '')::numeric * 100)::bigint END;
COMMIT;
