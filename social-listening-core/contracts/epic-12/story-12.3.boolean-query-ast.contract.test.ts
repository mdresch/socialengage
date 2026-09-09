/**
 * Contract: Story 12.3 (ADR-0102, BRD-0102, FDD-0102) — Boolean query AST and visual builder (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-123--boolean-query-ast-and-visual-builder-backend
 * and docs/adr/0102-boolean-query-ast-and-visual-builder.md
 */

import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import {
  WatchlistAST,
  validateWatchlistAst,
  parseBooleanQueryToAst,
  astToBooleanQuery,
} from '../../src/watchlists/ast';
import {
  getConnectorQueryCapabilities,
  validateAstForConnector,
} from '../../src/connectors/queryCapabilities';
import { evaluateWatchlistAst } from '../../src/watchlists/matcher';

jest.setTimeout(30000);

const app = createApp();
const AUTH_HEADER = testIdentityHeaderValue('tenant-12.3', {
  userId: 'user-12.3',
  role: 'tenant_admin',
});

beforeAll(async () => {
  await bootstrapConnectors();
});

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

describe('Story 12.3 — Boolean query AST and visual builder (backend)', () => {
  describe('AC1: Canonical WatchlistAST schema and clause types', () => {
    it('supports keyword, phrase, hashtag, mention, author, source, sentiment, date, and nested clauses', () => {
      const fullAst: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'keyword', value: 'SocialEngage' },
          { type: 'phrase', value: 'product launch' },
          { type: 'hashtag', value: 'DevAI' },
          { type: 'mention', value: 'example_corp' },
          { type: 'author', value: 'founder123' },
          { type: 'source', value: 'gnews' },
          { type: 'sentiment', value: 'positive' },
          { type: 'date', operator: '>=', value: '2026-08-01' },
          {
            type: 'nested',
            operator: 'OR',
            clauses: [
              { type: 'keyword', value: 'AI' },
              { type: 'keyword', value: 'automation' },
            ],
          },
        ],
      };

      const validation = validateWatchlistAst(fullAst);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('rejects malformed AST objects with descriptive errors', () => {
      const invalidAst = {
        operator: 'INVALID_OP',
        clauses: [{ type: 'unknown_type', value: 'test' }],
      };
      const validation = validateWatchlistAst(invalidAst as any);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('AC2: GET /v1/connectors/:platformId/query-capabilities endpoint', () => {
    it('returns supportedClauses, supportedOperators, and limits for connectors', async () => {
      const res = await request(app)
        .get('/v1/connectors/gnews/query-capabilities')
        .set('x-test-identity', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.platformId).toBe('gnews');
      expect(Array.isArray(res.body.supportedClauses)).toBe(true);
      expect(res.body.supportedClauses).toContain('keyword');
      expect(res.body.supportedClauses).toContain('phrase');
      expect(Array.isArray(res.body.supportedOperators)).toBe(true);
      expect(res.body.supportedOperators).toContain('AND');
      expect(res.body.supportedOperators).toContain('OR');
      expect(res.body.supportedOperators).toContain('NOT');
    });

    it('returns 404 for an unregistered connector', async () => {
      const res = await request(app)
        .get('/v1/connectors/non-existent-platform/query-capabilities')
        .set('x-test-identity', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('not_found');
    });
  });

  describe('AC3: Save-time validation returns 422 UNSUPPORTED_QUERY_CLAUSE on incompatible clauses', () => {
    it('detects unsupported clause for a connector in validateAstForConnector', () => {
      // Instagram connector only supports hashtags, keywords, mentions, author
      const astWithSentiment: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'hashtag', value: 'tech' },
          { type: 'sentiment', value: 'negative' },
        ],
      };

      const result = validateAstForConnector(astWithSentiment, 'instagram');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
      expect(result.offendingClause).toEqual({ type: 'sentiment', value: 'negative' });
    });

    it('POST /v1/watchlists returns 422 UNSUPPORTED_QUERY_CLAUSE if AST has unsupported clause for target platform', async () => {
      const res = await request(app)
        .post('/v1/watchlists')
        .set('x-test-identity', AUTH_HEADER)
        .send({
          name: 'Instagram Sentiment Watchlist',
          matchType: 'boolean',
          platformIds: ['instagram'],
          ast: {
            operator: 'AND',
            clauses: [
              { type: 'hashtag', value: 'summer' },
              { type: 'sentiment', value: 'positive' },
            ],
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('UNSUPPORTED_QUERY_CLAUSE');
      expect(res.body.offendingClause).toEqual({ type: 'sentiment', value: 'positive' });
    });
  });

  describe('AC4: In-process fallback AST evaluation (evaluateWatchlistAst)', () => {
    it('evaluates keyword, phrase, hashtag, author, sentiment, and nested clauses against MatchablePost', () => {
      const post = {
        text: 'Announcing our new product launch! Join us at #Tech2026',
        authorExternalId: 'auth_999',
        providerId: 'gnews',
        sentiment: 'positive',
        createdAt: new Date('2026-08-15T12:00:00Z'),
      };

      const matchingAst: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'phrase', value: 'product launch' },
          { type: 'hashtag', value: 'Tech2026' },
          { type: 'author', value: 'auth_999' },
          { type: 'source', value: 'gnews' },
          { type: 'sentiment', value: 'positive' },
          { type: 'date', operator: '>=', value: '2026-08-01' },
        ],
      };

      expect(evaluateWatchlistAst(matchingAst, post)).toBe(true);

      const nonMatchingAst: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'phrase', value: 'product launch' },
          { type: 'sentiment', value: 'negative' }, // Does not match
        ],
      };

      expect(evaluateWatchlistAst(nonMatchingAst, post)).toBe(false);
    });
  });

  describe('AC5: Bidirectional round-trip parser (parseBooleanQueryToAst & astToBooleanQuery)', () => {
    it('parses legacy text query strings to WatchlistAST and serializes back to text', () => {
      const textQuery = 'AI AND #DevAI AND NOT spam';
      const ast = parseBooleanQueryToAst(textQuery);

      expect(ast.operator).toBe('AND');
      expect(ast.clauses.some((c) => c.type === 'keyword' && c.value.toLowerCase() === 'ai')).toBe(true);
      expect(ast.clauses.some((c) => c.type === 'hashtag' && c.value === 'DevAI')).toBe(true);

      const serialized = astToBooleanQuery(ast);
      expect(serialized).toContain('AI');
      expect(serialized).toContain('#DevAI');
    });
  });
});
