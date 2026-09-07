/**
 * Story 16.1 (ADR-0125, BRD-0125, FDD-0125, TDS-0125): Governance & Takedown types.
 */

export type DataSubjectRequestStatus =
  | 'pending_verification'
  | 'received'
  | 'under_review'
  | 'granted'
  | 'denied'
  | 'escalated';

export interface DataSubjectRequest {
  id: string;
  tenantId: string;
  postId: string | null;
  postUrl: string;
  requesterEmail: string;
  requesterName: string | null;
  requesterAffirmation: boolean;
  reason: string | null;
  status: DataSubjectRequestStatus;
  verificationToken: string | null;
  verificationTokenExpiresAt: string | null;
  verifiedAt: string | null;
  slaDueAt: string | null;
  riskFlag: boolean;
  riskReason: string | null;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTakedownSubmissionInput {
  tenantId: string;
  postId?: string;
  postUrl: string;
  authorEmail: string;
  authorName?: string;
  reason?: string;
  captchaToken?: string;
  riskFlag?: boolean;
  riskReason?: string;
}

export interface VerifyTakedownInput {
  token: string;
}

export interface ResolveTakedownInput {
  decisionReason?: string;
  automated?: boolean;
}

export interface EnrichmentRedactionPayload {
  sentiment: null;
  sentimentConfidence: null;
  keyPhrases: [];
  topicClusters?: never;
  detectedLanguage?: string;
  enrichment_override?: any;
}
