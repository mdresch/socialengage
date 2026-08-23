# Business Requirements Document: Watchlist Matching — Connector-Side with Fallback

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0006 — Watchlist Matching — Connector-Side with Fallback |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0006 and related design artifacts |

---

## 2. Executive Summary

Social listening tenants define watchlists using keywords, hashtags, accounts, and boolean queries to decide which posts are relevant. Platforms differ widely in how they expose server-side filtering: some support native query syntax, while others return a raw stream that must be filtered after it is fetched. Fetching everything and discarding mismatches wastes rate-limit budget and bandwidth, which is especially costly on quota-constrained platforms.

This BRD translates ADR-0006 into business terms. The proposed solution is to translate each watchlist into the connected platform's own native query syntax wherever possible, and to fall back to post-fetch matching in the core for platforms that cannot honor the watchlist server-side. The result is a uniform watchlist model and consistent matching behavior, while minimizing unnecessary API calls and cost.

The primary beneficiaries are tenant administrators who configure watchlists, tenant analysts who rely on complete and consistent matched posts, and the platform operator who owns rate-limit cost and connector health.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce rate-limit cost and bandwidth spent fetching non-matching posts | Percentage of connector calls filtered natively on supported platforms; reduced quota consumption per matched post |
| 2 | Preserve uniform watchlist behavior across all supported platforms | A given watchlist produces the same matched posts against the same input data, regardless of whether native or post-fetch matching was used |
| 3 | Avoid per-platform watchlist model divergence | The `Watchlist` schema remains unchanged as new connectors are added |
| 4 | Make fallback behavior visible and auditable | Operators and tenants can see which watchlists are using post-fetch fallback per platform |

---

## 4. Scope

### 4.1 In Scope

- Translation of watchlist terms and boolean queries into each connector's native platform query syntax.
- Post-fetch matching fallback in `social-listening-core` for platforms without native filtering support.
- Connector capability declaration (`supportedQueryFeatures`) used to choose native or fallback matching.
- Consistency verification between connector-side native matching and core post-fetch matching for the same watchlist.
- Observability of which matching path was used per ingestion run / connector.
- Handling of keyword, hashtag, account, and boolean watchlist match types.

### 4.2 Out of Scope

- Onboarding of any specific new connector (covered by connector-specific ADRs and stories).
- The watchlist query-builder UI (covered by ADR-0021 / Story 3.6).
- Alerting, case routing, or downstream analytics based on matched posts.
- Exact per-connector documentation of semantic gaps in native query grammars (required by ADR-0006 but produced separately per connector).

### 4.3 Assumptions

- The `Watchlist` model includes `matchType`, `terms`, `booleanQuery`, and `platformIds`, as defined in the 2026-07-28 Design Spec §4.4.
- Each connector can declare which query features it supports natively.
- The core can access normalized post text, metadata, and platform identifiers to perform post-fetch matching.
- Rate-limit and cost discipline (ADR-0003) is already enforced by the connector framework.

### 4.4 Constraints

- Matching behavior must be equivalent for the same watchlist across native and fallback paths.
- The `Watchlist` model must not be modified per connector.
- Non-retryable errors, including malformed or unsupported watchlist queries, must surface to the tenant rather than be silently retried.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Creates and manages watchlists | High | Watchlists work on every connected platform without per-platform tweaking |
| Tenant User / Analyst | Consumes matched posts and reports | High | Consistent, complete set of posts for a watchlist, regardless of source platform |
| Platform Operator / Menno | Owns rate-limit cost, quota, and connector health | High | Native filtering used wherever possible; fallback is visible and bounded |
| Connector Developer | Implements per-connector query translation | Medium | Clear contract for capability declaration and query translation |
| Delivery / AI Reviewer | Validates consistency and cost assumptions | Medium | Contract tests proving equivalence between native and fallback paths |

---

## 6. Current State (As-Is)

Before ADR-0006, the design did not explicitly distinguish between platform-native filtering and core-side post-fetch matching. In practice this meant either:

- Every connector would fetch a full, unfiltered stream and the core would discard non-matching posts, wasting API quota and bandwidth; or
- Each connector could implement ad-hoc filtering without a shared fallback, leading to inconsistent results across platforms.

**Pain points:**
- Quota-constrained platforms (e.g., YouTube-style daily quota models) would spend budget on posts that are immediately discarded.
- There was no uniform rule for which platforms filter server-side and which rely on the core.
- A tenant could see different matched-post sets for the same watchlist depending on which platform sourced the data.
- The `Watchlist` model risked being forked per platform to accommodate different query capabilities.

---

## 7. Future State (To-Be)

After implementation, the ingestion pipeline will follow this rule for every active watchlist and platform pair:

1. The connector receives the watchlist and inspects its own `supportedQueryFeatures` for the watchlist's `matchType`.
2. If the platform supports native filtering, the connector translates the watchlist into the platform's own query syntax and sends the filter with the request.
3. If the platform does not support native filtering, the connector fetches the available stream and the core evaluates the watchlist against each normalized `SocialPost` before persistence.
4. The same `Watchlist` definition is used in both paths; only the matching execution location changes.
5. `IngestionRun` records how many posts were fetched, matched, and skipped, and the matching path used.

**Expected capabilities:**
- Native query translation per connector on supported platforms.
- A shared, tenant-isolated post-fetch matcher in `social-listening-core`.
- Connector capability declarations drive the native-vs-fallback decision.
- Contract tests prove that native and fallback matching produce identical results for the same input data.
- UI and health views expose fallback usage where it occurs.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall translate a watchlist's keyword, hashtag, and account terms into the native query syntax of each connected platform that supports it. | Must | For a supported connector, the outbound request includes the translated filter and no post is ingested that does not match the watchlist. | Connector Developer |
| BR-002 | For platforms that cannot honor a watchlist's terms natively, the core shall evaluate each fetched, normalized post against the watchlist before persisting matches. | Must | Posts that do not match the watchlist are not persisted as matches for that watchlist. | Core Backend Engineer |
| BR-003 | The system shall support the same `Watchlist` model in both native and fallback paths without per-platform schema changes. | Must | No `Watchlist` column or table is created or altered specifically for a single platform. | Data Model Engineer |
| BR-004 | Connectors shall declare `supportedQueryFeatures` so the matching path can be selected automatically. | Must | The framework can read a connector's declared features and route the watchlist to native translation or post-fetch matching. | Connector Framework Owner |
| BR-005 | Matching results for the same watchlist and the same input data shall be equivalent, whether the platform filtered natively or the core filtered post-fetch. | Must | A contract test with a mock fully-native platform and a mock no-native-support platform produces identical matched posts. | QA / Contract Engineer |
| BR-006 | The system shall surface a watchlist/connector combination that falls back to post-fetch matching in connector health and status views. | Should | A tenant or operator can see which platform+watchlist pairs are not using native filtering. | UI / Backend Engineer |
| BR-007 | Malformed or unsupported watchlist queries shall fail the ingestion run with a clear, non-retryable error. | Should | A malformed watchlist does not trigger blind retries and the failure reason is recorded in `IngestionRun.errorSummary`. | Connector Developer |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Multi-tenant isolation: one tenant's watchlist matching must not access or affect another tenant's data. | Security | Must | Contract and regression tests confirm tenant-scoped matching across all paths. |
| NFR-002 | Fallback matching must not cause the ingestion pipeline to exceed documented p95 latency for the supported volume. | Performance | Should | p95 ingestion latency for the fallback path is measured and stays within the documented threshold. |
| NFR-003 | Every ingestion run must record the number of posts fetched, matched, skipped, and the matching path used. | Observability | Must | `IngestionRun` fields are populated and queryable by operator dashboards. |
| NFR-004 | The native and fallback matchers must be exercised by a permanent regression suite. | Maintainability | Must | Both matching paths have contract tests in the accumulated suite. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A connector whose `supportedQueryFeatures` includes the watchlist's `matchType` must use native server-side filtering when available. |
| BRU-002 | If a connector does not support the watchlist's terms natively, the core post-fetch matcher must evaluate the normalized post's text and relevant metadata. |
| BRU-003 | The `Watchlist` definition is shared across all platforms; per-platform query differences are handled inside the connector, not by changing the watchlist schema. |
| BRU-004 | Non-retryable failures, including malformed or non-translatable watchlist queries, must be surfaced to the tenant and must not trigger blind retry. |
| BRU-005 | The same watchlist must produce the same matched-post set for the same underlying input data, regardless of which matching path was used. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Watchlist` (id, tenantId, name, matchType, terms, booleanQuery, platformIds, isActive, createdAt, updatedAt) | Tenant-defined filter for posts to ingest | Tenant-Admin input | `social-listening-core` data model | Tenant-confidential configuration |
| `SocialPost` (text, platformId, externalId, authorId, watchlistId, rawPayload, publishedAt) | Normalized post against which watchlists are matched | Connector normalization | `social-listening-core` data model | Multi-tenant social content; RLS-isolated |
| `supportedQueryFeatures` | Connector capability declaration per match type | Connector registration | Connector framework | Non-sensitive platform metadata |
| `IngestionRun` (postsIngested, postsSkipped, status, errorSummary) | Audit record of each fetch/match run | Ingestion pipeline | `social-listening-core` data model | Operational telemetry with tenant isolation |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Native vs. post-fetch match counts by connector | Track cost/efficiency of watchlist matching | Platform Operator | Daily / per run |
| Posts fetched vs. posts matched per `IngestionRun` | Measure noise reduction and data quality | Product Owner, Tenant-Admin | Per run |
| Per-connector fallback rate | Identify platforms with poor native query support | Platform Operator, Connector Developer | Weekly |
| Consistency test pass rate | Verify native and fallback matchers produce identical results | QA / Delivery Agent | Per build |
| Quota/cost saved by native filtering | Quantify rate-limit and bandwidth savings | Product Owner, Platform Operator | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Native and fallback matchers produce inconsistent results for the same watchlist. | Medium | High | Canonical AST for boolean queries (ADR-0021); contract tests comparing both paths per build; documented per-connector semantic gaps. | Lead Solutions Architect |
| R-002 | A platform's native query grammar cannot fully express the watchlist's boolean semantics. | Medium | High | Degrade to post-fetch matching for the unsupported part and surface the limitation to the tenant. | Connector Developer |
| R-003 | Heavy reliance on post-fetch matching increases core compute and latency. | Medium | Medium | Monitor per-connector fallback rate; optimize matcher and consider caching or indexing for high-volume tenants. | Platform Operator |
| R-004 | Native query translation contains a bug, causing missed posts. | Medium | High | Golden test cases per connector; equivalence contract tests against the shared fallback. | QA / Connector Developer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Watchlist data model and REST API schema (ADR-0044) | Internal | Data Model Engineer | Already Accepted |
| D-002 | Connector framework with rate-limit and capability contract (ADR-0002, ADR-0003) | Internal | Connector Framework Owner | Already Accepted |
| D-003 | Unified boolean-query AST and capability matrix (ADR-0021) | Internal | Lead Solutions Architect | Accepted; Story 3.6 |
| D-004 | Normalized `SocialPost` schema and RLS isolation (Design Spec §4.2) | Internal | Data Model Engineer | Already Accepted |
| D-005 | `post_watchlist_matches` junction table and server-side filter (ADR-0063) | Internal | Data Model Engineer | Accepted |
| D-006 | Story 3.3 — Connector-side watchlist filtering with post-fetch fallback | Internal | Delivery Agent / Menno | Ready |

---

## 14. Acceptance Criteria

- For a connector that translates watchlist terms into native query parameters, every outbound request includes the translated filter and no matching posts are lost due to translation errors.
- For a platform without native filtering support, the core evaluates the watchlist against every fetched post before persisting any match.
- A given `Watchlist` produces the same matched posts for the same input data regardless of whether the platform sourced them natively or the core matched them post-fetch.
- Rate-limit cost and bandwidth are not spent fetching posts that would be discarded, wherever the platform supports native filtering.
- The matching path used for a given `IngestionRun` is recorded and queryable.
- Malformed or non-translatable watchlists fail with a clear, non-retryable error and are surfaced to the tenant.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Watchlist** | A tenant-owned filter that defines which posts to collect, using keywords, hashtags, accounts, or boolean queries. |
| **Match type** | The kind of watchlist filter: `keyword`, `hashtag`, `account`, or `boolean`. |
| **Connector-side matching** | Evaluating the watchlist at the platform's server by translating it into the platform's native query syntax. |
| **Post-fetch matching** | Evaluating the watchlist against already-fetched, normalized posts inside `social-listening-core`. |
| **Native query syntax** | The platform-specific query language used to request filtered results (e.g., Twitter/X search operators, YouTube Data API search parameters). |
| **supportedQueryFeatures** | A connector's declared set of match types / AST node types it can honor natively. |
| **Boolean AST** | A canonical abstract syntax tree for watchlist boolean queries, used to drive both translation and fallback evaluation. |
| **Normalized post** | A `SocialPost` in the common schema after platform-specific data has been translated. |
| **Rate-limit cost** | Quota or request budget consumed by each platform API call. |

---

## 16. Appendices

### Appendix A: Source Architecture Decision Record

- [`docs/adr/0006-watchlist-matching-connector-side-with-fallback.md`](../../adr/0006-watchlist-matching-connector-side-with-fallback.md)

### Appendix B: Design Specification

- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` — §4.4 `Watchlist` and §4.2 `SocialPost`

### Appendix C: Related User Story

- `docs/user-stories/epic-3-data-model-storage-and-archival.md` — **Story 3.3 — Connector-side watchlist filtering with post-fetch fallback**

### Appendix D: Related Architecture Decision Records

- ADR-0021 — Watchlist boolean query AST and capability matrix
- ADR-0044 — Watchlist API design and database schema standardization
- ADR-0063 — `post_watchlist_matches` junction table and server-side watchlist filter
- ADR-0003 — Rate-limit and cost discipline

### Appendix E: Missing Product-Research Artifacts

- No `docs/product-research/feature-designs/` file specific to connector-side watchlist matching was found.
- No `docs/product-research/reports/<feature>-deep-research.md` file for this feature was found.
- These items are noted as gaps; the BRD content is derived from the ADR, the 2026-07-28 Design Spec, and the related user story.

### Appendix F: Stakeholder References

- `docs/project docs/Stakeholder-Register.md`
- `docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md`

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | — | | |
