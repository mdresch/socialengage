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

export interface AnalyzeResult {
  sentiment?: string;
  entities?: string[];
  keyPhrases?: string[];
  detectedLanguage?: string;
}

export interface AIProviderConnector extends ProviderConnector {
  listModels(): string[];
  /** Per-model, not per-provider — ADR-0002's one exception to the shared contract. */
  getModelRateLimit(modelId: string): RateLimitConfig;
  getModelCapabilities(modelId: string): ModelCapabilities;
  analyze(modelId: string, text: string): Promise<AnalyzeResult>;
}
