export interface AuditLogChainEntry {
  id: string;
  tenantId: string | null;
  actorId: string;
  action: string;
  timestamp: string;
  payload: Record<string, unknown>;
  previousRecordHash: string;
  recordHash: string;
}

export interface FileDigestEntry {
  path: string;
  sha256: string;
  rowCount: number;
  byteSize: number;
}

export interface ComplianceAuditPackManifest {
  manifestVersion: '1.0.0';
  packId: string;
  tenantId: string;
  generatedAt: string;
  timeRange: {
    startDate: string;
    endDate: string;
  };
  merkleRootHash: string;
  files: FileDigestEntry[];
  verificationSignature: string;
}

export interface AuditChainVerificationResult {
  isValid: boolean;
  verifiedRecordsCount?: number;
  chainStartHash?: string;
  chainEndHash?: string;
  compromisedRecordId?: string;
  sequencePosition?: number;
  expectedHash?: string;
  actualHash?: string;
}

export interface CreateAuditPackInput {
  packType?: 'dsr' | 'takedown' | 'ingestion' | 'enrichment' | 'full';
  startDate: string;
  endDate: string;
}

export interface AuditPackSummary {
  packId: string;
  tenantId: string;
  packType: string;
  status: string;
  startDate: string;
  endDate: string;
  sha256: string;
  merkleRoot: string;
  manifest: ComplianceAuditPackManifest;
  generatedAt: string;
  expiresAt: string;
}
