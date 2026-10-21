-- Align the existing singleton table with Keystone's fixed singleton id.
ALTER TABLE "BrokerageSettings" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "BrokerageSettings_id_seq";

-- Add immutable lifecycle evidence.
ALTER TABLE "Deal" ADD COLUMN "closedSnapshot" JSONB;
ALTER TABLE "Offer" ADD COLUMN "acceptedSnapshot" JSONB;

-- Preserve accepted-offer evidence that predates snapshot enforcement.
UPDATE "Offer" AS offer
SET "acceptedSnapshot" = jsonb_build_object(
    'version', 1,
    'capturedAt', COALESCE(offer."acceptedAt", offer."updatedAt"),
    'offerNumber', offer."offerNumber",
    'amount', offer."amount",
    'earnestMoney', offer."earnestMoney",
    'financingType', offer."financingType",
    'contingencies', offer."contingencies",
    'submittedAt', offer."submittedAt",
    'responseDueAt', offer."responseDueAt",
    'property', (
        SELECT jsonb_build_object(
            'id', property.id,
            'title', property.title,
            'slug', property.slug,
            'addressLine1', property."addressLine1",
            'city', property.city,
            'state', property.state
        )
        FROM "Property" AS property
        WHERE property.id = offer.property
    ),
    'deal', (
        SELECT jsonb_build_object('id', deal.id, 'title', deal.title)
        FROM "Deal" AS deal
        WHERE deal.id = offer.deal
    ),
    'lead', (
        SELECT jsonb_build_object('id', lead.id, 'name', lead.name, 'email', lead.email)
        FROM "Lead" AS lead
        WHERE lead.id = offer.lead
    ),
    'assignedAgent', (
        SELECT jsonb_build_object('id', agent.id, 'name', agent.name)
        FROM "User" AS agent
        WHERE agent.id = offer."assignedAgent"
    )
)
WHERE offer.status = 'accepted'
  AND offer."acceptedSnapshot" IS NULL;

-- Preserve closed-deal evidence that predates snapshot enforcement.
UPDATE "Deal" AS deal
SET "closedSnapshot" = jsonb_build_object(
    'version', 1,
    'capturedAt', COALESCE(deal."closedAt", deal."updatedAt"),
    'outcome', deal.stage,
    'title', deal.title,
    'transactionType', deal."transactionType",
    'offerAmount', deal."offerAmount",
    'commissionAmount', deal."commissionAmount",
    'expectedCloseDate', deal."expectedCloseDate",
    'nextStep', deal."nextStep",
    'notes', deal.notes,
    'property', (
        SELECT jsonb_build_object(
            'id', property.id,
            'title', property.title,
            'slug', property.slug,
            'addressLine1', property."addressLine1",
            'city', property.city,
            'state', property.state
        )
        FROM "Property" AS property
        WHERE property.id = deal.property
    ),
    'lead', (
        SELECT jsonb_build_object('id', lead.id, 'name', lead.name, 'email', lead.email)
        FROM "Lead" AS lead
        WHERE lead.id = deal.lead
    ),
    'assignedAgent', (
        SELECT jsonb_build_object('id', agent.id, 'name', agent.name)
        FROM "User" AS agent
        WHERE agent.id = deal."assignedAgent"
    )
)
WHERE deal.stage IN ('closed_won', 'closed_lost')
  AND deal."closedSnapshot" IS NULL;
