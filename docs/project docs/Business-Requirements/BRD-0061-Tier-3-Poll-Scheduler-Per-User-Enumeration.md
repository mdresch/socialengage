# Tier-3 (User-Bound) Poll Scheduler: Per-User Enumeration – Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Tier-3 (User-Bound) Poll Scheduler: Per-User Enumeration – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent (AI Business & Requirements Analyst) |
| Approver(s) | Menno, Sponsor |
| Status | Draft for review (source ADR-0061 Accepted 2026-08-18) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0061, Story 1.15, and feature design 01 |

---

## 2. Executive Summary

Tenant-wide poll-mode connectors now ingest automatically through the live scheduler delivered by ADR-0052 / Story 1.13. However, the first Tier-3 (user-bound) connector — Facebook — remains unscheduled: `pollFacebook(tenantId, userId)` has no real call site in the running server, so a connected Facebook Page never ingests unless triggered manually. Worse, the existing tenant-wide `ingestion_runs` queries and `deriveConnectorHealth()` logic have no `user_id` filter, meaning one user's poll history, credential state, or failure could silently bleed into another's if the scheduler were simply extended naively.

ADR-0061 closes this gap by introducing a **Tier-3 poll scheduler path**: a generic `pollUser(tenantId, userId)` surface on `SocialConnector`, a per-user enumeration of active activations, per-user in-flight and health isolation, and a corrected `shouldAttemptIngestion()` call chain. This Business Requirements Document captures the business need, scope, success measures, and acceptance criteria for delivering that per-user scheduling capability.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make a connected Tier-3 Page (Facebook, today) actually ingest on a recurring cadence | A tenant user's connected, activated Facebook Page receives real `SocialPost` rows within one 30-minute cadence period without manual intervention |
| 2 | Prevent cross-user information leakage in the scheduler and health derivation | One user's `failing` state or `running` ingestion run never delays or blocks a different user's due check for the same platform |
| 3 | Preserve the generic, connector-agnostic scheduler design | A future Tier-3 connector (e.g., Reddit) can be added by registering `pollUser` and `pollCadenceMs` with no scheduler code change |
| 4 | Keep the core ingestion pipeline closed to connector-specific schema joins | The scheduler does not acquire Facebook-specific table knowledge; all Tier-3 connectors populate the same `ingestion_runs.user_id` column |
| 5 | Retire the throwing-placeholder `poll` registration for Facebook | Facebook's registered connector shape reflects that it has no tenant-wide poll path; the scheduler cannot accidentally call it |

---

## 4. Scope

### 4.1 In Scope

- Adding a nullable `user_id` column to `ingestion_runs`, populated only by Tier-3 poll paths.
- New store function `listActiveUserActivations(tenantId, platformId)` enumerating every active user for a Tier-3 connector.
- New store function `getMostRecentRunStatusForUser(tenantId, platformId, userId)` for per-user in-flight guards.
- Extending `deriveConnectorHealth()` with an optional fourth `userId` parameter, filtering both `ingestion_runs` and `platform_credentials` by user when supplied.
- Correcting `shouldAttemptIngestion()` to pass `userId` through to `deriveConnectorHealth()` for `ownerType === 'user'`.
- Adding the distinct `pollUser?(tenantId, userId)` optional method to `SocialConnector`, keeping `poll?(tenantId)` and `pollCadenceMs` unchanged.
- Removing Facebook's throwing-placeholder `poll` registration and replacing it with `pollUser: pollFacebook`.
- Adding a third, independent enumeration level in `runSchedulerTick()`: for each tenant, for each connector with `pollUser`, for each active user, apply the same due-check shape and call `connector.pollUser(tenant.id, userId)`.
- Extending `jitterFraction()` with an optional third `userId` segment to prevent per-user thundering-herd within one tenant.
- Failure isolation one level deeper: one user's `pollUser()` exception does not prevent the next due user or tenant from running in the same tick.

### 4.2 Out of Scope

- Changing what `pollFacebook()` does once triggered; per-Page fan-out remains ADR-0060's responsibility.
- Re-keying `RequestGate` to be per-user for Facebook; that decision belongs to ADR-0060 / `pollFacebook()`'s own scope.
- Cost/quota budget ceiling or spend alerting for continuous Facebook polling (inherited open question from ADR-0052).
- Multi-instance distributed locking (still single-instance assumption).
- Admin UI changes; no new tenant user-facing screen is created.
- Editing ADR-0060 or Story 6.27's own text or Acceptance Criteria.

### 4.3 Assumptions

- `social-listening-core` continues to run as a single instance.
- `connector_user_activations`, `ingestion_runs`, `platform_credentials`, `SocialConnector` registry, live scheduler, and `shouldAttemptIngestion()` already exist and are operational.
- Facebook is the first real Tier-3 poll connector; future Tier-3 connectors will follow the same `pollUser` contract.
- Story 6.27 (ADR-0060) may add a `pageId?` parameter to `deriveConnectorHealth()` before or after this work; the fourth `userId?` position is reserved.

### 4.4 Constraints

- Must not violate ADR-0048's "no core pipeline change for new connector registration" rule.
- Must not introduce a Facebook-specific join inside the scheduler's generic due-check path.
- Must leave every tenant-wide `poll` and `ingestion_runs` query behavior byte-for-byte unchanged when `userId` is omitted.
- Must operate within the existing Node/Postgres stack and the existing `SocialConnector` interface shape.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Connects/activates sources on behalf of the tenant | Medium | The Facebook Page the tenant user connected actually ingests; status reflects truth without cross-user surprises |
| Tenant-User (Facebook owner) | Individual who OAuth-connected their own Page(s) | High | Their Page ingests on its own cadence and their credential failures do not affect other users' Pages |
| Sole-Operator | Platform owner / operator | High | No new service to provision; generic, future-proof scheduler path |
| Tenant-User (feed consumer) | Consumer of the normalized post feed | Medium | Sees timely Facebook posts in the feed once connected |
| Platform-Admin | Cross-tenant oversight | Low | Continues to see platform-level connector counts; no new operational burden |
| Menno (Sponsor / Technical Lead) | Decision authority and builder | High | Minimal, correct design that closes the live Tier-3 gap and fixes the confirmed cross-user bugs without speculative over-engineering |

---

## 6. Current State (As-Is)

**Current process:**

1. A Tenant-Admin or user connects and activates a Facebook Page via the admin UI.
2. The user's credential and activation records are persisted in `platform_credentials` and `connector_user_activations`.
3. `pollFacebook(tenantId, userId)` exists and is real, but the running scheduler never calls it.
4. The live scheduler (ADR-0052 / Story 1.13) only enumerates tenant-wide connector activations and calls `connector.poll(tenantId)`.
5. `ingestion_runs` has no `user_id` column; every run query and health derivation is keyed by `(tenantId, platformId)` only.
6. `deriveConnectorHealth(tenantId, platformId)` blends every user's runs and most recent credential into one result.
7. `shouldAttemptIngestion(tenantId, platformId, ownerType, userId)` accepts `userId` but its internal `deriveConnectorHealth()` call does not pass it through.
8. Facebook's connector registration has a throwing placeholder `poll` that documents the missing path.

**Pain points:**

- A real, connected, activated Facebook Page never ingests automatically.
- Extending the tenant-wide scheduler to Tier-3 would cause one user's `running` or `failing` state to incorrectly gate every other user's poll for the same platform.
- The existing health/credential derivation is cross-user-blended, which would silently corrupt per-user connector status once more than one user connects Facebook.
- The throwing `poll` placeholder is a defensive hack waiting to mislead a future maintainer.

---

## 7. Future State (To-Be)

**New or improved process:**

1. `ingestion_runs` carries a nullable `user_id` that is populated whenever a Tier-3 `IngestionRun` is created.
2. The scheduler's `runSchedulerTick()` now runs a third nested loop: for each tenant, for each connector with `pollUser` and `pollCadenceMs`, for each `userId` from `listActiveUserActivations(tenant.id, platformId)`.
3. For each `(tenant, platform, user)` tuple, the scheduler calls `shouldAttemptIngestion(tenantId, platformId, 'user', userId)`.
4. The due-check uses that user's own most recent run, via `getMostRecentRunStatusForUser()`, and that user's own `jitterFraction(tenantId, platformId, userId)`.
5. If eligible and not in-flight, the scheduler calls `connector.pollUser(tenant.id, userId)`.
6. `pollUser()` for Facebook internally fans out to the user's Pages and produces one `IngestionRun` per Page; the scheduler itself has no Page awareness.
7. `deriveConnectorHealth()` returns per-user status/credential state when `userId` is supplied; tenant-wide callers remain unchanged.
8. `shouldAttemptIngestion()` now correctly percolates `userId` into `deriveConnectorHealth()` for Tier-3 checks, fixing the false-negative auto-disable bug.
9. One user's `pollUser()` failure is caught and logged exactly like one tenant's `poll()` failure today, with no impact on other users or tenants.
10. Facebook's connector registration drops the throwing `poll` and declares `pollUser: pollFacebook`.

**Expected capabilities:**

- Facebook Pages connected by individual users actually ingest on a recurring cadence.
- The scheduler treats one user's poll history, health, and credential state as independent from every other user's.
- A future Tier-3 connector can be scheduled by the same mechanism without editing the scheduler.
- The in-flight guard, due-check, health derivation, and jitter are all per-user correct.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store the user scoping of a Tier-3 ingestion run | Must | `ingestion_runs` has a nullable `user_id UUID REFERENCES users(id)`; every existing tenant-wide run writes `NULL`; Tier-3 runs write the initiating user's id | Product Owner |
| BR-002 | The system shall enumerate every active user for a Tier-3 connector | Must | `listActiveUserActivations(tenantId, platformId)` returns exactly the `userId`s whose `connector_user_activations` rows are `is_active = true` for that `(tenantId, platformId)` | Product Owner |
| BR-003 | The system shall check the most recent run per user for Tier-3 in-flight guards | Must | `getMostRecentRunStatusForUser(tenantId, platformId, userId)` returns the most recent `ingestion_runs` row for that specific user, not any user under that tenant/platform | Product Owner |
| BR-004 | The system shall derive connector health per user when scheduling a Tier-3 poll | Must | `deriveConnectorHealth(tenantId, platformId, pageId?, userId?)` filters both `ingestion_runs` and `platform_credentials` by `userId` when supplied; tenant-wide and page-scoped calls remain unchanged | Technical Lead |
| BR-005 | The system shall correct the existing cross-user auto-disable false-negative | Must | `shouldAttemptIngestion(tenantId, platformId, 'user', userId)` passes `userId` through to `deriveConnectorHealth()`; one user's `failing` state no longer disables another user's due poll | Technical Lead |
| BR-006 | The system shall expose a generic, distinct `pollUser(tenantId, userId)` surface | Must | `SocialConnector` declares `pollUser?(tenantId: string, userId: string): Promise<RunIngestionAttemptResult>`; a connector may have `poll`, `pollUser`, both, or neither | Product Owner |
| BR-007 | The system shall schedule Tier-3 connectors only through their `pollUser` method | Must | `runSchedulerTick()` iterates tenants × `pollUser`-mode connectors × active users and calls `connector.pollUser(tenant.id, userId)` when due; it never calls `poll(tenantId)` for these connectors | Product Owner |
| BR-008 | The system shall reuse `pollCadenceMs` for both tenant-wide and Tier-3 dispatch | Must | `pollCadenceMs` remains a single field; the same registered cadence drives either or both scheduler paths without a second field | Product Owner |
| BR-009 | The system shall register Facebook with `pollUser` and no `poll` | Must | Facebook's `bootstrapConnectors.ts` registration has `pollUser: pollFacebook` and no `poll` property; `pollCadenceMs` remains 30 minutes | Technical Lead |
| BR-010 | The system shall jitter per-user due times within a tenant | Must | `jitterFraction(tenantId, platformId, userId?)` hashes the three-segment key when `userId` is supplied; omitted, output is byte-for-byte identical to existing two-argument calls | Technical Lead |
| BR-011 | The system shall isolate failures one user from another | Must | A `pollUser()` throwing for one user does not prevent the next due user, the next due tenant, or the tenant-wide loop from running in the same tick | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Tier-3 scheduling shall be additive to existing tenant-wide scheduling | Maintainability | Must | Every existing `poll()` contract test and scheduler test continues to pass unmodified; no tenant-wide behavior changes |
| NFR-002 | The scheduler shall remain connector-agnostic at the due-check layer | Maintainability | Must | No Facebook-specific table names or Page concepts appear in `pollScheduler.ts` or `ingestionRunStore.ts` due-check logic |
| NFR-003 | `userId`-omitted calls shall be byte-for-byte unchanged | Reliability | Must | Existing `deriveConnectorHealth()`, `jitterFraction()`, and `getMostRecentRunStatus()` outputs remain identical before and after the change when no user is supplied |
| NFR-004 | Tier-3 polling shall respect single-instance assumptions | Scalability | Must | The design is documented as single-instance only; multi-instance double-polling across users is named as a future risk |
| NFR-005 | Type safety shall enforce the `pollUser`/`poll` distinction | Maintainability | Must | TypeScript compilation fails if a connector declares `pollUser` with the wrong signature or if the scheduler tries to call `poll(tenantId)` on a `pollUser`-only connector |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A Tier-3 `IngestionRun` must record `user_id` directly on `ingestion_runs`; it must not be derived through a connector-specific table join. |
| BRU-002 | A connector with user-bound credentials must register `pollUser` and must not register a throwing or no-op `poll` placeholder. |
| BRU-003 | A `(tenant, platform, user)` tuple is eligible for polling only if it is active, healthy, not currently in-flight, and its user-scoped jittered cadence has elapsed. |
| BRU-004 | The scheduler must enumerate active Tier-3 users through `connector_user_activations` and must not synthesize a user list from `platform_credentials` or any connector-specific table. |
| BRU-005 | `deriveConnectorHealth()` must filter both `ingestion_runs` and `platform_credentials` by `userId` when a user-scoped result is requested. |
| BRU-006 | `shouldAttemptIngestion()` must pass the `userId` argument it receives into health derivation for `ownerType === 'user'`. |
| BRU-007 | `pollUser()` failures must be caught at the scheduler level unless they are `ClassifiableError`; one user's failure must not abort the tick. |
| BRU-008 | `pollCadenceMs` is the single source of truth for cadence for both `poll()` and `pollUser()` paths. |
| BRU-009 | The `pageId` third parameter of `deriveConnectorHealth()` is reserved by ADR-0060/Story 6.27; `userId` must be the fourth parameter. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.user_id` | Nullable FK to the user who initiated a Tier-3 `IngestionRun` | `ingestion_runs` table (new column) | Backend | Tenant-scoped / internal audit |
| `connector_user_activations.user_id` | User owning the Tier-3 activation | `connector_user_activations` table | Backend | Tenant-scoped |
| `connector_user_activations.is_active` | Whether the user's Tier-3 connector is active | `connector_user_activations` table | Backend | Tenant-scoped |
| `platform_credentials.user_id` | User owning the Tier-3 credential | `platform_credentials` table | Backend | Tenant-scoped / credential envelope |
| `ingestion_runs.started_at` | Start time of the most recent run for a `(tenant, platform, user)` tuple | `ingestion_runs` table | Backend | Internal audit |
| `ingestion_runs.status` | Completion status (`running`, `succeeded`, `failed`) | `ingestion_runs` table | Backend | Internal audit |
| `SocialConnector.pollUser` | Generic Tier-3 poll method on the connector interface | Connector registration | Backend | Internal |
| `jitterFraction(tenantId, platformId, userId?)` | Deterministic per-tuple jitter value | Scheduler computation | Backend | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Tier-3 poll attempts per tick | Tracks how many `(tenant, platform, user)` tuples are dispatched | Sole-Operator / Developer | Continuous (log/metric) |
| Skipped due to user-scoped in-flight runs | Measures effectiveness of per-user overlap prevention | Developer | Continuous |
| Connector health transitions by user | Shows per-user `healthy`/`failing` changes on `ConnectorHealthChangedEvent` | Tenant-Admin / Sole-Operator | Real-time |
| Ingestion volume by platform and user | Enables cost awareness for Facebook Graph API quota | Sole-Operator | Hourly / Daily |
| Cross-user poll failure isolation events | Confirms one user's failure does not halt the tick | Developer | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Continuous Facebook polling begins consuming real Graph API quota per connected user | High | High | Same open item as ADR-0052 Open Question 4 — track under Cost Management Plan; monitor ingestion volume and alert manually | Sponsor |
| R-002 | Build-order mismatch with Story 6.27 causes `deriveConnectorHealth()` parameter drift | Medium | High | Named explicitly: `pageId?` stays third, `userId?` fourth; whichever story lands second adds its parameter in the reserved slot and updates tests | Technical Lead |
| R-003 | The single `social-listening-core` process remains a single point of failure for all per-user polling | Medium | High | Accepted as a single-instance trade-off; revisit if a second concurrent instance is ever deployed | Technical Lead |
| R-004 | A second concurrent instance would double-poll eligible `(tenant, platform, user)` tuples | Low | High | Named and deferred; future design likely uses per-tuple Postgres advisory locks | Technical Lead |
| R-005 | `RequestGate` remains tenant-wide for Facebook, concentrating all tenant users' polling against one gate | Medium | Medium | Left to ADR-0060/`pollFacebook()` to resolve; this BRD only documents the live exposure | Product Owner |
| R-006 | Future maintainer reintroduces a throwing `poll` placeholder for a Tier-3-only connector | Low | Medium | Enforce the `pollUser` pattern in code review and contract tests; type shape makes the absence of `poll` a compile-time fact | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0061 accepted and source of truth | Internal / Decision | Sponsor | Resolved 2026-08-18 |
| D-002 | ADR-0052 live ingestion-polling scheduler | Internal / Decision | Sponsor | Built 2026-08-13 |
| D-003 | Story 1.13 (live ingestion-polling scheduler) | Internal / Story | Backend | Built 2026-08-13 |
| D-004 | Story 1.14 (skip in-flight runs) | Internal / Story | Backend | Built 2026-08-18 |
| D-005 | Story 1.11/1.12 (`shouldAttemptIngestion`, `connector_user_activations`) | Internal / Story | Backend | Built |
| D-006 | ADR-0060 Facebook per-Page fan-out | Internal / Decision | Sponsor | Accepted 2026-08-18 |
| D-007 | Story 2.15/6.23 (Facebook OAuth single-Page connect) | Internal / Story | Backend / Frontend | Built |
| D-008 | Story 6.27 (Facebook multiple Pages per user) | Future | Backend | Ready; `pageId?` parameter coordination only |
| D-009 | `ingestion_runs` audit table and indexing | Internal / Data | Backend | Built (ADR-0005) |
| D-010 | `RequestGate` per-provider rate/concurrency limit | Internal / Component | Backend | Built (ADR-0003/0020) |
| D-011 | ADR-0048 "no core pipeline change on new connector registration" | Internal / Constraint | Sponsor | Accepted |

---

## 14. Acceptance Criteria

- A tenant user with an active, connected Facebook Page sees the Page ingesting within one 30-minute cadence period without manual action.
- `ingestion_runs` rows created by Facebook polling are written with the initiating user's `user_id`; all GNews/Newswire/tenant-owned-feed rows continue to have `user_id = NULL`.
- `listActiveUserActivations(tenantId, 'facebook')` returns exactly the active user ids for that tenant and platform.
- `getMostRecentRunStatusForUser()` returns only the queried user's most recent run; `getMostRecentRunStatus()` remains unchanged and tenant-wide.
- With two users under one tenant, each with their own Facebook credential, `deriveConnectorHealth(tenant, 'facebook', undefined, userA)` and `deriveConnectorHealth(tenant, 'facebook', undefined, userB)` return independent `status` and `credentialStatus`.
- `shouldAttemptIngestion(tenant, 'facebook', 'user', userA)` returns `false` when user A's connector is `failing`, but `shouldAttemptIngestion(tenant, 'facebook', 'user', userB)` for a healthy user B still returns `true`.
- A connector type-level test proves a `SocialConnector` may declare `poll`, `pollUser`, both, or neither.
- Facebook's registered connector object has no `poll` property and a `pollUser` property pointing to `pollFacebook`.
- The scheduler invokes `pollUser(tenantId, userId)` only when the user-scoped due-check passes and no `running` row exists for that user.
- A `pollUser()` throwing for one user does not prevent the scheduler from attempting the next due user, the next due tenant-wide pair, or the next due tenant.
- `jitterFraction(tenant, 'facebook', userA)` and `jitterFraction(tenant, 'facebook', userB)` produce different, deterministic values; omitting `userId` yields the same output as the existing two-argument function.
- Every existing tenant-wide scheduler, `deriveConnectorHealth`, and `jitterFraction` contract test continues to pass unmodified.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Tier-3 / user-bound connector** | A connector whose credential and activation are scoped to an individual user rather than the whole tenant (e.g., per-user Facebook OAuth). |
| **pollUser** | A generic `SocialConnector` method `(tenantId, userId) => Promise<RunIngestionAttemptResult>` for dispatching a Tier-3 poll. |
| **Per-user enumeration** | Discovering every active `userId` for a given `(tenantId, platformId)` from `connector_user_activations`. |
| **In-flight guard** | The rule that skips a poll when the most recent `ingestion_runs` row for the same tuple still has `status: 'running'`. |
| **Cross-user blending** | The bug where run or credential history from one user incorrectly influences scheduling or health for another user. |
| **Connector-agnostic scheduler** | The design rule that the scheduler knows only `poll()`/`pollUser()` and `pollCadenceMs`; it has no connector-specific table or business logic. |
| **ClassifiableError** | The project's domain error type for connector failures that must be recorded and factored into `ConnectorHealth`. |
| **RequestGate** | The in-process per-provider rate/concurrency limit mechanism. |

---

## 16. Appendices

- **ADR-0061:** `docs/adr/0061-tier-3-poll-scheduler-per-user-enumeration.md`
- **Related ADRs:**
  - `docs/adr/0052-live-ingestion-polling-scheduler.md`
  - `docs/adr/0060-facebook-connector-multiple-pages-per-user.md`
  - `docs/adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md`
  - `docs/adr/0051-connector-activation-decoupled-from-credential.md`
- **Feature design (multi-source ingestion context):** `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- **Related user stories:**
  - `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.15 (Tier-3 per-user scheduling)
  - `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.23 (Facebook OAuth connect flow)
  - `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.27 (Facebook multiple Pages per user, dependency/coordination only)
- **No deep-research brief found** specifically for Tier-3 per-user poll scheduling; the design in ADR-0061 was driven by a live, in-session root-cause investigation rather than a pre-existing research report.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
