import { SocialConnector } from '../connectors/types';
import { MatchablePost, matchesWatchlist, matchesAst } from './matcher';
import { WatchlistTerms } from './types';
import { AstNode, AstNodeType, collectNodeTypes } from './ast';

export interface WatchlistDispatchResult {
  mode: 'native' | 'fallback';
  nativeQueryParams?: Record<string, string>;
}

/**
 * Decides native connector-side filtering vs. post-fetch fallback for a given
 * connector + Watchlist (ADR-0006). See
 * .claude/skills/watchlist-matching/SKILL.md.
 */
export function resolveWatchlistDispatch(
  connector: SocialConnector,
  terms: WatchlistTerms
): WatchlistDispatchResult {
  const translation = connector.translateWatchlistQuery?.(terms);
  if (translation?.supported) {
    return { mode: 'native', nativeQueryParams: translation.queryParams };
  }
  return { mode: 'fallback' };
}

/**
 * In native mode, the platform already applied the translated filter
 * server-side — every post handed in is presumed to already match, nothing
 * left to do. In fallback mode, the core evaluates every post itself.
 */
export function matchPostsForWatchlist(
  dispatch: WatchlistDispatchResult,
  terms: WatchlistTerms,
  posts: MatchablePost[]
): MatchablePost[] {
  if (dispatch.mode === 'native') {
    return posts;
  }
  return posts.filter((post) => matchesWatchlist(terms, post));
}

export interface WatchlistAstDispatchResult {
  mode: 'native' | 'fallback';
  /** Node types the parsed AST needs that this connector didn't declare
   * support for — empty when dispatching native. This is the signal a
   * future connector/watchlist status view surfaces (Story 3.6 AC2); no
   * such view exists yet, so this is proven at the data level only. */
  unsupportedNodeTypes: AstNodeType[];
}

// Canonical, deterministic ordering for unsupportedNodeTypes — independent
// of a Set's insertion order, which would otherwise vary with AST shape.
const CANONICAL_NODE_TYPE_ORDER: AstNodeType[] = ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'];

/**
 * Decides native vs. fallback for a parsed boolean-query AST (Story 3.6,
 * ADR-0021) — whole-query degradation: if the connector's declared
 * supportedQueryFeatures don't cover every node type the AST actually uses,
 * the *entire* query falls back, not just the unsupported clause.
 */
export function resolveWatchlistAstDispatch(
  connector: SocialConnector,
  ast: AstNode
): WatchlistAstDispatchResult {
  const required = collectNodeTypes(ast);
  const supported = new Set(connector.supportedQueryFeatures ?? []);
  const unsupportedNodeTypes = CANONICAL_NODE_TYPE_ORDER.filter(
    (type) => required.has(type) && !supported.has(type)
  );
  return {
    mode: unsupportedNodeTypes.length === 0 ? 'native' : 'fallback',
    unsupportedNodeTypes,
  };
}

/** AST-evaluating counterpart to matchPostsForWatchlist() (Story 3.6). Same native/fallback semantics: native mode presumes the platform already filtered. */
export function matchPostsForWatchlistAst(
  dispatch: WatchlistAstDispatchResult,
  ast: AstNode,
  posts: MatchablePost[]
): MatchablePost[] {
  if (dispatch.mode === 'native') {
    return posts;
  }
  return posts.filter((post) => matchesAst(ast, post));
}
