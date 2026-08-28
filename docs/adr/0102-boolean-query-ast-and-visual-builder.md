# ADR-0102: Boolean query AST and visual builder

**Status:** Proposed (2026-08-23; revised 2026-08-28 with competitive research — see Revision below)

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

### 6. Revision (2026-08-28) — simple/advanced builder modes

Competitive research (`02-boolean-query-builder-deep-research.md`) found that a two-tier UI — a guided/simplified mode for non-technical users plus a full power-user mode over the same underlying query — is shipped at both the enterprise tier (Brandwatch's ~22-operator query API, https://developers.brandwatch.com/docs/queries) and the budget tier (Awario's two-click simplified builder alongside a full "Boolean mode" with word-order, grammar-form, and per-keyword language controls, https://awario.com/boolean/). This directly informs the `BooleanQueryBuilder`'s planned block-based structure from §2: both tiers ship simple and advanced modes simultaneously rather than treating advanced mode as a v2 add-on, so `BooleanQueryBuilder` (§2) gains an explicit mode toggle at v1:

```
BooleanQueryBuilder
├── ModeToggle (Guided / Advanced)
├── ... (Guided mode: §2's existing clause-row tree, unchanged)
└── Advanced mode: the existing read-only text preview (§2, §4) becomes directly editable,
    round-tripping through the same AST parser used for legacy `boolean_query` migration (§4)
```

Both modes operate on the identical `WatchlistAST` (§1) — this is a UI-layer addition only; no schema or validation-contract change follows from it. `Advanced` mode reuses the existing text-preview-to-AST parser (already required by §4's migration path) rather than introducing a second parser.

### Clarification (2026-08-28) — color is never the sole operator indicator

Meltwater's live Boolean Editor color-codes `AND`/`OR`/`NOT`/phrase elements as the user types, but the surrounding product help material treats this as an additive visual cue layered on labeled text, not a color-only signal (https://community.meltwater.com/explore-44/getting-started-with-boolean-search-7996). This confirms — as an explicit clarification, not a new requirement — an accessibility constraint already logically required by BRD-0102 NFR-003 ("shall not rely solely on color to distinguish operators") but not previously stated in this ADR's own Decision text: `BooleanOperatorSelect` (§2) and `ClauseRow` operator badges must always pair color with a text label or icon, never color alone. This is Meltwater's proven pattern (color-plus-text), applied here as the implementation baseline rather than left to the frontend team to infer from the BRD alone.

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
- **Added 2026-08-28:** Should a `field` sub-scope (title vs. body/"ingress") be added to news-type clauses once RSS/news connectors mature? Meltwater's Boolean Editor scopes queries to an article's title vs. its opening text specifically for news sources (https://community.meltwater.com/explore-44/getting-started-with-boolean-search-7996). Deferred to v2 — flagged here as a candidate `source`-clause refinement, not decided by this ADR.
- **Added 2026-08-28:** Should a natural-language-to-AST generator be prioritized for v1 rather than a later AI enhancement? Hootsuite ships a public natural-language-to-Boolean tool today (https://www.hootsuite.com/social-media-tools/boolean-generator), which is evidence this is a low-risk, proven pattern rather than a speculative one — but it remains out of scope for this ADR per BRD-0102 §4.2 ("Natural-language-to-AST generation... future AI enhancements"). Flagged here for prioritization consideration in a future ADR, not decided by this one.

---

## Amendment Log

- 2026-08-28 — Added Decision §6 (simple/advanced builder mode toggle) and a Clarification on color-plus-text operator labeling, per competitive research findings in `c:/Users/menno/Documents/Second Brain/raw/02-boolean-query-builder-deep-research.md` (Brandwatch, Awario, Meltwater). Added two Open Questions items (field scoping, NL-to-AST prioritization) for future consideration; neither is decided by this revision. Also notes: the research brief's finding that every reviewed competitor (Brandwatch, Meltwater) stores its query as a structured, versioned, API-addressable object rather than free text is a provenance confirmation of this ADR's existing `WatchlistAST`-as-canonical-source decision (§1, §4) — no change follows from it, cited here per `docs/adr/README.md`'s "Note on provenance" convention. Status remains **Proposed** — the drafting persona does not hold ADR-acceptance authority; only Menno accepts an ADR.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0021` (boolean query AST), `ADR-0044` (watchlist CRUD), `ADR-0064` (connector-specific query rules)
