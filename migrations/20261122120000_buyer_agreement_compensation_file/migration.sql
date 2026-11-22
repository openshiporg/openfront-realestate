-- Buyer agreements: compensation terms and an optional uploaded signed PDF (Keystone file field `signedAgreement`, storage agreement_files).
ALTER TABLE "RepresentationAuthority" ADD COLUMN "compensationSummary" TEXT NOT NULL DEFAULT '',
ADD COLUMN "signedAgreement_filesize" INTEGER,
ADD COLUMN "signedAgreement_filename" TEXT;
