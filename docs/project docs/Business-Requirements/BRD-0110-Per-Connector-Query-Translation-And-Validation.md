# Business Requirements Document — Per-Connector Query Translation and Validation

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Per-Connector Query Translation and Validation – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (auto-generated) |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft — ADR-0110 is Proposed and may change before final acceptance |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0110, feature design `02-boolean-query-builder.md`, and Epic 13 stories |

---

## 2. Executive Summary

Social listening watchlists are stored as a canonical boolean Abstract Syntax Tree (AST) that can express keywords, phrases, hashtags, mentions, authors, sources, dates, and sentiment. Each connector (e.g., Google News, Bing, Brave, X, Instagram, LinkedIn) speaks a different native query language, with different operators, field filters, and length limits. Without a structured translation layer, the platform either under-uses a connector's native filtering or silently delivers wrong results.

This BRD authorizes a **per-connector query translation and validation layer**. Each connector will declare what it can translate (`supportedClauses`, `supportedOperators`, and hard limits). When a user saves a watchlist, the system validates the AST against the selected connector's capabilities and rejects unsupported clauses immediately. When a connector can translate only part of a watchlist, the system falls back to the existing in-process `matchesWatchlist()` matcher and warns the user that native filtering is not available for every clause.

The business value is threefold: **more accurate native search results**, **faster failure for unusable queries**, and **transparent, explainable behavior** for non-technical users. It also keeps the product competitive with Brandwatch and Talkwalker, which expose per-platform query capability matrices.

> **Note:** ADR-0110 is currently **Proposed**; this BRD is a draft for review and will be finalized after the ADR is accepted.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure each connector sends a query the platform understands | Contract tests prove native query shape for every real connector and reference AST |
| 2 | Prevent silent bad results from unsupported clauses | Save-time validation returns a clear `422 UNSUPPORTED_QUERY_CLAUSE` with the offending clause |
| 3 | Preserve the existing fallback safety net | Fallback matching and native translation produce the same result set on the reference corpus |
| 4 | Reduce noise and improve watchlist precision | Users can build complex queries with `AND`, `OR`, `NOT`, phrase, and field scoping confidently |
| 5 | Keep connector-specific behavior transparent | UI can display a connector capability matrix and warn before save (enabled by Story 13.3) |

---

## 4. Scope

### 4.1 In Scope

- A `ConnectorQueryTranslator` contract that every connector can implement or register.
- Per-connector declaration of `supportedClauses`, `supportedOperators`, `maxClauseCount`, and `maxQueryLength`.
- A `GET /v1/connectors/:platformId/query-capabilities` endpoint exposing the capability allowlist.
- Translation of canonical `WatchlistAST` nodes into a connector's native query string and parameters.
- Save-time validation (`validateAstForConnector`) that rejects unsupported clauses with a clear, actionable error.
- Fallback matching as a safety net for watchlists that cannot be fully translated natively.
- Contract tests that assert native query shape and parity with fallback matching for each real connector.

### 4.2 Out of Scope

- The visual watchlist query builder UI itself (covered by `02-boolean-query-builder.md` and Story 13.3).
- Support for `NEAR`, wildcard, regex, or other advanced operators unless the connector already declares them.
- Auto-simplification of user queries to fit a connector's capabilities.
- Natural-language-to-AST generation (an AI enhancement in the feature design, not this ADR).
- Changes to the canonical AST definition (owned by ADR-0102).

### 4.3 Assumptions

- A canonical `WatchlistAST` and in-process fallback matcher already exist (ADR-0102, `watchlist-matching`).
- Each connector is responsible for providing its own translator; the core platform provides the registry and validation orchestration.
- Translated native queries are treated as an optimization; the fallback matcher is the authoritative correctness baseline.
- Watchlists are already tenant-scoped and protected by RLS; this feature does not alter that model.

### 4.4 Constraints

- Translated queries must not exceed the connector's declared `maxClauseCount` or `maxQueryLength`.
- The semantic meaning of a watchlist must not be silently altered to fit a connector.
- Validation must not bypass tenant/user authorization or RLS.
- The solution must be testable against real connector shapes without requiring live platform credentials for every unit test.

---

## 5. Stakeholders

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

## 6. Current State (As-Is)

Watchlists are already stored as a normalized `watchlist_ast` in Postgres and are evaluated by an in-process fallback matcher. Connectors ingest posts either through a platform's own search API or an RSS feed. When a connector runs, it currently does not receive a translated version of the watchlist AST; it either relies on the platform's unfiltered feed or on the fallback matcher applied after ingestion.

**Pain points:**

- No standardized way for a connector to declare which AST clauses it can express natively.
- Unsupported clauses may fail at runtime, produce empty or noisy result sets, or force the platform to rely entirely on fallback matching.
- Users have no visibility into which connectors support `NOT`, phrase search, date filtering, author filters, or hashtags.
- Adding a new connector requires ad-hoc decisions about query syntax and validation.

---

## 7. Future State (To-Be)

Each connector exposes a `ConnectorQueryTranslator` that the platform queries for capabilities and uses to translate a watchlist AST. When a user saves a watchlist, the backend validates the AST against the selected connector's `supportedClauses`, `supportedOperators`, and limits. If any clause is unsupported, the save is rejected with a precise error. If the AST is only partially translatable, the watchlist may still be saved, but the UI is informed so it can warn the user and rely on fallback matching.

**Expected capabilities:**

- Retrieve per-connector query capabilities through a stable REST endpoint.
- Translate AST nodes (`keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `date`) to the connector's native syntax, when supported.
- Reject watchlists with unsupported clauses at save time (`422 UNSUPPORTED_QUERY_CLAUSE`).
- Keep fallback matching as the authoritative matcher when native translation is incomplete or unavailable.
- Enforce per-connector `maxClauseCount` and `maxQueryLength` limits.
- Prove parity between native translation and fallback matching through contract tests.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Each connector shall declare a query translator with `supportedClauses`, `supportedOperators`, `maxClauseCount`, and `maxQueryLength` | Must | Every real connector provides a translator; capabilities are programmatically discoverable | Backend Lead |
| BR-002 | The system shall expose a `GET /v1/connectors/:platformId/query-capabilities` endpoint | Must | Endpoint returns the connector's supported clauses, operators, and limits | Backend Lead |
| BR-003 | The system shall translate a canonical `WatchlistAST` into a connector's native query string and parameters when the connector declares support | Must | Reference ASTs produce expected native query shapes per connector in contract tests | Backend Lead |
| BR-004 | The system shall validate a watchlist AST against the selected connector's capabilities at save time | Must | Unsupported clauses return `422 UNSUPPORTED_QUERY_CLAUSE` and identify the offending clause | Backend Lead |
| BR-005 | The system shall allow a watchlist to be saved when it is only partially translatable, provided fallback matching can still run | Should | UI receives a warning; native query is not used for the untranslatable parts | Backend Lead |
| BR-006 | Translated queries shall respect the connector's `maxClauseCount` and `maxQueryLength` | Must | Queries exceeding limits are rejected before being sent to the connector | Backend Lead |
| BR-007 | Every real connector shall have a contract test proving native query shape and parity with fallback matching | Must | Tests pass in CI for every shipped connector | Backend Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Save-time validation shall respond within 200 ms at the 95th percentile | Performance | Must | Measured via load/contract tests |
| NFR-002 | Translation and validation shall enforce existing tenant/user authorization and RLS | Security | Must | No watchlist AST is exposed across tenant boundaries |
| NFR-003 | Translation for the same AST and connector shall be deterministic | Reliability | Must | Same input produces same native query on repeated runs |
| NFR-004 | Adding a new connector translator shall not require changes to the core watchlist storage or validation orchestration | Maintainability | Should | New translator is registered, not wired into core logic |
| NFR-005 | Validation error messages shall be business-readable and identify the unsupported clause | Usability | Must | Error payload includes clause type and, where possible, the offending value |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Watchlists saved with full native translation | Measure connector-native optimization adoption | Product / Backend | Weekly |
| Watchlists saved with partial translation + fallback | Track how often fallback matching is needed | Product / Backend | Weekly |
| `422 UNSUPPORTED_QUERY_CLAUSE` rejections by connector | Identify capability gaps and user confusion | Product / Backend | Daily |
| Native vs. fallback parity contract pass rate | Ensure correctness across connectors | Backend / QA | Per build |
| Translation latency (p50, p95) | Monitor save-time validation performance | Backend | Real-time via monitoring |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Native and fallback matching produce different result sets for the same watchlist | Medium | High | Maintain a reference test corpus; require parity contract tests for every connector | Backend Lead |
| R-002 | Connector-specific translator code becomes hard to maintain | Medium | Medium | Clear `ConnectorQueryTranslator` interface; keep translators in connector modules; test shapes not live credentials | Backend Lead |
| R-003 | Users are confused by connector-specific warnings and limitations | Medium | Medium | UI capability matrix and plain-language tooltips (Story 13.3); user-facing documentation | Product Owner |
| R-004 | Open questions about `NOT`, `OR`, and date handling delay implementation | Medium | Low | Document open questions in the ADR; scope the first version to the decisions already made; resolve open questions in follow-up ADRs | Technical Lead |
| R-005 | Save-time validation adds latency to watchlist save | Low | Medium | Cache capability metadata; bound AST size and depth; measure p95 in contract tests | Backend Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0102 canonical `WatchlistAST` and fallback matcher | Internal / Predecessor | Technical Lead | Accepted / implemented |
| D-002 | ADR-0064 connector-specific query rules | Internal / Predecessor | Technical Lead | Accepted |
| D-003 | ADR-0044 watchlists REST contract | Internal / Predecessor | Technical Lead | Accepted / implemented |
| D-004 | Feature design `02-boolean-query-builder.md` | Internal / Reference | Product Owner | High-level |
| D-005 | Story 13.3 query capability warnings in watchlist builder | Internal / Follow-on | Frontend Lead | After Story 13.2 |

---

## 14. Acceptance Criteria

- Each real connector has a translator implementing `supportedClauses`, `supportedOperators`, `maxClauseCount`, `maxQueryLength`, `translate()`, and `validate()`.
- `GET /v1/connectors/:platformId/query-capabilities` returns the translator's capabilities.
- Save-time validation returns `422 UNSUPPORTED_QUERY_CLAUSE` when a watchlist AST contains a clause the selected connector cannot translate.
- Partially translatable watchlists can still be saved if fallback matching supports the full AST; a warning is surfaced for the UI to display.
- Contract tests assert the native query shape for reference ASTs for every real connector.
- Contract tests assert that fallback matching and native translation produce the same matched post set on the reference corpus.
- Translated queries are rejected if they exceed `maxClauseCount` or `maxQueryLength`.
- All endpoints enforce existing tenant/user RLS and authorization.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `WatchlistAST` | A canonical, serializable Abstract Syntax Tree representing a boolean query used to match social posts. |
| `ConnectorQueryTranslator` | The contract through which a connector declares what it can translate and how it translates a `WatchlistAST` into a native query. |
| `Native Query` | The platform-specific query string and parameters sent to a connector's search API (e.g., Google News, X, Bing). |
| `Fallback Matching` | In-process evaluation of a `WatchlistAST` against ingested `SocialPost`s, used when native translation is unavailable or incomplete. |
| `ClauseType` | A node type in the AST such as `keyword`, `phrase`, `hashtag`, `mention`, `author`, `source`, `date`, or `sentiment`. |
| `ConnectorQueryCapability` | The allowlist of supported clauses, operators, and query limits for a given connector. |
| `ValidationResult` | The outcome of validating a `WatchlistAST` against a connector's capabilities, including validity, warnings, and any unsupported clauses. |
| `Watchlist` | A saved, reusable boolean query used to monitor mentions across one or more connectors. |

---

## 16. Appendices

### Appendix A — Source documents

| Document | Path | Status |
|---|---|---|
| ADR-0110 (Proposed) | `docs/adr/0110-per-connector-query-translation-and-validation.md` | Found |
| Feature design: Boolean query builder | `docs/product-research/feature-designs/02-boolean-query-builder.md` | Found |
| Feature-to-ADR scoping plan | `docs/product-research/feature-adr-scoping.md` | Found |

### Appendix B — Related ADRs

- ADR-0102 — Canonical `WatchlistAST` and visual builder
- ADR-0064 — Connector-specific query rules
- ADR-0044 — Watchlists REST contract

### Appendix C — Related user stories

| Story | Source | One-line intent | Key acceptance criteria |
|---|---|---|---|
| Story 13.2 | ADR-0110 | As a backend engineer, I want `ConnectorQueryTranslator` and a capabilities endpoint so watchlist ASTs are translated and unsupported clauses fail at save time. | Translator interface; capabilities endpoint; `422 UNSUPPORTED_QUERY_CLAUSE`; contract tests; fallback safety. |
| Story 13.3 | ADR-0110 | As a Tenant-User, I want the watchlist builder to warn me when a clause is not supported by the selected connector so I can adjust before saving. | Unsupported clauses highlighted; platform-specific tooltip; save disabled only on errors; warnings update on platform change. |

### Appendix D — Missing source material

- No `docs/product-research/reports/02-boolean-query-builder-deep-research.md` (or similarly named deep-research brief) was found for this feature. The BRD therefore does not include a competitive research brief appendix.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
