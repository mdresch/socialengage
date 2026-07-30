// Contract: Story 3.6 (ADR-0021) — unified boolean-query AST for watchlist
// matching, with per-connector capability declaration and whole-query
// degradation.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-36--unified-boolean-query-ast-for-watchlist-matching
//
// Intent: Story 3.6 — Unified boolean-query AST for watchlist matching (ADR-0021)
// Scope: src/watchlists/ast.ts (new — AstNode types, parseBooleanQuery(),
// collectNodeTypes()), src/watchlists/matcher.ts (matchesAst()),
// src/watchlists/dispatch.ts (resolveWatchlistAstDispatch(),
// matchPostsForWatchlistAst()), src/connectors/types.ts (SocialConnector gains
// supportedQueryFeatures?: AstNodeType[])
// Contract to encode: (1) parseBooleanQuery() parses a booleanQuery string
// into an AST built from AND/OR/NOT/TERM/HASHTAG/ACCOUNT node types, with
// NOT binding tighter than AND/OR and parentheses for grouping; (2) a
// connector whose supportedQueryFeatures covers every node type in the
// parsed AST dispatches to 'native'; one missing even a single node type
// present in the query dispatches to 'fallback' for the *whole* query
// (ADR-0021's accepted whole-query degradation, not per-clause), and the
// dispatch result names exactly which node types were unsupported — the
// signal a future connector/watchlist status view would surface (that view
// doesn't exist yet — no connector or watchlist REST endpoints exist at all
// in this repo yet, Phase 1's "also build, not storied" scope); (3) the same
// Watchlist's booleanQuery, evaluated via a mock connector that declares
// full native support (posts handed to it are already the correctly-
// filtered set, matching native mode's "platform already filtered" premise
// — Story 3.3's own load-bearing constraint) and via a mock connector with
// no supported features at all (posts handed to it are the full unfiltered
// set, filtered by matchesAst()), produce identical matched post sets for
// identical underlying data — closing the exact gap Story 3.3's AC3 flagged
// as "subject to Story 3.6 closing the AST-consistency gap."
// Explicitly out of scope: an actual native-query-string translator for any
// real platform (no real connector implements this yet — same "prove the
// mechanism, not the pipeline" scoping every prior connector-facing story
// this session used); the connector/watchlist status view itself (no REST
// endpoints exist for connectors or watchlists at all yet); per-clause
// degradation (ADR-0021 explicitly accepted whole-query for v1); quoted
// multi-word phrases in the query grammar (not named in the ADR's v1 node
// types, not built here — a possible later grammar extension, not this
// story's scope).

import { parseBooleanQuery, collectNodeTypes, AstNode } from '../../src/watchlists/ast';
import { matchesAst, MatchablePost } from '../../src/watchlists/matcher';
import { resolveWatchlistAstDispatch, matchPostsForWatchlistAst } from '../../src/watchlists/dispatch';
import { SocialConnector } from '../../src/connectors/types';

function post(id: string, text: string, authorExternalId?: string): MatchablePost {
  return { id, text, authorExternalId };
}

function stubConnector(supportedQueryFeatures: SocialConnector['supportedQueryFeatures']): SocialConnector {
  return {
    providerId: 'stub',
    authMode: 'none',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 60, windowSeconds: 60 }),
    normalize: (raw) => {
      const item = raw as { id: string };
      return { externalId: item.id, authorExternalId: 'unknown', publishedAt: new Date().toISOString(), rawPayload: raw };
    },
    supportedQueryFeatures,
  };
}

describe('Story 3.6 — watchlist boolean-query AST contract', () => {
  it('AC1: parseBooleanQuery() builds the AST with correct node types and NOT/AND/OR precedence', () => {
    const ast = parseBooleanQuery('acme AND (support OR help) NOT jobs');
    // Top level: AND(AND(TERM(acme), OR(TERM(support), TERM(help))), NOT(TERM(jobs)))
    expect(ast.type).toBe('AND');
    const top = ast as Extract<AstNode, { type: 'AND' }>;
    expect(top.right.type).toBe('NOT');
    expect((top.right as Extract<AstNode, { type: 'NOT' }>).operand).toEqual({ type: 'TERM', value: 'jobs' });

    const left = top.left as Extract<AstNode, { type: 'AND' }>;
    expect(left.left).toEqual({ type: 'TERM', value: 'acme' });
    expect(left.right.type).toBe('OR');
    const or = left.right as Extract<AstNode, { type: 'OR' }>;
    expect(or.left).toEqual({ type: 'TERM', value: 'support' });
    expect(or.right).toEqual({ type: 'TERM', value: 'help' });

    expect(collectNodeTypes(ast)).toEqual(new Set(['AND', 'OR', 'NOT', 'TERM']));
  });

  it('AC1: hashtag and account tokens parse to HASHTAG/ACCOUNT nodes', () => {
    const ast = parseBooleanQuery('#acme OR @acmecorp');
    expect(ast).toEqual({
      type: 'OR',
      left: { type: 'HASHTAG', value: 'acme' },
      right: { type: 'ACCOUNT', value: 'acmecorp' },
    });
    expect(collectNodeTypes(ast)).toEqual(new Set(['OR', 'HASHTAG', 'ACCOUNT']));
  });

  it('AC2: a connector missing even one required node type degrades the whole query to fallback, naming what\'s unsupported', () => {
    const ast = parseBooleanQuery('acme AND (support OR help)');

    const fullSupport = stubConnector(['AND', 'OR', 'TERM', 'NOT', 'HASHTAG', 'ACCOUNT']);
    expect(resolveWatchlistAstDispatch(fullSupport, ast)).toEqual({ mode: 'native', unsupportedNodeTypes: [] });

    // Supports AND and TERM but not OR — the query uses OR, so the *whole*
    // query falls back, not just the OR clause (ADR-0021's whole-query
    // degradation).
    const partialSupport = stubConnector(['AND', 'TERM']);
    expect(resolveWatchlistAstDispatch(partialSupport, ast)).toEqual({
      mode: 'fallback',
      unsupportedNodeTypes: ['OR'],
    });

    const noSupport = stubConnector(undefined);
    expect(resolveWatchlistAstDispatch(noSupport, ast)).toEqual({
      mode: 'fallback',
      unsupportedNodeTypes: ['AND', 'OR', 'TERM'],
    });
  });

  it('AC3: native (pre-filtered mock) and fallback (matchesAst over the full set) produce identical matched posts', () => {
    const ast = parseBooleanQuery('acme AND (support OR help) NOT jobs');

    const posts = [
      post('1', 'acme support is great'), // acme AND support, no "jobs" -> match
      post('2', 'acme help desk'), // acme AND help, no "jobs" -> match
      post('3', 'acme jobs posting'), // acme AND (no support/help) -> no match
      post('4', 'support and help for widgets'), // no "acme" -> no match
      post('5', 'acme help wanted for jobs'), // acme AND help but has "jobs" -> no match (NOT jobs)
    ];
    const expectedMatchIds = posts.filter((p) => matchesAst(ast, p)).map((p) => p.id);
    expect(expectedMatchIds).toEqual(['1', '2']);

    // Native mode: platform already filtered server-side (Story 3.3's
    // load-bearing constraint) — simulate by handing in only the
    // already-correct subset.
    const nativeConnector = stubConnector(['AND', 'OR', 'NOT', 'TERM']);
    const nativeDispatch = resolveWatchlistAstDispatch(nativeConnector, ast);
    expect(nativeDispatch.mode).toBe('native');
    const nativeResult = matchPostsForWatchlistAst(
      nativeDispatch,
      ast,
      posts.filter((p) => expectedMatchIds.includes(p.id))
    );

    // Fallback mode: hand in the full, unfiltered set.
    const fallbackConnector = stubConnector([]);
    const fallbackDispatch = resolveWatchlistAstDispatch(fallbackConnector, ast);
    expect(fallbackDispatch.mode).toBe('fallback');
    const fallbackResult = matchPostsForWatchlistAst(fallbackDispatch, ast, posts);

    expect(fallbackResult.map((p) => p.id).sort()).toEqual(nativeResult.map((p) => p.id).sort());
    expect(fallbackResult.map((p) => p.id).sort()).toEqual(['1', '2']);
  });
});
