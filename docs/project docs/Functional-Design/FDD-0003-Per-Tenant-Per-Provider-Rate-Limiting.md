# Business Requirements Document (BRD) — Per-Tenant, Per-Provider Rate Limiting

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Per-Tenant, Per-Provider Rate Limiting |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0003-per-tenant-per-provider-rate-limiting.md, ../Business-Requirements/BRD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0003-per-tenant-per-provider-rate-limiting.md and the business requirements in BRD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md into functional design for **Per Tenant Per Provider Rate Limiting**.
**What problem are we solving?**  
The SocialEngage platform connects multiple tenants to the same third-party social platforms and AI enrichment providers. Each tenant uses its own credentials, so its quota is independent. Without per-tenant enforcement, one tenant's heavy polling or enrichment could exhaust a shared rate budget and throttle every other tenant on that platform. There is also no shared place to react to live rate-limit headers, which means the system can either invent limits or silently drop requests when a ceiling is hit.

**Who is affected?**  
All tenants using social-listening connectors and AI enrichment, the platform operator responsible for multi-tenancy, and the core backend engineers who must keep connectors from overrunning platform quotas.

**What is the proposed solution at a glance?**  
A shared `RequestGate` in the core enforces rate limits per `(tenantId, providerId)` for social connectors and per `(tenantId, providerId, modelId)` for AI providers. Connectors declare their documented limits; the gate prefers live rate-limit headers returned by the platform; and requests that exceed the limit are queued and retried after the window resets, never dropped silently.

**What business value do we expect?**  
Stronger multi-tenancy guarantees, fairer quota allocation, no silent ingestion loss on transient rate limits, and a single enforcement point that every current and future connector can reuse.

---

### 2.2 Scope
**In scope:**
- A shared `RequestGate` in `social-listening-core` that enforces rate limits per `(tenantId, providerId)` for all social-connector outbound requests.
- Per-model gating for AI provider enrichment requests, keyed by `(tenantId, providerId, modelId)`.
- Connector-declared rate-limit configuration via `getRateLimitConfig()` and optional `parseRateLimitHeaders()`.
- Live rate-limit header state taking priority over the static declared configuration.
- Queuing and automatic retry of requests that would exceed the current rate limit, after the relevant window resets.
- Contract/acceptance tests proving two tenants are isolated when using the same platform.

**Out of scope:**
- Distributed `RequestGate` state across multiple `social-listening-core` instances (deferred to ADR-0020 / Story 2.4).
- Queue depth ceiling, TTL-based abandonment, and per-request dead-lettering (deferred to ADR-0020 / Story 2.4).
- Silently dropping requests that exceed a rate limit.
- Global per-provider rate limiting that is not tenant-scoped.

## 3. Context and Background
Each tenant connects platforms and AI providers using their own credentials, so each tenant carries independent, platform-imposed rate limits (X's per-tier windows, YouTube's daily quota-cost model, Reddit's per-minute cap, and per-model limits for AI providers). A shared enforcement point is needed so one tenant's usage can't affect another's, and so limits reflect what each platform actually documents rather than values invented by the core.
**What problem are we solving?**  
The SocialEngage platform connects multiple tenants to the same third-party social platforms and AI enrichment providers. Each tenant uses its own credentials, so its quota is independent. Without per-tenant enforcement, one tenant's heavy polling or enrichment could exhaust a shared rate budget and throttle every other tenant on that platform. There is also no shared place to react to live rate-limit headers, which means the system can either invent limits or silently drop requests when a ceiling is hit.

**Who is affected?**  
All tenants using social-listening connectors and AI enrichment, the platform operator responsible for multi-tenancy, and the core backend engineers who must keep connectors from overrunning platform quotas.

**What is the proposed solution at a glance?**  
A shared `RequestGate` in the core enforces rate limits per `(tenantId, providerId)` for social connectors and per `(tenantId, providerId, modelId)` for AI providers. Connectors declare their documented limits; the gate prefers live rate-limit headers returned by the platform; and requests that exceed the limit are queued and retried after the window resets, never dropped silently.

**What business value do we expect?**  
Stronger multi-tenancy guarantees, fairer quota allocation, no silent ingestion loss on transient rate limits, and a single enforcement point that every current and future connector can reuse.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Guarantee tenant-isolated rate-limit enforcement | Two tenants calling the same platform concurrently are gated independently — one tenant hitting its limit does not delay or block the other |
| 2 | Use platform-documented rate limits as the single source of truth | Every connector exposes `getRateLimitConfig()` derived from the platform's own documentation, with no invented core values |
| 3 | Adapt automatically to live platform limits | Where a connector implements `parseRateLimitHeaders()`, the gate reflects the platform's live reported state rather than stale static config |
| 4 | Prevent silent data loss on rate-limit hits | Requests that would exceed a limit are queued and retried; no request is dropped without a trace |
| 5 | Extend the same model to AI enrichment | AI provider calls are gated per model (`getModelRateLimit(modelId)`) as well as per provider |

---

**Positive consequences (from ADR):**
**Positive**
- Rate-limit isolation directly satisfies the multi-tenancy requirement in §8: one tenant's usage never throttles another's, even though all tenants may be hitting the same third-party platform.
- Preferring live header state over static config means the gate adapts to a platform tightening or loosening its limits without a code change.
- Queue-and-retry (rather than drop) means transient rate-limit hits don't silently lose data — consistent with the retryable-error handling in §5.

**Negative**
- A queued request that waits for window reset adds latency to that tenant's ingestion; under sustained over-quota conditions, the queue for a given `(tenantId, providerId)` can grow and needs monitoring/backpressure that isn't detailed in this spec.
- Per-model limits for AI providers mean the gate's key space is effectively `(tenantId, providerId, modelId)` for enrichment traffic, which is more granular bookkeeping than social connectors need.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall enforce all social-connector outbound requests per `(tenantId, providerId)` through a shared `RequestGate` | Must | Two tenants calling the same platform concurrently are gated independently; one tenant at its limit does not delay the other | Technical Lead |
| BR-002 | Every connector shall declare its rate limits via `getRateLimitConfig()` using only the platform's documented limits | Must | A connector's `RateLimitConfig` is traceable to platform documentation or explicitly labeled as a conservative placeholder | Technical Lead |
| BR-003 | The gate shall prefer live rate-limit headers over static declared config when a connector implements `parseRateLimitHeaders()` | Should | A test confirms that after parsing live headers, the gate uses the reported remaining quota/window rather than the static value | Technical Lead |
| BR-004 | Requests that would exceed the current rate limit shall be queued and retried after the window resets | Must | No request is dropped silently; a queued request is eventually delivered or fails with a visible record | Technical Lead |
| BR-005 | AI provider enrichment calls shall be gated per `(tenantId, providerId, modelId)` via `getModelRateLimit(modelId)` | Must | Two tenants calling the same AI model are gated independently; tenant A's usage does not throttle tenant B's same model | Technical Lead |
| BR-006 | The gate shall never enforce rate limits globally across all tenants | Must | No code path can reduce the available budget for one tenant because another tenant is active | Technical Lead |

### 5.1 Architecture Decision
- Every connector declares its own limits via `getRateLimitConfig()`, reflecting the platform's documented limits only.
- A shared `RequestGate` in the core enforces limits **per `(tenantId, providerId)`**, never globally.
- Where a platform returns live rate-limit state in response headers, `parseRateLimitHeaders()` updates the gate's live state, which takes priority over the static declared config.
- Requests that would exceed the limit are **queued and retried after window reset**, never dropped silently.
- AI providers extend this one level deeper: limits are enforced per-model via `getModelRateLimit(modelId)`, not just per-provider.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Ensures fair multi-tenant resource sharing | High | No cross-tenant throttling; visibility into gate queues |
| Tenant-Admin | Manages connected platforms and credentials | Medium | Connectors run reliably without being slowed by other tenants |
| Core Backend Engineer | Implements and maintains the `RequestGate` | High | Clear contract, reusable across all connectors |
| Tenant-User | Consumes ingested posts and analytics | Low | Data keeps flowing even when other tenants hit limits |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.2 | epic-2-ingestion-connectors-and-rate-limits.md | As multi-tenant platform operator, I want every outbound platform/AI request gated by a shared `RequestGate` scoped to `(tenantId, providerId)` — and `(tenan... | Two tenants issuing requests to the same platform concurrently are gated independently — one tenant hitting its limit does not delay or block the other's req... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `RateLimitConfig` | Static rate-limit declaration per connector (strategy, window, quota, cost-per-request) | Connector implementation | Technical Lead | Internal |
| `RateLimitState` | Live rate-limit state derived from platform response headers | `parseRateLimitHeaders()` output | Technical Lead | Internal |
| `RequestGate` queue entry | Queued outbound request keyed by `(tenantId, providerId)` or `(tenantId, providerId, modelId)` | `RequestGate` | Technical Lead | Internal |
| `IngestionRun` status/retryable | Record of a poll attempt, including whether it was retryable | Ingestion pipeline | Technical Lead | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A connector may only declare rate limits that reflect the platform's documented limits or an explicitly labeled conservative placeholder; the core shall never invent a rate limit. |
| BRU-002 | When a platform returns live rate-limit headers and the connector implements `parseRateLimitHeaders()`, the live state takes priority over the static `RateLimitConfig`. |
| BRU-003 | A request that would exceed the current rate limit for a tenant shall be queued and retried; it must never be dropped silently. |
| BRU-004 | AI enrichment requests shall be gated per model, using the key `(tenantId, providerId, modelId)`, in addition to provider-level gating. |
| BRU-005 | Rate-limit enforcement shall never be global; it shall always be scoped to a single tenant. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 — Unified provider connector framework (`getRateLimitConfig()`, `parseRateLimitHeaders()`) | Internal | Technical Lead | Already accepted |
| D-002 | ADR-0010 / ADR-0023 — Retryable/non-retryable error handling and connector auto-disable | Internal | Technical Lead | Already accepted |
| D-003 | ADR-0014 / ADR-0015 — Tenant-scoped credential storage and database-level RLS | Internal | Technical Lead | Already accepted |
| D-004 | ADR-0020 — Bounded queues, dead-lettering, and distributed gate state | Internal | Technical Lead | Accepted; queue bounds scheduled for Phase 4; distributed state deferred until multi-instance deployment |
| D-005 | Story 2.1 — Unified provider connector framework | Internal | Technical Lead | Ready |
| D-006 | Story 2.2 — Per-tenant, per-provider rate limiting | Internal | Technical Lead | Ready |

---

- Each tenant holds independent platform credentials and therefore independent quota.
- Platform rate limits are documented and stable enough to be declared by connectors; live headers are the preferred override where available.
- The initial `RequestGate` implementation runs in-process on a single `social-listening-core` instance.
- Existing retryable/non-retryable error handling (ADR-0010 / ADR-0023) remains the separate mechanism for connector health and auto-disable.

- Every connector declares its own limits via `getRateLimitConfig()`, reflecting the platform's documented limits only.
- A shared `RequestGate` in the core enforces limits **per `(tenantId, providerId)`**, never globally.
- Where a platform returns live rate-limit state in response headers, `parseRateLimitHeaders()` updates the gate's live state, which takes priority over the static declared config.
- Requests that would exceed the limit are **queued and retried after window reset**, never dropped silently.
- AI providers extend this one level deeper: limits are enforced per-model via `getModelRateLimit(modelId)`, not just per-provider.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Rate-limit enforcement must preserve multi-tenant isolation | Security / Reliability | Must | Acceptance tests prove one tenant's rate-limit state does not influence another tenant's allowed requests |
| NFR-002 | The gate must be observable via queue depth and wait-time metrics | Reliability / Maintainability | Should | Platform operator can inspect per `(tenantId, providerId)` queue depth and retry wait time |
| NFR-003 | The rate-limit contract must be reusable by all current and future connectors | Maintainability | Must | Adding a new connector requires only implementing `getRateLimitConfig()` (and optionally `parseRateLimitHeaders()`) |

---

## 11. Error Handling and Exceptions
**Positive**
- Rate-limit isolation directly satisfies the multi-tenancy requirement in §8: one tenant's usage never throttles another's, even though all tenants may be hitting the same third-party platform.
- Preferring live header state over static config means the gate adapts to a platform tightening or loosening its limits without a code change.
- Queue-and-retry (rather than drop) means transient rate-limit hits don't silently lose data — consistent with the retryable-error handling in §5.

**Negative**
- A queued request that waits for window reset adds latency to that tenant's ingestion; under sustained over-quota conditions, the queue for a given `(tenantId, providerId)` can grow and needs monitoring/backpressure that isn't detailed in this spec.
- Per-model limits for AI providers mean the gate's key space is effectively `(tenantId, providerId, modelId)` for enrichment traffic, which is more granular bookkeeping than social connectors need.

## 12. Assumptions and Dependencies
- Each tenant holds independent platform credentials and therefore independent quota.
- Platform rate limits are documented and stable enough to be declared by connectors; live headers are the preferred override where available.
- The initial `RequestGate` implementation runs in-process on a single `social-listening-core` instance.
- Existing retryable/non-retryable error handling (ADR-0010 / ADR-0023) remains the separate mechanism for connector health and auto-disable.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Sustained over-quota usage for one tenant causes queue growth and ingestion latency | Medium | Medium | Implement queue bounds, TTL, and dead-lettering per ADR-0020 / Story 2.4; add monitoring and backpressure | Technical Lead |
| R-002 | A connector does not implement `parseRateLimitHeaders()`, so the gate cannot react to live platform changes | Medium | Medium | Keep `getRateLimitConfig()` as a conservative, documented fallback; require explicit labels on placeholders | Technical Lead |
| R-003 | A bug in the gate allows cross-tenant quota sharing | Low | High | Acceptance tests with concurrent tenants; contract tests verifying key scoping | Technical Lead |
| R-004 | Per-model AI gating adds bookkeeping complexity | Medium | Low | Reuse the same `RequestGate` with an extra key segment; test key isolation per model | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0003-per-tenant-per-provider-rate-limiting.md`
- BRD: `../Business-Requirements/BRD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above