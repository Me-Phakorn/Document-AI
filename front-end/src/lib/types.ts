export type WorkflowStatus =
  | 'UPLOADED'
  | 'DOWNLOADED'
  | 'PROCESSING'
  | 'OCR_PROCESSING'
  | 'OCR_COMPLETED'
  | 'OCR_PARTIAL'
  | 'OCR_FAILED'
  | 'MANUAL_EDIT'
  | 'AI_PENDING'
  | 'AI_PROCESSING'
  | 'AI_COMPLETED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'NOT_RELEVANT'
  | 'NEED_HUMAN_REVIEW'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';