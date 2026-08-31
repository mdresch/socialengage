/**
 * Contract: Story 13.2 (ADR-0110, BRD-0021, FDD-0021) — Per-connector query translation and validation (backend).
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-132--per-connector-query-translation-and-validation-backend
 * and docs/adr/0110-per-connector-query-translation-and-validation.md
 *
 * Intent: Story 13.2 — Per-connector query translation and validation (ADR-0110)
 * Scope:
 *   - src/connectors/queryCapabilities.ts
 *   - src/connectors/queryTranslation.ts (new)
 *   - src/http/versions/v1/connectorsRouter.ts (existing query-capabilities route)
 *   - src/http/versions/v1/watchlistsRouter.ts (existing save-time validation)
 *   - .claude/skills/connector-query-translation/SKILL.md (new)
 * Contract to encode:
 *   (1) Each registered connector exposes a ConnectorQueryTranslator with the
 *       properties and methods required by ADR-0110 (supportedClauses,
 *       supportedOperators, maxClauseCount, maxQueryLength, translate(),
 *       validate()).
 *   (2) GET /v1/connectors/:platformId/query-capabilities returns the
 *       capability record for a platform.
 *   (3) Save-time validation (POST /v1/watchlists) returns 422
 *       UNSUPPORTED_QUERY_CLAUSE when the AST contains an unsupported clause
 *       for the target platform.
 *   (4) Reference ASTs translate to predictable, platform-specific NativeQuery
 *       shapes for the connectors that support them.
 *   (5) Fallback matching remains the safety net: an AST the translator cannot
 *       turn into a native query is still correctly evaluated by
 *       evaluateWatchlistAst, and a supported AST still matches a post through
 *       the fallback evaluator.
 *   (6) maxClauseCount and maxQueryLength are enforced and produce
 *       TOO_MANY_CLAUSES and QUERY_TOO_LONG codes respectively.
 *
 * Explicitly out of scope: native query execution against live platform APIs,
 * UI warnings, changing the legacy AstNode-based preview path (Story 9.1), or
 * updating the old SocialConnector.supportedQueryFeatures map.
 */

import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { randomUUID } from 'crypto';
import {
  getConnectorQueryTranslator,
  getConnectorQueryCapabilities,
  validateAstForConnector,
} from '../../src/connectors/queryCapabilities';
import type { ConnectorQueryTranslator, NativeQuery } from '../../src/connectors/queryCapabilities';
import { WatchlistAST } from '../../src/watchlists/ast';
import { evaluateWatchlistAst } from '../../src/watchlists/matcher';

jest.setTimeout(30000);

const app = createApp();
const AUTH_HEADER = testIdentityHeaderValue('tenant-13.2', {
  userId: 'user-13.2',
  role: 'tenant_admin',
});

async function makeTenantWithAdmin(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `admin-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_admin' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

const ALL_PLATFORM_IDS = [
  'gnews',
  'newswire',
  'brave-search',
  'bing-search',
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'wikipedia',
  'tenant-owned-feed',
];

function expectNativeQueryShape(actual: NativeQuery | null, expected: NativeQuery) {
  expect(actual).not.toBeNull();
  expect(actual!.query).toBe(expected.query);
  expect(actual!.params ?? {}).toEqual(expected.params ?? {});
}

describe('Story 13.2 — Per-connector query translation and validation', () => {
  describe('AC1: Each connector has a ConnectorQueryTranslator', () => {
    it.each(ALL_PLATFORM_IDS)('exposes a translator for %s', (platformId) => {
      const translator = getConnectorQueryTranslator(platformId);
      expect(translator).toBeTruthy();
      expect(translator!.platformId).toBe(platformId);
      expect(Array.isArray(translator!.supportedClauses)).toBe(true);
      expect(translator!.supportedClauses.length).toBeGreaterThan(0);
      expect(Array.isArray(translator!.supportedOperators)).toBe(true);
      expect(translator!.supportedOperators.length).toBeGreaterThan(0);
      expect(typeof translator!.maxClauseCount).toBe('number');
      expect(translator!.maxClauseCount).toBeGreaterThan(0);
      expect(typeof translator!.maxQueryLength).toBe('number');
      expect(translator!.maxQueryLength).toBeGreaterThan(0);
      expect(typeof translator!.translate).toBe('function');
      expect(typeof translator!.validate).toBe('function');
    });

    it('returns null for an unregistered platform', () => {
      expect(getConnectorQueryTranslator('not-a-platform')).toBeNull();
      expect(getConnectorQueryCapabilities('not-a-platform')).toBeNull();
    });
  });

  describe('AC2: GET /v1/connectors/:platformId/query-capabilities returns capabilities', () => {
    it('returns supportedClauses, supportedOperators, and limits for gnews', async () => {
      const res = await request(app)
        .get('/v1/connectors/gnews/query-capabilities')
        .set('x-test-identity', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.platformId).toBe('gnews');
      expect(res.body.supportedClauses).toEqual(
        expect.arrayContaining(['keyword', 'phrase', 'source', 'date', 'nested'])
      );
      expect(res.body.supportedOperators).toEqual(expect.arrayContaining(['AND', 'OR', 'NOT']));
      expect(res.body.limits).toMatchObject({ maxLength: 500, maxClauses: 20 });
    });

    it('returns 404 for an unregistered connector', async () => {
      const res = await request(app)
        .get('/v1/connectors/non-existent-platform/query-capabilities')
        .set('x-test-identity', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('not_found');
    });
  });

  describe('AC3: Save-time validation returns 422 UNSUPPORTED_QUERY_CLAUSE', () => {
    it('validateAstForConnector rejects an unsupported clause for a connector', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'tech' },
          { type: 'hashtag', value: 'AI' }, // gnews does not support hashtag
        ],
      };

      const result = validateAstForConnector(ast, 'gnews');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
      expect(result.offendingClause).toEqual({ type: 'hashtag', value: 'AI' });
    });

    it('POST /v1/watchlists returns 422 when a target platform cannot express the AST', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const res = await request(app)
        .post('/v1/watchlists')
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({
          name: 'GNews Hashtag Watchlist',
          matchType: 'boolean',
          platformIds: ['gnews'],
          ast: {
            operator: 'AND',
            clauses: [
              { type: 'keyword', value: 'tech' },
              { type: 'hashtag', value: 'AI' },
            ],
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
      expect(res.body.offendingClause).toEqual({ type: 'hashtag', value: 'AI' });
    });
  });

  describe('AC4: Native query shapes for reference ASTs', () => {
    it('translates a gnews keyword/phrase/source/date AST into q and date params', () => {
      const translator = getConnectorQueryTranslator('gnews')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'AI' },
          { type: 'phrase', value: 'product launch' },
          { type: 'source', value: 'gnews' },
          { type: 'date', operator: '>=', value: '2026-08-01' },
        ],
      };

      expect(translator.validate(ast).valid).toBe(true);
      expectNativeQueryShape(translator.translate(ast), {
        query: 'AI AND "product launch"',
        params: { from: '2026-08-01' },
      });
    });

    it('translates a newswire keyword/author/source AST', () => {
      const translator = getConnectorQueryTranslator('newswire')!;
      const ast: WatchlistAST = {
        operator: 'OR',
        clauses: [
          { type: 'keyword', value: 'energy' },
          { type: 'author', value: 'globenewswire' },
          { type: 'source', value: 'newswire' },
        ],
      };

      expect(translator.validate(ast).valid).toBe(true);
      expectNativeQueryShape(translator.translate(ast), {
        query: 'energy OR author:globenewswire',
      });
    });

    it('translates a bing-search nested NOT group', () => {
      const translator = getConnectorQueryTranslator('bing-search')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'Microsoft' },
          {
            type: 'nested',
            operator: 'NOT',
            clauses: [{ type: 'keyword', value: 'jobs' }],
          },
        ],
      };

      expect(translator.validate(ast).valid).toBe(true);
      expectNativeQueryShape(translator.translate(ast), {
        query: 'Microsoft AND NOT (jobs)',
      });
    });

    it('translates an instagram hashtag/mention/author AST', () => {
      const translator = getConnectorQueryTranslator('instagram')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'hashtag', value: 'Tech2026' },
          { type: 'mention', value: 'example' },
          { type: 'author', value: 'founder' },
        ],
      };

      expect(translator.validate(ast).valid).toBe(true);
      expectNativeQueryShape(translator.translate(ast), {
        query: '#Tech2026 AND @example AND from:founder',
      });
    });

    it('translates a youtube keyword/hashtag/author/date AST into q and params', () => {
      const translator = getConnectorQueryTranslator('youtube')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'review' },
          { type: 'hashtag', value: 'Brand' },
          { type: 'author', value: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
          { type: 'date', operator: '>=', value: '2026-08-01' },
        ],
      };

      expect(translator.validate(ast).valid).toBe(true);
      expectNativeQueryShape(translator.translate(ast), {
        query: 'review AND #Brand',
        params: {
          channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
          publishedAfter: '2026-08-01',
        },
      });
    });

    it('rejects phrase on instagram (not in supportedClauses)', () => {
      const translator = getConnectorQueryTranslator('instagram')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'summer' },
          { type: 'phrase', value: 'product launch' },
        ],
      };

      const result = translator.validate(ast);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
    });

    it('rejects NOT on linkedin (not in supportedOperators)', () => {
      const translator = getConnectorQueryTranslator('linkedin')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'acme' },
          {
            type: 'nested',
            operator: 'NOT',
            clauses: [{ type: 'keyword', value: 'jobs' }],
          },
        ],
      };

      const result = translator.validate(ast);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
    });
  });

  describe('AC5: Fallback matching remains the safety net', () => {
    it('an AST that the translator cannot translate still evaluates with evaluateWatchlistAst', () => {
      const translator = getConnectorQueryTranslator('gnews')!;
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'AI' },
          { type: 'hashtag', value: 'DevAI' },
        ],
      };

      // Native translation is not possible because gnews does not support hashtags.
      expect(translator.translate(ast)).toBeNull();

      // Fallback matching still finds the post.
      const post = {
        text: 'Announcing our new AI initiative. Join us at #DevAI',
        authorExternalId: 'auth_999',
        providerId: 'gnews',
      };
      expect(evaluateWatchlistAst(ast, post)).toBe(true);
    });

    it('a supported AST matches a post through fallback evaluation', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'phrase', value: 'product launch' },
          { type: 'hashtag', value: 'Tech2026' },
        ],
      };

      const matchingPost = {
        text: 'Announcing our new product launch! Join us at #Tech2026',
        authorExternalId: 'auth_999',
        providerId: 'instagram',
      };
      expect(evaluateWatchlistAst(ast, matchingPost)).toBe(true);

      const nonMatchingPost = {
        text: 'Announcing our new product launch! Join us at #OtherTag',
        authorExternalId: 'auth_999',
        providerId: 'instagram',
      };
      expect(evaluateWatchlistAst(ast, nonMatchingPost)).toBe(false);
    });

    it('fallback result set is a superset for a reference corpus', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'Microsoft' },
          { type: 'keyword', value: 'AI' },
        ],
      };

      const corpus = [
        { text: 'Microsoft announces new AI tools', matched: true },
        { text: 'Microsoft releases quarterly earnings', matched: false },
        { text: 'Google invests in AI research', matched: false },
        { text: 'Microsoft and OpenAI partner on AI', matched: true },
      ];

      for (const item of corpus) {
        expect(evaluateWatchlistAst(ast, { text: item.text })).toBe(item.matched);
      }

      // The same AST is translatable for gnews, and its native query is a
      // string that contains the same required terms. The fallback evaluator
      // returns the matching subset, so the native result set (if executed)
      // must be a subset of the fallback result set.
      const gnews = getConnectorQueryTranslator('gnews')!;
      const native = gnews.translate(ast);
      expect(native).not.toBeNull();
      expect(native!.query).toBe('Microsoft AND AI');
    });
  });

  describe('AC6: maxClauseCount and maxQueryLength limits are enforced', () => {
    it('returns TOO_MANY_CLAUSES when the clause count exceeds the platform limit', () => {
      const translator = getConnectorQueryTranslator('instagram')!;
      expect(translator.maxClauseCount).toBe(10);

      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: Array.from({ length: 11 }, (_, i) => ({
          type: 'keyword' as const,
          value: `term${i}`,
        })),
      };

      const result = validateAstForConnector(ast, 'instagram');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOO_MANY_CLAUSES');
    });

    it('returns TOO_MANY_CLAUSES through POST /v1/watchlists', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: Array.from({ length: 11 }, (_, i) => ({
          type: 'keyword' as const,
          value: `term${i}`,
        })),
      };

      const res = await request(app)
        .post('/v1/watchlists')
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({
          name: 'Too Many Clauses',
          matchType: 'boolean',
          platformIds: ['instagram'],
          ast,
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('TOO_MANY_CLAUSES');
    });

    it('returns QUERY_TOO_LONG when the native query exceeds maxQueryLength', () => {
      const translator = getConnectorQueryTranslator('instagram')!;
      const longValue = 'a'.repeat(translator.maxQueryLength + 1);

      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [{ type: 'keyword', value: longValue }],
      };

      const result = validateAstForConnector(ast, 'instagram');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('QUERY_TOO_LONG');
    });

    it('returns QUERY_TOO_LONG through POST /v1/watchlists', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const translator = getConnectorQueryTranslator('instagram')!;
      const longValue = 'a'.repeat(translator.maxQueryLength + 1);

      const res = await request(app)
        .post('/v1/watchlists')
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({
          name: 'Too Long Query',
          matchType: 'boolean',
          platformIds: ['instagram'],
          ast: {
            operator: 'AND',
            clauses: [{ type: 'keyword', value: longValue }],
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('QUERY_TOO_LONG');
    });
  });
});
