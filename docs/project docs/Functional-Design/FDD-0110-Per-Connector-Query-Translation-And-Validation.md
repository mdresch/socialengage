# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0110 Per-Connector Query Translation and Validation — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft — ADR-0110 is Proposed and may change before final acceptance) |
| Related Documents | ADR-0110, BRD-0110, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Social listening watchlists are stored as a canonical boolean Abstract Syntax Tree (AST) that can express keywords, phrases, hashtags, mentions, authors, sources, dates, and sentiment. Each connector (e.g., Google News, Bing, Brave, X, Instagram, LinkedIn) speaks a different native query language, with different operators, field filters, and length limits. Without a structured translation layer, the platform either under-uses a connector's native filtering or silently delivers wrong results.

This FDD translates the accepted architecture and business requirements from ADR-0110 and BRD-0110 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A `ConnectorQueryTranslator` contract that every connector can implement or register.
- Per-connector declaration of `supportedClauses`, `supportedOperators`, `maxClauseCount`, and `maxQueryLength`.
- A `GET /v1/connectors/:platformId/query-capabilities` endpoint exposing the capability allowlist.
- Translation of canonical `WatchlistAST` nodes into a connector's native query string and parameters.
- Save-time validation (`validateAstForConnector`) that rejects unsupported clauses with a clear, actionable error.
- Fallback matching as a safety net for watchlists that cannot be fully translated natively.
- Contract tests that assert native query shape and parity with fallback matching for each real connector.
- **Out of scope:** - The visual watchlist query builder UI itself (covered by `02-boolean-query-builder.md` and Story 13.3).
- Support for `NEAR`, wildcard, regex, or other advanced operators unless the connector already declares them.
- Auto-simplification of user queries to fit a connector's capabilities.
- Natural-language-to-AST generation (an AI enhancement in the feature design, not this ADR).
- Changes to the canonical AST definition (owned by ADR-0102).
- **Assumptions and constraints:** - A canonical `WatchlistAST` and in-process fallback matcher already exist (ADR-0102, `watchlist-matching`).
- Each connector is responsible for providing its own translator; the core platform provides the registry and validation orchestration.
- Translated native queries are treated as an optimization; the fallback matcher is the authoritative correctness baseline.
- Watchlists are already tenant-scoped and protected by RLS; this feature does not alter that model.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. The AST is canonical, but platforms are not
`ADR-0102` established a canonical `WatchlistAST`. Each `SocialConnector` must translate the AST into the platform's native query syntax (Google News, Bing, Brave, X, etc.). The capabilities differ, so translation must be safe and transparent.

### 2. Unsupported clauses must fail fast
If a connector cannot express a clause, the watchlist should be rejected at save time rather than silently returning bad results at runtime.

### 3. Fallback matching exists
`watchlist-matching` (per `SKILL.md`) evaluates the AST in process as a fallback. Native translation is an optimization, but it must produce a subset of the fallback result set.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure each connector sends a query the platform understands | Contract tests prove native query shape for every real connector and reference AST |
| 2 | Prevent silent bad results from unsupported clauses | Save-time validation returns a clear `422 UNSUPPORTED_QUERY_CLAUSE` with the offending clause |
| 3 | Preserve the existing fallback safety net | Fallback matching and native translation produce the same result set on the reference corpus |
| 4 | Reduce noise and improve watchlist precision | Users can build complex queries with `AND`, `OR`, `NOT`, phrase, and field scoping confidently |
| 5 | Keep connector-specific behavior transparent | UI can display a connector capability matrix and warn before save (enabled by Story 13.3) |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Each connector shall declare a query translator with `supportedClauses`, `supportedOperators`, `maxClauseCount`, and `maxQueryLength` | Must | Every real connector provides a translator; capabilities are programmatically discoverable | Backend Lead |
| BR-002 | The system shall expose a `GET /v1/connectors/:platformId/query-capabilities` endpoint | Must | Endpoint returns the connector's supported clauses, operators, and limits | Backend Lead |
| BR-003 | The system shall translate a canonical `WatchlistAST` into a connector's native query string and parameters when the connector declares support | Must | Reference ASTs produce expected native query shapes per connector in contract tests | Backend Lead |
| BR-004 | The system shall validate a watchlist AST against the selected connector's capabilities at save time | Must | Unsupported clauses return `422 UNSUPPORTED_QUERY_CLAUSE` and identify the offending clause | Backend Lead |
| BR-005 | The system shall allow a watchlist to be saved when it is only partially translatable, provided fallback matching can still run | Should | UI receives a warning; native query is not used for the untranslatable parts | Backend Lead |
| BR-006 | Translated queries shall respect the connector's `maxClauseCount` and `maxQueryLength` | Must | Queries exceeding limits are rejected before being sent to the connector | Backend Lead |
| BR-007 | Every real connector shall have a contract test proving native query shape and parity with fallback matching | Must | Tests pass in CI for every shipped connector | Backend Lead |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User | Builds personal watchlists | High | Clear feedback when a connector cannot support a clause |
| Tenant-Admin | Creates tenant-wide watchlists | High | Accurate, shareable monitoring queries |
| Tenant-Business-Analyst | Reuses watchlists in dashboards and exports | High | Native and fallback results are equivalent |
| Topic-Center-Analyst | Creates complex nested research queries | High | Support for phrase, author, source, and date scoping |
| Backend Engineer | Implements and maintains connectors | High | A clean, testable translator interface |
| Platform-Admin | Operates the connector roster | Medium | Capability discoverability and parity contract coverage |
| Tenant-Brand-Reputation-Manager | Excludes noise and competitors with `NOT` | Medium | Warnings when `NOT` or other clauses are not natively supported |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.2 | backend engineer | `ConnectorQueryTranslator` and `GET /v1/connectors/:platformId/query-capabilities`, | watchlist ASTs are translated to native queries and unsupported clauses fail at save time. | Each connector has a translator implementing `supportedClauses`, `maxClauseCount`, `maxQueryLength`, and `translate()`.; `GET /v1/connectors/:platformId/query-capabilities` returns capabilities.; Save-time validation returns `422 UNSUPPORTED_QUERY_CLAUSE`. |
| 13.3 | `Tenant-User` | the watchlist builder to warn me when a clause is not supported by the selected connector, | I can adjust my query before saving. | Unsupported clauses are highlighted in the visual builder.; A tooltip explains the platform-specific limitation.; The save button is disabled only for errors, not for warnings. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `watchlist_ast` | Canonical JSONB AST for a watchlist | `watchlists` table | Tenant/User | Tenant-scoped monitoring intent |
| `matchType` | Indicates native, fallback, or mixed matching mode | `watchlists` table | Tenant/User | Low |
| `platformId` | Connector identifier (e.g., `gnews`, `bing`, `x`) | `social_connectors` table / connector registry | System | Low |
| `supportedClauses` | Array of AST clause types the connector can translate | Connector translator | System | Low |
| `supportedOperators` | Array of boolean operators the connector supports | Connector translator | System | Low |
| `maxClauseCount` | Maximum number of clauses in a translated query | Connector translator | System | Low |
| `maxQueryLength` | Maximum length of the generated native query string | Connector translator | System | Low |
| `native_query` | Generated platform-specific query string and parameters | Translation layer | System | Low; no PII |
| `validation_result` | Result object including `valid`, `warnings`, and `unsupportedClauses` | Validation service | System | Low |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A connector must declare all AST clauses and operators it can translate before it can use native filtering. |
| BRU-002 | A watchlist containing unsupported clauses for the selected connector must be rejected at save time with `422 UNSUPPORTED_QUERY_CLAUSE`. |
| BRU-003 | If a clause is valid for fallback matching but cannot be translated natively, the system may save the watchlist and warn that native filtering is unavailable for that clause. |
| BRU-004 | A native translated query must produce a subset of the posts matched by the in-process fallback matcher for the same watchlist. |
| BRU-005 | Sentiment clauses are not translated to native query and are always handled by post-fetch fallback matching. |
| BRU-006 | `source` clauses are ignored for connectors that only search their own source; the connector id itself defines the source. |
| BRU-007 | `date` clauses are converted to the connector's native date parameter only if the connector supports date filtering. |
| BRU-008 | Translated queries must not exceed the connector's declared `maxClauseCount` or `maxQueryLength`. |
| BRU-009 | Auto-simplification of user queries to fit a connector is not allowed; semantic meaning must not change without explicit user action. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Save-time validation shall respond within 200 ms at the 95th percentile | Performance | Must | Measured via load/contract tests |
| NFR-002 | Translation and validation shall enforce existing tenant/user authorization and RLS | Security | Must | No watchlist AST is exposed across tenant boundaries |
| NFR-003 | Translation for the same AST and connector shall be deterministic | Reliability | Must | Same input produces same native query on repeated runs |
| NFR-004 | Adding a new connector translator shall not require changes to the core watchlist storage or validation orchestration | Maintainability | Should | New translator is registered, not wired into core logic |
| NFR-005 | Validation error messages shall be business-readable and identify the unsupported clause | Usability | Must | Error payload includes clause type and, where possible, the offending value |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Native and fallback matching produce different result sets for the same watchlist | Medium | High | Maintain a reference test corpus; require parity contract tests for every connector | Backend Lead |
| R-002 | Connector-specific translator code becomes hard to maintain | Medium | Medium | Clear `ConnectorQueryTranslator` interface; keep translators in connector modules; test shapes not live credentials | Backend Lead |
| R-003 | Users are confused by connector-specific warnings and limitations | Medium | Medium | UI capability matrix and plain-language tooltips (Story 13.3); user-facing documentation | Product Owner |
| R-004 | Open questions about `NOT`, `OR`, and date handling delay implementation | Medium | Low | Document open questions in the ADR; scope the first version to the decisions already made; resolve open questions in follow-up ADRs | Technical Lead |
| R-005 | Save-time validation adds latency to watchlist save | Low | Medium | Cache capability metadata; bound AST size and depth; measure p95 in contract tests | Backend Lead |

---

---

## 12. Assumptions and Dependencies

- A canonical `WatchlistAST` and in-process fallback matcher already exist (ADR-0102, `watchlist-matching`).
- Each connector is responsible for providing its own translator; the core platform provides the registry and validation orchestration.
- Translated native queries are treated as an optimization; the fallback matcher is the authoritative correctness baseline.
- Watchlists are already tenant-scoped and protected by RLS; this feature does not alter that model.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0102 canonical `WatchlistAST` and fallback matcher | Internal / Predecessor | Technical Lead | Accepted / implemented |
| D-002 | ADR-0064 connector-specific query rules | Internal / Predecessor | Technical Lead | Accepted |
| D-003 | ADR-0044 watchlists REST contract | Internal / Predecessor | Technical Lead | Accepted / implemented |
| D-004 | Feature design `02-boolean-query-builder.md` | Internal / Reference | Product Owner | High-level |
| D-005 | Story 13.3 query capability warnings in watchlist builder | Internal / Follow-on | Frontend Lead | After Story 13.2 |

---

---

## 13. Open Questions

- How are boolean `NOT` groups translated for platforms that do not support `NOT`?
- Should the connector use native `OR` or split into multiple queries?
- How is query length measured — characters, bytes, or encoded length?
- Should `date` clauses be validated against the connector's lookback window?

---

---

## 14. Appendix

### Reference Documents

- ADR-0110: `docs/adr/0110-per-connector-query-translation-and-validation.md`
- BRD-0110: `docs/project docs/Business-Requirements/BRD-0110-Per-Connector-Query-Translation-And-Validation.md`
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0110 and BRD-0110. |