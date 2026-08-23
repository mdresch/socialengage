# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0102 Boolean Query AST and Visual Builder — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (source ADR-0102 is Proposed)) |
| Related Documents | ADR-0102, BRD-0102, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Watchlists are the primary filtering artifact in SocialEngage, but they currently rely on a free-form `boolean_query` text string that is hard to validate, visualize, and translate consistently to each platform's native search grammar. Different connectors — GNews, Newswire, Brave Search, Bing, X, and others — support different Boolean operators, clause types, and length limits, so an unsupported operator can produce runtime errors or silently degraded results.

This FDD translates the accepted architecture and business requirements from ADR-0102 and BRD-0102 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A canonical `WatchlistAST` JSON schema supporting `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `sentiment`, `date`, and nested `AND` / `OR` / `NOT` clauses.
- The `BooleanQueryBuilder` UI component with clause rows, operator selection, nested groups, add/delete/reorder actions, and a read-only text preview.
- `GET /v1/connectors/:platformId/query-capabilities` returning supported clause types, operators, and limits per connector.
- Save-time AST validation that returns `422 UNSUPPORTED_QUERY_CLAUSE` for unsupported clauses and non-blocking warnings for length or other limits.
- Deprecation and migration of the legacy `boolean_query` text field to the AST on first edit.
- Consistent use of the AST by the in-process `watchlist-matching` fallback and by connector-native query translators.
- **Out of scope:** - `NEAR/x`, wildcard (`*`, `?`), and regex query support (deferred to v2 per the feature design open questions).
- Natural-language-to-AST generation and AI query explanation (future AI enhancements).
- Real-time sample-match preview inside the builder (separate story/ADR).
- `language` and `location` field scoping in the AST for v1.
- Per-clause native/fallback mixed execution in v1; whole-query fallback remains the default where native translation is not possible.
- **Assumptions and constraints:** - ADR-0102 will be accepted before implementation begins.
- ADR-0101 (connector capability matrix) and ADR-0044 (watchlist CRUD) are in place or accepted in the same delivery window.
- The existing `watchlists` table already stores `watchlist_ast` (JSONB) and `matchType`, or will be migrated to do so.
- Legacy `boolean_query` strings are syntactically parseable into the new AST, or will be surfaced to the user for repair on parse failure.
- Watchlist ownership and RLS already enforce tenant isolation.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Watchlists already have a query language
`docs/product-research/feature-designs/02-boolean-query-builder.md` describes a visual boolean query builder. `ADR-0021` already defined a text-based `boolean_query` AST for watchlists. The visual builder is a UI over this AST.

### 2. Connectors vary in query support
Brave Search, Bing, GNews, and X have different query operators and length limits. The UI must disable or warn about unsupported operators before the user saves the watchlist.

### 3. The AST must stay canonical
The visual builder, the raw text `boolean_query` field, and the connector translators must all operate on the same AST so that watchlist matching is consistent.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate runtime query errors caused by unsupported connector clauses | Save-time validation rejects >95% of unsupported clauses before the watchlist is saved |
| 2 | Increase watchlist precision and reduce false positives | Support for `NOT`, `phrase`, `author`, `source`, `sentiment`, and `date` clauses with visual grouping |
| 3 | Lower the skill barrier for building effective watchlists | Non-technical `Tenant-User` can build a valid watchlist without knowing platform query syntax |
| 4 | Maintain one canonical query model across UI, API, and connectors | The same `WatchlistAST` is used by the builder, the text preview, fallback matching, and every native translator |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store each watchlist as a canonical `WatchlistAST` object in the `watchlists.ast` JSONB field | Must | `PATCH /v1/watchlists/:id` accepts and persists a valid AST; `watchlist_ast` is the source of truth | Product Owner |
| BR-002 | The AST shall support `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `sentiment`, `date`, and nested `AND` / `OR` / `NOT` clauses | Must | All listed clause types are representable and round-trip through the API | Product Owner |
| BR-003 | The system shall expose `GET /v1/connectors/:platformId/query-capabilities` returning `supportedClauses`, `supportedOperators`, and limits for each connector | Must | Endpoint returns realistic capability objects for at least the existing connectors | Product Owner |
| BR-004 | The system shall validate the watchlist AST against the selected connector before saving and return `422 UNSUPPORTED_QUERY_CLAUSE` with the offending clause | Must | Contract test demonstrates rejection of an unsupported clause and acceptance of a supported one | Product Owner |
| BR-005 | The UI shall provide a `BooleanQueryBuilder` component that allows adding, deleting, grouping, and reordering clauses | Must | Component renders clause rows, operator selection, nested groups, and add/delete buttons | Product Owner |
| BR-006 | The clause-type selector shall be filtered to the connector's supported clause types | Should | Unsupported clause types are disabled or hidden for the selected connector | Product Owner |
| BR-007 | The UI shall display a read-only text preview of the AST for power users | Should | Preview updates as clauses are edited and is accessible from the watchlist editor | Product Owner |
| BR-008 | Existing `boolean_query` text strings shall be parsed into the AST when the watchlist is edited for the first time | Must | Legacy strings are migrated on edit; parse failures are surfaced for user correction | Product Owner |
| BR-009 | Each connector shall translate the canonical AST into the platform's native query syntax | Must | Contract tests verify native query shape for each real connector | Product Owner |
| BR-010 | The in-process fallback matcher shall evaluate the same AST used by the visual builder and native translators | Must | Fallback matcher produces the same result for a reference AST as a known-good fixture | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Creates and manages tenant-wide watchlists | High | Visual builder that validates connector-specific support |
| Tenant-Business-Analyst | Builds complex, reusable queries for dashboards and exports | High | AST export, read-only text preview, reusable watchlists |
| Tenant-User | Builds personal watchlists with limited query syntax knowledge | High | Intuitive visual query composer and clear warnings |
| Topic-Center-Analyst | Scopes topic research with nested Boolean queries | Medium | Phrase matching, nested groups, and source/author scoping |
| Tenant-Brand-Reputation-Manager | Excludes noise and competitors with `NOT` operators | Medium | Clear warnings when a clause cannot be translated to a connector |
| Backend Engineer | Implements AST, validation, and connector translation | High | Stable schema, contract-test targets, parity guarantees |
| Frontend Engineer | Implements `BooleanQueryBuilder` component | High | Reusable component hierarchy and debounced preview patterns |
| Product Owner | Owns roadmap and acceptance | Medium | Traceable requirements and measurable reduction in invalid queries |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.3 | backend engineer | a canonical `WatchlistAST`, `GET /v1/connectors/:platformId/query-capabilities`, and save-time validation, | watchlist queries are visual, platform-aware, and fail fast. | `WatchlistAST` schema supports `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `sentiment`, `date`, and `nested` clauses.; `watchlists` table uses `ast` as the canonical field; `boolean_query` text is migrated or deprecated.; Each connector exposes `supportedClauses`, `supportedOperators`, and limits. |
| 12.4 | `Tenant-User` | a visual query builder to add clauses, group them, and see platform-specific warnings, | I can build watchlists without learning platform query syntax. | `BooleanQueryBuilder` component with clause rows, operators, nested groups, and reordering.; Clause type selector filters to the platform's supported types.; Unsupported clauses show a warning before save. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `watchlists.ast` | Canonical `WatchlistAST` JSONB query representation | User input / UI builder | Tenant-User / Tenant-Admin | Tenant-scoped; reveals search intent |
| `watchlists.boolean_query` | Deprecated free-form text query (migrated on edit) | Legacy watchlists | Tenant-User / Tenant-Admin | Tenant-scoped |
| `watchlists.matchType` | Indicates matching strategy (e.g., fallback, native, hybrid) | Derived from connector capability | System | Tenant-scoped |
| `ConnectorQueryCapability` | Supported clause types, operators, and limits per connector | Connector implementation | System | Public to authenticated tenants |
| `post_watchlist_matches` | Junction of posts that match a watchlist | Ingestion / matching pipeline | System | Tenant-scoped |
| `ValidationResult` | Save-time validation outcome including errors and warnings | `validateAstForConnector()` | System | Tenant-scoped |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | The `watchlists.ast` field is the canonical source of truth for a watchlist's query; the legacy `boolean_query` text field is deprecated. |
| BRU-002 | A watchlist containing an unsupported clause for a selected connector is rejected with `422 UNSUPPORTED_QUERY_CLAUSE` and the offending clause is identified. |
| BRU-003 | Warnings such as query length or clause count are returned to the UI but do not block the save. |
| BRU-004 | Each connector declares its own `supportedClauses`, `supportedOperators`, `maxClauseCount`, and `maxQueryLength`. |
| BRU-005 | Existing `boolean_query` strings are parsed into the AST on first edit rather than during a batch migration. |
| BRU-006 | The visual builder, the read-only text preview, the fallback matcher, and the connector native translators all consume the same AST structure. |
| BRU-007 | Nested groups may use `AND`, `OR`, or `NOT` as the group operator, and `NOT` groups may contain nested sub-clauses. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Query-capability and validation responses shall complete within 200 ms for 95th percentile of requests | Performance | Must | Measured by contract and integration tests |
| NFR-002 | All watchlist AST data shall remain isolated by tenant and user via RLS | Security | Must | Verified by RLS contract tests |
| NFR-003 | The visual builder shall be operable with a keyboard and shall not rely solely on color to distinguish operators | Usability / Accessibility | Must | Accessibility audit and keyboard navigation tests pass |
| NFR-004 | Every real connector shall have a contract test asserting native translation parity with the fallback matcher | Maintainability | Must | Contract suite passes before the story is accepted |
| NFR-005 | The AST shall support at least 100 clauses per watchlist without UI degradation | Scalability | Should | Performance and rendering tests confirm usability at 100 clauses |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Legacy `boolean_query` strings cannot be parsed into the AST | Medium | High | Surface parse failures to the user for manual correction; do not silently drop legacy queries | Backend Engineer |
| R-002 | A connector incorrectly declares its capabilities, causing silent divergence between native and fallback matching | Medium | High | Contract tests assert native query shape and parity with fallback on a reference fixture for every real connector | Backend Engineer |
| R-003 | Non-technical users are confused by platform-specific warnings | Medium | Medium | Use plain-language tooltips and a connector capability matrix; provide query examples in the UI | Product Owner |
| R-004 | Nested `NOT` and `OR` groups are difficult to represent visually | Medium | Medium | Prototype tree vs. flat-with-parentheses layout early; usability test with analysts and brand managers | Frontend Engineer |
| R-005 | Native translation and fallback matching produce different result sets | Medium | High | Maintain a reference test corpus per connector; differences are treated as bugs until parity is proven | Backend Engineer |

---

---

## 12. Assumptions and Dependencies

- ADR-0102 will be accepted before implementation begins.
- ADR-0101 (connector capability matrix) and ADR-0044 (watchlist CRUD) are in place or accepted in the same delivery window.
- The existing `watchlists` table already stores `watchlist_ast` (JSONB) and `matchType`, or will be migrated to do so.
- Legacy `boolean_query` strings are syntactically parseable into the new AST, or will be surfaced to the user for repair on parse failure.
- Watchlist ownership and RLS already enforce tenant isolation.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0021: Unified boolean-query AST for watchlist matching, with per-connector capability matrix | Architectural | Product Owner / Technical Lead | Accepted; informs canonical AST |
| D-002 | ADR-0044: Watchlist API design and database schema standardization | Architectural | Product Owner / Technical Lead | Accepted; provides watchlist CRUD and JSONB storage |
| D-003 | ADR-0101: Multi-source connector capability matrix | Architectural | Product Owner / Technical Lead | Accepted; provides connector query capabilities |
| D-004 | ADR-0110: Per-connector query translation and validation | Architectural | Product Owner / Technical Lead | Proposed; defines translator interface and validation contract |
| D-005 | Story 12.3 — Boolean query AST and visual builder (backend) | Story | Backend Engineer | Ready; delivers AST, endpoint, and save-time validation |
| D-006 | Story 12.4 — Boolean query visual builder (frontend) | Story | Frontend Engineer | Ready; delivers `BooleanQueryBuilder` component |
| D-007 | `docs/product-research/feature-designs/02-boolean-query-builder.md` | Reference | Product Owner | Accepted high-level design |
| D-008 | `social-listening-core` and `social-listening-admin` repos built and contract-tested | Environment | Engineering | Existing |

---

---

## 13. Open Questions

- How are nested `NOT` and `OR` groups represented in the visual builder? Tree or flat with parentheses?
- Should the AST support fuzzy keyword matching or wildcards in v1?
- How is the `date` clause translated for connectors that do not support date filtering?
- What is the migration path for existing `boolean_query` strings? Parse on read or run a migration job?

---

---

## 14. Appendix

### Reference Documents

- ADR-0102: `docs/adr/0102-boolean-query-ast-and-visual-builder.md`
- BRD-0102: `docs/project docs/Business-Requirements/BRD-0102-Boolean-Query-AST-And-Visual-Builder.md`
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0102 and BRD-0102. |