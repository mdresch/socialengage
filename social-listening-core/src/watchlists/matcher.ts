import { WatchlistTerms } from './types';
import { AstNode } from './ast';

export interface MatchablePost {
  id: string;
  text: string;
  authorExternalId?: string;
}

/**
 * The post-fetch fallback matcher (ADR-0006) — evaluated against every
 * fetched post for a platform with no native filtering support. A post
 * matches if any keyword/hashtag/account term matches (OR semantics; see
 * types.ts for why this isn't full boolean-query evaluation yet).
 */
export function matchesWatchlist(terms: WatchlistTerms, post: MatchablePost): boolean {
  const text = post.text.toLowerCase();

  const keywordMatch = (terms.keywords ?? []).some((keyword) => text.includes(keyword.toLowerCase()));
  const hashtagMatch = (terms.hashtags ?? []).some((hashtag) =>
    text.includes(`#${hashtag.toLowerCase().replace(/^#/, '')}`)
  );
  const accountMatch = (terms.accounts ?? []).some((account) => post.authorExternalId === account);

  return keywordMatch || hashtagMatch || accountMatch;
}

/**
 * Evaluates a parsed boolean-query AST (Story 3.6, ADR-0021) against a post —
 * the fallback-path evaluator that must agree with whatever a natively-
 * filtering platform would have already returned for the same query. See
 * .claude/skills/watchlist-matching/SKILL.md.
 */
export function matchesAst(ast: AstNode, post: MatchablePost): boolean {
  const text = post.text.toLowerCase();

  switch (ast.type) {
    case 'AND':
      return matchesAst(ast.left, post) && matchesAst(ast.right, post);
    case 'OR':
      return matchesAst(ast.left, post) || matchesAst(ast.right, post);
    case 'NOT':
      return !matchesAst(ast.operand, post);
    case 'TERM':
      return text.includes(ast.value.toLowerCase());
    case 'HASHTAG':
      return text.includes(`#${ast.value.toLowerCase()}`);
    case 'ACCOUNT':
      return post.authorExternalId === ast.value;
  }
}
