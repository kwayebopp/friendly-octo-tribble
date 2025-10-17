-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "lastSentAt" TIMESTAMP(3),
ADD COLUMN     "maxMessages" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "messageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextScheduledFor" TIMESTAMP(3),
ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "leads_nextScheduledFor_status_idx" ON "leads"("nextScheduledFor", "status");
