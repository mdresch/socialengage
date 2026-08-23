// Contract: Story 2.26 (ADR-0073) — Connector Reply Framework and Outbound Rate Gate
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-226--connector-reply-framework-and-outbound-rate-gate
//
// Intent: Story 2.26 — Connector Reply Framework and Outbound Rate Gate (ADR-0073)
// Scope: src/connectors/types.ts, src/ingestion/errorClassification.ts,
//        src/connectors/requestGate.ts, src/outbound/outboundEngagementService.ts
// Contract to encode: (1) SocialConnector exposes an optional reply?() method;
// (2) outboundEngagementService.invoke() calls reply(), catches ClassifiableError,
// and maps successful/failed results to the outbound_activities row shape;
// (3) connectors without reply() fail with code 'reply_not_supported';
// (4) errorClassification.ts gains reply-specific ErrorKind values without changing
// ingestion classification; (5) RequestGate has a separate outbound gate per
// (tenantId, providerId) using getOutboundRateLimitConfig?() if present.
// Explicitly out of scope: Facebook/Instagram/LinkedIn-specific reply logic;
// outbound_activities table persistence (Story 3.14); GET /v1/posts/:id/replies;
// the REST endpoint.

import { SocialConnector } from '../../src/connectors/types';
import { ClassifiableError, isRetryable, isCredentialError } from '../../src/ingestion/errorClassification';
import { __resetGateForTests, acquireForOutbound, acquireForProvider } from '../../src/connectors/requestGate';
import { invoke } from '../../src/outbound/outboundEngagementService';

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

beforeEach(() => {
  __resetGateForTests();
});

const minimalPost = {
  id: 'p1',
  createdAt: '2024-01-01T00:00:00Z',
  rawPayload: {},
  publishedAt: '2024-01-01T00:00:00Z',
  enrichment: {},
  bodyMarkdown: 'Hello',
};

describe('Story 2.26 — connector reply framework and outbound rate gate', () => {
  it('AC1: SocialConnector accepts an optional reply?() method', () => {
    const withReply: SocialConnector = {
      providerId: 'replyable',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
      reply: async () => ({ externalId: 'r1', externalUrl: 'https://example.com/r1' }),
    };
    expect(withReply.reply).toBeDefined();
  });

  it('AC2: outboundEngagementService invokes reply() and returns a sent-shaped row', async () => {
    const connector: SocialConnector = {
      providerId: 'replyable',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      getOutboundRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
      reply: async (post, body, credential) => ({
        externalId: 'r1',
        externalUrl: `https://example.com/r1?body=${body}&credential=${credential}`,
      }),
    };

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      post: minimalPost,
      body: 'Nice post',
      credential: 'cred',
      connector,
    });

    expect(result.status).toBe('sent');
    expect(result.externalId).toBe('r1');
    expect(result.errorCode).toBeNull();
  });

  it('AC2: connectors without reply() fail with code reply_not_supported', async () => {
    const connector: SocialConnector = {
      providerId: 'no-reply',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
    };

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      post: minimalPost,
      body: 'Nice post',
      credential: 'cred',
      connector,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('reply_not_supported');
  });

  it('AC2: reply() throwing ClassifiableError maps to a failed row with the error kind', async () => {
    const connector: SocialConnector = {
      providerId: 'failing',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
      reply: async () => {
        throw new ClassifiableError('rate_limited', 'too many');
      },
    };

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      post: minimalPost,
      body: 'Nice post',
      credential: 'cred',
      connector,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('rate_limited');
  });

  it('AC3: errorClassification.ts gains reply-specific ErrorKinds without changing ingest handling', () => {
    const kinds: Array<'missing_permission' | 'post_not_found' | 'reconnect_required' | 'rate_limited'> = [
      'missing_permission',
      'post_not_found',
      'reconnect_required',
      'rate_limited',
    ];
    for (const kind of kinds) {
      const err = new ClassifiableError(kind, 'test');
      expect(err.kind).toBe(kind);
      expect(isRetryable(kind)).toBe(false);
      expect(isCredentialError(kind)).toBe(false);
    }
  });

  it('AC4: RequestGate tracks outbound calls separately from provider calls', async () => {
    const connector: SocialConnector = {
      providerId: 'tight',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      getOutboundRateLimitConfig: () => ({ requestsPerWindow: 1, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
    };

    const tenantId = 'tenant-tight';
    await acquireForOutbound(tenantId, connector);

    const outboundStart = process.hrtime.bigint();
    const outboundPromise = acquireForOutbound(tenantId, connector);

    const providerStart = process.hrtime.bigint();
    await acquireForProvider(tenantId, connector);
    expect(elapsedMs(providerStart)).toBeLessThan(200);

    await outboundPromise;
    expect(elapsedMs(outboundStart)).toBeGreaterThanOrEqual(700);
  });

  it('AC4: outbound gate falls back to getRateLimitConfig when getOutboundRateLimitConfig is absent', async () => {
    const connector: SocialConnector = {
      providerId: 'fallback',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 1, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
    };

    const tenantId = 'tenant-fallback';
    await acquireForOutbound(tenantId, connector);

    const secondStart = process.hrtime.bigint();
    await acquireForOutbound(tenantId, connector);
    expect(elapsedMs(secondStart)).toBeGreaterThanOrEqual(700);
  });
});
