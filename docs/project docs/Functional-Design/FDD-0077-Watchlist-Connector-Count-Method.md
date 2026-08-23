# Business Requirements Document (BRD) — Watchlist Connector Count and Preview Volume

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Watchlist Connector Count and Preview Volume |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0077-watchlist-connector-count-method.md, ../Business-Requirements/BRD-0077-Watchlist-Connector-Count-Method.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0077-watchlist-connector-count-method.md and the business requirements in BRD-0077-Watchlist-Connector-Count-Method.md into functional design for **Watchlist Connector Count Method**.
When a Tenant-Admin or Tenant-User creates a watchlist today, they must activate it before they can estimate how many posts the query will pull across the selected connectors. Broad or poorly scoped queries can trigger unexpectedly large ingestion volumes, draining third-party API rate limits, increasing storage and AI-enrichment costs, and generating noise in the post feed.

This initiative delivers a **watchlist volume preview** capability. Before activation, the user can click **Preview volume** in the watchlist builder. The system calls a new `POST /v1/watchlists/preview-volume` endpoint and, for each selected connector, either uses a native `count?()` capability or falls back to a bounded sample and extrapolation. The preview returns a per-connector estimate with confidence levels and warnings (high volume, quota risk, unsupported query). No preview data is persisted.

The expected business value is lower operational risk, fewer runaway ingestion incidents, more confident self-service watchlist tuning, and reduced support burden from overbroad queries.

> **Note:** ADR-0077 is currently **Proposed**. This BRD is a draft for review and will be finalized once the ADR is accepted.

---

### 2.2 Scope
**In scope:**
- A new `POST /v1/watchlists/preview-volume` endpoint that accepts a watchlist query AST, selected connector IDs, and an optional time window.
- An optional `SocialConnector.count?()` method for connectors that can return a native search-result count.
- A bounded fallback preview sample (default 100 posts) and extrapolation for connectors that do not support counting.
- Per-connector `WatchlistVolumePreview` response fields: `estimatedPosts`, `confidence`, `sampleSize` (where applicable), `rateLimitCost`, and `warning`.
- Warning thresholds: `high_volume` (>100,000 posts per connector), `quota_risk` (>80% of remaining rate-limit budget), and `unsupported_query`.
- Rate-limit protection: preview calls must not consume more than 5% of a connector's remaining rate-limit budget.
- UI support in the watchlist builder to render the preview breakdown and warnings.

**Out of scope:**
- Persisting preview posts to `social_posts`, `post_watchlist_matches`, or `outbound_activities`.
- A historical time-series table for estimate tracking (deferred optimization).
- AI cost projection for storage, compute, or enrichment (future enhancement).
- Blocking activation for high-volume queries; the Tenant-Admin retains the activation decision.
- Public API or integration access for the preview endpoint in v1.

## 3. Context and Background
See ADR Context.
When a Tenant-Admin or Tenant-User creates a watchlist today, they must activate it before they can estimate how many posts the query will pull across the selected connectors. Broad or poorly scoped queries can trigger unexpectedly large ingestion volumes, draining third-party API rate limits, increasing storage and AI-enrichment costs, and generating noise in the post feed.

This initiative delivers a **watchlist volume preview** capability. Before activation, the user can click **Preview volume** in the watchlist builder. The system calls a new `POST /v1/watchlists/preview-volume` endpoint and, for each selected connector, either uses a native `count?()` capability or falls back to a bounded sample and extrapolation. The preview returns a per-connector estimate with confidence levels and warnings (high volume, quota risk, unsupported query). No preview data is persisted.

The expected business value is lower operational risk, fewer runaway ingestion incidents, more confident self-service watchlist tuning, and reduced support burden from overbroad queries.

> **Note:** ADR-0077 is currently **Proposed**. This BRD is a draft for review and will be finalized once the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Prevent runaway ingestion and rate-limit costs from overbroad watchlists | Number of watchlist activations later manually throttled or disabled due to excessive volume is reduced |
| 2 | Enable informed, self-service watchlist tuning before activation | Users preview volume at least once before activating a watchlist with more than one connector |
| 3 | Reduce support and operational overhead from unintended high-volume queries | Fewer support requests tied to unexpectedly large post counts or quota exhaustion |
| 4 | Preserve connector-specific transparency | Each connector's estimate clearly shows whether it is exact, estimated, or unavailable |

---

**Positive consequences (from ADR):**
1. **Operational protection:** users can see expected data load before activation, reducing the risk of broad queries draining quota or storage.
2. **Connector heterogeneity is exposed honestly:** some connectors will show exact counts, others estimates; the UI must render the confidence for each.
3. **New endpoint surface:** `POST /v1/watchlists/preview-volume` must be added to the auth/RLS pipeline, contract-tested, and documented.
4. **Optional method keeps churn low:** connectors that cannot count simply do not implement the method.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a `POST /v1/watchlists/preview-volume` endpoint | Must | Endpoint accepts `ast`, `connectorIds`, and optional `timeWindow`; returns a tenant-scoped `WatchlistVolumePreview` | Product Owner |
| BR-002 | The system shall support an optional `SocialConnector.count?()` capability | Must | `count?()` returns `count` and `confidence: 'exact' \| 'estimate'`; connectors that cannot count omit the method | Product Owner |
| BR-003 | The system shall fall back to a bounded sample for connectors without `count?()` | Must | Fallback calls `connector.poll({ limit: 100 })` and extrapolates; returns `confidence: 'estimate'` and `sampleSize` | Product Owner |
| BR-004 | The system shall not persist preview posts | Must | Preview posts are discarded; no writes to `social_posts`, `post_watchlist_matches`, or `outbound_activities` | Product Owner |
| BR-005 | The system shall return per-connector warnings | Must | Warnings `high_volume`, `quota_risk`, `unsupported_query` are surfaced when thresholds are exceeded | Product Owner |
| BR-006 | The UI shall show the preview breakdown and warnings | Should | `WatchlistBuilder` renders `VolumePreviewPanel`, `ConnectorVolumeRow`, and `VolumeWarning` components | Product Owner |
| BR-007 | The system shall support re-preview after query refinement | Should | User can adjust query/connectors and click Preview volume again without activating | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary decision maker for tenant watchlists | High | Avoid runaway costs and see per-connector risk before activation |
| Tenant-User | Builds personal or team watchlists | High | Understand expected data load and refine queries |
| Tenant-Brand-Reputation-Manager | Monitors brand risk | Medium | Quickly scope crisis or brand watchlists without large data commitments |
| Tenant-Business-Analyst | Exploratory watchlist user | Medium | Estimate volume for exploratory queries without activating them |
| Backend Engineer | Implements the endpoint and connector method | High | Clear contract, fallback behavior, and auth/RLS rules |
| Menno | Product Owner / Technical Lead / Sponsor | High | A small, additive change with large operational protection value |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.1 | epic-9-adr-0077-to-0085.md | As backend engineer, I want `SocialConnector.count?()` and `POST /v1/watchlists/preview-volume` to return a per-connector, tenant-scoped estimate of how many... | `SocialConnector` interface exposes an optional `count?()` method with `ConnectorCountResult`.; At least one existing connector (e.g. `gnews`, `brave-search`... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `WatchlistAST` | Boolean query AST supplied by the watchlist builder | Watchlist builder / UI | Product | Public query terms |
| `connectorIds` | List of selected connector IDs for preview | User selection | Product | Tenant-scoped identifiers |
| `timeWindow` | Optional start/end ISO interval for the preview | User selection | Product | Not PII |
| `ConnectorCountResult` | Per-connector count and confidence | Connector `count?()` or sample extrapolation | Engineering | Not PII |
| `WatchlistVolumePreview` | Aggregated response with total and breakdown | `WatchlistVolumePreviewService` | Engineering | Not PII; no post bodies retained |
| Rate-limit budget | Remaining quota from `connectorHealthStore` | Connector health / `RequestGate` | Engineering | Tenant operational data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A preview is a read-only, non-persistent operation; it may not create or modify watchlists, posts, or matches. |
| BRU-002 | Preview calls use the caller's connector credentials and respect the same ownership tiers and RLS as live ingestion. |
| BRU-003 | A connector with `count?()` may return `confidence: 'exact'` or `confidence: 'estimate'` depending on platform capability. |
| BRU-004 | A connector without `count?()` must fall back to a bounded sample; the default sample size is 100. |
| BRU-005 | A `high_volume` warning is triggered when a single connector's estimated posts exceed 100,000. |
| BRU-006 | A `quota_risk` warning is triggered when a preview would consume more than 80% of the connector's remaining rate-limit budget. |
| BRU-007 | An `unsupported_query` warning is triggered when the watchlist AST contains operators the connector cannot evaluate. |
| BRU-008 | Activation remains a separate, explicit action; warnings do not block activation in v1. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0077 acceptance | Decision | Menno | Before implementation begins |
| D-002 | `SocialConnector` pluggable interface (ADR-0026, ADR-0064 conventions) | Architecture | Engineering | Already in place; additive optional method only |
| D-003 | `RequestGate` and rate-limit budget tracking | Backend | Engineering | Already in place |
| D-004 | Watchlist builder UI and AST generation | Frontend | Engineering | Already in place |
| D-005 | Story 9.1 — Watchlist connector count and preview volume endpoint | Story | Engineering | Ready; implementation follows ADR-0077 acceptance |

---

- The watchlist builder already produces a valid watchlist AST and time window.
- Connectors already expose tenant-scoped credentials and a `RequestGate` for rate limiting.
- The `SocialConnector` interface can accept an optional method without breaking existing connectors.
- Users preview before activating; the existing activation endpoints remain unchanged.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Preview calls shall consume no more than 5% of a connector's remaining rate-limit budget | Performance / Operational | Must | Rate-limit cost is tracked and capped per connector |
| NFR-002 | The endpoint shall be tenant-scoped and RLS-gated | Security | Must | Cross-tenant and unauthorized requests return 403/404 |
| NFR-003 | Preview data shall not be retained | Compliance | Must | No persistence of preview samples or results |
| NFR-004 | The preview shall degrade gracefully for unsupported connectors | Reliability | Must | Unsupported connectors return `confidence: 'unavailable'` without failing the whole preview |
| NFR-005 | Contract tests shall cover exact, estimate, fallback, and cross-tenant cases | Maintainability | Must | All preview contract tests pass before merge |

---

## 11. Error Handling and Exceptions
1. **Operational protection:** users can see expected data load before activation, reducing the risk of broad queries draining quota or storage.
2. **Connector heterogeneity is exposed honestly:** some connectors will show exact counts, others estimates; the UI must render the confidence for each.
3. **New endpoint surface:** `POST /v1/watchlists/preview-volume` must be added to the auth/RLS pipeline, contract-tested, and documented.
4. **Optional method keeps churn low:** connectors that cannot count simply do not implement the method.

---

## 12. Assumptions and Dependencies
- The watchlist builder already produces a valid watchlist AST and time window.
- Connectors already expose tenant-scoped credentials and a `RequestGate` for rate limiting.
- The `SocialConnector` interface can accept an optional method without breaking existing connectors.
- Users preview before activating; the existing activation endpoints remain unchanged.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users ignore high-volume warnings and activate broad queries anyway | Medium | High | Warnings require explicit confirmation; documentation and onboarding highlight the value of refining queries | Product Owner |
| R-002 | Non-count connectors consume too much quota during sample fetching | Medium | High | Cap preview calls at 5% of remaining rate limit; default sample size of 100; short time windows | Engineering |
| R-003 | UI must handle mixed confidence levels and unavailable connectors | Medium | Medium | Design per-connector rows with clear confidence and warning labels; test with mixed connector states | Engineering |
| R-004 | ADR-0077 remains Proposed, causing scope uncertainty | Medium | High | Do not start implementation until ADR is accepted; treat this BRD as draft for review | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0077-watchlist-connector-count-method.md`
- BRD: `../Business-Requirements/BRD-0077-Watchlist-Connector-Count-Method.md`
- Feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above