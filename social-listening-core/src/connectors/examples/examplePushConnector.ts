import { SocialConnector } from '../types';

/**
 * Minimal reference SocialConnector (deliveryMode: 'push') proving the framework
 * generalizes across delivery modes — not a real platform integration. Deliberately
 * has no parseRateLimitHeaders(): proving that's genuinely optional. See
 * .claude/skills/provider-connector-framework/SKILL.md.
 */
export const examplePushConnector: SocialConnector = {
  providerId: 'example-push',
  authMode: 'oauth',
  deliveryMode: 'push',

  getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 60 }),

  normalize: (rawItem) => {
    const item = rawItem as { id: string };
    return {
      externalId: item.id,
      authorExternalId: 'unknown',
      publishedAt: new Date().toISOString(),
      rawPayload: rawItem,
    };
  },
};
