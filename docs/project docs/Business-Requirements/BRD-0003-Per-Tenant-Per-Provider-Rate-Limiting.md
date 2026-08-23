# Business Requirements Document (BRD) — Per-Tenant, Per-Provider Rate Limiting

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Per-Tenant, Per-Provider Rate Limiting — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Devin (AI BRD Writer Agent) |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Draft / Pending review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Devin | Initial draft from ADR-0003, design spec §3.2, and Story 2.2 |

---

## 2. Executive Summary

**What problem are we solving?**  
The SocialEngage platform connects multiple tenants to the same third-party social platforms and AI enrichment providers. Each tenant uses its own credentials, so its quota is independent. Without per-tenant enforcement, one tenant's heavy polling or enrichment could exhaust a shared rate budget and throttle every other tenant on that platform. There is also no shared place to react to live rate-limit headers, which means the system can either invent limits or silently drop requests when a ceiling is hit.

**Who is affected?**  
All tenants using social-listening connectors and AI enrichment, the platform operator responsible for multi-tenancy, and the core backend engineers who must keep connectors from overrunning platform quotas.

**What is the proposed solution at a glance?**  
A shared `RequestGate` in the core enforces rate limits per `(tenantId, providerId)` for social connectors and per `(tenantId, providerId, modelId)` for AI providers. Connectors declare their documented limits; the gate prefers live rate-limit headers returned by the platform; and requests that exceed the limit are queued and retried after the window resets, never dropped silently.

**What business value do we expect?**  
Stronger multi-tenancy guarantees, fairer quota allocation, no silent ingestion loss on transient rate limits, and a single enforcement point that every current and future connector can reuse.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Guarantee tenant-isolated rate-limit enforcement | Two tenants calling the same platform concurrently are gated independently — one tenant hitting its limit does not delay or block the other |
| 2 | Use platform-documented rate limits as the single source of truth | Every connector exposes `getRateLimitConfig()` derived from the platform's own documentation, with no invented core values |
| 3 | Adapt automatically to live platform limits | Where a connector implements `parseRateLimitHeaders()`, the gate reflects the platform's live reported state rather than stale static config |
| 4 | Prevent silent data loss on rate-limit hits | Requests that would exceed a limit are queued and retried; no request is dropped without a trace |
| 5 | Extend the same model to AI enrichment | AI provider calls are gated per model (`getModelRateLimit(modelId)`) as well as per provider |

---

## 4. Scope

### 4.1 In Scope

- A shared `RequestGate` in `social-listening-core` that enforces rate limits per `(tenantId, providerId)` for all social-connector outbound requests.
- Per-model gating for AI provider enrichment requests, keyed by `(tenantId, providerId, modelId)`.
- Connector-declared rate-limit configuration via `getRateLimitConfig()` and optional `parseRateLimitHeaders()`.
- Live rate-limit header state taking priority over the static declared configuration.
- Queuing and automatic retry of requests that would exceed the current rate limit, after the relevant window resets.
- Contract/acceptance tests proving two tenants are isolated when using the same platform.

### 4.2 Out of Scope

- Distributed `RequestGate` state across multiple `social-listening-core` instances (deferred to ADR-0020 / Story 2.4).
- Queue depth ceiling, TTL-based abandonment, and per-request dead-lettering (deferred to ADR-0020 / Story 2.4).
- Silently dropping requests that exceed a rate limit.
- Global per-provider rate limiting that is not tenant-scoped.

### 4.3 Assumptions

- Each tenant holds independent platform credentials and therefore independent quota.
- Platform rate limits are documented and stable enough to be declared by connectors; live headers are the preferred override where available.
- The initial `RequestGate` implementation runs in-process on a single `social-listening-core` instance.
- Existing retryable/non-retryable error handling (ADR-0010 / ADR-0023) remains the separate mechanism for connector health and auto-disable.

### 4.4 Constraints

- Rate-limit values must not be invented by the core; they must reflect the platform's documented limits.
- A queued request waiting for window reset adds latency for that tenant's ingestion.
- Per-model AI gating increases the gate's key-space bookkeeping compared with social connectors.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Ensures fair multi-tenant resource sharing | High | No cross-tenant throttling; visibility into gate queues |
| Tenant-Admin | Manages connected platforms and credentials | Medium | Connectors run reliably without being slowed by other tenants |
| Core Backend Engineer | Implements and maintains the `RequestGate` | High | Clear contract, reusable across all connectors |
| Tenant-User | Consumes ingested posts and analytics | Low | Data keeps flowing even when other tenants hit limits |

---

## 6. Current State (As-Is)

**Current process:**
1. Connectors are expected to make outbound requests to social platforms and AI providers.
2. There is no central enforcement point for per-tenant or per-provider rate limits.
3. Rate-limit knowledge lives inside each connector or is not enforced at all, risking global or cross-tenant throttling.
4. There is no standard mechanism to read live rate-limit headers from platform responses and adjust behavior.
5. Rate-limit hits could be treated as hard failures or silently dropped, depending on the connector.

**Pain points:**
- A single heavy tenant could throttle every other tenant sharing a platform.
- Platform-imposed limit changes require code or config updates unless live headers are honored.
- Transient rate-limit errors can lead to lost ingestion data if requests are dropped.
- AI providers have per-model limits that are not captured by per-provider gating alone.

---

## 7. Future State (To-Be)

**New or improved process:**
1. Before any outbound request leaves `social-listening-core`, it acquires a slot from the shared `RequestGate`.
2. The gate keys the request by `(tenantId, providerId)` for social platforms, or by `(tenantId, providerId, modelId)` for AI enrichment.
3. The connector supplies a documented `RateLimitConfig`; if the platform returns live headers, the gate overrides the static config with the live state.
4. If the request would exceed the limit, it is queued and automatically retried once the window resets.
5. A tenant's queue for a given provider/model grows independently of other tenants' queues.
6. Connector health and auto-disable logic remains separate, so a sustained failure can still disable a connector for that tenant.

**Expected capabilities:**
- Guaranteed per-tenant isolation for every outbound platform and AI provider call.
- Automatic adaptation to platform rate-limit header changes without a code release.
- Resilient handling of transient rate limits through queue-and-retry.
- Consistent rate-limit contract for all current and future connectors.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall enforce all social-connector outbound requests per `(tenantId, providerId)` through a shared `RequestGate` | Must | Two tenants calling the same platform concurrently are gated independently; one tenant at its limit does not delay the other | Technical Lead |
| BR-002 | Every connector shall declare its rate limits via `getRateLimitConfig()` using only the platform's documented limits | Must | A connector's `RateLimitConfig` is traceable to platform documentation or explicitly labeled as a conservative placeholder | Technical Lead |
| BR-003 | The gate shall prefer live rate-limit headers over static declared config when a connector implements `parseRateLimitHeaders()` | Should | A test confirms that after parsing live headers, the gate uses the reported remaining quota/window rather than the static value | Technical Lead |
| BR-004 | Requests that would exceed the current rate limit shall be queued and retried after the window resets | Must | No request is dropped silently; a queued request is eventually delivered or fails with a visible record | Technical Lead |
| BR-005 | AI provider enrichment calls shall be gated per `(tenantId, providerId, modelId)` via `getModelRateLimit(modelId)` | Must | Two tenants calling the same AI model are gated independently; tenant A's usage does not throttle tenant B's same model | Technical Lead |
| BR-006 | The gate shall never enforce rate limits globally across all tenants | Must | No code path can reduce the available budget for one tenant because another tenant is active | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Rate-limit enforcement must preserve multi-tenant isolation | Security / Reliability | Must | Acceptance tests prove one tenant's rate-limit state does not influence another tenant's allowed requests |
| NFR-002 | The gate must be observable via queue depth and wait-time metrics | Reliability / Maintainability | Should | Platform operator can inspect per `(tenantId, providerId)` queue depth and retry wait time |
| NFR-003 | The rate-limit contract must be reusable by all current and future connectors | Maintainability | Must | Adding a new connector requires only implementing `getRateLimitConfig()` (and optionally `parseRateLimitHeaders()`) |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A connector may only declare rate limits that reflect the platform's documented limits or an explicitly labeled conservative placeholder; the core shall never invent a rate limit. |
| BRU-002 | When a platform returns live rate-limit headers and the connector implements `parseRateLimitHeaders()`, the live state takes priority over the static `RateLimitConfig`. |
| BRU-003 | A request that would exceed the current rate limit for a tenant shall be queued and retried; it must never be dropped silently. |
| BRU-004 | AI enrichment requests shall be gated per model, using the key `(tenantId, providerId, modelId)`, in addition to provider-level gating. |
| BRU-005 | Rate-limit enforcement shall never be global; it shall always be scoped to a single tenant. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `RateLimitConfig` | Static rate-limit declaration per connector (strategy, window, quota, cost-per-request) | Connector implementation | Technical Lead | Internal |
| `RateLimitState` | Live rate-limit state derived from platform response headers | `parseRateLimitHeaders()` output | Technical Lead | Internal |
| `RequestGate` queue entry | Queued outbound request keyed by `(tenantId, providerId)` or `(tenantId, providerId, modelId)` | `RequestGate` | Technical Lead | Internal |
| `IngestionRun` status/retryable | Record of a poll attempt, including whether it was retryable | Ingestion pipeline | Technical Lead | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Queue depth per `(tenantId, providerId)` | Detect over-quota conditions and backpressure needs | Platform Operator | Real-time |
| Rate-limit hit count per tenant | Identify tenants routinely hitting platform limits | Platform Operator / Tenant-Admin | Hourly / Daily |
| Average retry wait time | Monitor latency added by queue-and-retry behavior | Technical Lead | Hourly |
| Requests delivered vs. still-queued vs. abandoned | Track gate throughput and backlog | Platform Operator | Hourly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Sustained over-quota usage for one tenant causes queue growth and ingestion latency | Medium | Medium | Implement queue bounds, TTL, and dead-lettering per ADR-0020 / Story 2.4; add monitoring and backpressure | Technical Lead |
| R-002 | A connector does not implement `parseRateLimitHeaders()`, so the gate cannot react to live platform changes | Medium | Medium | Keep `getRateLimitConfig()` as a conservative, documented fallback; require explicit labels on placeholders | Technical Lead |
| R-003 | A bug in the gate allows cross-tenant quota sharing | Low | High | Acceptance tests with concurrent tenants; contract tests verifying key scoping | Technical Lead |
| R-004 | Per-model AI gating adds bookkeeping complexity | Medium | Low | Reuse the same `RequestGate` with an extra key segment; test key isolation per model | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 — Unified provider connector framework (`getRateLimitConfig()`, `parseRateLimitHeaders()`) | Internal | Technical Lead | Already accepted |
| D-002 | ADR-0010 / ADR-0023 — Retryable/non-retryable error handling and connector auto-disable | Internal | Technical Lead | Already accepted |
| D-003 | ADR-0014 / ADR-0015 — Tenant-scoped credential storage and database-level RLS | Internal | Technical Lead | Already accepted |
| D-004 | ADR-0020 — Bounded queues, dead-lettering, and distributed gate state | Internal | Technical Lead | Accepted; queue bounds scheduled for Phase 4; distributed state deferred until multi-instance deployment |
| D-005 | Story 2.1 — Unified provider connector framework | Internal | Technical Lead | Ready |
| D-006 | Story 2.2 — Per-tenant, per-provider rate limiting | Internal | Technical Lead | Ready |

---

## 14. Acceptance Criteria

- Two tenants issuing requests to the same platform concurrently are gated independently; one tenant hitting its limit does not delay or block the other's requests.
- When a connector implements `parseRateLimitHeaders()`, the `RequestGate` reflects the live rate-limit state reported by the platform rather than the static `RateLimitConfig`.
- A request that would exceed the rate limit is queued and retried after the window resets, with no silent dropping.
- AI enrichment requests are gated per model (`getModelRateLimit(modelId)`), not only per AI provider.
- No code path enforces a rate limit globally across tenants.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `RequestGate` | The shared, tenant-scoped rate-limit enforcement point in `social-listening-core`. |
| `RateLimitConfig` | A connector's static declaration of the platform's documented rate limits. |
| `parseRateLimitHeaders()` | An optional connector method that reads live rate-limit headers from a platform response and updates gate state. |
| `getModelRateLimit(modelId)` | AI provider method returning the rate-limit configuration for a specific model. |
| `RateLimitState` | The gate's current view of remaining quota, window boundaries, and cost for a given tenant/provider/model. |
| `tenantId` / `providerId` / `modelId` | Identifiers used to scope rate-limit keys: tenant, platform/AI provider, and (for AI) model. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0003-per-tenant-per-provider-rate-limiting.md` — the source ADR.
- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` — design spec §3.2 "Rate Limiting" and §8 "Security & Multi-Tenancy".
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.2 (per-tenant, per-provider rate limiting) and Story 2.4 (bounded queues/dead-lettering, ADR-0020).
- `docs/adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md` — queue bounds and distributed gate state.

### 16.2 Missing Source

No `docs/product-research/reports/<feature>-deep-research.md` file was found for per-tenant, per-provider rate limiting. This BRD was produced from the ADR, design spec, and user stories above.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
