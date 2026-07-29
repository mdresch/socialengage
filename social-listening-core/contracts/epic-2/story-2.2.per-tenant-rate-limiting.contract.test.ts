// Contract: Story 2.2 (ADR-0003) — per-tenant, per-provider rate limiting via a
// shared RequestGate.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-22--per-tenant-per-provider-rate-limiting
//
// Intent: Story 2.2 — Per-tenant, per-provider rate limiting (ADR-0003)
// Scope: src/connectors/requestGate.ts
// Contract to encode: (1) two tenants issuing requests to the same platform
// concurrently are gated independently — one hitting its limit never delays the
// other; (2) when a connector implements parseRateLimitHeaders(), the gate's
// enforcement reflects live reported state, taking priority over static declared
// config; (3) a request that would exceed the limit is queued and retried after
// window reset, never dropped — no code path in the gate rejects/discards a
// request, it only waits; (4) AI enrichment requests are gated per
// (tenantId, providerId, modelId), not just per provider — two models on the same
// provider with different limits are exhausted independently.
// Explicitly out of scope: bounded queue depth/TTL and dead-lettering (Story 2.4,
// ADR-0020, Blocked — pending acceptance); distributed gate state across more than
// one social-listening-core process instance (also Story 2.4, explicitly deferred
// per docs/implementation-plan.md's solo-project note — this is a single-process,
// in-memory gate); retryable-error classification around a gate wait (Story 2.3).

import { exampleAiProviderY } from '../../src/connectors/examples/exampleAiProviderY';
import {
  acquireForProvider,
  acquireForAiModel,
  __resetGateForTests,
} from '../../src/connectors/requestGate';
import { ProviderConnector } from '../../src/connectors/types';

jest.setTimeout(20000);

beforeEach(() => {
  __resetGateForTests();
});

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const tightConnector: ProviderConnector = {
  providerId: 'rate-limit-test-provider',
  authMode: 'api_key',
  getRateLimitConfig: () => ({ requestsPerWindow: 1, windowSeconds: 1 }),
};

// Static config is deliberately generous (10/1s) so the test can prove live
// headers are what actually tightens it to 1/1s — not examplePollConnector's
// 60-second window, which would make "waits for reset" take up to 60s to
// observe directly.
const liveHeaderConnector: ProviderConnector = {
  providerId: 'live-header-test-provider',
  authMode: 'api_key',
  getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
  parseRateLimitHeaders: (headers) => {
    const remaining = headers['x-ratelimit-remaining'];
    return remaining !== undefined ? { requestsPerWindow: Number(remaining) } : undefined;
  },
};

describe('Story 2.2 — per-tenant, per-provider RequestGate contract', () => {
  it('AC1: two tenants hitting the same platform are gated independently', async () => {
    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    await acquireForProvider(tenantA, tightConnector); // consumes tenant A's only slot

    const tenantBStart = process.hrtime.bigint();
    await acquireForProvider(tenantB, tightConnector); // must not wait on tenant A
    expect(elapsedMs(tenantBStart)).toBeLessThan(200);

    // Meanwhile tenant A's next request genuinely waits for its own window reset.
    const tenantASecondStart = process.hrtime.bigint();
    await acquireForProvider(tenantA, tightConnector);
    expect(elapsedMs(tenantASecondStart)).toBeGreaterThanOrEqual(700);
  });

  it('AC2: live parsed rate-limit headers take priority over static declared config', async () => {
    const tenantId = 'tenant-live-headers';
    // liveHeaderConnector declares a generous 10/1s statically; the live header
    // tightens requestsPerWindow to 1 for this window.
    await acquireForProvider(tenantId, liveHeaderConnector, { 'x-ratelimit-remaining': '1' });

    const secondStart = process.hrtime.bigint();
    await acquireForProvider(tenantId, liveHeaderConnector, { 'x-ratelimit-remaining': '1' });
    // With the static 10/1s config this would be instant; the live 1/1s value
    // instead forces a wait for window reset, proving live state won, not the
    // static declaration.
    expect(elapsedMs(secondStart)).toBeGreaterThanOrEqual(700);
  });

  it('AC3: a request past the limit is queued and retried after window reset, never dropped', async () => {
    const tenantId = 'tenant-queue-test';
    const results = await Promise.allSettled([
      acquireForProvider(tenantId, tightConnector),
      acquireForProvider(tenantId, tightConnector),
      acquireForProvider(tenantId, tightConnector),
    ]);

    // All three eventually resolve — none rejected/dropped.
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('AC4: AI enrichment requests are gated per (tenantId, providerId, modelId)', async () => {
    const tenantId = 'tenant-ai-models';
    const [modelWithMoreCapacity, modelWithLessCapacity] = exampleAiProviderY.listModels();
    expect(
      exampleAiProviderY.getModelRateLimit(modelWithLessCapacity).requestsPerWindow
    ).toBeLessThan(exampleAiProviderY.getModelRateLimit(modelWithMoreCapacity).requestsPerWindow);

    // Exhaust the lower-capacity model's window entirely.
    const lessCapacityLimit = exampleAiProviderY.getModelRateLimit(
      modelWithLessCapacity
    ).requestsPerWindow;
    for (let i = 0; i < lessCapacityLimit; i++) {
      await acquireForAiModel(tenantId, exampleAiProviderY, modelWithLessCapacity);
    }

    // The other model, same tenant and provider, is unaffected.
    const otherModelStart = process.hrtime.bigint();
    await acquireForAiModel(tenantId, exampleAiProviderY, modelWithMoreCapacity);
    expect(elapsedMs(otherModelStart)).toBeLessThan(200);
  });
});
