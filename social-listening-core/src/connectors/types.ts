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
