ALTER TABLE "PromptTemplateVersion"
ADD COLUMN "aiProvider" TEXT,
ADD COLUMN "aiModel" TEXT;

CREATE INDEX "PromptTemplateVersion_aiProvider_aiModel_idx" ON "PromptTemplateVersion"("aiProvider", "aiModel");