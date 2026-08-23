# Live Ingestion-Polling Scheduler – Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Live Ingestion-Polling Scheduler – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent (AI Business & Requirements Analyst) |
| Approver(s) | Menno, Sponsor |
| Status | Draft for review (source ADR-0052 Accepted 2026-08-13) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0052, Story 1.13/1.14, and feature design 01 |

---

## 2. Executive Summary

The product's core value proposition is that a connected, activated social-listening or news connector actually ingests posts into the tenant's feed. Today, that promise is broken: connectors can be verified and activated in the admin UI, yet the running `social-listening-core` server never invokes their poll logic. The result is that "active" on the connector status screen is a false positive; real tenants see zero ingested posts from GNews, Newswire, or tenant-owned RSS feeds unless a contract test happens to have run.

ADR-0052 closes this gap by introducing a **live ingestion-polling scheduler**: a single, in-process loop that boots the connector registry, enumerates active tenant-connector pairs, and triggers each poll-mode connector's generic `poll()` on a derived, per-pair cadence. The design intentionally avoids new persisted state, new deployable services, and hardcoded per-connector dispatch logic. This Business Requirements Document captures the business need, scope, success measures, and acceptance criteria for delivering that scheduler.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make an "active" connector actually ingest content on a recurring basis | Tenants with active, healthy connectors receive new `SocialPost` rows without manual intervention within one cadence period |
| 2 | Eliminate the false-positive "active but not ingesting" state | Connector status and self-service exports reflect real, live polling rather than artifacts from prior test runs |
| 3 | Preserve the existing lightweight, single-instance operational model | No new scheduling service, cron worker, or database migration is introduced for the scheduler mechanism itself |
| 4 | Keep the core ingestion pipeline closed to connector-specific changes | A new poll connector can be added by registering its own `poll()`/`pollCadenceMs`; no scheduler code is edited |
| 5 | Prevent overlapping re-polls from slow or interrupted cycles | The scheduler skips a `(tenant, platform)` pair whose most recent run is still in progress |

---

## 4. Scope

### 4.1 In Scope

- Bootstrap of the shared connector registry at application startup so every real `SocialConnector`/`AIProviderConnector` is registered before the scheduler begins.
- Extension of the `SocialConnector` contract with an optional, generic `poll(tenantId)` method and a `pollCadenceMs` value for poll-mode connectors.
- An in-process interval loop started from the server's `main()` entry point only.
- Per-tick enumeration of every tenant × every registered poll-mode connector filtered through the existing `shouldAttemptIngestion()` health/activation gate.
- Derived cadence scheduling from each `(tenantId, platformId)` pair's most recent `ingestion_runs.started_at`, with no new stored "next poll" field.
- Deterministic, per-pair `jitterFraction` of ±5% to spread cross-tenant and cross-restart thundering-herd risk.
- Skipping a pair when its most recent `ingestion_runs` row still has `status: 'running'`.
- Failure isolation: scheduler-level catch of unexpected, non-classifiable errors only; `ClassifiableError` propagates uncaught so existing health derivation remains correct.
- Tenant-wide (`ownerType: 'tenant'`) poll connectors only for this ADR (GNews, Newswire, tenant-owned-feed).
- Test isolation: the scheduler must not start from the test-only `createApp()` path and must default off under `NODE_ENV === 'test'`.

### 4.2 Out of Scope

- Tier-3 (per-user) poll connector scheduling (e.g., a future per-user Reddit or Facebook OAuth connector). This is deliberately deferred; Story 1.15/ADR-0061 addresses it separately.
- Multi-instance distributed locking. The scheduler assumes a single `social-listening-core` process, matching the current deployment shape.
- Cost/quota budget ceiling, spend alerting, or a circuit-breaker for continuous polling.
- Changing *what* each connector polls for; the GNews hardcoded query default remains unchanged.
- A separate scheduling service (BullMQ/Redis, Azure Functions Timer, `pg_cron`, or a standalone cron container).
- Admin UI surfacing of scheduler activity, such as a "last polled at" timestamp.

### 4.3 Assumptions

- `social-listening-core` continues to run as a single instance.
- The connector registry, `ingestion_runs` table, `connector_activations` table, `RequestGate`, and `ConnectorHealth` derivation already exist and are operational.
- At least one poll-mode connector (GNews, Newswire, tenant-owned-feed) is registered with a valid `poll()` wrapper and `pollCadenceMs`.
- Platform admin role already has the necessary bypass scope to enumerate tenants (ADR-0030).

### 4.4 Constraints

- Must not violate ADR-0048's "no core pipeline change for new connector registration" rule.
- Must not introduce a second, independently-updateable source of "when to poll" truth.
- Must not make real outbound API calls during the contract-test suite.
- Must operate within the existing Node/Postgres stack; no new infrastructure or deployment target.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary user who connects and activates sources | High | An activated connector actually ingests posts; status screen reflects truth |
| Sole-Operator | Platform owner / operator | High | No new service to provision, monitor, or pay for; cost and health visible |
| Tenant-User | Consumer of the normalized post feed | Medium | Sees timely, source-accurate posts without manual refresh |
| Platform-Admin | Cross-tenant oversight | Medium | Can see platform-level active connector and error counts |
| Menno (Sponsor / Technical Lead) | Decision authority and builder | High | Minimal, maintainable design that closes the live gap without speculative over-engineering |

---

## 6. Current State (As-Is)

**Current process:**

1. A Tenant-Admin uses the admin UI to connect, verify, and activate a poll-mode connector.
2. The connector's activation and credential records are persisted.
3. The running `social-listening-core` server starts `main()`, which initializes the Express listener.
4. No background loop or scheduler is started.
5. The connector registry (`registry.ts`) is never populated outside of Jest contract-test setup.
6. `pollGNewsSearch()`, `pollNewswireFeeds()`, and `pollTenantOwnedFeed()` are never called by production code.
7. Any `SocialPost` rows visible to the tenant are incidental artifacts from earlier contract-test runs, not live polling.

**Pain points:**

- The connector status screen says "active" while ingestion is zero.
- Real, DNS-verified and credentialed connectors produce no posts.
- A tenant's own export shows only test artifacts, creating confusion and eroding trust.
- The shared registry is unbootstrapped in production, which also leaves the `authMode === 'none'` gating in `connectorsRouter.ts` effectively unenforced.

---

## 7. Future State (To-Be)

**New or improved process:**

1. At startup, `main()` calls `bootstrapConnectors()` to register every real `SocialConnector` and `AIProviderConnector` exactly once.
2. `main()` then starts a single in-process scheduler loop, gated by `SCHEDULER_ENABLED` and off in test mode.
3. Every 60 seconds the scheduler evaluates every `(tenant, poll-mode connector)` pair.
4. For each pair, it first checks `shouldAttemptIngestion(tenantId, platformId)` with the default tenant scope.
5. It then checks whether the pair's most recent `ingestion_runs` row is not `status: 'running'` and whether `now - last_started_at` is at least the connector's `pollCadenceMs` adjusted by a deterministic ±5% jitter.
6. Eligible pairs trigger `connector.poll(tenantId)` generically through the registry.
7. Unexpected, non-classifiable errors are caught and logged at the scheduler level; classified connector failures propagate and are recorded as `IngestionRun` rows as before.
8. Contract tests continue to run without real outbound calls because the scheduler never starts from the test-only `createApp()` path.

**Expected capabilities:**

- Poll-mode connectors ingest on a real, recurring cadence automatically.
- A new poll connector can be added by registering its own `poll()`/`pollCadenceMs`; no scheduler edits.
- Restarting the scheduler loses no scheduling state because cadence is derived from existing audit rows.
- Overlapping polls for the same `(tenant, platform)` pair are prevented in the common single-process case.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall bootstrap the shared connector registry at application startup | Must | `main()` calls `bootstrapConnectors()` before the HTTP listener accepts traffic and before the scheduler's first tick; `listSocialConnectors()` returns every real poll-mode connector after startup | Product Owner |
| BR-002 | The system shall support a generic `poll()` method on poll-mode `SocialConnector` registrations | Must | GNews, Newswire, and tenant-owned-feed each register a `poll()` wrapper plus `pollCadenceMs`; the scheduler invokes `getSocialConnector(platformId)?.poll?.(tenantId)` with no per-`providerId` switch | Product Owner |
| BR-003 | The system shall run a single in-process scheduler loop only from the production server entry point | Must | The loop starts only from `main()`; `createApp()` (used by contract tests) never starts a background timer | Technical Lead |
| BR-004 | The system shall enumerate eligible tenant-connector pairs each tick | Must | Each tick considers `listTenants() × listSocialConnectors().filter(deliveryMode === 'poll')` and consults `shouldAttemptIngestion(tenantId, platformId)` defaulting to tenant scope | Product Owner |
| BR-005 | The system shall poll a pair only after its jittered cadence has elapsed | Must | Eligibility uses `now - last_started_at >= pollCadenceMs × (1 + jitterFraction)`, where `jitterFraction` is deterministic and stable per `(tenantId, platformId)` in `[-0.05, +0.05]` | Product Owner |
| BR-006 | The system shall skip a pair whose most recent run is still in progress | Must | A pair is not polled when its most recent `ingestion_runs` row for that `(tenantId, platformId)` has `status: 'running'`, regardless of elapsed time | Product Owner |
| BR-007 | The system shall isolate unexpected poll failures without halting the scheduler | Must | Non-`ClassifiableError` exceptions are caught and logged at the scheduler level; the loop continues for all other pairs; `ClassifiableError` propagates uncaught so health derivation is preserved | Technical Lead |
| BR-008 | The system shall not schedule polls during automated testing | Must | `SCHEDULER_ENABLED` defaults to off under `NODE_ENV === 'test'`; the full contract suite makes zero real outbound calls from scheduler activity | Technical Lead |
| BR-009 | The system shall schedule tenant-wide poll connectors only in this release | Must | No `connector_user_activations` (Tier-3) row is enumerated or polled by the v1 scheduler | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Scheduler cadence shall be derived from existing `ingestion_runs` rows, with no new persisted "next poll" state | Maintainability | Must | No new table or column is added for the scheduler; restart recomputes eligibility from `ingestion_runs.started_at` and `status` |
| NFR-002 | Tick interval and per-connector cadence shall be adjustable via environment variables | Maintainability | Should | `SCHEDULER_ENABLED` and default cadence values (60 s tick; GNews 15 min; Newswire 15 min; tenant-owned-feed 30 min) are configurable without code change |
| NFR-003 | Jitter shall be deterministic and reproducible | Reliability | Must | The same `(tenantId, platformId)` always yields the same `jitterFraction`; contract tests can assert exact scheduling behavior without randomness |
| NFR-004 | The scheduler shall not trigger real outbound calls during tests | Security / Reliability | Must | `npm test` makes zero real calls to GNews, Newswire, or any tenant feed from scheduler side effects |
| NFR-005 | The scheduler shall operate correctly under a single-instance assumption | Scalability | Must | The design is documented as single-instance only; multi-instance double-polling is explicitly deferred and named as a future risk |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A poll-mode connector must expose a `pollCadenceMs` value alongside its `poll()` method; the scheduler uses that value as the single source of truth for its cadence. |
| BRU-002 | A `(tenant, platform)` pair is eligible for polling only if it is active, healthy (per `shouldAttemptIngestion`), its most recent `ingestion_runs` row is not `status: 'running'`, and its jittered cadence has elapsed. |
| BRU-003 | If no prior `ingestion_runs` row exists for a pair, the pair is treated as unconditionally due. |
| BRU-004 | A `poll()` implementation must let `ClassifiableError` propagate uncaught; it must not wrap or downgrade connector-level failures locally. |
| BRU-005 | The scheduler must catch and log only unexpected, non-`ClassifiableError` exceptions; it must never allow one pair's failure to halt the loop or affect other pairs. |
| BRU-006 | The scheduler must not start from any test-only application-construction path. |
| BRU-007 | The v1 scheduler is limited to tenant-wide poll connectors; user-bound (Tier-3) poll connectors are out of scope. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.started_at` | Timestamp of the most recent ingestion attempt for a `(tenant, platform)` pair | `ingestion_runs` table | Backend | Internal audit |
| `ingestion_runs.status` | Completion status of the most recent run (`running`, `succeeded`, `failed`) | `ingestion_runs` table | Backend | Internal audit |
| `connector_activations.is_active` | Whether a tenant-wide connector is activated | `connector_activations` table | Backend | Tenant-scoped |
| `connector.pollCadenceMs` | Connector-specific default polling interval in milliseconds | Connector registration | Backend | Internal |
| `jitterFraction` | Deterministic ±5% cadence offset derived from a stable hash of `tenantId:platformId` | Scheduler computation | Backend | Internal |
| `providerId` / `platformId` | Identifier for the source platform (e.g., `gnews`, `newswire`, `tenant-owned-feed`) | Connector registry / `social_connectors` metadata | Backend | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Poll attempts per tick | Tracks how many `(tenant, platform)` pairs are actually dispatched per scheduler tick | Sole-Operator / Developer | Continuous (log/metric) |
| Skipped due to in-flight runs | Measures the effectiveness of the overlap-prevention guard | Developer | Continuous |
| Connector health transitions | Shows `healthy` → `failing` and `failing` → `healthy` movements from live polling | Tenant-Admin / Sole-Operator | Real-time on `ConnectorHealthChangedEvent` |
| Ingestion volume by platform | Enables cost and usage awareness across GNews, Newswire, tenant-owned-feed, etc. | Sole-Operator / Platform-Admin | Hourly / Daily |
| Scheduler uptime | Indicates whether the background loop is running in the one deployed instance | Sole-Operator | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Continuous polling begins consuming real paid quota (GNews API calls, etc.) immediately on ship | High | High | Document and track the cost/quota ceiling as an open item for the Cost Management Plan; monitor ingestion volume closely | Sponsor |
| R-002 | The single `social-listening-core` process becomes a single point of failure for all ingestion | Medium | High | Accepted as a deliberate single-instance trade-off; revisit if a second concurrent instance is ever deployed | Technical Lead |
| R-003 | A second concurrent instance would double-poll eligible pairs | Low | High | Named and deferred; future design likely uses a per-pair Postgres advisory lock | Technical Lead |
| R-004 | Several active connectors for one tenant may still become eligible on the same tick, creating a small burst | Medium | Low | Mitigated by `RequestGate` per-key queuing; residual cross-tenant/cross-restart thundering herd is closed by ±5% jitter | Technical Lead |
| R-005 | Once live polling runs, the GNews hardcoded query default may surface irrelevant posts for tenants | High | Medium | Explicitly out of scope; track as a separate "what to poll for" story (watchlist-driven query construction) | Product Owner |
| R-006 | A future connector author may wrap `ClassifiableError` locally and break health derivation | Low | High | Stated as a durable contract in ADR-0052 §8; enforced by code review and contract tests | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0052 accepted and source of truth | Internal / Decision | Sponsor | Resolved 2026-08-13 |
| D-002 | Story 1.11 (`connector_activations`/`shouldAttemptIngestion`) | Internal / Story | Backend | Built |
| D-003 | Story 1.12 (`isActive` read path) | Internal / Story | Backend | Built |
| D-004 | Story 1.13 (live ingestion-polling scheduler) | Internal / Story | Backend | Built 2026-08-13 |
| D-005 | Story 1.14 (skip in-flight runs) | Internal / Story | Backend | Built 2026-08-18 |
| D-006 | `ingestion_runs` audit table and indexing | Internal / Data | Backend | Built (ADR-0005) |
| D-007 | `RequestGate` per-provider rate limiting | Internal / Component | Backend | Built (ADR-0003/0020) |
| D-008 | Connector health derivation (`shouldAttemptIngestion`) | Internal / Component | Backend | Built (ADR-0009/0010/0023/0051) |
| D-009 | ADR-0048 "no core pipeline change on new connector registration" | Internal / Constraint | Sponsor | Accepted |
| D-010 | Story 1.15 / ADR-0061 (Tier-3 per-user scheduling) | Future | Backend | Out of scope for this BRD; built separately 2026-08-18 |

---

## 14. Acceptance Criteria

- A tenant with an active, healthy GNews connector receives new `SocialPost` rows within one 15-minute cadence period without manual action.
- `listSocialConnectors()` returns GNews, Newswire, and tenant-owned-feed after real server startup, not an empty list.
- The scheduler's `main()`-only start path plus `SCHEDULER_ENABLED` guard prevents all background polling during `npm test`.
- A pair under its jittered cadence is not polled; a pair with no prior run is polled when eligible.
- A pair whose most recent `ingestion_runs` row is still `status: 'running'` is never re-polled, even if its cadence has elapsed.
- A new poll connector can be added by registering `poll()`/`pollCadenceMs` without editing the scheduler module.
- A raw (non-`ClassifiableError`) exception in one `poll()` call does not prevent other pairs from being polled in the same tick.
- A `ClassifiableError` from a `poll()` call propagates uncaught and updates `ConnectorHealth` as if the connector had been invoked directly.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Poll-mode connector** | A `SocialConnector` whose source requires the system to ask the provider repeatedly for new content (`deliveryMode: 'poll'`), as opposed to push/webhook sources. |
| **Registry bootstrap** | The one-time registration of every real connector module into the shared `registry.ts` at server startup. |
| **Derived cadence** | A scheduling decision computed from existing audit data (`ingestion_runs.started_at`) rather than from a separately stored "next run at" value. |
| **Jitter fraction** | A deterministic, per-pair offset in `[-0.05, +0.05]` applied to `pollCadenceMs` to avoid thundering-herd re-synchronization. |
| **Ingestion run** | A record in `ingestion_runs` anchoring an attempt to poll a `(tenant, platform)` pair, including `started_at`, `status`, and result metadata. |
| **ClassifiableError** | The project's domain error type for connector failures (rate limits, auth failures, malformed responses) that must be recorded and factored into `ConnectorHealth`. |
| **RequestGate** | The in-process per-provider rate/concurrency limit mechanism. |
| **Tier-3 / user-bound connector** | A connector whose credential and activation are scoped to an individual user rather than the whole tenant (e.g., a per-user OAuth grant). |

---

## 16. Appendices

- **ADR-0052:** `docs/adr/0052-live-ingestion-polling-scheduler.md`
- **Feature design (multi-source ingestion context):** `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- **Related user stories:**
  - `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.13 (live ingestion-polling scheduler)
  - `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.14 (skip in-flight runs)
  - `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.15 (Tier-3 per-user scheduling, out of scope for this ADR)
- **No deep-research brief found** specifically for the live ingestion-polling scheduler; the design in ADR-0052 was driven by a live, in-session root-cause investigation rather than a pre-existing research report.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
