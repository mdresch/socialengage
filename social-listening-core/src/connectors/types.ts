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

export interface SocialConnector extends ProviderConnector {
  readonly deliveryMode: DeliveryMode;
  normalize(rawItem: unknown): NormalizedPost;
  /** Optional, authMode-agnostic hook — a specific connector's OAuth exchange
   * logic (if any) lives in its own implementation, not this interface. */
  getAuthHeaders?(credential: string): Record<string, string>;
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
