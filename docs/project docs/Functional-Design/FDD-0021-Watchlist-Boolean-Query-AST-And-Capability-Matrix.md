# BRD-0021 – Watchlist Boolean Query AST and Capability Matrix

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0021 – Watchlist Boolean Query AST and Capability Matrix |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md, ../Business-Requirements/BRD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0021-watchlist-boolean-query-ast-and-capability-matrix.md and the business requirements in BRD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md into functional design for **Watchlist Boolean Query AST And Capability Matrix**.
**What problem are we solving?**

Watchlist matching can take two paths: a connector's native server-side query, or a shared post-fetch fallback matcher. Without a single interpretation of the tenant's `booleanQuery`, these two paths can silently disagree — especially for expressions like `"acme AND (support OR help) NOT jobs"`, where every platform's query grammar is different. That undermines trust in the product: the same watchlist should return the same posts regardless of the source platform.

**Who is affected?**

- Tenants who build multi-term or boolean watchlists and expect consistent results across platforms.
- Connector authors who need a clear contract for what query features they must translate.
- Admin users who need visibility into whether a connector is honoring a watchlist natively or falling back.

**What is the proposed solution at a glance?**

Parse every `Watchlist.booleanQuery` exactly once into a canonical, platform-agnostic abstract syntax tree (AST). Connector native query translations and the shared post-fetch fallback both consume that same AST. Each connector declares the AST node types it supports (`supportedQueryFeatures`); unsupported queries degrade visibly to post-fetch matching instead of silently mis-translating.

**What business value do we expect?**

A single source of truth for boolean watchlist semantics, consistent cross-platform matching, and transparent, inspectable platform capability limits. This reduces connector-specific bugs, makes platform limitations visible, and supports the connector-status and watchlist-detail UI improvements planned for Phase 1.

---

### 2.2 Scope
**In scope:**
- A canonical AST representation of a `Watchlist.booleanQuery`.
- v1 AST node types: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- Single parse of `booleanQuery` into the AST before any connector or fallback matcher evaluates it.
- Connector-side translation of the same AST into native platform query syntax where supported.
- Shared post-fetch fallback matcher that evaluates the same AST against normalized post text.
- `supportedQueryFeatures: AstNodeType[]` declaration on the `SocialConnector` interface.
- Whole-query degradation to post-fetch matching when any AST node is unsupported for a given connector.
- Tenant-visible fallback indicators on the connector status page and the watchlist detail view.
- Contract-test targets that assert parity between native and fallback matching for the same watchlist.

**Out of scope:**
- Per-clause degradation for v1 (deferred until a third connector with partial, divergent support is proven necessary).
- Creation-time blocking warning in the watchlist builder UI for v1.
- `NEAR`, `WILDCARD`, regex, or other advanced operators beyond the v1 node types.
- A complete visual query builder UI (tracked separately; this BRD covers the AST and capability matrix only).

## 3. Context and Background
ADR-0006 established that watchlist matching happens connector-side where a platform supports native query filtering, falling back to post-fetch matching in the core otherwise. Its own Negative consequences already flag the resulting risk directly: matching logic exists in two places (each connector's native-query translation, and the shared post-fetch matcher) that need to behave *equivalently* for the same `Watchlist`, and nothing in the design ensures they actually do, especially for `booleanQuery` (`"acme AND (support OR help) NOT jobs"`) where platforms' native query grammars vary in what they can express.
**What problem are we solving?**

Watchlist matching can take two paths: a connector's native server-side query, or a shared post-fetch fallback matcher. Without a single interpretation of the tenant's `booleanQuery`, these two paths can silently disagree — especially for expressions like `"acme AND (support OR help) NOT jobs"`, where every platform's query grammar is different. That undermines trust in the product: the same watchlist should return the same posts regardless of the source platform.

**Who is affected?**

- Tenants who build multi-term or boolean watchlists and expect consistent results across platforms.
- Connector authors who need a clear contract for what query features they must translate.
- Admin users who need visibility into whether a connector is honoring a watchlist natively or falling back.

**What is the proposed solution at a glance?**

Parse every `Watchlist.booleanQuery` exactly once into a canonical, platform-agnostic abstract syntax tree (AST). Connector native query translations and the shared post-fetch fallback both consume that same AST. Each connector declares the AST node types it supports (`supportedQueryFeatures`); unsupported queries degrade visibly to post-fetch matching instead of silently mis-translating.

**What business value do we expect?**

A single source of truth for boolean watchlist semantics, consistent cross-platform matching, and transparent, inspectable platform capability limits. This reduces connector-specific bugs, makes platform limitations visible, and supports the connector-status and watchlist-detail UI improvements planned for Phase 1.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate silent divergence between connector-native and post-fetch watchlist matching | Contract tests prove the same watchlist produces the same matches on the same input data for mock full-support and no-support platforms |
| 2 | Make platform query limits an explicit, inspectable fact | `supportedQueryFeatures` is declared for every connector and surfaced in the admin UI capability matrix / badge |
| 3 | Reduce the cost and risk of onboarding new connectors | New connectors translate a single AST and declare support, rather than re-implementing boolean semantics |
| 4 | Maintain tenant trust when native filtering is unavailable | Fallback to post-fetch is shown to the tenant on the connector status page and the watchlist detail view |

---

**Positive consequences (from ADR):**
**Positive**
- Closes the exact gap ADR-0006 already flagged: native-path and fallback-path matching are now guaranteed to agree, because they share one parse rather than two interpretations.
- The capability matrix makes platform query limitations an explicit, inspectable fact (useful for the admin UI's connector status view, ADR-0009/ADR-0010) instead of an implicit gap a tenant discovers by noticing inconsistent results.
- A single AST definition is the one place boolean-query semantics need to be specified and tested, rather than semantics being implicitly defined by however many connectors happen to interpret `booleanQuery` strings.

**Negative**
- Building and maintaining a real parser (even a small boolean-expression one) is new, non-trivial infrastructure that didn't exist in the original design.
- Whole-query degradation is a real capability loss for connectors that support most, but not all, AST node types — a platform lacking only `NOT` support loses native filtering entirely for any query using `NOT`, not just the `NOT` clause. Per-clause degradation would recover more of the native-filtering benefit but is materially more complex to implement and to explain to tenants.
- Every connector author now needs to understand and correctly declare `supportedQueryFeatures` — an incorrect declaration (claiming support that doesn't translate correctly) reintroduces exactly the silent-divergence risk this ADR exists to close.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-F001 | The system shall parse a `Watchlist.booleanQuery` into a canonical AST before any matching path evaluates it | Must | `Watchlist.booleanQuery` is represented by AST node types before native translation or fallback evaluation | Product Owner |
| BR-F002 | The same AST shall be consumed by both connector-native translations and the shared post-fetch fallback matcher | Must | Connector translation and `matchesWatchlist()` both operate on the identical parsed AST | Product Owner |
| BR-F003 | Each connector shall declare `supportedQueryFeatures: AstNodeType[]` as part of its capability contract | Must | `SocialConnector` exposes `supportedQueryFeatures`; each connector's declaration is persisted and inspectable | Product Owner |
| BR-F004 | If a query contains any AST node not declared in a connector's `supportedQueryFeatures`, the entire query for that connector shall degrade to post-fetch matching | Must | A query with one unsupported node falls back completely; no partial native translation is attempted | Product Owner |
| BR-F005 | The system shall support v1 AST nodes `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, and `ACCOUNT` | Must | Parser and evaluator recognize and correctly handle all six v1 node types | Product Owner |
| BR-F006 | Degradation to post-fetch matching shall be visible to the tenant on the connector status page and watchlist detail view | Must | Connector status page shows `supportedQueryFeatures`; watchlist detail shows a "using post-fetch matching for X" badge | Product Owner |
| BR-F007 | The same `Watchlist` run against identical input data on a full-support platform and a no-support platform shall produce the same matched posts | Must | Parity contract test passes for representative corpus and all v1 operators | Product Owner |
| BR-F008 | The admin UI shall present a per-connector capability matrix for supported query features | Should | Connector status view lists `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` support per connector | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

A `Watchlist`'s `booleanQuery` (and `terms`/`matchType` generally) is parsed exactly once, at the core layer, into a canonical platform-agnostic abstract syntax tree (AST). Every connector that supports native server-side filtering translates *that same AST* into its own platform's query syntax; the shared post-fetch fallback matcher evaluates *that same AST* directly against normalized post text. Because both paths consume the identical parsed representation, they cannot silently diverge in how they interpret the tenant's query — there is one parse, many translations/evaluations of it, not multiple independent reimplementations of "what does this boolean query mean."

Each connector declares which AST node types it can translate to its platform's native query capability (e.g., a platform whose search API has no `NOT` operator declares that it can't translate `NOT` nodes). Anything a connector can't translate degrades to post-fetch matching, and — critically — this degradation is surfaced to the tenant, not silently absorbed, since a tenant relying on server-side filtering for cost/rate-limit reasons (ADR-0006's original motivation) needs to know when that assumption stops holding for a given platform.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- AST node types for v1: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- Degradation granularity: **whole-query**, not per-clause — if any part of a `Watchlist`'s query can't be natively translated for a platform, the *entire* query for that platform falls back to post-fetch matching, rather than natively translating the parts it can and post-fetch-matching only the unsupported clause. Simpler to reason about and to explain to a tenant ("this platform isn't using native filtering for this watchlist") than a mixed per-clause state, at the cost of losing native-filtering's rate-limit benefit (ADR-0006) for the whole query when only one clause is the problem.
- Capability declaration: connectors expose a `supportedQueryFeatures: AstNodeType[]` field (extending the `SocialConnector` interface from ADR-0002) that the core checks against the parsed AST before attempting native translation.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures and owns tenant-wide watchlists | High | Consistent, shareable watchlists and visible fallback warnings |
| Tenant-Business-Analyst | Builds complex monitoring queries | High | Same result set across platforms and the ability to preview matches |
| Tenant-User | Builds personal watchlists | Medium | Simple, validated query experience without learning Boolean syntax |
| Topic-Center-Analyst | Runs topic research with nested queries | High | Reliable nested AND/OR/NOT and phrase behavior |
| Tenant-Brand-Reputation-Manager | Uses `NOT` to exclude noise/competitors | Medium | Clear warning when a connector cannot translate an exclusion clause |
| Connector Author | Implements platform-specific filtering | High | Clear AST contract and capability declaration requirements |
| Platform Admin | Operates the multi-tenant service | Medium | Observable per-connector capability matrix and parity test results |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.6 | epic-3-data-model-storage-and-archival.md | As tenant with a watchlist using a boolean query, I want that query parsed once into a canonical AST that every connector's native translation and the shared... | A `Watchlist.booleanQuery` is parsed into an AST with `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` node types before any connector or fallback matcher evaluat... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Watchlist.booleanQuery` | Free-form boolean query string entered by the tenant | Tenant input | Tenant | Business intent |
| `Watchlist.watchlist_ast` | Canonical, serializable AST of the boolean query (JSONB) | Derived from `booleanQuery` | System | Internal structure |
| `Watchlist.matchType` | Matching mode indicator | Tenant / system | Tenant | Business intent |
| `SocialConnector.supportedQueryFeatures` | Array of AST node types the connector can translate natively | Connector declaration | Connector author | Platform capability |
| `post_watchlist_matches` | Junction table linking posts to watchlists they match | Matching pipeline | System | Tenant-scoped content |
| Connector status / capability matrix | Derived display of `supportedQueryFeatures` per connector | Derived from connector metadata | System | Operational visibility |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A `Watchlist.booleanQuery` is parsed exactly once and the resulting AST is the only representation used for matching. |
| BRU-002 | A connector must accurately declare `supportedQueryFeatures` for every AST node type it can translate correctly to its platform's native query. |
| BRU-003 | If any AST node in a watchlist query is not in a connector's `supportedQueryFeatures`, the entire query falls back to post-fetch matching for that connector. |
| BRU-004 | Degradation to post-fetch matching must be surfaced to the tenant; it may not be silently absorbed. |
| BRU-005 | The set of v1 AST node types is `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, and `ACCOUNT`. |
| BRU-006 | The post-fetch matcher and every connector-native translation must produce the same match set for the same AST and the same input data. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialConnector` interface (ADR-0002) | Architectural | Technical Lead | N/A — existing |
| D-002 | Connector-side watchlist filtering with post-fetch fallback (ADR-0006) | Architectural | Technical Lead | N/A — existing |
| D-003 | Connector status page / admin UI exposure (ADR-0009, ADR-0010) | UI/UX | Product Owner | Phase 1 admin UI scope |
| D-004 | `Watchlist` CRUD / row-shape validation (ADR-0044, Story 1.x) | Data model | Technical Lead | Existing or in-progress |
| D-005 | Story 3.6 — Unified boolean-query AST for watchlist matching | Implementation | Engineering | Shipped 2026-07-30 |

---

- The `watchlists` table already stores `booleanQuery` and `matchType`.
- A post-fetch matching mechanism exists and can evaluate an AST against ingested posts.
- Connector authors can accurately declare which AST node types their platform supports.
- The set of near-term connectors is small enough that whole-query degradation is acceptable.

**The durable decision — this is what would need superseding, not just amending:**

A `Watchlist`'s `booleanQuery` (and `terms`/`matchType` generally) is parsed exactly once, at the core layer, into a canonical platform-agnostic abstract syntax tree (AST). Every connector that supports native server-side filtering translates *that same AST* into its own platform's query syntax; the shared post-fetch fallback matcher evaluates *that same AST* directly against normalized post text. Because both paths consume the identical parsed representation, they cannot silently diverge in how they interpret the tenant's query — there is one parse, many translations/evaluations of it, not multiple independent reimplementations of "what does this boolean query mean."

Each connector declares which AST node types it can translate to its platform's native query capability (e.g., a platform whose search API has no `NOT` operator declares that it can't translate `NOT` nodes). Anything a connector can't translate degrades to post-fetch matching, and — critically — this degradation is surfaced to the tenant, not silently absorbed, since a tenant relying on server-side filtering for cost/rate-limit reasons (ADR-0006's original motivation) needs to know when that assumption stops holding for a given platform.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- AST node types for v1: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- Degradation granularity: **whole-query**, not per-clause — if any part of a `Watchlist`'s query can't be natively translated for a platform, the *entire* query for that platform falls back to post-fetch matching, rather than natively translating the parts it can and post-fetch-matching only the unsupported clause. Simpler to reason about and to explain to a tenant ("this platform isn't using native filtering for this watchlist") than a mixed per-clause state, at the cost of losing native-filtering's rate-limit benefit (ADR-0006) for the whole query when only one clause is the problem.
- Capability declaration: connectors expose a `supportedQueryFeatures: AstNodeType[]` field (extending the `SocialConnector` interface from ADR-0002) that the core checks against the parsed AST before attempting native translation.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The AST parser, evaluator, and per-connector translations are covered by contract tests | Maintainability | Must | Test suite includes all v1 operators, nested groups, and parity checks |
| NFR-002 | Native and fallback matching paths return equivalent results for the same watchlist and input data | Consistency | Must | Reference test corpus shows no divergence for supported connectors |
| NFR-003 | Fallback state and connector limitations are communicated in plain language to non-technical tenants | Usability | Should | UI badges and tooltips explain unsupported operators without requiring query syntax knowledge |
| NFR-004 | The parser rejects malformed boolean queries with a clear error instead of silently producing an incorrect AST | Reliability | Should | Invalid queries return a tenant-readable validation message |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Closes the exact gap ADR-0006 already flagged: native-path and fallback-path matching are now guaranteed to agree, because they share one parse rather than two interpretations.
- The capability matrix makes platform query limitations an explicit, inspectable fact (useful for the admin UI's connector status view, ADR-0009/ADR-0010) instead of an implicit gap a tenant discovers by noticing inconsistent results.
- A single AST definition is the one place boolean-query semantics need to be specified and tested, rather than semantics being implicitly defined by however many connectors happen to interpret `booleanQuery` strings.

**Negative**
- Building and maintaining a real parser (even a small boolean-expression one) is new, non-trivial infrastructure that didn't exist in the original design.
- Whole-query degradation is a real capability loss for connectors that support most, but not all, AST node types — a platform lacking only `NOT` support loses native filtering entirely for any query using `NOT`, not just the `NOT` clause. Per-clause degradation would recover more of the native-filtering benefit but is materially more complex to implement and to explain to tenants.
- Every connector author now needs to understand and correctly declare `supportedQueryFeatures` — an incorrect declaration (claiming support that doesn't translate correctly) reintroduces exactly the silent-divergence risk this ADR exists to close.

## 12. Assumptions and Dependencies
- The `watchlists` table already stores `booleanQuery` and `matchType`.
- A post-fetch matching mechanism exists and can evaluate an AST against ingested posts.
- Connector authors can accurately declare which AST node types their platform supports.
- The set of near-term connectors is small enough that whole-query degradation is acceptable.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Building and maintaining a real parser is more complex than the original per-connector string translation | Medium | High | Keep v1 node types minimal; cover all operators with contract tests; document the grammar and translation contract | Technical Lead |
| R-002 | Whole-query degradation loses rate-limit savings for connectors that support most but not all operators | Medium | Medium | Accept for v1; revisit once a third connector shows partial, divergent support; monitor fallback ratios | Product Owner |
| R-003 | A connector author declares support for an AST node it does not correctly translate, reintroducing silent divergence | Medium | High | Require contract tests that assert parity with the fallback matcher on a reference corpus before declaring support | Technical Lead |
| R-004 | Tenants misinterpret the fallback badge as a bug rather than a platform limitation | Medium | Low | Use plain-language tooltips and documentation explaining platform-specific operator support | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md`
- BRD: `../Business-Requirements/BRD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above