import { SocialConnector } from '../types';

/**
 * Minimal reference SocialConnector (deliveryMode: 'poll') proving the framework
 * generalizes — not a real platform integration. See
 * .claude/skills/provider-connector-framework/SKILL.md.
 */
export const examplePollConnector: SocialConnector = {
  providerId: 'example-poll',
  authMode: 'api_key',
  deliveryMode: 'poll',

  getRateLimitConfig: () => ({ requestsPerWindow: 60, windowSeconds: 60 }),

  parseRateLimitHeaders: (headers) => {
    const remaining = headers['x-ratelimit-remaining'];
    return remaining !== undefined ? { requestsPerWindow: Number(remaining) } : undefined;
  },

  normalize: (rawItem) => {
    const item = rawItem as { id: string; text?: string };
    return {
      externalId: item.id,
      authorExternalId: 'unknown',
      publishedAt: new Date().toISOString(),
      rawPayload: rawItem,
    };
  },
};
