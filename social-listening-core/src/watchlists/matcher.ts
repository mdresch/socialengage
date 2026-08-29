import { WatchlistTerms } from './types';
import { AstNode, WatchlistAST, WatchlistClause } from './ast';

export interface MatchablePost {
  id?: string;
  text: string;
  authorExternalId?: string;
  authorHandle?: string;
  providerId?: string;
  sentiment?: string;
  enrichment?: { sentiment?: string; [key: string]: any };
  createdAt?: string | Date;
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

/**
 * Evaluates a canonical WatchlistAST (Story 12.3, ADR-0102) against a post.
 */
export function evaluateWatchlistAst(ast: WatchlistAST, post: MatchablePost): boolean {
  const text = (post.text || '').toLowerCase();

  function evaluateClause(clause: WatchlistClause): boolean {
    switch (clause.type) {
      case 'keyword':
        return text.includes(clause.value.toLowerCase());
      case 'phrase':
        return text.includes(clause.value.toLowerCase());
      case 'hashtag': {
        const cleanTag = clause.value.toLowerCase().replace(/^#/, '');
        return text.includes(`#${cleanTag}`);
      }
      case 'mention': {
        const cleanMention = clause.value.toLowerCase().replace(/^@/, '');
        return text.includes(`@${cleanMention}`);
      }
      case 'author':
        return (
          post.authorExternalId === clause.value ||
          post.authorHandle?.toLowerCase() === clause.value.toLowerCase()
        );
      case 'source':
        return post.providerId?.toLowerCase() === clause.value.toLowerCase();
      case 'sentiment': {
        const postSentiment = (post.sentiment || post.enrichment?.sentiment || '').toLowerCase();
        return postSentiment === clause.value.toLowerCase();
      }
      case 'date': {
        if (!post.createdAt) return false;
        const postTime = new Date(post.createdAt).getTime();
        const clauseTime = new Date(clause.value).getTime();
        if (Number.isNaN(postTime) || Number.isNaN(clauseTime)) return false;

        switch (clause.operator) {
          case '>=':
            return postTime >= clauseTime;
          case '<=':
            return postTime <= clauseTime;
          case '>':
            return postTime > clauseTime;
          case '<':
            return postTime < clauseTime;
          case '=':
            return Math.abs(postTime - clauseTime) < 86400000;
          default:
            return false;
        }
      }
      case 'nested':
        return evaluateAstGroup(clause.operator, clause.clauses);
    }
  }

  function evaluateAstGroup(operator: 'AND' | 'OR' | 'NOT', clauses: WatchlistClause[]): boolean {
    if (clauses.length === 0) return true;

    if (operator === 'AND') {
      return clauses.every(evaluateClause);
    }
    if (operator === 'OR') {
      return clauses.some(evaluateClause);
    }
    if (operator === 'NOT') {
      return !clauses.some(evaluateClause);
    }
    return false;
  }

  return evaluateAstGroup(ast.operator, ast.clauses);
}
