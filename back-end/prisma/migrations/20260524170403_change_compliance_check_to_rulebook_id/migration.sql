/*
  Warnings:

  - You are about to drop the column `selectedRulebookVersionId` on the `ComplianceCheck` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ComplianceCheck" DROP CONSTRAINT "ComplianceCheck_selectedRulebookVersionId_fkey";

-- DropIndex
DROP INDEX "ComplianceCheck_selectedRulebookVersionId_createdAt_idx";

-- AlterTable
ALTER TABLE "ComplianceCheck" DROP COLUMN "selectedRulebookVersionId",
ADD COLUMN     "selectedRulebookId" UUID;

-- CreateIndex
CREATE INDEX "ComplianceCheck_selectedRulebookId_createdAt_idx" ON "ComplianceCheck"("selectedRulebookId", "createdAt");

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_selectedRulebookId_fkey" FOREIGN KEY ("selectedRulebookId") REFERENCES "MasterRulebook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
