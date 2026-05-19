-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('UPLOAD', 'WEBSITE_SCAN', 'API');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'DOWNLOADED', 'PROCESSING', 'OCR_PROCESSING', 'OCR_COMPLETED', 'OCR_PARTIAL', 'OCR_FAILED', 'AI_PENDING', 'AI_PROCESSING', 'AI_COMPLETED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NOT_RELEVANT', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "WebsiteScanStatus" AS ENUM ('IDLE', 'SCANNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED');

-- CreateEnum
CREATE TYPE "DocumentGroupStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiAnalysisOutcome" AS ENUM ('RULES_FOUND', 'NO_RULES_FOUND', 'NOT_RELEVANT', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('SOURCE_AI_RESULT', 'NOT_RELEVANT', 'RULEBOOK_VERSION', 'COMPLIANCE_CHECK');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CONFIRMED_NOT_RELEVANT', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "RulebookStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'NEEDS_REVIEW', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComplianceInputType" AS ENUM ('IMAGE', 'PDF', 'TEXT', 'URL', 'SOCIAL_POST', 'SCREENSHOT');

-- CreateEnum
CREATE TYPE "ComplianceCheckStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLIANT', 'NON_COMPLIANT', 'POTENTIAL_VIOLATION', 'AMBIGUOUS', 'INSUFFICIENT_INFORMATION', 'NEED_HUMAN_REVIEW', 'REJECTED', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('RULE_EXTRACTION', 'COMPLIANCE_USAGE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'XLSX', 'JSON');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StoredObjectLifecycleStatus" AS ENUM ('CURRENT', 'SUPERSEDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceUrlHash" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "fileSha256" TEXT,
    "contentSha256" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scanConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteScan" (
    "id" UUID NOT NULL,
    "websiteSourceId" UUID NOT NULL,
    "status" "WebsiteScanStatus" NOT NULL DEFAULT 'IDLE',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentGroup" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "ownerId" UUID,
    "promptTemplateVersionId" UUID,
    "status" "DocumentGroupStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchAnalysisJob" (
    "id" UUID NOT NULL,
    "documentGroupId" UUID NOT NULL,
    "status" "DocumentGroupStatus" NOT NULL DEFAULT 'QUEUED',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "processingCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "tags" TEXT[],
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplateVersion" (
    "id" UUID NOT NULL,
    "promptTemplateId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "templateText" TEXT NOT NULL,
    "variables" TEXT[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptInstance" (
    "id" UUID NOT NULL,
    "promptTemplateVersionId" UUID NOT NULL,
    "documentVersionId" UUID,
    "documentGroupId" UUID,
    "renderedPromptHash" TEXT NOT NULL,
    "variables" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokenUsage" INTEGER,
    "estimatedCost" DECIMAL(12,4),
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrArtifact" (
    "id" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "engine" TEXT NOT NULL,
    "status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "aggregateConfidence" DOUBLE PRECISION,
    "minPageConfidence" DOUBLE PRECISION,
    "pageCount" INTEGER,
    "failedPages" JSONB,
    "warnings" JSONB,
    "searchableObjectId" UUID,
    "textObjectId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysisResult" (
    "id" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "promptInstanceId" UUID NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "AiAnalysisOutcome",
    "confidence" DOUBLE PRECISION,
    "result" JSONB,
    "tokenUsage" INTEGER,
    "estimatedCost" DECIMAL(12,4),
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" UUID NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "ReviewOutcome",
    "aiAnalysisResultId" UUID,
    "complianceCheckId" UUID,
    "reviewerId" UUID,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRulebook" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRulebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRulebookVersion" (
    "id" UUID NOT NULL,
    "masterRulebookId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "RulebookStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" UUID,
    "publishedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRulebookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" UUID NOT NULL,
    "masterRulebookVersionId" UUID NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "variantGroupId" TEXT,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "condition" TEXT,
    "prohibition" TEXT,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'INFO',
    "sourceReferences" JSONB NOT NULL,
    "examples" JSONB,
    "requiresReReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" UUID NOT NULL,
    "inputType" "ComplianceInputType" NOT NULL,
    "status" "ComplianceCheckStatus" NOT NULL DEFAULT 'PENDING',
    "selectedRulebookVersionId" UUID,
    "selectedReportId" UUID,
    "createdById" UUID,
    "inputHash" TEXT,
    "extractedContentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheckResult" (
    "id" UUID NOT NULL,
    "complianceCheckId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "ComplianceCheckStatus" NOT NULL,
    "summary" TEXT,
    "matchedRules" JSONB,
    "ambiguousPoints" JSONB,
    "recommendedAction" TEXT,
    "reviewerDecision" "ReviewOutcome",
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "masterRulebookVersionId" UUID,
    "complianceCheckId" UUID,
    "parameters" JSONB,
    "generatedById" UUID,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "storedObjectId" UUID,
    "parametersHash" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredObject" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "lifecycleStatus" "StoredObjectLifecycleStatus" NOT NULL DEFAULT 'CURRENT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "previousState" JSONB,
    "nextState" JSONB,
    "correlationId" TEXT NOT NULL,
    "requestMetadata" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Document_status_createdAt_idx" ON "Document"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Document_sourceType_createdAt_idx" ON "Document"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "Document_ownerId_createdAt_idx" ON "Document"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_sourceUrlHash_idx" ON "DocumentVersion"("sourceUrlHash");

-- CreateIndex
CREATE INDEX "DocumentVersion_fileSha256_idx" ON "DocumentVersion"("fileSha256");

-- CreateIndex
CREATE INDEX "DocumentVersion_contentSha256_idx" ON "DocumentVersion"("contentSha256");

-- CreateIndex
CREATE INDEX "DocumentVersion_status_createdAt_idx" ON "DocumentVersion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_ocrStatus_createdAt_idx" ON "DocumentVersion"("ocrStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "WebsiteScan_websiteSourceId_createdAt_idx" ON "WebsiteScan"("websiteSourceId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteScan_status_createdAt_idx" ON "WebsiteScan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentGroup_status_createdAt_idx" ON "DocumentGroup"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentGroup_ownerId_createdAt_idx" ON "DocumentGroup"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "BatchAnalysisJob_status_createdAt_idx" ON "BatchAnalysisJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BatchAnalysisJob_documentGroupId_createdAt_idx" ON "BatchAnalysisJob"("documentGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptTemplateVersion_status_createdAt_idx" ON "PromptTemplateVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplateVersion_promptTemplateId_versionNumber_key" ON "PromptTemplateVersion"("promptTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "PromptInstance_promptTemplateVersionId_createdAt_idx" ON "PromptInstance"("promptTemplateVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptInstance_documentVersionId_createdAt_idx" ON "PromptInstance"("documentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptInstance_documentGroupId_createdAt_idx" ON "PromptInstance"("documentGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrArtifact_documentVersionId_createdAt_idx" ON "OcrArtifact"("documentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrArtifact_status_createdAt_idx" ON "OcrArtifact"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysisResult_documentVersionId_createdAt_idx" ON "AiAnalysisResult"("documentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysisResult_promptInstanceId_createdAt_idx" ON "AiAnalysisResult"("promptInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysisResult_status_createdAt_idx" ON "AiAnalysisResult"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysisResult_documentVersionId_promptInstanceId_key" ON "AiAnalysisResult"("documentVersionId", "promptInstanceId");

-- CreateIndex
CREATE INDEX "ReviewItem_status_createdAt_idx" ON "ReviewItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewItem_reviewerId_status_createdAt_idx" ON "ReviewItem"("reviewerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewItem_aiAnalysisResultId_roundNumber_idx" ON "ReviewItem"("aiAnalysisResultId", "roundNumber");

-- CreateIndex
CREATE INDEX "ReviewItem_complianceCheckId_roundNumber_idx" ON "ReviewItem"("complianceCheckId", "roundNumber");

-- CreateIndex
CREATE INDEX "MasterRulebookVersion_status_createdAt_idx" ON "MasterRulebookVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRulebookVersion_masterRulebookId_versionNumber_key" ON "MasterRulebookVersion"("masterRulebookId", "versionNumber");

-- CreateIndex
CREATE INDEX "RuleVersion_variantGroupId_idx" ON "RuleVersion"("variantGroupId");

-- CreateIndex
CREATE INDEX "RuleVersion_riskLevel_idx" ON "RuleVersion"("riskLevel");

-- CreateIndex
CREATE INDEX "RuleVersion_requiresReReview_idx" ON "RuleVersion"("requiresReReview");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_masterRulebookVersionId_ruleCode_key" ON "RuleVersion"("masterRulebookVersionId", "ruleCode");

-- CreateIndex
CREATE INDEX "ComplianceCheck_status_createdAt_idx" ON "ComplianceCheck"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceCheck_selectedRulebookVersionId_createdAt_idx" ON "ComplianceCheck"("selectedRulebookVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceCheck_selectedReportId_createdAt_idx" ON "ComplianceCheck"("selectedReportId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceCheckResult_status_createdAt_idx" ON "ComplianceCheckResult"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCheckResult_complianceCheckId_versionNumber_key" ON "ComplianceCheckResult"("complianceCheckId", "versionNumber");

-- CreateIndex
CREATE INDEX "Report_reportType_status_createdAt_idx" ON "Report"("reportType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_masterRulebookVersionId_createdAt_idx" ON "Report"("masterRulebookVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_complianceCheckId_createdAt_idx" ON "Report"("complianceCheckId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExport_reportId_createdAt_idx" ON "ReportExport"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExport_status_createdAt_idx" ON "ReportExport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportExport_reportId_format_parametersHash_key" ON "ReportExport"("reportId", "format", "parametersHash");

-- CreateIndex
CREATE INDEX "StoredObject_ownerType_ownerId_idx" ON "StoredObject"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "StoredObject_sha256_idx" ON "StoredObject"("sha256");

-- CreateIndex
CREATE INDEX "StoredObject_lifecycleStatus_createdAt_idx" ON "StoredObject"("lifecycleStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_bucket_objectKey_key" ON "StoredObject"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteScan" ADD CONSTRAINT "WebsiteScan_websiteSourceId_fkey" FOREIGN KEY ("websiteSourceId") REFERENCES "WebsiteSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchAnalysisJob" ADD CONSTRAINT "BatchAnalysisJob_documentGroupId_fkey" FOREIGN KEY ("documentGroupId") REFERENCES "DocumentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplateVersion" ADD CONSTRAINT "PromptTemplateVersion_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptInstance" ADD CONSTRAINT "PromptInstance_promptTemplateVersionId_fkey" FOREIGN KEY ("promptTemplateVersionId") REFERENCES "PromptTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrArtifact" ADD CONSTRAINT "OcrArtifact_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisResult" ADD CONSTRAINT "AiAnalysisResult_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisResult" ADD CONSTRAINT "AiAnalysisResult_promptInstanceId_fkey" FOREIGN KEY ("promptInstanceId") REFERENCES "PromptInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_aiAnalysisResultId_fkey" FOREIGN KEY ("aiAnalysisResultId") REFERENCES "AiAnalysisResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_complianceCheckId_fkey" FOREIGN KEY ("complianceCheckId") REFERENCES "ComplianceCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRulebookVersion" ADD CONSTRAINT "MasterRulebookVersion_masterRulebookId_fkey" FOREIGN KEY ("masterRulebookId") REFERENCES "MasterRulebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_masterRulebookVersionId_fkey" FOREIGN KEY ("masterRulebookVersionId") REFERENCES "MasterRulebookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_selectedRulebookVersionId_fkey" FOREIGN KEY ("selectedRulebookVersionId") REFERENCES "MasterRulebookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheckResult" ADD CONSTRAINT "ComplianceCheckResult_complianceCheckId_fkey" FOREIGN KEY ("complianceCheckId") REFERENCES "ComplianceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_masterRulebookVersionId_fkey" FOREIGN KEY ("masterRulebookVersionId") REFERENCES "MasterRulebookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_complianceCheckId_fkey" FOREIGN KEY ("complianceCheckId") REFERENCES "ComplianceCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
