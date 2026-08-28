export type CRMProviderType = 'dynamics365' | 'salesforce' | 'hubspot';
export type CRMEntityType = 'lead' | 'opportunity' | 'support';

export interface CRMConnectorContext {
  tenantId: string;
  credentials?: Record<string, any>;
}

export interface CRMCasePayload {
  tenantId: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorPublicUrl?: string;
  postId?: string;                   // Optional for author-only prospecting pushes
  postExcerpt?: string;
  platformId: string;
  publishedAt?: string;
  sentiment?: string;
  watchlistId?: string;
  entityType: CRMEntityType;          // 'lead' | 'opportunity' | 'support'
  assignedTo?: string;               // External CRM User / Queue ID
  notes?: string;
  customFields?: Record<string, any>;
}

export interface CRMPushResult {
  crmRecordId: string;
  crmRecordUrl: string;
  entityType: string;
  rawResponse?: Record<string, any>;
}

export interface CRMConnectorStatus {
  isActive: boolean;
  provider: CRMProviderType;
  lastValidatedAt?: string;
  error?: string;
}

export interface CRMConnector {
  readonly id: string;
  readonly provider: CRMProviderType;

  pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult>;

  validateCredentials(ctx: CRMConnectorContext): Promise<boolean>;
  status(ctx: CRMConnectorContext): Promise<CRMConnectorStatus>;
}
