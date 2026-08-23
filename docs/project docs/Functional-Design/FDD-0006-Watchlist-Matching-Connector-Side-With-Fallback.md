# Business Requirements Document: Watchlist Matching — Connector-Side with Fallback

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document: Watchlist Matching — Connector-Side with Fallback |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0006-watchlist-matching-connector-side-with-fallback.md, ../Business-Requirements/BRD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0006-watchlist-matching-connector-side-with-fallback.md and the business requirements in BRD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md into functional design for **Watchlist Matching Connector Side With Fallback**.
Social listening tenants define watchlists using keywords, hashtags, accounts, and boolean queries to decide which posts are relevant. Platforms differ widely in how they expose server-side filtering: some support native query syntax, while others return a raw stream that must be filtered after it is fetched. Fetching everything and discarding mismatches wastes rate-limit budget and bandwidth, which is especially costly on quota-constrained platforms.

This BRD translates ADR-0006 into business terms. The proposed solution is to translate each watchlist into the connected platform's own native query syntax wherever possible, and to fall back to post-fetch matching in the core for platforms that cannot honor the watchlist server-side. The result is a uniform watchlist model and consistent matching behavior, while minimizing unnecessary API calls and cost.

The primary beneficiaries are tenant administrators who configure watchlists, tenant analysts who rely on complete and consistent matched posts, and the platform operator who owns rate-limit cost and connector health.

---

### 2.2 Scope
**In scope:**
- Translation of watchlist terms and boolean queries into each connector's native platform query syntax.
- Post-fetch matching fallback in `social-listening-core` for platforms without native filtering support.
- Connector capability declaration (`supportedQueryFeatures`) used to choose native or fallback matching.
- Consistency verification between connector-side native matching and core post-fetch matching for the same watchlist.
- Observability of which matching path was used per ingestion run / connector.
- Handling of keyword, hashtag, account, and boolean watchlist match types.

**Out of scope:**
- Onboarding of any specific new connector (covered by connector-specific ADRs and stories).
- The watchlist query-builder UI (covered by ADR-0021 / Story 3.6).
- Alerting, case routing, or downstream analytics based on matched posts.
- Exact per-connector documentation of semantic gaps in native query grammars (required by ADR-0006 but produced separately per connector).

## 3. Context and Background
Watchlists support four match types (`keyword`, `hashtag`, `account`, `boolean`) scoped to a subset of connected platforms. Platforms differ in what filtering they support natively: some accept a query syntax at the API/webhook level, others return an unfiltered stream that must be matched client-side.
Social listening tenants define watchlists using keywords, hashtags, accounts, and boolean queries to decide which posts are relevant. Platforms differ widely in how they expose server-side filtering: some support native query syntax, while others return a raw stream that must be filtered after it is fetched. Fetching everything and discarding mismatches wastes rate-limit budget and bandwidth, which is especially costly on quota-constrained platforms.

This BRD translates ADR-0006 into business terms. The proposed solution is to translate each watchlist into the connected platform's own native query syntax wherever possible, and to fall back to post-fetch matching in the core for platforms that cannot honor the watchlist server-side. The result is a uniform watchlist model and consistent matching behavior, while minimizing unnecessary API calls and cost.

The primary beneficiaries are tenant administrators who configure watchlists, tenant analysts who rely on complete and consistent matched posts, and the platform operator who owns rate-limit cost and connector health.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce rate-limit cost and bandwidth spent fetching non-matching posts | Percentage of connector calls filtered natively on supported platforms; reduced quota consumption per matched post |
| 2 | Preserve uniform watchlist behavior across all supported platforms | A given watchlist produces the same matched posts against the same input data, regardless of whether native or post-fetch matching was used |
| 3 | Avoid per-platform watchlist model divergence | The `Watchlist` schema remains unchanged as new connectors are added |
| 4 | Make fallback behavior visible and auditable | Operators and tenants can see which watchlists are using post-fetch fallback per platform |

---

**Positive consequences (from ADR):**
**Positive**
- Connector-side filtering avoids fetching and paying rate-limit cost (per ADR-0003) for posts that will just be discarded, which matters most for platforms with tight quotas (e.g., YouTube's daily quota-cost model).
- Falling back to post-fetch matching means watchlists still work uniformly across every platform, including ones whose API can't express boolean queries, without changing the `Watchlist` model per platform.

**Negative**
- Matching logic now effectively exists in two places (each connector's query translation, and a shared post-fetch matcher), which need to behave equivalently for the same `Watchlist` or tenants will see inconsistent results depending on which platform matched a post.
- Boolean query semantics (`"acme AND (support OR help) NOT jobs"`) must be translatable into every supported platform's native syntax where available; platforms with weaker query grammars may only support an approximation, which isn't specified here and will need per-connector documentation of any semantic gaps.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall translate a watchlist's keyword, hashtag, and account terms into the native query syntax of each connected platform that supports it. | Must | For a supported connector, the outbound request includes the translated filter and no post is ingested that does not match the watchlist. | Connector Developer |
| BR-002 | For platforms that cannot honor a watchlist's terms natively, the core shall evaluate each fetched, normalized post against the watchlist before persisting matches. | Must | Posts that do not match the watchlist are not persisted as matches for that watchlist. | Core Backend Engineer |
| BR-003 | The system shall support the same `Watchlist` model in both native and fallback paths without per-platform schema changes. | Must | No `Watchlist` column or table is created or altered specifically for a single platform. | Data Model Engineer |
| BR-004 | Connectors shall declare `supportedQueryFeatures` so the matching path can be selected automatically. | Must | The framework can read a connector's declared features and route the watchlist to native translation or post-fetch matching. | Connector Framework Owner |
| BR-005 | Matching results for the same watchlist and the same input data shall be equivalent, whether the platform filtered natively or the core filtered post-fetch. | Must | A contract test with a mock fully-native platform and a mock no-native-support platform produces identical matched posts. | QA / Contract Engineer |
| BR-006 | The system shall surface a watchlist/connector combination that falls back to post-fetch matching in connector health and status views. | Should | A tenant or operator can see which platform+watchlist pairs are not using native filtering. | UI / Backend Engineer |
| BR-007 | Malformed or unsupported watchlist queries shall fail the ingestion run with a clear, non-retryable error. | Should | A malformed watchlist does not trigger blind retries and the failure reason is recorded in `IngestionRun.errorSummary`. | Connector Developer |

### 5.1 Architecture Decision
Translate a `Watchlist`'s terms/boolean query into each platform's own native query syntax and let matching happen connector-side wherever the platform supports it. For platforms without native filtering support, fall back to post-fetch matching in the core after normalization.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Creates and manages watchlists | High | Watchlists work on every connected platform without per-platform tweaking |
| Tenant User / Analyst | Consumes matched posts and reports | High | Consistent, complete set of posts for a watchlist, regardless of source platform |
| Platform Operator / Menno | Owns rate-limit cost, quota, and connector health | High | Native filtering used wherever possible; fallback is visible and bounded |
| Connector Developer | Implements per-connector query translation | Medium | Clear contract for capability declaration and query translation |
| Delivery / AI Reviewer | Validates consistency and cost assumptions | Medium | Contract tests proving equivalence between native and fallback paths |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.3 | epic-3-data-model-storage-and-archival.md | As tenant configuring a watchlist, I want matching to happen on the platform's own server when it supports query filtering, falling back to post-fetch matchi... | For a platform whose connector translates watchlist terms into native query parameters, requests sent to that platform include the translated filter.; For a ... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Watchlist` (id, tenantId, name, matchType, terms, booleanQuery, platformIds, isActive, createdAt, updatedAt) | Tenant-defined filter for posts to ingest | Tenant-Admin input | `social-listening-core` data model | Tenant-confidential configuration |
| `SocialPost` (text, platformId, externalId, authorId, watchlistId, rawPayload, publishedAt) | Normalized post against which watchlists are matched | Connector normalization | `social-listening-core` data model | Multi-tenant social content; RLS-isolated |
| `supportedQueryFeatures` | Connector capability declaration per match type | Connector registration | Connector framework | Non-sensitive platform metadata |
| `IngestionRun` (postsIngested, postsSkipped, status, errorSummary) | Audit record of each fetch/match run | Ingestion pipeline | `social-listening-core` data model | Operational telemetry with tenant isolation |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A connector whose `supportedQueryFeatures` includes the watchlist's `matchType` must use native server-side filtering when available. |
| BRU-002 | If a connector does not support the watchlist's terms natively, the core post-fetch matcher must evaluate the normalized post's text and relevant metadata. |
| BRU-003 | The `Watchlist` definition is shared across all platforms; per-platform query differences are handled inside the connector, not by changing the watchlist schema. |
| BRU-004 | Non-retryable failures, including malformed or non-translatable watchlist queries, must be surfaced to the tenant and must not trigger blind retry. |
| BRU-005 | The same watchlist must produce the same matched-post set for the same underlying input data, regardless of which matching path was used. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Watchlist data model and REST API schema (ADR-0044) | Internal | Data Model Engineer | Already Accepted |
| D-002 | Connector framework with rate-limit and capability contract (ADR-0002, ADR-0003) | Internal | Connector Framework Owner | Already Accepted |
| D-003 | Unified boolean-query AST and capability matrix (ADR-0021) | Internal | Lead Solutions Architect | Accepted; Story 3.6 |
| D-004 | Normalized `SocialPost` schema and RLS isolation (Design Spec §4.2) | Internal | Data Model Engineer | Already Accepted |
| D-005 | `post_watchlist_matches` junction table and server-side filter (ADR-0063) | Internal | Data Model Engineer | Accepted |
| D-006 | Story 3.3 — Connector-side watchlist filtering with post-fetch fallback | Internal | Delivery Agent / Menno | Ready |

---

- The `Watchlist` model includes `matchType`, `terms`, `booleanQuery`, and `platformIds`, as defined in the 2026-07-28 Design Spec §4.4.
- Each connector can declare which query features it supports natively.
- The core can access normalized post text, metadata, and platform identifiers to perform post-fetch matching.
- Rate-limit and cost discipline (ADR-0003) is already enforced by the connector framework.

Translate a `Watchlist`'s terms/boolean query into each platform's own native query syntax and let matching happen connector-side wherever the platform supports it. For platforms without native filtering support, fall back to post-fetch matching in the core after normalization.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Multi-tenant isolation: one tenant's watchlist matching must not access or affect another tenant's data. | Security | Must | Contract and regression tests confirm tenant-scoped matching across all paths. |
| NFR-002 | Fallback matching must not cause the ingestion pipeline to exceed documented p95 latency for the supported volume. | Performance | Should | p95 ingestion latency for the fallback path is measured and stays within the documented threshold. |
| NFR-003 | Every ingestion run must record the number of posts fetched, matched, skipped, and the matching path used. | Observability | Must | `IngestionRun` fields are populated and queryable by operator dashboards. |
| NFR-004 | The native and fallback matchers must be exercised by a permanent regression suite. | Maintainability | Must | Both matching paths have contract tests in the accumulated suite. |

---

## 11. Error Handling and Exceptions
**Positive**
- Connector-side filtering avoids fetching and paying rate-limit cost (per ADR-0003) for posts that will just be discarded, which matters most for platforms with tight quotas (e.g., YouTube's daily quota-cost model).
- Falling back to post-fetch matching means watchlists still work uniformly across every platform, including ones whose API can't express boolean queries, without changing the `Watchlist` model per platform.

**Negative**
- Matching logic now effectively exists in two places (each connector's query translation, and a shared post-fetch matcher), which need to behave equivalently for the same `Watchlist` or tenants will see inconsistent results depending on which platform matched a post.
- Boolean query semantics (`"acme AND (support OR help) NOT jobs"`) must be translatable into every supported platform's native syntax where available; platforms with weaker query grammars may only support an approximation, which isn't specified here and will need per-connector documentation of any semantic gaps.

## 12. Assumptions and Dependencies
- The `Watchlist` model includes `matchType`, `terms`, `booleanQuery`, and `platformIds`, as defined in the 2026-07-28 Design Spec §4.4.
- Each connector can declare which query features it supports natively.
- The core can access normalized post text, metadata, and platform identifiers to perform post-fetch matching.
- Rate-limit and cost discipline (ADR-0003) is already enforced by the connector framework.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Native and fallback matchers produce inconsistent results for the same watchlist. | Medium | High | Canonical AST for boolean queries (ADR-0021); contract tests comparing both paths per build; documented per-connector semantic gaps. | Lead Solutions Architect |
| R-002 | A platform's native query grammar cannot fully express the watchlist's boolean semantics. | Medium | High | Degrade to post-fetch matching for the unsupported part and surface the limitation to the tenant. | Connector Developer |
| R-003 | Heavy reliance on post-fetch matching increases core compute and latency. | Medium | Medium | Monitor per-connector fallback rate; optimize matcher and consider caching or indexing for high-volume tenants. | Platform Operator |
| R-004 | Native query translation contains a bug, causing missed posts. | Medium | High | Golden test cases per connector; equivalence contract tests against the shared fallback. | QA / Connector Developer |

---

## 14. Appendix
- ADR: `../../adr/0006-watchlist-matching-connector-side-with-fallback.md`
- BRD: `../Business-Requirements/BRD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md`
- Feature design: `docs/product-research/feature-designs/``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above