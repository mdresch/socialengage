# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0052 Live Ingestion-Polling Scheduler — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0052-live-ingestion-polling-scheduler.md, ../Business-Requirements/BRD-0052-Live-Ingestion-Polling-Scheduler.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0052-live-ingestion-polling-scheduler.md and the business requirements in BRD-0052-Live-Ingestion-Polling-Scheduler.md into functional design for **Live Ingestion Polling Scheduler**.
The product's core value proposition is that a connected, activated social-listening or news connector actually ingests posts into the tenant's feed. Today, that promise is broken: connectors can be verified and activated in the admin UI, yet the running `social-listening-core` server never invokes their poll logic. The result is that "active" on the connector status screen is a false positive; real tenants see zero ingested posts from GNews, Newswire, or tenant-owned RSS feeds unless a contract test happens to have run.

ADR-0052 closes this gap by introducing a **live ingestion-polling scheduler**: a single, in-process loop that boots the connector registry, enumerates active tenant-connector pairs, and triggers each poll-mode connector's generic `poll()` on a derived, per-pair cadence. The design intentionally avoids new persisted state, new deployable services, and hardcoded per-connector dispatch logic. This Business Requirements Document captures the business need, scope, success measures, and acceptance criteria for delivering that scheduler.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Tier-3 (per-user) poll connector scheduling (e.g., a future per-user Reddit or Facebook OAuth connector). This is deliberately deferred; Story 1.15/ADR-0061 addresses it separately.
- Multi-instance distributed locking. The scheduler assumes a single `social-listening-core` process, matching the current deployment shape.
- Cost/quota budget ceiling, spend alerting, or a circuit-breaker for continuous polling.
- Changing *what* each connector polls for; the GNews hardcoded query default remains unchanged.
- A separate scheduling service (BullMQ/Redis, Azure Functions Timer, `pg_cron`, or a standalone cron container).
- Admin UI surfacing of scheduler activity, such as a "last polled at" timestamp.

## 3. Context and Background
See ADR Context.
The product's core value proposition is that a connected, activated social-listening or news connector actually ingests posts into the tenant's feed. Today, that promise is broken: connectors can be verified and activated in the admin UI, yet the running `social-listening-core` server never invokes their poll logic. The result is that "active" on the connector status screen is a false positive; real tenants see zero ingested posts from GNews, Newswire, or tenant-owned RSS feeds unless a contract test happens to have run.

ADR-0052 closes this gap by introducing a **live ingestion-polling scheduler**: a single, in-process loop that boots the connector registry, enumerates active tenant-connector pairs, and triggers each poll-mode connector's generic `poll()` on a derived, per-pair cadence. The design intentionally avoids new persisted state, new deployable services, and hardcoded per-connector dispatch logic. This Business Requirements Document captures the business need, scope, success measures, and acceptance criteria for delivering that scheduler.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Make an "active" connector actually ingest content on a recurring basis | Tenants with active, healthy connectors receive new `SocialPost` rows without manual intervention within one cadence period |
| 2 | Eliminate the false-positive "active but not ingesting" state | Connector status and self-service exports reflect real, live polling rather than artifacts from prior test runs |
| 3 | Preserve the existing lightweight, single-instance operational model | No new scheduling service, cron worker, or database migration is introduced for the scheduler mechanism itself |
| 4 | Keep the core ingestion pipeline closed to connector-specific changes | A new poll connector can be added by registering its own `poll()`/`pollCadenceMs`; no scheduler code is edited |
| 5 | Prevent overlapping re-polls from slow or interrupted cycles | The scheduler skips a `(tenant, platform)` pair whose most recent run is still in progress |

---

**Positive consequences (from ADR):**
**Positive**
- Closes the actual, live, core-value-proposition gap this session found: connectors can be connected, verified, activated, and still never ingest anything — this ADR's Decision, once built, is the first design that makes that gap closeable rather than a described-but-unaddressed limitation.
- No new database table or migration is required for the scheduler mechanism itself (§5's derived-cadence decision) — the only schema-adjacent change is none; the only new persisted state anywhere in this Decision is nothing beyond what `ingestion_runs` and `connector_activations` already store.
- §4's generic `poll()` interface addition is enforced, not just requested, by ADR-0048's own already-Accepted CI guardrail (Story 2.10) — a future connector cannot silently reintroduce a hardcoded scheduler switch without that guardrail flagging it, the same protection every other connector-registration surface already has.
- §3's registry-bootstrap fix has a genuinely useful side effect found only while drafting this ADR: it closes the live, previously-unnamed `authModeForbidsUserScope()` no-op gap in `connectorsRouter.ts`, at zero additional design cost.
- §5's derived-cadence choice means a scheduler process restart loses no state and can never desynchronize from the audit trail — consistent with, not a departure from, this project's existing `ConnectorHealth`/`AuthorTopicSignal` "single source of truth, nothing else to reconcile" discipline (ADR-0009, ADR-0022).

**Negative**
- **Real, immediate external cost begins the moment this ships.** Every tenant with an active, credentialed connector (GNews's paid/free-tier API calls in particular) starts consuming real quota continuously, not on-demand — this is the first mechanism in this project that turns "connected" into "actually costing something, repeatedly, without a human clicking anything." No budget ceiling, rate cap, or cost-alerting mechanism is decided by this ADR — named as a real, unresolved gap for Menno (see Open Question 4), not fabricated a number here.
- Single point of failure while single-instance: if the one `social-listening-core` process is down, ingestion stops entirely for every tenant, with no distributed fallback — an accepted, named trade-off (§7), not an oversight.
- Distributed correctness (double-polling under a hypothetical second concurrent instance) is deliberately deferred, same as ADR-0020's own Redis deferral — a real gap if that condition is ever hit, not designed against now.
- §5's own ±5% per-pair jitter spreads *cross-tenant* and *cross-restart* synchronization, but a single tenant with several active poll connectors that all happen to become eligible on the same tick still dispatches them concurrently within that tick — bounded only by `RequestGate`'s own per-key queueing, not by any explicit stagger across a tenant's own connectors. A real, smaller residual risk than the one §5 closes, deliberately left as-is rather than over-designed against a burst width (at most a handful of connectors per tenant today) that `RequestGate` already absorbs.
- This ADR makes a separate, already-existing gap newly *visible* rather than closing it: `pollGNewsSearch()`'s query defaults to a hardcoded `'technology'` string, not each tenant's actual watchlist terms (verified directly, `pollGNewsSearch.ts` line 10 and its call site). Once polling actually runs continuously, tenants will start seeing real posts matched against that hardcoded query, not their own watchlists — a real, adjacent, "what to poll for" gap, deliberately out of this "when/how to trigger polling" ADR's own scope (Open Question 5).

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary user who connects and activates sources | High | An activated connector actually ingests posts; status screen reflects truth |
| Sole-Operator | Platform owner / operator | High | No new service to provision, monitor, or pay for; cost and health visible |
| Tenant-User | Consumer of the normalized post feed | Medium | Sees timely, source-accurate posts without manual refresh |
| Platform-Admin | Cross-tenant oversight | Medium | Can see platform-level active connector and error counts |
| Menno (Sponsor / Technical Lead) | Decision authority and builder | High | Minimal, maintainable design that closes the live gap without speculative over-engineering |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.13 | epic-1-repository-and-api-foundation.md | As Tenant-Admin who has connected, verified, and activated a connector, I want that connector to actually poll on a real, recurring cadence without me doing ... | `bootstrapConnectors()` (new) registers every real `SocialConnector`/`AIProviderConnector` module (GNews, Newswire, tenant-owned-feed, Azure AI Language, Azu... |
| Story 1.14 | epic-1-repository-and-api-foundation.md |  | `runSchedulerTick()`'s eligibility comparison (`pollScheduler.ts`) gains one additional, mandatory condition on top of ADR-0052 Decision §5's existing elapse... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.started_at` | Timestamp of the most recent ingestion attempt for a `(tenant, platform)` pair | `ingestion_runs` table | Backend | Internal audit |
| `ingestion_runs.status` | Completion status of the most recent run (`running`, `succeeded`, `failed`) | `ingestion_runs` table | Backend | Internal audit |
| `connector_activations.is_active` | Whether a tenant-wide connector is activated | `connector_activations` table | Backend | Tenant-scoped |
| `connector.pollCadenceMs` | Connector-specific default polling interval in milliseconds | Connector registration | Backend | Internal |
| `jitterFraction` | Deterministic ±5% cadence offset derived from a stable hash of `tenantId:platformId` | Scheduler computation | Backend | Internal |
| `providerId` / `platformId` | Identifier for the source platform (e.g., `gnews`, `newswire`, `tenant-owned-feed`) | Connector registry / `social_connectors` metadata | Backend | Internal |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- `social-listening-core` continues to run as a single instance.
- The connector registry, `ingestion_runs` table, `connector_activations` table, `RequestGate`, and `ConnectorHealth` derivation already exist and are operational.
- At least one poll-mode connector (GNews, Newswire, tenant-owned-feed) is registered with a valid `poll()` wrapper and `pollCadenceMs`.
- Platform admin role already has the necessary bypass scope to enumerate tenants (ADR-0030).

**The durable decision — this is what would need superseding, not just amending:**

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Scheduler cadence shall be derived from existing `ingestion_runs` rows, with no new persisted "next poll" state | Maintainability | Must | No new table or column is added for the scheduler; restart recomputes eligibility from `ingestion_runs.started_at` and `status` |
| NFR-002 | Tick interval and per-connector cadence shall be adjustable via environment variables | Maintainability | Should | `SCHEDULER_ENABLED` and default cadence values (60 s tick; GNews 15 min; Newswire 15 min; tenant-owned-feed 30 min) are configurable without code change |
| NFR-003 | Jitter shall be deterministic and reproducible | Reliability | Must | The same `(tenantId, platformId)` always yields the same `jitterFraction`; contract tests can assert exact scheduling behavior without randomness |
| NFR-004 | The scheduler shall not trigger real outbound calls during tests | Security / Reliability | Must | `npm test` makes zero real calls to GNews, Newswire, or any tenant feed from scheduler side effects |
| NFR-005 | The scheduler shall operate correctly under a single-instance assumption | Scalability | Must | The design is documented as single-instance only; multi-instance double-polling is explicitly deferred and named as a future risk |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes the actual, live, core-value-proposition gap this session found: connectors can be connected, verified, activated, and still never ingest anything — this ADR's Decision, once built, is the first design that makes that gap closeable rather than a described-but-unaddressed limitation.
- No new database table or migration is required for the scheduler mechanism itself (§5's derived-cadence decision) — the only schema-adjacent change is none; the only new persisted state anywhere in this Decision is nothing beyond what `ingestion_runs` and `connector_activations` already store.
- §4's generic `poll()` interface addition is enforced, not just requested, by ADR-0048's own already-Accepted CI guardrail (Story 2.10) — a future connector cannot silently reintroduce a hardcoded scheduler switch without that guardrail flagging it, the same protection every other connector-registration surface already has.
- §3's registry-bootstrap fix has a genuinely useful side effect found only while drafting this ADR: it closes the live, previously-unnamed `authModeForbidsUserScope()` no-op gap in `connectorsRouter.ts`, at zero additional design cost.
- §5's derived-cadence choice means a scheduler process restart loses no state and can never desynchronize from the audit trail — consistent with, not a departure from, this project's existing `ConnectorHealth`/`AuthorTopicSignal` "single source of truth, nothing else to reconcile" discipline (ADR-0009, ADR-0022).

**Negative**
- **Real, immediate external cost begins the moment this ships.** Every tenant with an active, credentialed connector (GNews's paid/free-tier API calls in particular) starts consuming real quota continuously, not on-demand — this is the first mechanism in this project that turns "connected" into "actually costing something, repeatedly, without a human clicking anything." No budget ceiling, rate cap, or cost-alerting mechanism is decided by this ADR — named as a real, unresolved gap for Menno (see Open Question 4), not fabricated a number here.
- Single point of failure while single-instance: if the one `social-listening-core` process is down, ingestion stops entirely for every tenant, with no distributed fallback — an accepted, named trade-off (§7), not an oversight.
- Distributed correctness (double-polling under a hypothetical second concurrent instance) is deliberately deferred, same as ADR-0020's own Redis deferral — a real gap if that condition is ever hit, not designed against now.
- §5's own ±5% per-pair jitter spreads *cross-tenant* and *cross-restart* synchronization, but a single tenant with several active poll connectors that all happen to become eligible on the same tick still dispatches them concurrently within that tick — bounded only by `RequestGate`'s own per-key queueing, not by any explicit stagger across a tenant's own connectors. A real, smaller residual risk than the one §5 closes, deliberately left as-is rather than over-designed against a burst width (at most a handful of connectors per tenant today) that `RequestGate` already absorbs.
- This ADR makes a separate, already-existing gap newly *visible* rather than closing it: `pollGNewsSearch()`'s query defaults to a hardcoded `'technology'` string, not each tenant's actual watchlist terms (verified directly, `pollGNewsSearch.ts` line 10 and its call site). Once polling actually runs continuously, tenants will start seeing real posts matched against that hardcoded query, not their own watchlists — a real, adjacent, "what to poll for" gap, deliberately out of this "when/how to trigger polling" ADR's own scope (Open Question 5).

---

## 12. Assumptions and Dependencies
- `social-listening-core` continues to run as a single instance.
- The connector registry, `ingestion_runs` table, `connector_activations` table, `RequestGate`, and `ConnectorHealth` derivation already exist and are operational.
- At least one poll-mode connector (GNews, Newswire, tenant-owned-feed) is registered with a valid `poll()` wrapper and `pollCadenceMs`.
- Platform admin role already has the necessary bypass scope to enumerate tenants (ADR-0030).

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Continuous polling begins consuming real paid quota (GNews API calls, etc.) immediately on ship | High | High | Document and track the cost/quota ceiling as an open item for the Cost Management Plan; monitor ingestion volume closely | Sponsor |
| R-002 | The single `social-listening-core` process becomes a single point of failure for all ingestion | Medium | High | Accepted as a deliberate single-instance trade-off; revisit if a second concurrent instance is ever deployed | Technical Lead |
| R-003 | A second concurrent instance would double-poll eligible pairs | Low | High | Named and deferred; future design likely uses a per-pair Postgres advisory lock | Technical Lead |
| R-004 | Several active connectors for one tenant may still become eligible on the same tick, creating a small burst | Medium | Low | Mitigated by `RequestGate` per-key queuing; residual cross-tenant/cross-restart thundering herd is closed by ±5% jitter | Technical Lead |
| R-005 | Once live polling runs, the GNews hardcoded query default may surface irrelevant posts for tenants | High | Medium | Explicitly out of scope; track as a separate "what to poll for" story (watchlist-driven query construction) | Product Owner |
| R-006 | A future connector author may wrap `ClassifiableError` locally and break health derivation | Low | High | Stated as a durable contract in ADR-0052 §8; enforced by code review and contract tests | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0052-live-ingestion-polling-scheduler.md`
- BRD: `../Business-Requirements/BRD-0052-Live-Ingestion-Polling-Scheduler.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Deep research: _No deep-research report found._
- User stories: see extracted stories above