-- CreateEnum
CREATE TYPE "BrokerageStatusType" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "BrokerageMembershipMembershipRoleType" AS ENUM ('owner', 'admin', 'team_lead', 'agent', 'coordinator', 'analyst');

-- CreateEnum
CREATE TYPE "BrokerageMembershipStatusType" AS ENUM ('invited', 'active', 'suspended');

-- AlterTable
ALTER TABLE "AgentTeam" ADD COLUMN     "brokerage" TEXT;

-- AlterTable
CREATE SEQUENCE brokeragesettings_id_seq;
ALTER TABLE "BrokerageSettings" ADD COLUMN     "brokerage" TEXT,
ALTER COLUMN "id" SET DEFAULT nextval('brokeragesettings_id_seq');
ALTER SEQUENCE brokeragesettings_id_seq OWNED BY "BrokerageSettings"."id";

-- CreateTable
CREATE TABLE "Brokerage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "status" "BrokerageStatusType" NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brokerage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageMembership" (
    "id" TEXT NOT NULL,
    "brokerage" TEXT,
    "user" TEXT,
    "membershipRole" "BrokerageMembershipMembershipRoleType" NOT NULL DEFAULT 'agent',
    "status" "BrokerageMembershipStatusType" NOT NULL DEFAULT 'invited',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerageMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brokerage_slug_key" ON "Brokerage"("slug");

-- CreateIndex
CREATE INDEX "BrokerageMembership_brokerage_idx" ON "BrokerageMembership"("brokerage");

-- CreateIndex
CREATE INDEX "BrokerageMembership_user_idx" ON "BrokerageMembership"("user");

-- CreateIndex
CREATE INDEX "AgentTeam_brokerage_idx" ON "AgentTeam"("brokerage");

-- CreateIndex
CREATE INDEX "BrokerageSettings_brokerage_idx" ON "BrokerageSettings"("brokerage");

-- AddForeignKey
ALTER TABLE "BrokerageMembership" ADD CONSTRAINT "BrokerageMembership_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageMembership" ADD CONSTRAINT "BrokerageMembership_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageSettings" ADD CONSTRAINT "BrokerageSettings_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTeam" ADD CONSTRAINT "AgentTeam_brokerage_fkey" FOREIGN KEY ("brokerage") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
