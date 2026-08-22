# ADR-0102: Boolean query AST and visual builder

**Status:** Proposed (2026-08-23)

**Authorizes:** a canonical `WatchlistAST` JSON schema for boolean queries, the `BooleanQueryBuilder` UI component, and the per-connector AST validation rules that prevent unsupported operators from reaching a connector.

**Source:** `docs/product-research/feature-designs/02-boolean-query-builder.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Watchlists already have a query language
`docs/product-research/feature-designs/02-boolean-query-builder.md` describes a visual boolean query builder. `ADR-0021` already defined a text-based `boolean_query` AST for watchlists. The visual builder is a UI over this AST.

### 2. Connectors vary in query support
Brave Search, Bing, GNews, and X have different query operators and length limits. The UI must disable or warn about unsupported operators before the user saves the watchlist.

### 3. The AST must stay canonical
The visual builder, the raw text `boolean_query` field, and the connector translators must all operate on the same AST so that watchlist matching is consistent.

---

## Decision

### 1. `WatchlistAST` schema (revision of ADR-0021)
```json
{
  "operator": "AND" | "OR" | "NOT",
  "clauses": [
    { "type": "keyword", "value": "SocialEngage" },
    { "type": "phrase", "value": "product launch" },
    { "type": "hashtag", "value": "#DevAI" },
    { "type": "mention", "value": "@example" },
    { "type": "author", "value": "example_author" },
    { "type": "source", "value": "gnews" },
    { "type": "sentiment", "value": "negative" },
    { "type": "date", "operator": ">=", "value": "2026-08-01" },
    { "type": "nested", "operator": "OR", "clauses": [...] }
  ]
}
```

### 2. Visual builder components
```
BooleanQueryBuilder
├── BooleanOperatorSelect (AND / OR / NOT)
├── ClauseRow (one row per clause)
│   ├── ClauseTypeSelect (keyword, phrase, hashtag, mention, author, source, sentiment, date)
│   ├── ClauseValueInput
│   └── ClauseDeleteButton
├── AddClauseButton
└── NestedClauseDropZone
```

- The builder renders the AST as a nested list of clauses.
- Users can add, remove, group, and reorder clauses.
- Clause types map to platform-specific operators in the connector translator.

### 3. Per-connector validation
- `GET /v1/connectors/:platformId/query-capabilities` returns a list of supported clause types, operators, and limits (max length, max clauses).
- On save, `watchlistStore` calls `validateAstForConnector(ast, platformId)`.
- Unsupported clauses return `422 UNSUPPORTED_QUERY_CLAUSE` with the offending clause.
- Warnings (e.g. query too long) are returned but do not block save.

### 4. Text/AST round trip
- The raw `boolean_query` text field is deprecated; the canonical source is `ast`.
- The UI can show a read-only text preview of the AST for power users.
- Existing watchlists with `boolean_query` are migrated to `ast` on first edit.

### 5. Watchlist matching
- `watchlist-matching` (per `SKILL.md`) evaluates the AST against a `SocialPost` for fallback matching.
- Connector-side native filtering (where available) translates the AST to the platform's query syntax.

---

## Consequences

1. **Consistent query model:** the visual builder, raw text, and connector translators all use the same AST.
2. **Fewer runtime errors:** unsupported operators are caught at save time.
3. **Better UX:** users get platform-specific warnings and a visual query builder.
4. **Migration cost:** existing `boolean_query` strings must be parsed into `ast` on edit.

---

## Alternatives considered

1. **Keep the `boolean_query` text field as the source of truth.**
   - *Rejected:* a text string is hard to validate, visualize, and translate to platform-specific queries. The AST is the better canonical form.

2. **Build a separate query model for each connector.**
   - *Rejected:* it duplicates logic and makes watchlist behavior inconsistent. The AST is platform-agnostic; translation is connector-specific.

3. **Use a third-party query-builder library unchanged.**
   - *Rejected:* off-the-shelf libraries do not understand the platform-specific capabilities and limits. A custom component is required.

---

## Open questions

- How are nested `NOT` and `OR` groups represented in the visual builder? Tree or flat with parentheses?
- Should the AST support fuzzy keyword matching or wildcards in v1?
- How is the `date` clause translated for connectors that do not support date filtering?
- What is the migration path for existing `boolean_query` strings? Parse on read or run a migration job?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0021` (boolean query AST), `ADR-0044` (watchlist CRUD), `ADR-0064` (connector-specific query rules)
