// Contract: Story 9.1 (ADR-0077) — Watchlist connector count and preview volume endpoint
// See docs/user-stories/epic-9-adr-0077-to-0085.md#story-91
//
// Intent: Story 9.1 — Watchlist connector count and preview volume endpoint (ADR-0077, Accepted 2026-08-23)
// Scope:
//   src/connectors/types.ts (add optional count?()/sample?() to SocialConnector, ConnectorCountResult,
//     ConnectorSampleResult, ConnectorContext, TimeWindow, WatchlistAST alias),
//   src/connectors/requestGate.ts (add checkAvailability / checkProviderAvailability pre-check),
//   src/connectors/gnews/gnewsConnector.ts (implement count?() via GNews totalArticles field + countGNewsSearch helper),
//   src/watchlists/previewVolumeService.ts (new — concurrent per-connector previews, fallback extrapolation,
//     high_volume/quota_risk/unsupported_query warnings, partial-failure isolation),
//   src/http/versions/v1/watchlistsRouter.ts (POST /preview-volume route),
//   .claude/skills/provider-connector-framework/SKILL.md, .claude/skills/watchlist-matching/SKILL.md
// Contract to encode:
//   AC1: SocialConnector exposes an optional count?() returning ConnectorCountResult
//        (count, confidence, sampleSize?, rateLimitCost?, unsupportedOperators?); a connector
//        without count?() is still a valid SocialConnector.
//   AC2: at least one existing connector (gnews) implements count?() using the platform's
//        total-results (totalArticles) field, returning confidence 'exact'.
//   AC3: connectors without count?() fall back to a bounded preview sample (default 50) via
//        sample?() and extrapolate; a sample smaller than 50 is the exact count for that window
//        (confidence 'exact'); preview calls pass mode 'preview' / isDryRun true and do not
//        update cursors or watermarks (proven structurally — sample?() is the no-side-effect path).
//   AC4: POST /v1/watchlists/preview-volume is tenant-scoped, RLS-gated, and returns
//        WatchlistVolumePreview with totalEstimatedPosts and a breakdown whose items carry
//        estimatedPosts, confidence, sampleSize?, rateLimitCost, warning, errorCode?, errorMessage?.
//   AC5: connector previews run concurrently; a single connector failure is returned as
//        confidence 'unavailable' with errorCode and errorMessage without failing the HTTP request.
//   AC6: high_volume (>100,000 estimated posts), quota_risk (RequestGate.checkAvailability
//        pre-check, >80% of remaining budget), and unsupported_query (AST operators the connector
//        cannot evaluate) warnings are triggered per ADR-0077's thresholds.
//   AC7: contract tests cover exact count, estimate, fallback, unavailable partial failure,
//        and cross-tenant 404/403 behavior.
// Explicitly out of scope:
//   - Rewriting every real connector's poll() to honor a preview/dry-run mode — the sample?()
//     path is the sanctioned no-side-effect preview mechanism; connectors without count?() or
//     sample?() report 'preview_not_supported' rather than mutating the live poll() pipeline
//     (ADR-0077 §2/§3, documented as a known gap in the component SKILL.md).
//   - Real outbound GNews API calls — countGNewsSearch() is exercised against a mocked fetch
//     reading totalArticles, proving the total-results-field path without a live API key.
//   - projectedIngestionRateLimitCost (ADR-0077 §1) — a separate future-cost field, not built here.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import {
  registerSocialConnector,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import { __resetGateForTests, acquire } from '../../src/connectors/requestGate';
import { SocialConnector, NormalizedPost } from '../../src/connectors/types';
import { gnewsConnector, countGNewsSearch } from '../../src/connectors/gnews/gnewsConnector';
import { parseBooleanQuery, AstNode } from '../../src/watchlists/ast';
import { previewWatchlistVolume } from '../../src/watchlists/previewVolumeService';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetRegistryForTests();
  __resetGateForTests();
});

const NOW = Date.parse('2026-08-23T12:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function makePosts(count: number, spanMs: number): NormalizedPost[] {
  const posts: NormalizedPost[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? NOW : NOW - spanMs * (i / (count - 1));
    posts.push({
      externalId: `p-${i}`,
      authorExternalId: `a-${i}`,
      publishedAt: iso(t),
      rawPayload: {},
    });
  }
  return posts;
}

// --- Test connectors -------------------------------------------------------

const TERM_AST: AstNode = { type: 'TERM', value: 'technology' };

function countConnector(
  providerId: string,
  result: { count: number; confidence: 'exact' | 'estimate'; rateLimitCost?: number; unsupportedOperators?: string[] }
): SocialConnector {
  return {
    providerId,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    count: async () => result,
  };
}

function sampleConnector(providerId: string, posts: NormalizedPost[]): SocialConnector {
  return {
    providerId,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    sample: async () => ({ posts, rateLimitCost: 1 }),
  };
}

function failingConnector(providerId: string): SocialConnector {
  return {
    providerId,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    count: async () => {
      throw new Error('platform down');
    },
  };
}

function unsupportedConnector(providerId: string): SocialConnector {
  return {
    providerId,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    // Declares support for nothing — any AST with a TERM/HASHTAG/ACCOUNT is unsupported.
    supportedQueryFeatures: [],
  };
}

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

// --- AC1: interface --------------------------------------------------------

describe('Story 9.1 — AC1: SocialConnector.count?() is optional and returns ConnectorCountResult', () => {
  it('a connector without count?() is a valid SocialConnector (count is undefined)', () => {
    const withoutCount: SocialConnector = {
      providerId: 'no-count',
      authMode: 'api_key',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 60 }),
      normalize: (raw) => raw as NormalizedPost,
    };
    expect(withoutCount.count).toBeUndefined();
  });

  it('a connector with count?() returns a ConnectorCountResult with the required fields', async () => {
    const c = countConnector('ac1-count', { count: 42, confidence: 'exact', rateLimitCost: 1 });
    const result = await c.count!({ tenantId: 't', mode: 'preview', isDryRun: true }, { ast: TERM_AST, timeWindow: {} });
    expect(result.count).toBe(42);
    expect(result.confidence).toBe('exact');
    expect(result.rateLimitCost).toBe(1);
    expect(result.sampleSize).toBeUndefined();
    expect(result.unsupportedOperators).toBeUndefined();
  });
});

// --- AC2: gnews implements count?() via totalArticles ----------------------

describe('Story 9.1 — AC2: gnews implements count?() using the total-results field', () => {
  it('gnewsConnector.count is a function', () => {
    expect(typeof gnewsConnector.count).toBe('function');
  });

  it('countGNewsSearch reads totalArticles and returns confidence exact', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ totalArticles: 1337, articles: [] }),
    } as Response);

    try {
      const result = await countGNewsSearch('technology', 'dummy-key');
      expect(result.count).toBe(1337);
      expect(result.confidence).toBe('exact');
      expect(result.rateLimitCost).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// --- AC3: fallback to bounded preview sample + extrapolation ---------------

describe('Story 9.1 — AC3: fallback to bounded preview sample (default 50) and extrapolation', () => {
  it('a full 50-post sample over 1h extrapolates to confidence estimate over a 24h window', async () => {
    registerSocialConnector(sampleConnector('test-sample', makePosts(50, HOUR_MS)));
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac3',
      ast: TERM_AST,
      connectorIds: ['test-sample'],
      timeWindow: { start: iso(NOW - 24 * HOUR_MS), end: iso(NOW) },
    });
    const item = preview.breakdown[0];
    expect(item.confidence).toBe('estimate');
    expect(item.sampleSize).toBe(50);
    expect(item.rateLimitCost).toBe(1);
    // 50 posts / 1h cadence * 24h window = 1200
    expect(item.estimatedPosts).toBe(1200);
  });

  it('a sample smaller than 50 is the exact count for that window', async () => {
    registerSocialConnector(sampleConnector('test-sample-exact', makePosts(10, HOUR_MS)));
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac3',
      ast: TERM_AST,
      connectorIds: ['test-sample-exact'],
      timeWindow: { start: iso(NOW - 24 * HOUR_MS), end: iso(NOW) },
    });
    const item = preview.breakdown[0];
    expect(item.confidence).toBe('exact');
    expect(item.estimatedPosts).toBe(10);
    expect(item.sampleSize).toBe(10);
  });

  it('preview calls pass mode preview / isDryRun true to sample?()', async () => {
    let capturedCtx: { mode?: string; isDryRun?: boolean } | undefined;
    const connector: SocialConnector = {
      providerId: 'ctx-check',
      authMode: 'api_key',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
      normalize: (raw) => raw as NormalizedPost,
      supportedQueryFeatures: ['TERM'],
      sample: async (ctx) => {
        capturedCtx = ctx;
        return { posts: makePosts(10, HOUR_MS), rateLimitCost: 1 };
      },
    };
    registerSocialConnector(connector);
    await previewWatchlistVolume({
      tenantId: 't-ac3',
      ast: TERM_AST,
      connectorIds: ['ctx-check'],
      timeWindow: {},
    });
    expect(capturedCtx!.mode).toBe('preview');
    expect(capturedCtx!.isDryRun).toBe(true);
  });
});

// --- AC5: concurrent previews, partial failure isolated --------------------

describe('Story 9.1 — AC5: a single connector failure is unavailable, not a request failure', () => {
  it('returns unavailable for the failing connector alongside a healthy one', async () => {
    registerSocialConnector(countConnector('healthy', { count: 7, confidence: 'exact', rateLimitCost: 1 }));
    registerSocialConnector(failingConnector('broken'));
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac5',
      ast: TERM_AST,
      connectorIds: ['healthy', 'broken'],
      timeWindow: {},
    });
    const byId = Object.fromEntries(preview.breakdown.map((b) => [b.connectorId, b]));
    expect(byId.healthy.confidence).toBe('exact');
    expect(byId.healthy.estimatedPosts).toBe(7);
    expect(byId.broken.confidence).toBe('unavailable');
    expect(byId.broken.errorCode).toBeDefined();
    expect(byId.broken.errorMessage).toBeDefined();
    expect(preview.totalEstimatedPosts).toBe(7);
  });
});

// --- AC6: warnings ---------------------------------------------------------

describe('Story 9.1 — AC6: high_volume, quota_risk, unsupported_query warnings', () => {
  it('high_volume warning when estimated posts > 100,000', async () => {
    registerSocialConnector(countConnector('hv', { count: 150000, confidence: 'estimate' }));
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac6',
      ast: TERM_AST,
      connectorIds: ['hv'],
      timeWindow: {},
    });
    expect(preview.breakdown[0].warning).toBe('high_volume');
    expect(preview.breakdown[0].estimatedPosts).toBe(150000);
  });

  it('quota_risk warning via RequestGate.checkAvailability pre-check when >80% of remaining budget', async () => {
    const connector = countConnector('quota', { count: 5, confidence: 'exact', rateLimitCost: 1 });
    // Override to a tiny budget so we can drain it.
    (connector as SocialConnector).getRateLimitConfig = () => ({ requestsPerWindow: 5, windowSeconds: 3600 });
    registerSocialConnector(connector);
    const key = 't-ac6:quota';
    const config = { requestsPerWindow: 5, windowSeconds: 3600 };
    // Drain 4 of 5 so only 1 remains — a 1-unit preview is 100% of remaining (>80%).
    for (let i = 0; i < 4; i++) {
      await acquire(key, config);
    }
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac6',
      ast: TERM_AST,
      connectorIds: ['quota'],
      timeWindow: {},
    });
    const item = preview.breakdown[0];
    expect(item.warning).toBe('quota_risk');
    expect(item.confidence).toBe('unavailable');
    expect(item.errorCode).toBe('quota_exceeded');
  });

  it('unsupported_query warning when the AST uses operators the connector cannot evaluate', async () => {
    registerSocialConnector(unsupportedConnector('unsup'));
    const preview = await previewWatchlistVolume({
      tenantId: 't-ac6',
      ast: TERM_AST,
      connectorIds: ['unsup'],
      timeWindow: {},
    });
    expect(preview.breakdown[0].warning).toBe('unsupported_query');
  });
});

// --- AC4 + AC7: HTTP endpoint, RLS, cross-tenant 404/403 -------------------

describe('Story 9.1 — AC4/AC7: POST /v1/watchlists/preview-volume (tenant-scoped, RLS-gated)', () => {
  it('returns 200 with WatchlistVolumePreview for an inline ast', async () => {
    const app = createApp();
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(countConnector('http-count', { count: 30, confidence: 'exact', rateLimitCost: 1 }));
    registerSocialConnector(sampleConnector('http-sample', makePosts(50, HOUR_MS)));

    const res = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId }))
      .send({
        ast: TERM_AST,
        connectorIds: ['http-count', 'http-sample'],
        timeWindow: { start: iso(NOW - 24 * HOUR_MS), end: iso(NOW) },
      });

    expect(res.status).toBe(200);
    expect(res.body.totalEstimatedPosts).toBeGreaterThan(0);
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    const item = res.body.breakdown.find((b: { connectorId: string }) => b.connectorId === 'http-count');
    expect(item.estimatedPosts).toBe(30);
    expect(item.confidence).toBe('exact');
    expect(item.rateLimitCost).toBe(1);
    expect(item.warning).toBe('none');
  });

  it('a watchlistId is loaded under RLS and a cross-tenant caller gets 404', async () => {
    const app = createApp();
    const owner = await makeTenantWithUser();
    const other = await makeTenantWithUser();
    const wl = await createWatchlist(owner.tenantId, owner.userId, {
      name: `wl-${randomUUID()}`,
      matchType: 'boolean',
      booleanQuery: 'technology',
    });
    registerSocialConnector(countConnector('rls-count', { count: 9, confidence: 'exact', rateLimitCost: 1 }));

    // Owner sees it.
    const ownerRes = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', testIdentityHeaderValue(owner.tenantId, { userId: owner.userId }))
      .send({ watchlistId: wl.id, connectorIds: ['rls-count'] });
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.breakdown[0].estimatedPosts).toBe(9);

    // Cross-tenant caller gets 404 (RLS hides the other tenant's watchlist).
    const crossRes = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', testIdentityHeaderValue(other.tenantId, { userId: other.userId }))
      .send({ watchlistId: wl.id, connectorIds: ['rls-count'] });
    expect(crossRes.status).toBe(404);
  });

  it('a Platform Admin identity is rejected 403', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }))
      .send({ ast: TERM_AST, connectorIds: [] });
    expect(res.status).toBe(403);
  });

  it('a request with neither watchlistId nor ast is 400', async () => {
    const app = createApp();
    const { tenantId, userId } = await makeTenantWithUser();
    const res = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId }))
      .send({ connectorIds: [] });
    expect(res.status).toBe(400);
  });

  it('a single connector failure does not fail the HTTP request (200 with unavailable item)', async () => {
    const app = createApp();
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(countConnector('ok', { count: 3, confidence: 'exact', rateLimitCost: 1 }));
    registerSocialConnector(failingConnector('boom'));

    const res = await request(app)
      .post('/v1/watchlists/preview-volume')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId }))
      .send({ ast: TERM_AST, connectorIds: ['ok', 'boom'] });

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.breakdown.map((b: { connectorId: string }) => [b.connectorId, b]));
    expect(byId.ok.confidence).toBe('exact');
    expect(byId.boom.confidence).toBe('unavailable');
    expect(byId.boom.errorCode).toBeDefined();
  });
});
