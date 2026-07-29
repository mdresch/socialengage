// Contract: Story 1.3 (ADR-0017) — REST API versioning and compatibility policy.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-13--rest-api-versioning-and-compatibility-policy
//
// Intent: Story 1.3 — REST API versioning and compatibility policy (ADR-0017)
// Scope: src/http/app.ts, src/http/versions/v1/router.ts, src/http/deprecation.ts,
// src/http/server.ts, social-listening-admin/src/lib/core-client.ts (updated to call
// /v1/health — anticipated by that file's own SKILL.md, written during Story 1.1,
// which flagged exactly this update as pending once Story 1.3 landed)
// Contract to encode: (1) every registered route is reachable under /v1/..., and an
// unversioned path 404s; (2) a router marked deprecated emits RFC 8594
// Deprecation/Sunset response headers, with Sunset at least the 90-day minimum
// (ADR-0017's Amendment Log's current default) after the successor version's ship
// date; (3) a fixed, documented response-shape contract for /v1/health that fails
// if the shape changes unexpectedly — the pattern every future /v1 endpoint follows.
// Explicitly out of scope: any real business endpoint (connectors, watchlists, posts
// — Phase 1+ stories); an actual v2 (no successor version exists yet — this only
// needs to prove the deprecation mechanism works, not a real deprecated version in
// production); OpenAPI/schema-registry tooling (already deferred per
// docs/adr/README.md's "not captured as ADRs" list).

import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import {
  deprecateVersion,
  minimumSunsetDate,
  MIN_DEPRECATION_WINDOW_DAYS,
} from '../../src/http/deprecation';

describe('Story 1.3 — API versioning contract', () => {
  const app = createApp();

  it('AC1: every registered route is reachable under /v1/...', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
  });

  it('AC1: no unversioned route exists', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(404);
  });

  it('AC2: a router marked deprecated emits Deprecation/Sunset headers per RFC 8594', async () => {
    const successorShippedAt = new Date('2026-01-01T00:00:00Z');
    const sunsetAt = minimumSunsetDate(successorShippedAt);

    const testApp = express();
    const deprecatedRouter = express.Router();
    deprecatedRouter.use(deprecateVersion(successorShippedAt, sunsetAt));
    deprecatedRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
    testApp.use('/v0', deprecatedRouter);

    const res = await request(testApp).get('/v0/health');
    expect(res.headers['deprecation']).toBe(successorShippedAt.toUTCString());
    expect(res.headers['sunset']).toBe(sunsetAt.toUTCString());
  });

  it('AC2: rejects a sunset date earlier than the 90-day minimum after the successor ships', () => {
    const successorShippedAt = new Date('2026-01-01T00:00:00Z');
    const tooSoon = new Date(successorShippedAt.getTime() + 89 * 24 * 60 * 60 * 1000);
    expect(() => deprecateVersion(successorShippedAt, tooSoon)).toThrow();

    const okSunset = new Date(
      successorShippedAt.getTime() + MIN_DEPRECATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    expect(() => deprecateVersion(successorShippedAt, okSunset)).not.toThrow();
  });

  it('AC3: /v1/health has a fixed, documented response shape', async () => {
    const res = await request(app).get('/v1/health');
    expect(Object.keys(res.body).sort()).toEqual(['status']);
    expect(res.body.status).toBe('ok');
  });
});
