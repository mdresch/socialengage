export type UserRole = 'tenant_admin' | 'tenant_user' | 'platform_admin' | 'unauthenticated';

export type StatusBadgeVariant =
  | 'healthy'
  | 'degraded'
  | 'failing'
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'verified'
  | 'pending';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenantName: string | null;
  avatarUrl?: string;
  isAuthenticated?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'Active' | 'Suspended' | 'active' | 'suspended';
  plan?: 'Enterprise' | 'Scale' | 'Pro' | string;
  activeSeats: number;
  licenseSeats: number;
  createdAt: string;
  isolationMode?: string;
  deletionRequest?: {
    requestedAt: string;
    graceEndsAt: string;
    requestedBy: string;
    status: 'grace_period' | 'scheduled' | 'cancelled';
  };
}

export type PlatformConnectorId =
  | 'gnews'
  | 'newswire'
  | 'azure_ai_language'
  | 'azure_openai'
  | 'tenant_owned_feed'
  | 'linkedin'
  | 'x'
  | 'facebook'
  | 'instagram'
  | 'youtube';

export interface Connector {
  id: string;
  tenantId?: string;
  platformId: PlatformConnectorId;
  name: string;
  category: 'Ingestion' | 'AI Enrichment' | 'Custom Feed' | string;
  description: string;
  status: 'healthy' | 'degraded' | 'failing' | 'inactive';
  isActive: boolean;
  lastSuccessfulFetch: string;
  lastAttempt: string;
  consecutiveFailures: number;
  config?: {
    apiKeyMasked?: string;
    endpoint?: string;
    deploymentName?: string;
    region?: string;
    feedUrl?: string;
    customDomain?: string;
    dnsTxtHost?: string;
    dnsTxtValue?: string;
    dnsVerified?: boolean;
    activationId?: string;
    lastVerifiedAt?: string;
  };
}

export type MatchType = 'Keyword' | 'Hashtag' | 'Account' | 'Boolean';

export interface Watchlist {
  id: string;
  tenantId?: string;
  name: string;
  matchType: MatchType;
  query: string;
  terms: string[];
  owner: string;
  platforms: string[];
  isActive: boolean;
  createdAt: string;
  matchedPostsCount: number;
}

export interface PostEnrichment {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  sentimentScores: {
    positive: number;
    neutral: number;
    negative: number;
  };
  entities: Array<{
    text: string;
    category: 'Organization' | 'Person' | 'Location' | 'Product' | 'Event';
  }>;
  keyPhrases: string[];
  lastEnrichedAt?: string;
}

export type IngestionSourceType =
  | 'facebook'
  | 'youtube'
  | 'instagram'
  | 'linkedin'
  | 'x'
  | 'blog'
  | 'gnews'
  | 'newswire'
  | 'tenant_owned_feed';

export interface Post {
  id: string;
  title: string;
  text: string;
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  url: string;
  provider: 'GNEWS' | 'NEWSWIRE' | 'TENANT_OWNED_FEED' | 'X' | 'LINKEDIN' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'BLOG' | string;
  sourceType?: IngestionSourceType;
  publishedAt: string;
  ingestedAt: string;
  ingestionRunId: string;
  matchedWatchlistId?: string;
  matchedWatchlistName?: string;
  enrichment: PostEnrichment;
  rawPayload: Record<string, any>;
  language?: string;
  location?: {
    country: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: 'tenant_admin' | 'tenant_user';
  status: 'Active' | 'Pending';
  accessEndsAt: string | null;
  joinedAt: string;
  lastActiveAt: string;
}

export interface InviteAssistCandidate {
  id: string;
  name: string;
  email: string;
  domain: string;
  attemptAt: string;
  status: 'pending' | 'invited' | 'dismissed';
}

export interface PlatformAdminAuditLog {
  id: string;
  timestamp: string;
  actor: string;
  operation:
    | 'tenant_create'
    | 'tenant_suspend'
    | 'tenant_resume'
    | 'seat_count_adjust'
    | 'break_glass_request'
    | 'break_glass_execute';
  targetTenant: string;
  targetTenantId: string;
  details: string;
  ipAddress: string;
}

export interface BreakGlassRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  requestedBy: string;
  reason: string;
  requestedAt: string;
  executedAt?: string;
  temporaryAccessPass?: string;
  status: 'pending' | 'executed';
}

export interface DbHealth {
  status: 'ok' | 'unavailable';
  latencyMs: number;
  activeConnections: number;
  maxConnections: number;
  poolSize: number;
  version: string;
  timestamp: string;
  uptime: string;
}
