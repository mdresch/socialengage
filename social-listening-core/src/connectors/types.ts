import { WatchlistTerms } from '../watchlists/types';
import { AstNodeType, AstNode } from '../watchlists/ast';
import { RunIngestionAttemptResult } from '../ingestion/runIngestionAttempt';
import { SocialPostSummary } from '../posts/socialPostStore';

export type AuthMode = 'oauth' | 'api_key' | 'none';

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowSeconds: number;
}

/**
 * Story 9.1 (ADR-0077) — the canonical boolean-query AST, surfaced under the
 * ADR's own name so connector `count?()`/`sample?()` signatures read exactly
 * as the ADR's decision text writes them. An alias, not a second
 * representation: it is `AstNode` from `src/watchlists/ast.ts`, unchanged.
 */
export type WatchlistAST = AstNode;

/**
 * Story 9.1 (ADR-0077) — a half-open time window passed to `count?()` /
 * `sample?()`. ISO 8601 strings, either bound optional. The preview
 * controller defaults a fully-unspecified window to a 7-day look-back when
 * extrapolating a sample.
 */
export interface TimeWindow {
  start?: string;
  end?: string;
}

/**
 * Story 9.1 (ADR-0077) — the context handed to `count?()` / `sample?()`.
 * `mode: 'preview'` / `isDryRun: true` is the preview controller's signal to
 * the connector that this call must not mutate cursors, watermarks,
 * checkpoints, or high-water-marks, and that fetched posts are discarded
 * after counting (ADR-0077 §2). `tenantId` is the resolved, token-authenticated
 * caller's tenant — never a client-supplied value.
 */
export interface ConnectorContext {
  tenantId: string;
  mode?: 'preview' | 'live';
  isDryRun?: boolean;
}

/**
 * Story 9.1 (ADR-0077 §1) — the result of a connector's optional `count?()`.
 * `count` is the platform's own total-results figure (or, for the fallback
 * sample path, the extrapolated estimate); `confidence` is `'exact'` when the
 * platform reported a real total and `'estimate'` when derived. `rateLimitCost`
 * is the API request units the preview check itself consumed (a separate
 * `projectedIngestionRateLimitCost` field would carry future ingestion cost —
 * not built in v1). `unsupportedOperators` lets the connector report AST
 * operators it could not evaluate, feeding the `unsupported_query` warning.
 */
export interface ConnectorCountResult {
  count: number;
  confidence: 'exact' | 'estimate';
  sampleSize?: number;
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}

/**
 * Story 9.1 (ADR-0077 §3) — the result of a connector's optional `sample?()`,
 * the no-side-effect preview fallback for connectors without `count?()`. The
 * preview controller extrapolates from `posts`' publishedAt span against the
 * requested time window; a sample smaller than the bounded preview size
 * (default 50) is the exact count for that window.
 */
export interface ConnectorSampleResult {
  posts: NormalizedPost[];
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}

/**
 * Shared base every connector — social platform or AI provider — implements
 * (ADR-0002). See .claude/skills/provider-connector-framework/SKILL.md.
 */
export interface ProviderConnector {
  readonly providerId: string;
  readonly authMode: AuthMode;
  getRateLimitConfig(): RateLimitConfig;
  /** Optional: not every platform reports live rate-limit state. */
  parseRateLimitHeaders?(headers: Record<string, string>): Partial<RateLimitConfig> | undefined;
}

export type DeliveryMode = 'push' | 'poll';

export interface NormalizedPost {
  externalId: string;
  authorExternalId: string;
  publishedAt: string;
  rawPayload: unknown;
  /**
   * Story 3.9 (ADR-0049): the author's follower count as reported by the
   * platform alongside this specific post, at this specific moment —
   * optional and omitted entirely by connectors that don't report it (see
   * SocialConnector.canProvideFollowerCountAtPublish below). Never derived
   * from Author.followerCount; a point-in-time snapshot only.
   */
  authorFollowerCountAtPublish?: number;
}

export interface NativeQueryTranslation {
  supported: boolean;
  queryParams?: Record<string, string>;
}

/**
 * Story 13.9 (ADR-0115) — a single asset attached to an outbound post.
 * `mediaId` references the tenant's `media_assets` table; `url` is a 24-hour
 * presigned Blob URL resolved by the publishing service before dispatch.
 */
export interface OutboundAsset {
  type: 'image' | 'video' | 'link-card';
  mediaId?: string;
  url?: string;
  imageUrl?: string;
  alt?: string;
  target?: string;
}

/**
 * Story 2.28 (ADR-0075) / Story 13.9 (ADR-0115) — payload for a new outbound
 * post. Carries the final text, per-asset targeting, optional per-platform
 * overrides, and a resolved `assets` array with presigned media URLs.
 */
export interface OutboundPostPayload {
  text: string;
  perPlatformOverrides?: Record<string, string>;
  media?: unknown[];
  linkPreview?: unknown;
  assets?: OutboundAsset[];
  assetTargets?: Record<string, string>;
  targetAssetId: string;
  targetAssetType: string;
}

export interface OutboundActivitySummary {
  id: string;
  tenantId: string;
  userId: string;
  providerId: string;
  activityType: 'post' | 'reply' | string;
  targetAssetId: string | null;
  targetAssetType?: string | null;
  externalId: string | null;
  externalUrl?: string | null;
  body?: string;
  payload?: Record<string, unknown> | null;
}

export interface SocialConnector extends ProviderConnector {
  readonly deliveryMode: DeliveryMode;
  readonly sourceType?: SocialConnectorCapabilities['sourceType'];
  normalize(rawItem: unknown): NormalizedPost;
  /** Optional, authMode-agnostic hook — a specific connector's OAuth exchange
   * logic (if any) lives in its own implementation, not this interface. */
  getAuthHeaders?(credential: string): Record<string, string>;
  /** Optional: platforms with native query filtering translate a Watchlist's
   * terms (ADR-0006). Omitting this (or returning { supported: false }) falls
   * back to post-fetch matching — see src/watchlists/dispatch.ts. */
  translateWatchlistQuery?(terms: WatchlistTerms): NativeQueryTranslation;
  /** AST node types this platform's native query filtering can express
   * (Story 3.6, ADR-0021). Missing/omitted is treated as supporting none —
   * a connector must opt in explicitly. Checked against a parsed
   * booleanQuery's node types by resolveWatchlistAstDispatch(); missing even
   * one degrades the whole query to fallback (not just the unsupported
   * clause). See .claude/skills/watchlist-matching/SKILL.md. */
  supportedQueryFeatures?: AstNodeType[];
  /**
   * Story 3.9 (ADR-0049 §Implementation defaults, Open Question 5) — the
   * connector-level capability declaration resolving "how does a connector
   * signal it provides follower-count-at-publish," analogous in shape to
   * supportedQueryFeatures above. Missing/omitted/false means the
   * connector's normalize() output never sets NormalizedPost's own
   * authorFollowerCountAtPublish field — the same "must opt in explicitly"
   * discipline supportedQueryFeatures already establishes. Not required to
   * be true even when set: a connector may declare it and still return
   * undefined for a specific post whose platform payload omitted the value
   * (the "platform-omitted null" case named on the migration's own column
   * comment) — this flag only says the connector *can*, not that it always
   * *will*.
   */
  canProvideFollowerCountAtPublish?: boolean;
  /**
   * Story 2.26 (ADR-0073) — optional outbound reply/comment capability. Connectors
   * that do not implement it fail with `reply_not_supported` through the
   * outbound service.
   */
  getOutboundRateLimitConfig?(): RateLimitConfig;
  /**
   * Story 3.15 (ADR-0075) — optional per-user asset enumeration used to
   * validate `targetAssetId` before dispatch. Returns an array of asset
   * identifiers (strings) or objects with `id` and `type`.
   */
  targetAssets?(
    tenantId: string,
    userId: string,
    credential: string
  ): Promise<Array<string | { id: string; type: string }>> | Array<string | { id: string; type: string }>;
  reply?(post: SocialPostSummary, body: string, credential: string): Promise<{ externalId: string; externalUrl: string }>;
  /**
   * Story 2.28 (ADR-0075) — optional outbound post/publish capability. Connectors
   * that do not implement it fail with `publish_not_supported` through the
   * outbound post service.
   */
  publish?(
    tenantId: string,
    userId: string,
    payload: OutboundPostPayload,
    credential: string
  ): Promise<{ externalId: string; externalUrl: string }>;
  /**
   * Story 14.2 (ADR-0119) — optional outbound post/activity edit capability.
   * Connectors that do not implement it fail with `edit_not_supported` (422).
   */
  edit?(
    activity: OutboundActivitySummary,
    body: string,
    payload?: OutboundPostPayload,
    credential?: string
  ): Promise<{ externalId?: string; externalUrl?: string }>;
  /**
   * Story 14.2 (ADR-0119) — optional outbound post/activity delete capability.
   * Connectors that do not implement it fail with `delete_not_supported` (422).
   */
  delete?(
    activity: OutboundActivitySummary,
    credential?: string
  ): Promise<{ externalId?: string; externalUrl?: string }>;
  /**
   * Story 1.13 (ADR-0052 Decision §4) — present only on connectors with
   * deliveryMode: 'poll'. The scheduler's one generic invocation surface —
   * getSocialConnector(platformId)?.poll?.(tenantId), never a hardcoded
   * per-providerId switch/map (ADR-0048's own "no core pipeline change for
   * new connector registration" guardrail). Each real poll connector's own
   * registration (bootstrapConnectors.ts) delegates this unchanged to its
   * already-existing, already-contract-verified pollX() function — see
   * .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
   */
  poll?(tenantId: string): Promise<RunIngestionAttemptResult>;
  /**
   * Story 1.13 (ADR-0052 Decision §4/§5) — this connector's own poll
   * cadence in milliseconds, the scheduler's sole source for "how often":
   * never a second, separately-maintained cadence table inside the
   * scheduler itself, which would drift the moment a connector's own
   * registration changed its cadence without a matching scheduler edit.
   */
  pollCadenceMs?: number;
  /**
   * Story 1.15 (ADR-0061 Decision §3) — the Tier-3 (user-bound) analogue of
   * `poll`, for connectors with no tenant-wide activation path at all
   * (Facebook, ADR-0059 Decision §4, is the first). A distinct method, not
   * an overload of `poll` — TypeScript can't express two differently-shaped
   * optional methods under one name — and never present alongside `poll`
   * on the same connector: a connector is tenant-wide-pollable or
   * user-bound-pollable, never both. The scheduler's own separate per-user
   * enumeration loop (`.claude/skills/live-ingestion-polling-scheduler/SKILL.md`)
   * is the only caller.
   */
  pollUser?(tenantId: string, userId: string): Promise<RunIngestionAttemptResult>;
  /**
   * Story 13.1 (ADR-0109) — optional dedicated health-check method used by the
   * manual re-enable flow (`POST /v1/connectors/:platformId/enable`). If a
   * connector implements this, `runConnectorHealthCheck()` delegates to it and
   * the run is opened with `trigger_type='health_check'` from the start. If a
   * connector omits this, the re-enable endpoint falls back to
   * `connector.poll()` / `connector.pollUser()` and rewrites the run's
   * `trigger_type` after the fact.
   */
  healthCheck?(tenantId: string, userId?: string): Promise<RunIngestionAttemptResult>;
  /**
   * Story 9.1 (ADR-0077 §1) — optional per-connector post-count estimate for
   * the watchlist volume preview. Connectors whose platform exposes a
   * total-results field (GNews `totalArticles`, Brave/Bing page counts)
   * implement this returning `confidence: 'exact'`; connectors that cannot
   * count simply omit it and the preview controller falls back to
   * `sample?()`. The method receives the same `WatchlistAST` and
   * `timeWindow` used for `poll()`, must be tenant-scoped, and must use the
   * connector's existing credentials and `RequestGate`. See
   * .claude/skills/watchlist-matching/SKILL.md and
   * .claude/skills/provider-connector-framework/SKILL.md.
   */
  count?(ctx: ConnectorContext, args: { ast: WatchlistAST; timeWindow: TimeWindow }): Promise<ConnectorCountResult>;
  /**
   * Story 9.1 (ADR-0077 §2/§3) — optional bounded preview sample, the
   * no-side-effect fallback for connectors without `count?()`. The preview
   * controller passes `mode: 'preview'` / `isDryRun: true` in `ctx`; the
   * connector must skip watermark/cursor/checkpoint updates and must not
   * persist fetched posts. `limit` is the bounded preview size (default 50).
   */
  sample?(
    ctx: ConnectorContext,
    args: { ast: WatchlistAST; timeWindow: TimeWindow; limit: number }
  ): Promise<ConnectorSampleResult>;
  /**
   * Story 12.1 (ADR-0101) — optional explicit capability matrix method.
   */
  getCapabilities?(tenantId?: string): SocialConnectorCapabilities;
}

/**
 * Story 12.1 (ADR-0101) — Unified capability declaration for social & news connectors.
 */
export interface SocialConnectorCapabilities {
  sourceType: 'social' | 'news' | 'forum' | 'review' | 'broadcast' | 'blog' | 'wiki';
  poll: boolean | { cadenceMs: number; supportsTimeWindow: boolean };
  count?: { supportsExactCount: boolean };
  publish?: { supportsScheduling: boolean; supportedAssetTypes: string[] };
  reply?: boolean;
  backfill?: { supportsHistorical: boolean; maxLookbackDays: number };
}

export interface ModelCapabilities {
  supportsSentiment: boolean;
  supportsEntities: boolean;
  supportsKeyPhrases: boolean;
  supportsLanguageDetection: boolean;
}

/** A single named entity Azure AI Language (or any AIProviderConnector) recognized in a text. */
export interface EnrichmentEntity {
  text: string;
  category: string;
  confidenceScore: number;
}

export interface SentimentScores {
  positive: number;
  neutral: number;
  negative: number;
}

/**
 * Story 12.5 (ADR-0103) — Aspect-based sentiment breakdown.
 */
export interface SentimentAspect {
  aspect: string;
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  evidence: string;
}

export interface SentimentOverridden {
  by: string;
  at: string;
  reason?: string;
  previousValue?: {
    overall: string;
    confidence: number;
  };
}

export interface PostSentimentEnrichment {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  language: string;
  aspects?: SentimentAspect[];
  overridden?: SentimentOverridden;
}

/**
 * Story 2.8 (ADR-0038) — widened from its original, never-yet-implemented-
 * against-a-real-provider shape (sentiment?: string; entities?: string[]) to
 * match what a real provider's own output actually looks like — confirmed
 * directly against real Azure AI Language responses, not assumed. Purely
 * additive: every existing field's own name is unchanged, `entities`'
 * element type is the only breaking shape change, and every prior caller of
 * `analyze()` (Story 2.1's own contract, both example providers) continues
 * to compile and pass unmodified. See
 * .claude/skills/azure-ai-language-connector/SKILL.md.
 */
export interface ResearchResult {
  keyPhrases: string[];
  relatedTopics: string[];
  searchQueries: string[];
  contextSummary: string;
  comparison: string;
}

/**
 * Story 13.7 (ADR-0113) — structured result of a metric-explainability call.
 */
export interface AIExplainResult {
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ResearchOptions {
  maxKeyPhrases: number;
  maxRelatedTopics: number;
  maxSearchQueries: number;
}

export interface SearchSnippet {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

/**
 * Story 12.7 (ADR-0104) — AI topic extraction result.
 */
export interface ExtractedTopic {
  name: string;
  confidence: number;
}

export interface AnalyzeResult {
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScores?: SentimentScores;
  /** Story 12.5 (ADR-0103) — aspect-based sentiment breakdown. */
  aspects?: SentimentAspect[];
  sentimentObject?: PostSentimentEnrichment;
  /** Story 12.7 (ADR-0104) — extracted topics. */
  topics?: ExtractedTopic[];
  entities?: EnrichmentEntity[];
  keyPhrases?: string[];
  detectedLanguage?: string;
  /** e.g. "azure-ai-language:2025-01-01" — which provider/model version actually produced this result. */
  modelUsed?: string;
  overallConfidence?: number;
  summary?: string;
  /** Story 2.20 (ADR-0064) — ISO 3166-1 alpha-2 country code (e.g. "US", "GB", "NL"). */
  geoCountry?: string | null;
  /** Story 2.20 (ADR-0064) — English country name (e.g. "United States", "United Kingdom"). */
  geoCountryName?: string | null;
  /** Story 2.20 (ADR-0064) — optional sub-region (e.g. "EU", "NA"). */
  geoRegion?: string | null;
  /** Story 2.20 (ADR-0064) — provenance of the country signal: post, source, inferred, or unknown. */
  geoSource?: 'post' | 'source' | 'inferred' | 'unknown' | null;
  /** Story 2.20 (ADR-0064) — confidence level of the country mapping: high, medium, low. */
  geoConfidence?: 'high' | 'medium' | 'low' | null;
}

export interface AIProviderConnector extends ProviderConnector {
  listModels(): string[];
  /** Per-model, not per-provider — ADR-0002's one exception to the shared contract. */
  getModelRateLimit(modelId: string): RateLimitConfig;
  getModelCapabilities(modelId: string): ModelCapabilities;
  analyze(modelId: string, text: string, credential?: string): Promise<AnalyzeResult>;
  /**
   * Story 12.5 (ADR-0103) — optional aspect-based sentiment analyzer.
   */
  analyzeSentiment?(text: string, language?: string, credential?: string): Promise<PostSentimentEnrichment>;
  /**
   * Story 12.7 (ADR-0104) — optional topic clustering/extraction.
   */
  extractTopics?(text: string, language?: string, credential?: string): Promise<ExtractedTopic[]>;
  /**
   * Story 2.32 (ADR-0076) — optional deep-research capability. Only
   * generative providers (Azure OpenAI in v1) implement it; classifiers
   * such as Azure AI Language correctly leave it undefined.
   */
  research?(
    text: string,
    searchSnippets: SearchSnippet[],
    options: ResearchOptions,
    credential?: string
  ): Promise<ResearchResult>;

  /**
   * Story 13.7 (ADR-0113) — optional metric-explainability call. Generative
   * providers (Azure OpenAI in v1) return a one-to-two-sentence explanation
   * and a high/medium/low confidence grade. The caller supplies the fully
   * rendered prompt, the credential, and deterministic model parameters.
   */
  explain?(
    text: string,
    credential?: string,
    options?: { seed?: number; promptVersion?: number }
  ): Promise<AIExplainResult>;
}

/**
 * Story 14.3 (ADR-0120) — standardized request shape for one-off search.
 */
export interface SearchRequest {
  q: string;
  limit?: number; // default 5, hard cap 10
  freshness?: 'any' | 'day' | 'week' | 'month';
  market?: string; // optional ISO country/language hint (e.g. 'en-US')
}

/**
 * Story 14.3 (ADR-0120) — standardized individual search result item.
 */
export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

/**
 * Story 14.3 (ADR-0120) — standardized response shape for one-off search.
 */
export interface SearchResponse {
  results: SearchItem[];
}

/**
 * Story 14.3 (ADR-0120) — shared interface for on-demand one-off search providers.
 */
export interface SearchProviderConnector {
  readonly providerId: string;
  search?(ctx: ConnectorContext, request: SearchRequest): Promise<SearchResponse>;
  getRateLimitConfig?(): RateLimitConfig;
  getSearchRateLimitConfig?(): RateLimitConfig;
}

