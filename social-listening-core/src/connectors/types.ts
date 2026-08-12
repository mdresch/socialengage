import { WatchlistTerms } from '../watchlists/types';
import { AstNodeType } from '../watchlists/ast';

export type AuthMode = 'oauth' | 'api_key' | 'none';

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowSeconds: number;
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

export interface SocialConnector extends ProviderConnector {
  readonly deliveryMode: DeliveryMode;
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
export interface AnalyzeResult {
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScores?: SentimentScores;
  entities?: EnrichmentEntity[];
  keyPhrases?: string[];
  detectedLanguage?: string;
  /** e.g. "azure-ai-language:2025-01-01" — which provider/model version actually produced this result. */
  modelUsed?: string;
  /**
   * Story 2.9 (ADR-0038) — an LLM-based provider's own self-reported
   * confidence (0.0-1.0) in its complete answer, after an explicit self-
   * review step (see azureOpenAiConnector.ts's own system prompt).
   * Deliberately a separate field from entities[].confidenceScore
   * (per-entity, and — for a calibrated-classifier provider like Azure AI
   * Language — a real statistical probability, not a self-assessment).
   * Never populated by azureAiLanguageConnector.ts; this directly answers
   * (for the LLM side only) the fitness-for-purpose question ADR-0038's
   * own Open Questions section named before this field existed: whether
   * self-reported confidence is comparable to a calibrated probability.
   * It isn't — callers reading this field should treat it as an LLM's own
   * self-assessment, not interchangeable with sentimentScores'/
   * confidenceScore's calibrated-probability semantics.
   */
  overallConfidence?: number;
}

export interface AIProviderConnector extends ProviderConnector {
  listModels(): string[];
  /** Per-model, not per-provider — ADR-0002's one exception to the shared contract. */
  getModelRateLimit(modelId: string): RateLimitConfig;
  getModelCapabilities(modelId: string): ModelCapabilities;
  /**
   * `credential` (Story 2.8) is additive and optional — a real provider's
   * own implementation needs the caller's resolved, decrypted credential to
   * authenticate; a stateless example/mock implementation (Story 2.1's own
   * fixtures) simply ignores it. Never resolved by analyze() itself — the
   * caller (e.g. enrichPost.ts) reads it from the tenant's own stored
   * credential first (ADR-0027: never a SocialEngage-held key).
   */
  analyze(modelId: string, text: string, credential?: string): Promise<AnalyzeResult>;
}
