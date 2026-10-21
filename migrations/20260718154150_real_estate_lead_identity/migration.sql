-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "identityKey" TEXT NOT NULL DEFAULT '';

-- Backfill deterministic contact identities before indexing. Existing duplicate
-- rows intentionally retain the same key so operators can merge them while new
-- public capture reuses the oldest active lead under an advisory transaction lock.
UPDATE "Lead"
SET "identityKey" = CASE
  WHEN btrim("email") <> '' THEN 'email:' || lower(btrim("email"))
  WHEN length(regexp_replace("phone", '\\D', '', 'g')) >= 7 THEN
    'phone:' || CASE
      WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 11
        AND regexp_replace("phone", '\\D', '', 'g') LIKE '1%'
      THEN substring(regexp_replace("phone", '\\D', '', 'g') FROM 2)
      ELSE regexp_replace("phone", '\\D', '', 'g')
    END
  ELSE 'lead:' || "id"
END;

-- CreateIndex
CREATE INDEX "Lead_identityKey_idx" ON "Lead"("identityKey");
