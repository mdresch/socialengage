# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0003 Per-Tenant, Per-Provider Rate Limiting — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0003 is Accepted) |
| Related Documents | ADR-0003, ADR-0002, ADR-0010, ADR-0020, ADR-0023, BRD-0003, Story 2.2, Story 2.4 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0003 (rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate`) and BRD-0003 into a functional design for the enforcement engine that stops one tenant's usage from throttling another tenant sharing the same social platform or AI provider.

### 2.2 Scope

- **In scope:** the `RequestGate` enforcement point; per-`(tenantId, providerId)` (social) and per-`(tenantId, providerId, modelId)` (AI) key scoping; static `RateLimitConfig` vs. live header-derived state precedence; queue-and-retry behavior for over-limit requests.
- **Out of scope:** distributed gate state across multiple `social-listening-core` instances, queue depth ceilings, TTL-based abandonment, and dead-lettering — all deferred to ADR-0020/FDD-0020; connector health/auto-disable logic (ADR-0010/ADR-0023); the connector contract itself that supplies `getRateLimitConfig()`/`parseRateLimitHeaders()` (ADR-0002/FDD-0002).

### 2.3 Target Audience

Core backend engineers implementing or consuming `RequestGate`, the platform operator monitoring queue depth/throughput, and the technical lead validating tenant-isolation guarantees.

---

## 3. Context and Background

- **Problem/opportunity:** each tenant connects platforms/AI providers with its own credentials and therefore its own independent quota (X's per-tier windows, YouTube's daily quota-cost model, Reddit's per-minute cap, per-model AI limits). Without a shared, tenant-scoped enforcement point, one heavy tenant could exhaust a shared budget and throttle every other tenant hitting the same platform, and the system would either invent limits or silently drop over-limit requests.
- **Business/user value:** guaranteed multi-tenant isolation on rate limiting; automatic adaptation to a platform's live rate-limit state without a code change; no silent ingestion data loss on transient rate-limit hits.
- **Source requirements:** ADR-0003; BRD-0003 (BR-001–BR-006, BRU-001–BRU-005); Story 2.2 (Epic 2, built `social-listening-core@00322f2`).
- **Constraints/dependencies:** rate-limit values must never be invented by the core — only platform-documented limits or explicitly labeled conservative placeholders (BRU-001); a queued request waiting for window reset adds latency to that tenant's ingestion; per-model AI gating is more granular bookkeeping than social connectors need; the current `RequestGate` runs in-process on a single `social-listening-core` instance — distributed state is explicitly deferred (ADR-0020) until a second concurrent instance is actually run.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Guarantee tenant-isolated rate-limit enforcement | Two tenants calling the same platform concurrently are gated independently — one tenant at its limit does not delay or block the other |
| G2 | Use platform-documented rate limits as the sole source of truth | Every connector's `RateLimitConfig` traces to platform documentation or an explicitly labeled conservative placeholder; the core invents nothing |
| G3 | Adapt automatically to a platform's live rate-limit state | When a connector implements `parseRateLimitHeaders()`, the gate reflects live reported state over the static config |
| G4 | Prevent silent data loss on rate-limit hits | Requests exceeding a limit are queued and retried after window reset; none are dropped without a trace |
| G5 | Extend isolation to AI enrichment at model granularity | AI provider calls are gated per `(tenantId, providerId, modelId)`, not merely per provider |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `RequestGate` admission check

- **Description:** the shared enforcement point every outbound platform/AI request passes through before leaving `social-listening-core`.
- **Triggers:** any outbound request a connector is about to make — a poll fetch, a push/webhook-driven follow-up call, or an AI `analyze()` call.
- **Inputs:** the requesting `tenantId`; the target connector's `providerId` (and `modelId` for AI); the connector's declared `RateLimitConfig` (from `getRateLimitConfig()`, ADR-0002).
- **Processing:** the gate looks up current state for the request's key — `(tenantId, providerId)` for social, `(tenantId, providerId, modelId)` for AI — and determines whether the request fits within the remaining quota for the current window. Live header-derived state (if the connector implements `parseRateLimitHeaders()`) takes priority over the static `RateLimitConfig` when both exist for the same key.
- **Outputs:** either an immediate admission (the request proceeds) or a queued-and-delayed admission (see 5.3).
- **Error handling:** a missing or malformed `RateLimitConfig` from a connector is a contract-test-time failure (per ADR-0002), not something the gate silently works around at runtime.
- **Edge cases:** a connector with no declared limit for a request type it is now making — treated as a contract violation to be fixed, not a runtime default to invent.

### 5.2 Feature / Capability: Tenant-scoped key isolation

- **Description:** the gate's state is partitioned strictly by tenant, so no tenant's usage can ever consume another tenant's budget for the same provider.
- **Triggers:** every admission check (5.1).
- **Inputs:** `tenantId` as a mandatory component of every gate key.
- **Processing:** social requests key on `(tenantId, providerId)`; AI enrichment requests key on `(tenantId, providerId, modelId)` — one level deeper, since AI provider limits are typically per-model (per ADR-0002's `getModelRateLimit(modelId)`). No code path aggregates or shares quota across tenants for the same provider/model.
- **Outputs:** independent quota state per tenant, verifiable by concurrent-tenant tests.
- **Error handling:** a bug that lets one tenant's state influence another's is a correctness defect verified against directly by acceptance/contract tests (per BR-006/NFR-001), not an acceptable degradation.
- **Edge cases:** two tenants sharing the exact same underlying platform credential (not the normal case, since each tenant holds its own credentials) — even then, gating remains keyed by `tenantId`, not by credential identity.

### 5.3 Feature / Capability: Queue-and-retry for over-limit requests

- **Description:** a request that would exceed the current rate limit is not dropped — it is queued for the same `(tenantId, providerId[, modelId])` key and automatically retried once the relevant window resets.
- **Triggers:** an admission check (5.1) that determines the request would exceed the remaining quota.
- **Inputs:** the over-limit request; the window-reset time derived from the (live or static) rate-limit state.
- **Processing:** the request is placed on that key's queue; when the window resets (or live state indicates quota is available again), the gate releases the next queued request(s) up to the newly available quota.
- **Outputs:** eventual delivery of the request once quota is available, or (in future scope per ADR-0020) a visible failure if queue bounds/TTL are exceeded.
- **Error handling:** a request must never be silently dropped for exceeding the limit — queue-and-retry is the only sanctioned outcome in this ADR's scope (BR-004/BRU-003); unbounded queue growth under sustained over-quota conditions is a known gap, explicitly deferred to ADR-0020 (queue bounds, TTL, dead-lettering) rather than solved here.
- **Edge cases:** a tenant sustaining over-quota usage indefinitely — queue for that `(tenantId, providerId)` grows without the bounds/backpressure this ADR does not define; monitoring queue depth (NFR-002) is the mitigation available today, ahead of ADR-0020's bounded-queue work.

### 5.4 Feature / Capability: Live rate-limit header precedence

- **Description:** where a platform reports its current rate-limit state in response headers, and the connector implements `parseRateLimitHeaders()`, that live state overrides the connector's static declared `RateLimitConfig` for admission decisions.
- **Triggers:** any platform response that includes rate-limit headers, on a connector that implements the optional parser.
- **Inputs:** raw response headers from the platform call; the connector's `parseRateLimitHeaders()` implementation.
- **Processing:** the gate updates its live-state view for the request's key from the parsed headers; subsequent admission checks for that key prefer this live state over the static config until it is next refreshed or expires.
- **Outputs:** an admission decision that reflects what the platform is reporting right now, not a potentially stale static value.
- **Error handling:** a connector without `parseRateLimitHeaders()` simply falls back to the static `RateLimitConfig` — this is a normal, supported path, not an error.
- **Edge cases:** a platform tightening its limits mid-window (live state now stricter than static config) — the gate must honor the tighter live state immediately, not wait for the next static-config deploy.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Ingestion Pipeline / Enrichment Stage (system actor) | Issues outbound requests that must pass through `RequestGate` |
| `RequestGate` (system actor) | Enforces tenant-scoped admission, queuing, and retry |
| Platform Operator | Monitors queue depth and retry wait times across tenants |
| Core Backend Engineer | Implements connectors that supply `RateLimitConfig`/`parseRateLimitHeaders()` consumed by the gate |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 2.2) | multi-tenant platform operator | have every outbound platform/AI request gated by a shared `RequestGate` scoped to `(tenantId, providerId)` — and `(tenantId, providerId, modelId)` for AI enrichment — with live rate-limit headers taking priority over static declared config | one tenant's usage never throttles another tenant sharing the same platform | (1) two tenants calling the same platform concurrently are gated independently; (2) live headers, when parsed, override static config; (3) an over-limit request is queued and retried after window reset, never dropped without a trace; (4) AI enrichment requests are gated per model |

### 6.3 Workflow Diagrams / Steps

**Workflow: Outbound request admission**

1. A connector (social poll/push, or AI `analyze()`) is about to make an outbound call.
2. The pipeline requests admission from `RequestGate`, supplying `tenantId`, `providerId` (and `modelId` for AI).
3. The gate checks current state for that key: live header-derived state if present, otherwise the connector's static `RateLimitConfig`.
4. If quota is available, the request proceeds immediately.
5. If not, the request is queued for that key.
6. When the window resets (or live state indicates renewed quota), the gate releases the queued request for delivery.
7. If the platform response includes rate-limit headers and the connector implements `parseRateLimitHeaders()`, the gate updates its live state for that key from the response, ready for the next admission check.

---

## 7. Data Requirements

### 7.1 Data Inputs

Connector-declared `RateLimitConfig` (strategy, window, quota, cost-per-request); live rate-limit headers from platform responses (where available); the `tenantId`/`providerId`/`modelId` of each outbound request.

### 7.2 Data Outputs

Admission decisions (proceed / queue); queue entries per key; updated live `RateLimitState` per key; observability metrics (queue depth, wait time) for the platform operator.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `RequestGate` | in-process enforcement component; holds state keyed by `(tenantId, providerId)` or `(tenantId, providerId, modelId)` | Consumes `RateLimitConfig`/`RateLimitState` from connectors (ADR-0002); gates every outbound request |
| `RateLimitConfig` | strategy, window, quota, cost-per-request; static, connector-declared | Produced by `getRateLimitConfig()`; superseded by `RateLimitState` when live headers are available |
| `RateLimitState` | live remaining quota, window boundaries, cost — derived from platform response headers | Produced by `parseRateLimitHeaders()`; takes priority over `RateLimitConfig` |
| Queue entry | a queued outbound request awaiting window reset, keyed by `(tenantId, providerId[, modelId])` | Belongs to exactly one tenant/provider/model key; released on window reset |
| `IngestionRun` (referenced) | records whether a poll attempt was retryable, per the ingestion pipeline | Related but owned by ADR-0005/ADR-0010, not by this ADR |

### 7.4 Validation Rules

- A connector's `RateLimitConfig` must trace to platform documentation, or be explicitly labeled as a conservative placeholder (BRU-001) — never an invented value.
- Live state from `parseRateLimitHeaders()` always takes priority over static `RateLimitConfig` for the same key when both exist (BRU-002).
- Every gate key must include `tenantId` — no key may omit tenant scope (BRU-005).
- AI enrichment keys must include `modelId` in addition to `providerId` (BRU-004).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A connector may only declare rate limits reflecting the platform's documented limits or an explicitly labeled conservative placeholder; the core never invents a limit. | All connectors |
| BR2 | When a platform returns live rate-limit headers and the connector implements `parseRateLimitHeaders()`, the live state takes priority over the static `RateLimitConfig`. | `RequestGate` |
| BR3 | A request that would exceed the current rate limit for a tenant must be queued and retried; it must never be dropped silently. | `RequestGate` |
| BR4 | AI enrichment requests are gated per model, using the key `(tenantId, providerId, modelId)`, in addition to provider-level gating. | AI enrichment requests |
| BR5 | Rate-limit enforcement is never global; it is always scoped to a single tenant. | `RequestGate` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `ProviderConnector`/`SocialConnector`/`AIProviderConnector` (ADR-0002) | Inbound to gate | Supplies `RateLimitConfig` and, optionally, live header state | In-process |
| Ingestion pipeline / enrichment stage | Outbound consumer of the gate | Requests admission before every outbound call | In-process |
| Connector health / auto-disable (ADR-0010/ADR-0023) | Parallel system | Handles sustained failure separately from rate-limit queuing | In-process |
| ADR-0020 bounded-queue/distributed-gate work (future) | Extension point | Adds queue bounds, TTL, dead-lettering, and multi-instance distributed state | In-process (future: shared state store) |

---

## 10. Non-Functional Considerations

- **Performance:** admission checks sit on the hot path of every outbound request; the lookup/update for a given key must stay cheap enough not to become the pipeline's bottleneck.
- **Security/access control:** rate-limit state is keyed by `tenantId`, reinforcing tenant isolation alongside RLS (ADR-0015) but at the outbound-request layer rather than the database layer.
- **Scalability:** the current design runs in-process on a single instance; horizontal scaling to multiple instances requires the distributed gate state deferred to ADR-0020.
- **Reliability/availability:** queue-and-retry protects against silent data loss on transient rate-limit hits; unbounded queue growth under sustained over-quota conditions is a known, currently unmitigated risk pending ADR-0020.
- **Audit and logging:** queue depth and retry wait time per `(tenantId, providerId)` should be observable to the platform operator (NFR-002).
- **Accessibility/localization:** not applicable — internal backend enforcement component with no UI surface.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Request would exceed the current rate limit | N/A (internal); ingestion for that tenant/provider simply resumes after window reset | Request queued at the `(tenantId, providerId[, modelId])` key, retried after window reset |
| Connector declares no valid `RateLimitConfig` | N/A (caught in contract tests, ADR-0002) | Gate cannot admit requests for that connector until fixed |
| Live headers indicate a tighter limit than the static config | N/A (internal) | Gate immediately adopts the tighter live state for subsequent admission checks |
| Sustained over-quota usage causes unbounded queue growth | N/A (operator-facing metric, not user-facing) | Currently unmitigated within this ADR's scope; tracked as a known gap for ADR-0020 |
| Cross-tenant quota leakage (defect scenario) | N/A | Must never occur; caught by acceptance/contract tests verifying key isolation (BR-006/NFR-001) |

---

## 12. Assumptions and Dependencies

- Each tenant holds independent platform credentials and therefore independent quota.
- Platform rate limits are documented and stable enough to be declared by connectors; live headers are the preferred override where available.
- The initial `RequestGate` implementation runs in-process on a single `social-listening-core` instance; distributed state is out of scope until a second concurrent instance actually runs.
- Existing retryable/non-retryable error handling (ADR-0010/ADR-0023) remains the separate mechanism for connector health and auto-disable — not duplicated here.
- Dependency: ADR-0002 supplies the `getRateLimitConfig()`/`parseRateLimitHeaders()` contract this gate consumes.
- Dependency: ADR-0020 will add queue bounds, TTL-based abandonment, dead-lettering, and distributed gate state — explicitly deferred, not built speculatively.
- Dependency: ADR-0014/ADR-0015 (tenant-scoped credential storage and RLS) provide the broader tenant-isolation context this gate reinforces at the outbound-request layer.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What queue depth/TTL bounds and backpressure mechanism will apply once ADR-0020 is implemented? | Technical Lead | Resolved by ADR-0020/FDD-0020 |
| Q2 | What observability surface (dashboard, metric export) will expose queue depth and retry wait time to the platform operator? | Technical Lead | Open — NFR-002 states the requirement, not the mechanism |

---

## 14. Appendix

- **Glossary:** see BRD-0003 §15 (`RequestGate`, `RateLimitConfig`, `parseRateLimitHeaders()`, `getModelRateLimit(modelId)`, `RateLimitState`, `tenantId`/`providerId`/`modelId`).
- **Reference links:** `docs/adr/0003-per-tenant-per-provider-rate-limiting.md`; `docs/project docs/Business-Requirements/BRD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md`; `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` (Story 2.2, Story 2.4); `docs/adr/0002-unified-provider-connector-pattern.md`; `docs/adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md`; `docs/adr/0010-error-handling-and-auto-disable-policy.md`; `docs/adr/0023-proportional-connector-failure-threshold.md`.
- **Feature design/deep research:** none found — this is a backend enforcement ADR with no dedicated `docs/product-research/feature-designs/` or `reports/` entry; rationale is captured directly in the design spec (§3.2, §8) and the ADR.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0003/BRD-0003/Story 2.2 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
