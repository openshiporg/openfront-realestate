-- Invariants the app relied on without enforcing (round 2). Live data was checked for violations first (all zero).
-- Model hooks give the readable messages; these constraints are the backstop for every writer.

-- Uniqueness
CREATE UNIQUE INDEX "SavedProperty_user_property_key" ON "SavedProperty"("user", "property");
CREATE UNIQUE INDEX "PropertyMedia_single_hero_key" ON "PropertyMedia"("property") WHERE "isHero";
CREATE UNIQUE INDEX "Brokerage_single_primary_key" ON "Brokerage"((true)) WHERE "isPrimary";
CREATE UNIQUE INDEX "BrokerageMembership_brokerage_user_key" ON "BrokerageMembership"("brokerage", "user");
CREATE UNIQUE INDEX "BrokerageMembership_single_primary_key" ON "BrokerageMembership"("user") WHERE "isPrimary";
CREATE UNIQUE INDEX "Escrow_single_open_per_deal_key" ON "Escrow"("deal") WHERE "status" IN ('opened', 'pending');

-- Money is never negative
ALTER TABLE "Property" ADD CONSTRAINT "Property_priceMinor_nonnegative" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_hoaFeeMinor_nonnegative" CHECK ("hoaFeeMinor" IS NULL OR "hoaFeeMinor" >= 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_budgetMinMinor_nonnegative" CHECK ("budgetMinMinor" IS NULL OR "budgetMinMinor" >= 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_budgetMaxMinor_nonnegative" CHECK ("budgetMaxMinor" IS NULL OR "budgetMaxMinor" >= 0);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_offerAmountMinor_nonnegative" CHECK ("offerAmountMinor" IS NULL OR "offerAmountMinor" >= 0);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_commissionAmountMinor_nonnegative" CHECK ("commissionAmountMinor" IS NULL OR "commissionAmountMinor" >= 0);
ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_estimatedCostMinor_nonnegative" CHECK ("estimatedCostMinor" IS NULL OR "estimatedCostMinor" >= 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_amountMinor_nonnegative" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_earnestMoneyMinor_nonnegative" CHECK ("earnestMoneyMinor" IS NULL OR "earnestMoneyMinor" >= 0);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_grossCommissionMinor_nonnegative" CHECK ("grossCommissionMinor" IS NULL OR "grossCommissionMinor" >= 0);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_netCommissionMinor_nonnegative" CHECK ("netCommissionMinor" IS NULL OR "netCommissionMinor" >= 0);
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_minPriceMinor_nonnegative" CHECK ("minPriceMinor" IS NULL OR "minPriceMinor" >= 0);
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_maxPriceMinor_nonnegative" CHECK ("maxPriceMinor" IS NULL OR "maxPriceMinor" >= 0);
ALTER TABLE "MarketComp" ADD CONSTRAINT "MarketComp_listPriceMinor_nonnegative" CHECK ("listPriceMinor" IS NULL OR "listPriceMinor" >= 0);
ALTER TABLE "MarketComp" ADD CONSTRAINT "MarketComp_salePriceMinor_nonnegative" CHECK ("salePriceMinor" IS NULL OR "salePriceMinor" >= 0);
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_medianSalePriceMinor_nonnegative" CHECK ("medianSalePriceMinor" IS NULL OR "medianSalePriceMinor" >= 0);
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_medianRentMinor_nonnegative" CHECK ("medianRentMinor" IS NULL OR "medianRentMinor" >= 0);
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_lowValueMinor_nonnegative" CHECK ("lowValueMinor" IS NULL OR "lowValueMinor" >= 0);
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_estimatedValueMinor_nonnegative" CHECK ("estimatedValueMinor" IS NULL OR "estimatedValueMinor" >= 0);
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_highValueMinor_nonnegative" CHECK ("highValueMinor" IS NULL OR "highValueMinor" >= 0);
ALTER TABLE "MortgageApplication" ADD CONSTRAINT "MortgageApplication_loanAmountMinor_nonnegative" CHECK ("loanAmountMinor" IS NULL OR "loanAmountMinor" >= 0);
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_depositAmountMinor_nonnegative" CHECK ("depositAmountMinor" IS NULL OR "depositAmountMinor" >= 0);
ALTER TABLE "ShowingFeedback" ADD CONSTRAINT "ShowingFeedback_priceOpinionMinor_nonnegative" CHECK ("priceOpinionMinor" IS NULL OR "priceOpinionMinor" >= 0);

-- Ranges and totals
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_budget_order" CHECK ("budgetMinMinor" IS NULL OR "budgetMaxMinor" IS NULL OR "budgetMinMinor" <= "budgetMaxMinor");
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_price_order" CHECK ("minPriceMinor" IS NULL OR "maxPriceMinor" IS NULL OR "minPriceMinor" <= "maxPriceMinor");
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_value_order" CHECK (
  ("lowValueMinor" IS NULL OR "estimatedValueMinor" IS NULL OR "lowValueMinor" <= "estimatedValueMinor")
  AND ("estimatedValueMinor" IS NULL OR "highValueMinor" IS NULL OR "estimatedValueMinor" <= "highValueMinor")
  AND ("lowValueMinor" IS NULL OR "highValueMinor" IS NULL OR "lowValueMinor" <= "highValueMinor"));
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_earnest_within_amount" CHECK ("earnestMoneyMinor" IS NULL OR "earnestMoneyMinor" <= "amountMinor");
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_split_range" CHECK (
  ("brokerageSplitPercent" IS NULL OR "brokerageSplitPercent" BETWEEN 0 AND 100)
  AND ("agentSplitPercent" IS NULL OR "agentSplitPercent" BETWEEN 0 AND 100)
  AND COALESCE("brokerageSplitPercent", 0) + COALESCE("agentSplitPercent", 0) <= 100);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_net_within_gross" CHECK ("netCommissionMinor" IS NULL OR "grossCommissionMinor" IS NULL OR "netCommissionMinor" <= "grossCommissionMinor");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_within_amount" CHECK ("refundedMinor" IS NULL OR ("refundedMinor" >= 0 AND "refundedMinor" <= "amountMinor"));

-- Time
ALTER TABLE "OpenHouse" ADD CONSTRAINT "OpenHouse_ends_after_start" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_ends_after_start" CHECK ("scheduledEnd" IS NULL OR "scheduledEnd" > "scheduledStart");
