-- Add source document date metadata separately from DocAI import timestamps.
ALTER TABLE "DocumentVersion"
  ADD COLUMN "sourceDocumentDate" TIMESTAMP(3),
  ADD COLUMN "sourceDocumentDateText" TEXT;

CREATE INDEX "DocumentVersion_sourceDocumentDate_createdAt_idx" ON "DocumentVersion"("sourceDocumentDate", "createdAt");