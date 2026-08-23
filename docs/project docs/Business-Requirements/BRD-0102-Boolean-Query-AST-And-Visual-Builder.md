# BRD-0102: Boolean Query AST and Visual Builder

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Business Requirements Document: Boolean Query AST and Visual Builder |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (sourced from ADR-0102) |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft (source ADR-0102 is Proposed) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0102, feature design `02-boolean-query-builder.md`, `feature-adr-scoping.md`, and Epic 12 stories 12.3–12.4 |

---

## 2. Executive Summary

Watchlists are the primary filtering artifact in SocialEngage, but they currently rely on a free-form `boolean_query` text string that is hard to validate, visualize, and translate consistently to each platform's native search grammar. Different connectors — GNews, Newswire, Brave Search, Bing, X, and others — support different Boolean operators, clause types, and length limits, so an unsupported operator can produce runtime errors or silently degraded results.

This BRD authorizes a canonical `WatchlistAST` JSON schema as the single source of truth for watchlist queries, a visual `BooleanQueryBuilder` UI component that non-technical users can operate, and per-connector validation that rejects unsupported clauses at save time. The raw `boolean_query` text field is deprecated and will be migrated to the AST on first edit. The same AST will be consumed by the visual builder, the read-only text preview, the in-process fallback matcher, and each connector's native query translator, ensuring that a watchlist always means the same thing regardless of which connector evaluates it.

The expected business value is fewer invalid watchlists, more precise mention filtering, lower skill barriers for building queries, and a consistent query model across the product.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate runtime query errors caused by unsupported connector clauses | Save-time validation rejects >95% of unsupported clauses before the watchlist is saved |
| 2 | Increase watchlist precision and reduce false positives | Support for `NOT`, `phrase`, `author`, `source`, `sentiment`, and `date` clauses with visual grouping |
| 3 | Lower the skill barrier for building effective watchlists | Non-technical `Tenant-User` can build a valid watchlist without knowing platform query syntax |
| 4 | Maintain one canonical query model across UI, API, and connectors | The same `WatchlistAST` is used by the builder, the text preview, fallback matching, and every native translator |

---

## 4. Scope

### 4.1 In Scope

- A canonical `WatchlistAST` JSON schema supporting `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `sentiment`, `date`, and nested `AND` / `OR` / `NOT` clauses.
- The `BooleanQueryBuilder` UI component with clause rows, operator selection, nested groups, add/delete/reorder actions, and a read-only text preview.
- `GET /v1/connectors/:platformId/query-capabilities` returning supported clause types, operators, and limits per connector.
- Save-time AST validation that returns `422 UNSUPPORTED_QUERY_CLAUSE` for unsupported clauses and non-blocking warnings for length or other limits.
- Deprecation and migration of the legacy `boolean_query` text field to the AST on first edit.
- Consistent use of the AST by the in-process `watchlist-matching` fallback and by connector-native query translators.

### 4.2 Out of Scope

- `NEAR/x`, wildcard (`*`, `?`), and regex query support (deferred to v2 per the feature design open questions).
- Natural-language-to-AST generation and AI query explanation (future AI enhancements).
- Real-time sample-match preview inside the builder (separate story/ADR).
- `language` and `location` field scoping in the AST for v1.
- Per-clause native/fallback mixed execution in v1; whole-query fallback remains the default where native translation is not possible.

### 4.3 Assumptions

- ADR-0102 will be accepted before implementation begins.
- ADR-0101 (connector capability matrix) and ADR-0044 (watchlist CRUD) are in place or accepted in the same delivery window.
- The existing `watchlists` table already stores `watchlist_ast` (JSONB) and `matchType`, or will be migrated to do so.
- Legacy `boolean_query` strings are syntactically parseable into the new AST, or will be surfaced to the user for repair on parse failure.
- Watchlist ownership and RLS already enforce tenant isolation.

### 4.4 Constraints

- The AST must never be evaluated as raw text against the database; all matching is in-process or translated to a platform-safe native query.
- Each connector imposes its own query length and clause-count limits, which must be respected at save time.
- The UI must remain accessible without relying solely on color to distinguish `AND` / `OR` / `NOT` operators.
- Multi-tenant isolation and RLS apply to all watchlist storage and query translation.

---

## 5. Stakeholders

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

## 6. Current State (As-Is)

Watchlists currently rely on a `boolean_query` text field. Tenants type free-form Boolean strings such as `acme AND (support OR help) NOT jobs`. Connectors translate these strings into their own platform query syntax, and a shared fallback matcher also evaluates the same text. Because the text is the source of truth, there is one parse at the core and another interpretation in each connector, creating a real risk that the two paths disagree on the meaning of the same query.

**Pain points:**
- Text syntax errors are not caught until a connector fails at runtime.
- Platform-specific operator and length limits are discovered after a query is saved and run.
- Non-technical users struggle to write valid Boolean strings.
- Power users cannot reliably export or inspect the canonical structure of a saved query.
- Inconsistent behavior between native platform filtering and post-fetch fallback matching is hard to debug.

---

## 7. Future State (To-Be)

After this initiative, every watchlist is stored as a canonical `WatchlistAST` object. The visual builder renders the AST as a nested list of clauses. Users add, remove, group, and reorder clauses with a guided interface. When a selected connector cannot translate a clause, the UI shows a warning before save, and the save is rejected with a specific `422` response for unsupported clauses. A read-only text preview remains available for power users.

**Expected capabilities:**
- The `watchlists.ast` JSONB field is the single source of truth; `boolean_query` is deprecated.
- The `BooleanQueryBuilder` supports all v1 clause types and nested `AND` / `OR` / `NOT` groups.
- `GET /v1/connectors/:platformId/query-capabilities` drives which clause types are offered for each platform.
- Save-time validation returns the offending clause for unsupported operators and non-blocking warnings for limits.
- Legacy `boolean_query` strings are parsed into the visual builder on first edit.
- The same AST is evaluated by the fallback matcher and translated by each connector's native query path.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Query-capability and validation responses shall complete within 200 ms for 95th percentile of requests | Performance | Must | Measured by contract and integration tests |
| NFR-002 | All watchlist AST data shall remain isolated by tenant and user via RLS | Security | Must | Verified by RLS contract tests |
| NFR-003 | The visual builder shall be operable with a keyboard and shall not rely solely on color to distinguish operators | Usability / Accessibility | Must | Accessibility audit and keyboard navigation tests pass |
| NFR-004 | Every real connector shall have a contract test asserting native translation parity with the fallback matcher | Maintainability | Must | Contract suite passes before the story is accepted |
| NFR-005 | The AST shall support at least 100 clauses per watchlist without UI degradation | Scalability | Should | Performance and rendering tests confirm usability at 100 clauses |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `watchlists.ast` | Canonical `WatchlistAST` JSONB query representation | User input / UI builder | Tenant-User / Tenant-Admin | Tenant-scoped; reveals search intent |
| `watchlists.boolean_query` | Deprecated free-form text query (migrated on edit) | Legacy watchlists | Tenant-User / Tenant-Admin | Tenant-scoped |
| `watchlists.matchType` | Indicates matching strategy (e.g., fallback, native, hybrid) | Derived from connector capability | System | Tenant-scoped |
| `ConnectorQueryCapability` | Supported clause types, operators, and limits per connector | Connector implementation | System | Public to authenticated tenants |
| `post_watchlist_matches` | Junction of posts that match a watchlist | Ingestion / matching pipeline | System | Tenant-scoped |
| `ValidationResult` | Save-time validation outcome including errors and warnings | `validateAstForConnector()` | System | Tenant-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Watchlist save validation failure rate | Track reduction in invalid queries | Product team | Weekly |
| Percentage of watchlists using AST vs. legacy text | Monitor migration to canonical model | Product team | Weekly |
| Native vs. fallback match rate by connector | Measure how often each connector can use native filtering | Engineering / Product | Weekly |
| Number of saved watchlists per tenant | Track adoption of the builder | Product / Customer success | Monthly |
| Most common unsupported-clause warnings | Prioritize future connector or UI work | Product / Engineering | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Legacy `boolean_query` strings cannot be parsed into the AST | Medium | High | Surface parse failures to the user for manual correction; do not silently drop legacy queries | Backend Engineer |
| R-002 | A connector incorrectly declares its capabilities, causing silent divergence between native and fallback matching | Medium | High | Contract tests assert native query shape and parity with fallback on a reference fixture for every real connector | Backend Engineer |
| R-003 | Non-technical users are confused by platform-specific warnings | Medium | Medium | Use plain-language tooltips and a connector capability matrix; provide query examples in the UI | Product Owner |
| R-004 | Nested `NOT` and `OR` groups are difficult to represent visually | Medium | Medium | Prototype tree vs. flat-with-parentheses layout early; usability test with analysts and brand managers | Frontend Engineer |
| R-005 | Native translation and fallback matching produce different result sets | Medium | High | Maintain a reference test corpus per connector; differences are treated as bugs until parity is proven | Backend Engineer |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A `WatchlistAST` schema supports `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `sentiment`, `date`, and nested `AND` / `OR` / `NOT` clauses.
- The `watchlists` table uses `ast` as the canonical field; the `boolean_query` text field is deprecated.
- Each connector exposes `supportedClauses`, `supportedOperators`, and limits via `GET /v1/connectors/:platformId/query-capabilities`.
- Saving a watchlist with an unsupported clause returns `422 UNSUPPORTED_QUERY_CLAUSE` and identifies the offending clause.
- Warnings for length or clause-count limits are returned but do not block the save.
- The `BooleanQueryBuilder` UI supports adding, deleting, grouping, and reordering clauses; clause types are filtered by the selected connector's capabilities.
- A read-only text preview of the AST is available for power users.
- Existing `boolean_query` strings are parsed into the visual builder on first edit.
- The fallback matcher continues to evaluate the AST in process.
- Contract tests demonstrate native-query translation parity with fallback matching for each real connector.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `WatchlistAST` | A canonical, platform-agnostic abstract syntax tree that represents the Boolean query of a watchlist. |
| `BooleanQueryBuilder` | The visual UI component that lets users compose a `WatchlistAST` without writing raw query text. |
| `Clause` | A single node in the AST, such as a keyword, phrase, hashtag, mention, author, source, sentiment, or date constraint. |
| `Connector` | A `SocialConnector` implementation that ingests posts from a platform and optionally supports native query translation. |
| `Native filtering` | Platform-level filtering performed by the connector's search API before posts are ingested. |
| `Fallback matching` | In-process evaluation of the AST against already-ingested `SocialPost` objects when native filtering cannot be used. |
| `Query capability` | A connector's declared support for clause types, operators, and query limits. |
| `Unsupported clause` | An AST clause that a selected connector cannot translate to its native query grammar. |

---

## 16. Appendices

- ADR-0102: `docs/adr/0102-boolean-query-ast-and-visual-builder.md`
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- Feature-to-ADR scoping plan: `docs/product-research/feature-adr-scoping.md`
- Related ADRs:
  - ADR-0021: `docs/adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md`
  - ADR-0044: `docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md`
  - ADR-0110: `docs/adr/0110-per-connector-query-translation-and-validation.md`
- Related user stories:
  - `docs/user-stories/epic-12-adr-0101-to-0108.md` — Story 12.3 (backend) and Story 12.4 (frontend)
- Missing source: A `docs/product-research/reports/<feature>-deep-research.md` brief for this feature was not found in the repository; the competitive research references in `02-boolean-query-builder.md` were used instead.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
