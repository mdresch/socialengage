// Contract: Story 2.28 (ADR-0075, BRD-0075, FDD-0075) — Connector Publish Framework and Outbound Post Rate Gate
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-228--connector-publish-framework-and-outbound-post-rate-gate
//
// Intent: Story 2.28 — Connector Publish Framework and Outbound Post Rate Gate (ADR-0075)
// Scope: src/connectors/types.ts, src/ingestion/errorClassification.ts,
//        src/connectors/requestGate.ts, src/outbound/outboundPublishService.ts,
//        .claude/skills/outbound-post/SKILL.md
// Contract to encode: (1) SocialConnector exposes an optional publish?() method;
// (2) outboundPublishService.invoke() calls publish(), catches ClassifiableError,
// and maps successful/failed results to the outbound_activities 'post' row shape;
// (3) connectors without publish() fail with code 'publish_not_supported';
// (4) errorClassification.ts gains post-specific ErrorKind values without changing
// ingestion/reply classification; (5) RequestGate tracks outbound_post calls
// separately per (tenantId, providerId, 'outbound_post'), reusing
// getOutboundRateLimitConfig?() or getRateLimitConfig().
// Explicitly out of scope: Facebook/Instagram/LinkedIn-specific publish logic;
// outbound_activities table persistence (Story 3.15); GET /v1/outbound/posts;
// POST /v1/outbound/posts endpoint; scheduled dispatch processing; media upload.

import { SocialConnector, OutboundPostPayload } from '../../src/connectors/types';
import { ClassifiableError, isRetryable, isCredentialError } from '../../src/ingestion/errorClassification';
import {
  __resetGateForTests,
  acquireForOutbound,
  acquireForOutboundPost,
} from '../../src/connectors/requestGate';
import { invoke } from '../../src/outbound/outboundPublishService';

beforeEach(() => {
  __resetGateForTests();
});

const payload: OutboundPostPayload = {
  text: 'Hello world',
  targetAssetId: 'page-1',
  targetAssetType: 'facebook_page',
};

const credential = 'page-token-abc';

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

describe('Story 2.28 — connector publish framework and outbound post rate gate', () => {
  it('AC1: SocialConnector accepts an optional publish?() method', () => {
    const withPublish: SocialConnector = {
      providerId: 'publishable',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'p',
        authorExternalId: 'a',
        publishedAt: '2024-01-01T00:00:00Z',
        rawPayload: {},
      }),
      publish: async () => ({ externalId: 'post-1', externalUrl: 'https://example.com/post/1' }),
    };
    expect(withPublish.publish).toBeDefined();
  });

  it('AC2: outboundPublishService invokes publish() and returns a sent-shaped row', async () => {
    const connector: SocialConnector = {
      providerId: 'publishable',
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
      publish: async (tenantId, userId, p, cred) => ({
        externalId: 'post-1',
        externalUrl: `https://example.com/post/${p.targetAssetId}?tenant=${tenantId}&user=${userId}&cred=${cred}`,
      }),
    };

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      payload,
      credential,
      connector,
    });

    expect(result.status).toBe('sent');
    expect(result.activityType).toBe('post');
    expect(result.externalId).toBe('post-1');
    expect(result.errorCode).toBeNull();
    expect(result.postId).toBeNull();
    expect(result.targetAssetId).toBe('page-1');
    expect(result.targetAssetType).toBe('facebook_page');
  });

  it('AC2: connectors without publish() fail with code publish_not_supported', async () => {
    const connector: SocialConnector = {
      providerId: 'no-publish',
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
      payload,
      credential,
      connector,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('publish_not_supported');
    expect(result.activityType).toBe('post');
  });

  it('AC2: publish() throwing ClassifiableError maps to a failed row with the error kind', async () => {
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
      publish: async () => {
        throw new ClassifiableError('rate_limited', 'too many');
      },
    };

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      payload,
      credential,
      connector,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('rate_limited');
  });

  it('AC3: errorClassification.ts gains post-specific ErrorKinds without changing ingest/reply handling', () => {
    const kinds: Array<'missing_permission' | 'target_asset_not_found' | 'reconnect_required' | 'rate_limited' | 'media_not_supported' | 'publish_not_supported'> = [
      'missing_permission',
      'target_asset_not_found',
      'reconnect_required',
      'rate_limited',
      'media_not_supported',
      'publish_not_supported',
    ];
    for (const kind of kinds) {
      const err = new ClassifiableError(kind, 'test');
      expect(err.kind).toBe(kind);
      expect(isRetryable(kind)).toBe(false);
      expect(isCredentialError(kind)).toBe(false);
    }
  });

  it('AC4: RequestGate tracks outbound_post calls separately from outbound (reply) calls', async () => {
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
    // Exhaust the reply 'outbound' key's single token.
    await acquireForOutbound(tenantId, connector);

    // The 'outbound_post' key is untouched and should acquire immediately.
    const postStart = process.hrtime.bigint();
    await acquireForOutboundPost(tenantId, connector);
    expect(elapsedMs(postStart)).toBeLessThan(200);

    // A second reply 'outbound' call must wait for the window to reset.
    const outboundStart = process.hrtime.bigint();
    await acquireForOutbound(tenantId, connector);
    expect(elapsedMs(outboundStart)).toBeGreaterThanOrEqual(700);
  });

  it('AC4: outbound_post gate falls back to getRateLimitConfig when getOutboundRateLimitConfig is absent', async () => {
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
    await acquireForOutboundPost(tenantId, connector);

    const secondStart = process.hrtime.bigint();
    await acquireForOutboundPost(tenantId, connector);
    expect(elapsedMs(secondStart)).toBeGreaterThanOrEqual(700);
  });
});
