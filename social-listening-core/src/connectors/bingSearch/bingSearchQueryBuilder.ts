import { Watchlist } from '../../watchlists/watchlistStore';
import { AstNode, AstNodeType, parseBooleanQuery } from '../../watchlists/ast';
import { matchesAst, MatchablePost } from '../../watchlists/matcher';
import { BingSearchItem } from './bingSearchConnector';

/**
 * Builds a search query expression tailored for Bing Search API from a Watchlist.
 */
export function buildBingSearchQuery(watchlist: Watchlist): string {
  if (watchlist.matchType === 'boolean') {
    return watchlist.booleanQuery?.trim() ?? '';
  }

  const terms = watchlist.terms ?? [];
  if (terms.length === 0) {
    return '';
  }

  if (watchlist.matchType === 'hashtag') {
    return terms
      .map((t) => {
        const clean = t.trim().replace(/^#+/, '');
        return `"#${clean}"`;
      })
      .join(' OR ');
  }

  if (watchlist.matchType === 'account') {
    return terms
      .map((t) => {
        const clean = t.trim().replace(/^@+/, '');
        return `"@${clean}"`;
      })
      .join(' OR ');
  }

  // matchType === 'keyword'
  return terms
    .map((t) => {
      const clean = t.trim();
      if (clean.startsWith('"') && clean.endsWith('"')) {
        return clean;
      }
      return `"${clean}"`;
    })
    .join(' OR ');
}

/**
 * Converts any Watchlist into an in-process AstNode tree for strict candidate validation.
 */
export function watchlistToAst(watchlist: Watchlist): AstNode | null {
  if (watchlist.matchType === 'boolean') {
    return watchlist.booleanQuery ? parseBooleanQuery(watchlist.booleanQuery) : null;
  }
  const terms = watchlist.terms ?? [];
  if (terms.length === 0) return null;
  const nodeType: AstNodeType =
    watchlist.matchType === 'hashtag' ? 'HASHTAG' : watchlist.matchType === 'account' ? 'ACCOUNT' : 'TERM';
  const leaves: AstNode[] = terms.map((value) => ({ type: nodeType, value }) as AstNode);
  return leaves.reduce((left, right) => ({ type: 'OR', left, right }));
}

/**
 * In-process validation: evaluates candidate search result (title + snippet/description)
 * against the triggering watchlist's exact AST filter rules before ingestion (100% precision).
 */
export function validateCandidateMatch(
  watchlist: Watchlist,
  candidate: BingSearchItem
): boolean {
  const ast = watchlistToAst(watchlist);
  if (!ast) return false;

  const candidateText = [candidate.name, candidate.description, candidate.snippet]
    .filter(Boolean)
    .join('. ');

  const matchablePost: MatchablePost = {
    id: candidate.url,
    text: candidateText,
  };

  return matchesAst(ast, matchablePost);
}
