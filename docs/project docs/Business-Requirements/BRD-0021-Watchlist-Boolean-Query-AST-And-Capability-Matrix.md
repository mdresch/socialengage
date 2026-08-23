# BRD-0021 – Watchlist Boolean Query AST and Capability Matrix

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0021 – Watchlist Boolean Query AST and Capability Matrix |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | BRD Writer Agent | Initial draft from ADR-0021, feature design, and stories |

---

## 2. Executive Summary

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

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate silent divergence between connector-native and post-fetch watchlist matching | Contract tests prove the same watchlist produces the same matches on the same input data for mock full-support and no-support platforms |
| 2 | Make platform query limits an explicit, inspectable fact | `supportedQueryFeatures` is declared for every connector and surfaced in the admin UI capability matrix / badge |
| 3 | Reduce the cost and risk of onboarding new connectors | New connectors translate a single AST and declare support, rather than re-implementing boolean semantics |
| 4 | Maintain tenant trust when native filtering is unavailable | Fallback to post-fetch is shown to the tenant on the connector status page and the watchlist detail view |

---

## 4. Scope

### 4.1 In Scope

- A canonical AST representation of a `Watchlist.booleanQuery`.
- v1 AST node types: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- Single parse of `booleanQuery` into the AST before any connector or fallback matcher evaluates it.
- Connector-side translation of the same AST into native platform query syntax where supported.
- Shared post-fetch fallback matcher that evaluates the same AST against normalized post text.
- `supportedQueryFeatures: AstNodeType[]` declaration on the `SocialConnector` interface.
- Whole-query degradation to post-fetch matching when any AST node is unsupported for a given connector.
- Tenant-visible fallback indicators on the connector status page and the watchlist detail view.
- Contract-test targets that assert parity between native and fallback matching for the same watchlist.

### 4.2 Out of Scope

- Per-clause degradation for v1 (deferred until a third connector with partial, divergent support is proven necessary).
- Creation-time blocking warning in the watchlist builder UI for v1.
- `NEAR`, `WILDCARD`, regex, or other advanced operators beyond the v1 node types.
- A complete visual query builder UI (tracked separately; this BRD covers the AST and capability matrix only).

### 4.3 Assumptions

- The `watchlists` table already stores `booleanQuery` and `matchType`.
- A post-fetch matching mechanism exists and can evaluate an AST against ingested posts.
- Connector authors can accurately declare which AST node types their platform supports.
- The set of near-term connectors is small enough that whole-query degradation is acceptable.

### 4.4 Constraints

- The parser and AST must be maintainable and well-tested infrastructure.
- No raw query string is executed against the database; AST evaluation is in-process.
- Native filtering rate-limit benefits (ADR-0006) may be lost for the entire query when any clause cannot be translated.

---

## 5. Stakeholders

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

## 6. Current State (As-Is)

**Current process:**

ADR-0006 established connector-side watchlist filtering with a post-fetch fallback in the core. Each connector that can do so translates watchlist terms into its platform's native query. For platforms without native support, the core evaluates the watchlist after fetching posts. This means matching logic effectively exists in two places — the connector's native translation and the shared fallback matcher — and there is no guarantee they interpret the same `booleanQuery` the same way.

**Pain points:**

- A `booleanQuery` can be interpreted differently by each connector's translation, leading to inconsistent matched posts across platforms.
- There is no explicit record of which connectors support which boolean operators.
- When a connector cannot translate part of a query, the tenant has no visibility into the fallback.
- Testing semantics is scattered across every connector instead of centered on one canonical representation.

---

## 7. Future State (To-Be)

**New or improved process:**

When a `Watchlist` is saved, its `booleanQuery` is parsed once into a canonical AST. Before a poll or fetch is sent to a connector, the core compares the AST's node types against that connector's declared `supportedQueryFeatures`. If every node type is supported, the connector receives a native query translation of the same AST. If any node type is not supported, the entire query for that connector falls back to the shared post-fetch matcher, which evaluates the identical AST against the fetched post text. The fallback is surfaced to the tenant on the connector status page and the watchlist detail view.

**Expected capabilities:**

- One parse, many translations/evaluations: the AST is the single source of truth.
- Native and fallback paths produce the same matches for the same input data.
- Every connector exposes an inspectable capability matrix (`supportedQueryFeatures`).
- Tenants see when a platform is not using native filtering for a given watchlist.
- New AST node types can be added without redefining boolean semantics per connector.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The AST parser, evaluator, and per-connector translations are covered by contract tests | Maintainability | Must | Test suite includes all v1 operators, nested groups, and parity checks |
| NFR-002 | Native and fallback matching paths return equivalent results for the same watchlist and input data | Consistency | Must | Reference test corpus shows no divergence for supported connectors |
| NFR-003 | Fallback state and connector limitations are communicated in plain language to non-technical tenants | Usability | Should | UI badges and tooltips explain unsupported operators without requiring query syntax knowledge |
| NFR-004 | The parser rejects malformed boolean queries with a clear error instead of silently producing an incorrect AST | Reliability | Should | Invalid queries return a tenant-readable validation message |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `Watchlist.booleanQuery` is parsed exactly once and the resulting AST is the only representation used for matching. |
| BRU-002 | A connector must accurately declare `supportedQueryFeatures` for every AST node type it can translate correctly to its platform's native query. |
| BRU-003 | If any AST node in a watchlist query is not in a connector's `supportedQueryFeatures`, the entire query falls back to post-fetch matching for that connector. |
| BRU-004 | Degradation to post-fetch matching must be surfaced to the tenant; it may not be silently absorbed. |
| BRU-005 | The set of v1 AST node types is `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, and `ACCOUNT`. |
| BRU-006 | The post-fetch matcher and every connector-native translation must produce the same match set for the same AST and the same input data. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Watchlist.booleanQuery` | Free-form boolean query string entered by the tenant | Tenant input | Tenant | Business intent |
| `Watchlist.watchlist_ast` | Canonical, serializable AST of the boolean query (JSONB) | Derived from `booleanQuery` | System | Internal structure |
| `Watchlist.matchType` | Matching mode indicator | Tenant / system | Tenant | Business intent |
| `SocialConnector.supportedQueryFeatures` | Array of AST node types the connector can translate natively | Connector declaration | Connector author | Platform capability |
| `post_watchlist_matches` | Junction table linking posts to watchlists they match | Matching pipeline | System | Tenant-scoped content |
| Connector status / capability matrix | Derived display of `supportedQueryFeatures` per connector | Derived from connector metadata | System | Operational visibility |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Watchlists with fallback by connector | Track how often each connector cannot use native filtering | Product / Platform Ops | Weekly |
| Native vs. post-fetch match ratio | Measure rate-limit savings and fallback cost | Platform Ops | Weekly |
| Connector AST parity test results | Confirm native and fallback paths remain equivalent | Engineering / QA | Per build |
| Unsupported operator usage | Identify which AST node types trigger fallback most often | Product | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Building and maintaining a real parser is more complex than the original per-connector string translation | Medium | High | Keep v1 node types minimal; cover all operators with contract tests; document the grammar and translation contract | Technical Lead |
| R-002 | Whole-query degradation loses rate-limit savings for connectors that support most but not all operators | Medium | Medium | Accept for v1; revisit once a third connector shows partial, divergent support; monitor fallback ratios | Product Owner |
| R-003 | A connector author declares support for an AST node it does not correctly translate, reintroducing silent divergence | Medium | High | Require contract tests that assert parity with the fallback matcher on a reference corpus before declaring support | Technical Lead |
| R-004 | Tenants misinterpret the fallback badge as a bug rather than a platform limitation | Medium | Low | Use plain-language tooltips and documentation explaining platform-specific operator support | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialConnector` interface (ADR-0002) | Architectural | Technical Lead | N/A — existing |
| D-002 | Connector-side watchlist filtering with post-fetch fallback (ADR-0006) | Architectural | Technical Lead | N/A — existing |
| D-003 | Connector status page / admin UI exposure (ADR-0009, ADR-0010) | UI/UX | Product Owner | Phase 1 admin UI scope |
| D-004 | `Watchlist` CRUD / row-shape validation (ADR-0044, Story 1.x) | Data model | Technical Lead | Existing or in-progress |
| D-005 | Story 3.6 — Unified boolean-query AST for watchlist matching | Implementation | Engineering | Shipped 2026-07-30 |

---

## 14. Acceptance Criteria

- A `Watchlist.booleanQuery` is parsed into an AST with `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` node types before any connector or fallback matcher evaluates it.
- Each connector declares `supportedQueryFeatures: AstNodeType[]`; a query containing a node type the connector does not support falls back to post-fetch matching for that platform, and this fallback is visible on the connector and watchlist status views.
- A test asserting the same `Watchlist` against a mock platform with full native support and a mock platform with no native support produces identical matched posts for identical input data.
- The admin UI connector status page and watchlist detail view display the fallback state clearly.

---

## 15. Glossary

| Term | Definition |
|---|---|
| AST (Abstract Syntax Tree) | A tree representation of a `booleanQuery` that captures operators, terms, hashtags, and accounts in a platform-agnostic structure. |
| `supportedQueryFeatures` | The array of AST node types a connector can translate into its platform's native query syntax. |
| Whole-query degradation | The v1 rule that a single unsupported AST node causes the entire watchlist query to fall back to post-fetch matching for that connector. |
| Post-fetch matching | Evaluating the watchlist AST against a post's normalized text after the post has already been fetched from the platform. |
| Native filtering | Server-side query translation that lets a platform return only posts matching the watchlist before data reaches the core. |
| `matchType` | The mode or strategy governing how a watchlist is matched against posts. |
| Watchlist | A saved tenant- or user-level query used to monitor and collect matching social posts. |

---

## 16. Appendices

### Reference documents

- [ADR-0021: Unified boolean-query AST for watchlist matching, with per-connector capability matrix](../../adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md)
- [Feature design: Boolean query builder](../../product-research/feature-designs/02-boolean-query-builder.md)
- [ADR-0006: Connector-side watchlist filtering with post-fetch fallback](../../adr/0006-connector-side-watchlist-filtering-with-post-fetch-fallback.md)
- [ADR-0002: `SocialConnector` interface](../../adr/0002-social-connector-interface.md) (assumed)
- [ADR-0009: Connector status / health view](../../adr/0009-connector-status-and-health-view.md) (assumed)
- [ADR-0010: Admin UI scope for Phase 1](../../adr/0010-admin-ui-phase-1-scope.md) (assumed)

### Related user stories

- [Story 3.6 — Unified boolean-query AST for watchlist matching](../../user-stories/epic-3-data-model-storage-and-archival.md) (source ADR-0021; shipped 2026-07-30)
- Connector-specific `supportedQueryFeatures` declarations in Epic 2 (e.g., Newswire, GNews, future connectors) reference ADR-0021's capability matrix pattern.

### Missing sources

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the watchlist boolean query or capability matrix feature. This does not block the BRD, but a deep-research brief should be added later if competitive/operator analysis is needed.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
