# Boolean Query AST & Query Capabilities (Backend)

## Purpose
Defines the canonical `WatchlistAST` JSON schema, connector query capability discovery (`GET /v1/connectors/:platformId/query-capabilities`), save-time AST validation (`422 UNSUPPORTED_QUERY_CLAUSE`), and fallback evaluation engine for multi-platform watchlists per ADR-0102.

## Canonical Schema: `WatchlistAST`
```typescript
export type WatchlistClauseType =
  | 'keyword'
  | 'phrase'
  | 'hashtag'
  | 'mention'
  | 'author'
  | 'source'
  | 'sentiment'
  | 'date'
  | 'nested';

export type WatchlistOperator = 'AND' | 'OR' | 'NOT';

export interface WatchlistAST {
  operator: WatchlistOperator;
  clauses: WatchlistClause[];
}
```

## Supported Clauses
1. `keyword`: Single token or stem match.
2. `phrase`: Exact multi-word sequence match.
3. `hashtag`: Tag match (without `#` symbol prefix in `value`).
4. `mention` / `account`: Account handle mention.
5. `author`: Post author identifier match.
6. `source`: Platform / connector source identifier (e.g. `gnews`, `newswire`).
7. `sentiment`: Post sentiment polarity (`positive`, `negative`, `neutral`).
8. `date`: Post date range filter with operator (`>=`, `<=`, `=`, `>`, `<`).
9. `nested`: Nested group with its own `operator` and sub-`clauses`.

## Query Capabilities Contract
- Endpoint: `GET /v1/connectors/:platformId/query-capabilities`
- Returns:
```json
{
  "platformId": "gnews",
  "supportedClauses": ["keyword", "phrase", "source", "date", "nested"],
  "supportedOperators": ["AND", "OR", "NOT"],
  "limits": {
    "maxLength": 500,
    "maxClauses": 20
  }
}
```

## Save-Time Validation
When creating or updating a watchlist with `ast` and target `platformIds`:
- `validateAstForConnector(ast, platformId)` runs against all target platforms.
- If any target platform does not support a clause type or operator, API responds with HTTP 422:
```json
{
  "code": "UNSUPPORTED_QUERY_CLAUSE",
  "offendingClause": { "type": "sentiment", "value": "negative" },
  "reason": "Platform 'instagram' does not support clause type 'sentiment'"
}
```

## Matching & AST Evaluation
`evaluateWatchlistAst(ast: WatchlistAST, post: MatchablePost): boolean`
Evaluates the canonical AST during fallback ingestion when native connector-side filtering is unavailable.
