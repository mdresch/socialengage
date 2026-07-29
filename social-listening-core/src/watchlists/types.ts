/**
 * Simple OR-of-terms matching only (keyword/hashtag/account) — full boolean
 * query grammar (AND/OR/NOT combinations) and a unified AST both connector-side
 * translation and fallback matching evaluate identically is Story 3.6's job
 * (ADR-0021, Blocked). See .claude/skills/watchlist-matching/SKILL.md.
 */
export interface WatchlistTerms {
  keywords?: string[];
  hashtags?: string[];
  accounts?: string[];
}
