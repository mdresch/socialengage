// Contract: Story 2.1 (ADR-0002) — unified ProviderConnector contract, specialized
// into SocialConnector and AIProviderConnector.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-21--unified-provider-connector-framework
//
// Intent: Story 2.1 — Unified provider connector framework (ADR-0002)
// Scope: src/connectors/types.ts, src/connectors/registry.ts,
// src/connectors/rateLimitResolution.ts, src/connectors/examples/*.ts
// Contract to encode: (1) ProviderConnector exposes providerId, authMode,
// getRateLimitConfig(), optional parseRateLimitHeaders(); (2) SocialConnector adds
// deliveryMode ('push'|'poll') and normalize(), and a poll-mode connector needs no
// push-specific support; (3) AIProviderConnector adds listModels(),
// getModelRateLimit(modelId), getModelCapabilities(modelId), analyze(); (4)
// registering a second reference connector of each kind requires no change to the
// shared rate-limit-resolution dispatcher (the "core ingestion orchestration" piece
// this story's AC4 names) — proven by running it generically over four registered
// connectors, and by live parsed headers taking priority over static config.
// Explicitly out of scope: any real platform/AI-provider integration (RSS/News,
// Reddit, Azure AI Language — Phase 1's "also build, not storied" work, layered on
// top of this framework once Stories 3.1-3.4 give it something to normalize into);
// RequestGate/rate-limit enforcement itself (Story 2.2, consumes
// resolveRateLimitConfig but doesn't live here); real OAuth token exchange (a
// specific connector's concern, not the generic framework's).

import {
  registerSocialConnector,
  registerAIProviderConnector,
  listSocialConnectors,
  listAIProviderConnectors,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import { resolveRateLimitConfig } from '../../src/connectors/rateLimitResolution';
import { examplePollConnector } from '../../src/connectors/examples/examplePollConnector';
import { examplePushConnector } from '../../src/connectors/examples/examplePushConnector';
import { exampleAiProviderX } from '../../src/connectors/examples/exampleAiProviderX';
import { exampleAiProviderY } from '../../src/connectors/examples/exampleAiProviderY';

beforeEach(() => {
  __resetRegistryForTests();
});

describe('Story 2.1 — provider connector framework contract', () => {
  it('AC1: ProviderConnector exposes providerId, authMode, getRateLimitConfig(), optional parseRateLimitHeaders()', () => {
    expect(examplePollConnector.providerId).toBe('example-poll');
    expect(examplePollConnector.authMode).toBe('api_key');
    expect(examplePollConnector.getRateLimitConfig()).toEqual(
      expect.objectContaining({
        requestsPerWindow: expect.any(Number),
        windowSeconds: expect.any(Number),
      })
    );
    expect(typeof examplePollConnector.parseRateLimitHeaders).toBe('function');
    expect(examplePushConnector.parseRateLimitHeaders).toBeUndefined();
  });

  it('AC2: a poll-mode SocialConnector declares deliveryMode "poll" and normalizes without any push-specific support', () => {
    expect(examplePollConnector.deliveryMode).toBe('poll');
    const normalized = examplePollConnector.normalize({ id: 'abc123', text: 'hello' });
    expect(normalized.externalId).toBe('abc123');
  });

  it('AC2: a push-mode SocialConnector declares deliveryMode "push"', () => {
    expect(examplePushConnector.deliveryMode).toBe('push');
    const normalized = examplePushConnector.normalize({ id: 'xyz789' });
    expect(normalized.externalId).toBe('xyz789');
  });

  it('AC3: AIProviderConnector exposes listModels(), getModelRateLimit(), getModelCapabilities(), analyze()', async () => {
    const models = exampleAiProviderX.listModels();
    expect(models.length).toBeGreaterThan(0);

    expect(exampleAiProviderX.getModelRateLimit(models[0])).toEqual(
      expect.objectContaining({
        requestsPerWindow: expect.any(Number),
        windowSeconds: expect.any(Number),
      })
    );
    expect(exampleAiProviderX.getModelCapabilities(models[0])).toEqual(
      expect.objectContaining({ supportsSentiment: expect.any(Boolean) })
    );

    const result = await exampleAiProviderX.analyze(models[0], 'hello world');
    expect(result).toBeDefined();
  });

  it('AC3: a second AIProviderConnector can have per-model rate limits that differ within the same provider', () => {
    const models = exampleAiProviderY.listModels();
    expect(models.length).toBeGreaterThanOrEqual(2);
    const limits = models.map((m) => exampleAiProviderY.getModelRateLimit(m).requestsPerWindow);
    expect(new Set(limits).size).toBeGreaterThan(1);
  });

  it('AC4: registering a second reference connector of each kind requires no change to resolveRateLimitConfig', () => {
    registerSocialConnector(examplePollConnector);
    registerSocialConnector(examplePushConnector);
    registerAIProviderConnector(exampleAiProviderX);
    registerAIProviderConnector(exampleAiProviderY);

    expect(listSocialConnectors()).toHaveLength(2);
    expect(listAIProviderConnectors()).toHaveLength(2);

    // The same generic dispatcher, unmodified, resolves a rate limit for every
    // registered connector — social or AI — with no providerId-specific branch.
    // This IS the "no pipeline edits" guarantee, exercised against all four at once.
    for (const connector of [...listSocialConnectors(), ...listAIProviderConnectors()]) {
      expect(resolveRateLimitConfig(connector).requestsPerWindow).toBeGreaterThan(0);
    }
  });

  it('AC4: live parsed rate-limit headers take priority over the static declared config', () => {
    const declared = examplePollConnector.getRateLimitConfig();
    const live = resolveRateLimitConfig(examplePollConnector, {
      'x-ratelimit-remaining': '5',
    });
    expect(live.requestsPerWindow).toBe(5);
    expect(live.requestsPerWindow).not.toBe(declared.requestsPerWindow);
  });
});
