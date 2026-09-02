export type CRMProviderType = 'dynamics365' | 'salesforce' | 'hubspot';
export type CRMEntityType = string;

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
  postUrl?: string;                  // Best-effort link to the original social post
  postMediaUrls?: string[];          // Best-effort media or attachment links for the post
  platformId: string;
  publishedAt?: string;
  sentiment?: string;
  watchlistId?: string;
  entityType: CRMEntityType;          // 'lead' | 'opportunity' | 'support' or a custom table logical name
  entitySet?: string;                 // Optional Dataverse collection/plural name; falls back to entityType + 's'
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
