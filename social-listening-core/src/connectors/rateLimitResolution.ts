import { ProviderConnector, RateLimitConfig } from './types';

/**
 * Resolves the effective rate limit for any registered connector — social or AI —
 * dispatching purely on the ProviderConnector interface, never on a specific
 * providerId. This is the "core ingestion orchestration" piece Story 2.1's AC4
 * requires stay unedited as new connectors register (ADR-0002); Story 2.2's
 * RequestGate builds on it next. See
 * .claude/skills/provider-connector-framework/SKILL.md.
 */
export function resolveRateLimitConfig(
  connector: ProviderConnector,
  liveHeaders?: Record<string, string>
): RateLimitConfig {
  const declared = connector.getRateLimitConfig();
  if (!liveHeaders || !connector.parseRateLimitHeaders) {
    return declared;
  }
  const live = connector.parseRateLimitHeaders(liveHeaders);
  return { ...declared, ...live };
}
