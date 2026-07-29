import { SocialConnector } from '../types';

/**
 * Minimal reference SocialConnector implementing translateWatchlistQuery() —
 * proving the native-filtering path (ADR-0006), paired with
 * examplePollConnector (Story 2.1), which has no such capability, for the
 * fallback path. The OR-joined query string here is deliberately
 * illustrative, not a real platform's actual query grammar. See
 * .claude/skills/watchlist-matching/SKILL.md.
 */
export const exampleNativeFilterConnector: SocialConnector = {
  providerId: 'example-native-filter',
  authMode: 'api_key',
  deliveryMode: 'poll',

  getRateLimitConfig: () => ({ requestsPerWindow: 60, windowSeconds: 60 }),

  normalize: (rawItem) => {
    const item = rawItem as { id: string };
    return {
      externalId: item.id,
      authorExternalId: 'unknown',
      publishedAt: new Date().toISOString(),
      rawPayload: rawItem,
    };
  },

  translateWatchlistQuery: (terms) => {
    const clauses = [
      ...(terms.keywords ?? []),
      ...(terms.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`),
      ...(terms.accounts ?? []).map((a) => `from:${a}`),
    ];
    if (clauses.length === 0) {
      return { supported: false };
    }
    return { supported: true, queryParams: { q: clauses.join(' OR ') } };
  },
};
