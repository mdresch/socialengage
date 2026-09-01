# ADR-0110: Per-connector query translation and validation

**Status:** Accepted (2026-08-28)

**Authorizes:** the `WatchlistAST` to platform-specific query translation layer, the `ConnectorQueryCapability` allowlist, and the validation that rejects unsupported clauses before they reach a connector.

**Source:** `docs/product-research/feature-designs/02-boolean-query-builder.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The AST is canonical, but platforms are not
`ADR-0102` established a canonical `WatchlistAST`. Each `SocialConnector` must translate the AST into the platform's native query syntax (Google News, Bing, Brave, X, etc.). The capabilities differ, so translation must be safe and transparent.

### 2. Unsupported clauses must fail fast
If a connector cannot express a clause, the watchlist should be rejected at save time rather than silently returning bad results at runtime.

### 3. Fallback matching exists
`watchlist-matching` (per `SKILL.md`) evaluates the AST in process as a fallback. Native translation is an optimization, but it must produce a subset of the fallback result set.

---

## Decision

### 1. New `ConnectorQueryTranslator` interface
```ts
interface ConnectorQueryTranslator {
  platformId: string;
  supportedClauses: ClauseType[];
  supportedOperators: ('AND' | 'OR' | 'NOT' | 'date')[];
  maxClauseCount: number;
  maxQueryLength: number;
  translate(ast: WatchlistAST): NativeQuery | null;
  validate(ast: WatchlistAST): ValidationResult;
}

interface NativeQuery {
  query: string;              // the platform's query string
  params?: Record<string, string>; // platform-specific parameters
}
```

### 2. Capability registry
- Each connector implementation exposes a `getQueryTranslator()` or registers a `ConnectorQueryTranslator`.
- `GET /v1/connectors/:platformId/query-capabilities` returns the `supportedClauses`, `supportedOperators`, and limits.

### 3. Translation rules
- `keyword` → most platforms support plain terms. `X` supports `#keyword` if it matches `#hashtag`; otherwise it is treated as a term.
- `phrase` → wrapped in quotes `"..."` where supported; otherwise joined with `AND` and a warning is returned.
- `hashtag` → `#value` on X, Instagram, LinkedIn; treated as `keyword` on news search connectors.
- `mention` → `@value` on X, LinkedIn; not supported on GNews/Newswire.
- `author` → platform-specific author filter; unsupported on most news connectors.
- `source` → the platform id itself; silently ignored if the connector only searches its own source.
- `date` → converted to the connector's date parameter; unsupported on connectors that do not support date filtering.
- `sentiment` → post-fetch fallback only; not translated to native query.

### 4. Validation and fallback
- On watchlist save, `validateAstForConnector(ast, platformId)` runs `translator.validate()`.
- If the AST contains unsupported clauses, it returns `422 UNSUPPORTED_QUERY_CLAUSE` with the offending clause.
- If the AST cannot be fully translated but is still valid for fallback matching, the connector still runs fallback matching. The UI warns that native search is not available.
- All translated queries are bounded by `maxClauseCount` and `maxQueryLength`.

### 5. Test contract
- Every real `SocialConnector` has a contract test that translates a reference AST and asserts the native query shape.
- The contract test also verifies that fallback matching and native translation produce the same set of matched posts for a known test fixture.

---

## Consequences

1. **Correct native queries:** each connector sends a query the platform understands.
2. **Fast failure:** unsupported clauses are caught at save time.
3. **Fallback safety:** fallback matching ensures no posts are missed if translation is incomplete.
4. **Connector-specific complexity:** every new connector needs a translator. This is unavoidable.

---

## Alternatives considered

1. **Use only fallback matching and never translate to native queries.**
   - *Rejected:* it misses platform-level filtering, pagination, and rate-limit benefits. Native translation is a key optimization.

2. **Accept all watchlists and let the connector throw at runtime.**
   - *Rejected:* it creates a bad user experience. Save-time validation is much better.

3. **Auto-simplify the AST to fit the connector's capabilities.**
   - *Rejected:* silent simplification can change the meaning of a watchlist. The user should be warned and allowed to adjust.

---

## Open questions

- How are boolean `NOT` groups translated for platforms that do not support `NOT`?
- Should the connector use native `OR` or split into multiple queries?
- How is query length measured — characters, bytes, or encoded length?
- Should `date` clauses be validated against the connector's lookback window?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0102` (AST and visual builder), `ADR-0064` (connector-specific query rules), `ADR-0044` (watchlists)
