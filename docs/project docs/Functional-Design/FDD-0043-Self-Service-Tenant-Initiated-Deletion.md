# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0043 Self-Service, Tenant-Admin-Initiated Tenant Deletion — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Sponsor / Technical Lead) |
| Status | Approved (ADR-0043 Accepted 2026-08-07; backend built via Story 3.8, UI via Story 6.13) |
| Related Documents | ADR-0043, BRD-0043, ADR-0039, ADR-0030, ADR-0031, ADR-0032, ADR-0018, ADR-0014, ADR-0037, Story 3.8, Story 6.13, Story 3.7 (retired/historical) |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0043's architecture decision and BRD-0043's business requirements into the functional design of the fully self-service, Tenant-Admin-initiated tenant deletion flow — the sole tenant-deletion mechanism, superseding ADR-0039 Decision §1 in full. It specifies the request/export/grace-period/cancel/confirm lifecycle, the ingestion-halt behavior, the narrow database-privilege model, and the audit-visibility contract for Platform Admin. The backend is built (Story 3.8) and the UI is built (Story 6.13); this FDD documents the shipped functional behavior for traceability and future maintenance.

### 2.2 Scope

- **In scope:** tenant-admin-only deletion request; immediate ingestion halt; re-triggerable CSV/JSON export reusing ADR-0039 §2's export scope; a 30-day (configurable) grace period; cancellation at any point before final execution; final confirmation gated on grace-period elapse; asynchronous, bounded, partition-aware deletion execution (reusing ADR-0039 §4); audit logging of every lifecycle step to `platform_admin_audit_log`; narrow `app_user` grants for the new `tenants` columns, table deletes, and audit-log inserts.
- **Out of scope:** any Platform-Admin-initiated or Platform-Admin-approved deletion path (fully superseded); a deletion path for `tenant_user`; formal GDPR Article 17/20 legal certification; rate-limiting/abuse prevention for repeated request/cancel cycles; the exact wording/channel of grace-period reminder notifications; whether a `requireTenantAdmin()` middleware helper is added.

### 2.3 Target Audience

Backend engineers maintaining the deletion lifecycle endpoints and the async deletion executor; frontend engineers maintaining the offboarding UI (Story 6.13); QA maintaining contract tests for authorization boundaries and idempotency; Compliance/Legal reviewing the mechanism against data-portability/right-to-erasure expectations; Platform Operations monitoring the async deletion job.

---

## 3. Context and Background

ADR-0039 (Accepted 2026-08-06) originally prohibited any self-service tenant-deletion mechanism, naming a possible future Platform-Admin-reviewed path as an undesigned option. Menno's direct instruction the same day resolved this more aggressively than ADR-0039 anticipated: fully self-service, with Platform Admin limited to audit-trail visibility, no approval gate. This is a real reversal of ADR-0039 Decision §1, not a clarification — ADR-0043 supersedes that section in full via a new ADR per this project's governance convention for Accepted-ADR changes.

A critical mid-build correction occurred: Story 3.7 was initially built exactly as ADR-0039 Decision §1 originally specified (`platform_admin_role`-gated), and its contract suite surfaced a direct collision with Story 5.7's already-accepted "zero access to tenant-content tables" boundary for `platform_admin_role`. Menno corrected this directly, confirming the entire deletion-execution path — including the final, irreversible cross-table deletion step — must run under the tenant-scoped `app_user` connection (RLS-scoped, `withTenant()`), never under `platform_admin_role`'s `BYPASSRLS`. Story 3.7's originally-built implementation was retired, never committed; Story 3.8 was built as the corrected, sole mechanism.

`tenants.status` remains database-GRANT-restricted (`platform_admin_role` only) for most values, but this flow requires two new narrow, `app_user`-granted `timestamptz` columns (`deletion_requested_at`, `deletion_confirmed_at`) and narrow `DELETE` grants on `users`/`tenants` plus an `INSERT` grant on `platform_admin_audit_log` — all scoped as narrowly as this project's existing precedents (`active_seat_count`'s column grant; `tenant_signup_role`'s separate audit-log insert grant).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable fully self-service tenant deletion with no Platform Admin execution step | A `tenant_admin` can request, export, and confirm deletion of their own tenant unassisted |
| G2 | Halt ingestion immediately on request | Any ingestion attempt for a tenant with a pending deletion request is refused before an `IngestionRun` opens |
| G3 | Provide genuine data portability before erasure | Re-triggerable CSV/JSON export of the tenant's full data scope during the grace period |
| G4 | Prevent accidental or premature irreversible action | Confirmation rejected until the grace period has genuinely elapsed; cancellation available throughout |
| G5 | Preserve the platform/tenant boundary — `platform_admin_role` never touches tenant-content tables | No exception carved into the zero-access boundary for this flow |
| G6 | Preserve full auditability for Platform Admin | Every lifecycle step (request, export, cancel, confirm) logged to `platform_admin_audit_log` with the acting Tenant-Admin's identity |
| G7 | Keep new database privileges as narrow as existing precedent | New grants are per-column/per-table, RLS-scoped, matching `active_seat_count`'s and `tenant_signup_role`'s own precedent |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Deletion Request

- **Description:** Allows a `tenant_admin`-authenticated caller to request deletion of their own tenant, starting the offboarding lifecycle.
- **Triggers:** Tenant-Admin submits a deletion request (API call or UI action from Story 6.13's offboarding screen).
- **Inputs:** The caller's resolved identity (`type: 'tenant_user'`, `role: 'tenant_admin'`, `tenantId`).
- **Processing:** Verify caller role is exactly `tenant_admin` (never `tenant_user`, never `platform_admin`). Set `tenants.deletion_requested_at = now()` for the caller's own tenant, scoped by existing `tenant_isolation` RLS policy. Log the action to `platform_admin_audit_log` with `actorIdentity` set to the requesting Tenant-Admin's own identity.
- **Outputs:** `deletion_requested_at` populated; ingestion halt takes effect immediately (Section 5.2); an audit-log entry recorded.
- **Error handling:** A `tenant_user` or `platform_admin` caller is rejected (authorization error); a second request while one is already pending is either a no-op or rejected (idempotency handled at implementation level, not re-specified beyond "no duplicate active request").
- **Edge cases:** A tenant with only one `tenant_admin` user — deletion request still proceeds; no multi-admin quorum is required by this design.

### 5.2 Feature / Capability: Immediate Ingestion Halt

- **Description:** Prevents any new ingestion attempt from opening for a tenant once deletion has been requested, enforced at the single shared choke point every ingestion attempt funnels through.
- **Triggers:** Any call to `runIngestionAttempt()` for a tenant with a non-null `deletion_requested_at`.
- **Inputs:** `tenantId`, `deletion_requested_at` state.
- **Processing:** Before `startIngestionRun()` is invoked, the guard checks whether the tenant's `deletion_requested_at` is non-null; if so, the attempt is refused immediately without opening an `IngestionRun`, returning a non-retryable classified outcome (e.g., `tenant_deletion_requested`), consistent with the existing `errorClassification.ts` pattern.
- **Outputs:** No `IngestionRun` opened; a non-retryable classified failure recorded/returned to the caller (connector or future scheduler).
- **Error handling:** N/A beyond the classified refusal itself — this is the intended behavior, not an error condition from the system's perspective.
- **Edge cases:** This enforcement point is chosen specifically because it is the one shared function every current and future connector/scheduler already funnels through, guaranteeing the halt takes effect regardless of how ingestion is eventually triggered (no tenant-iterating scheduler existed at ADR-0043's acceptance).

### 5.3 Feature / Capability: Data Export (Re-triggerable, CSV or JSON)

- **Description:** Lets the Tenant-Admin download their own tenant's data any number of times during the grace period, reusing ADR-0039 §2's already-scoped export logic.
- **Triggers:** Tenant-Admin submits an export request (e.g., `POST /v1/tenants/self-service-deletion/export`), any time between request and final confirmation.
- **Inputs:** Caller's identity (`tenant_admin`, own tenant); requested format (`CSV` or `JSON`, caller's explicit choice).
- **Processing:** Reuses Story 3.7's export service function directly (not re-implemented), scoped to the caller's own tenant under ordinary RLS (not `platform_admin_role`). Assembles `social_posts` (including archived `rawPayload` resolved via its blob pointer), `authors`, `watchlists`, and `ingestion_runs` (including archived rows) in the requested format.
- **Outputs:** A downloadable CSV or JSON export bundle; an audit-log entry per export request.
- **Error handling:** A very large export may require asynchronous handling or a size-exceeded response rather than blocking indefinitely (implementation-time bound, named in BRD NFR-002).
- **Edge cases:** Export is available any number of times up to the moment final confirmation actually executes — not one-shot; a tenant that never exports is still deletable once the grace period elapses and confirmation is given (export is offered, not mandatory).

### 5.4 Feature / Capability: Grace Period Enforcement

- **Description:** Enforces a configurable waiting window (default 30 days) between request and eligibility for final confirmation.
- **Triggers:** Any attempt to call the final-confirmation endpoint.
- **Inputs:** `deletion_requested_at`; current time; the configured grace-period duration.
- **Processing:** If `now() < deletion_requested_at + grace_period` (30 days by default), the confirmation attempt is rejected outright (HTTP 409), naming the remaining wait — never silently ignored or queued.
- **Outputs:** A rejection response with remaining-wait information, or (once eligible) permission to proceed to confirmation.
- **Error handling:** An early confirmation attempt always returns an explicit rejection, never a silent no-op.
- **Edge cases:** The grace period is a floor on how soon deletion can be confirmed, not a ceiling on how long the tenant may still cancel — cancellation remains available even after the grace period has technically elapsed but before confirmation actually happens.

### 5.5 Feature / Capability: Cancellation

- **Description:** Allows the Tenant-Admin to abandon a pending deletion request at any point before final execution, restoring normal operation.
- **Triggers:** Tenant-Admin submits a cancellation request (e.g., `DELETE /v1/tenants/self-service-deletion`).
- **Inputs:** Caller's identity (`tenant_admin`, own tenant).
- **Processing:** Nulls both `deletion_requested_at` and `deletion_confirmed_at` for the tenant. Because the ingestion-halt guard (Section 5.2) checks `deletion_requested_at` directly, nulling it immediately resumes ingestion eligibility with no separate "resume" step needed.
- **Outputs:** Deletion markers cleared; ingestion eligibility restored; an audit-log entry recorded.
- **Error handling:** Cancellation after final execution has already begun (`tenants.status = 'deleting'`) is not meaningful — cancellation is only available up to the moment execution actually starts, per Decision §5's own framing ("until the moment final confirmation is actually executed").
- **Edge cases:** Cancellation is available even after the 30-day grace period has technically elapsed, as long as confirmation has not yet been executed — a tenant who changes their mind at the last moment still has a real path back.

### 5.6 Feature / Capability: Final Confirmation and Deletion Execution

- **Description:** The irreversible step: once the grace period has genuinely elapsed, the Tenant-Admin confirms deletion, which triggers the actual, bounded, asynchronous, partition-aware removal of the tenant's content.
- **Triggers:** Tenant-Admin submits a confirmation request (e.g., `POST /v1/tenants/self-service-deletion/confirm`) after the grace period has elapsed.
- **Inputs:** Caller's identity (`tenant_admin`, own tenant); `deletion_requested_at`.
- **Processing:** If the grace period has not elapsed, reject (Section 5.4). If eligible: set `tenants.status = 'deleting'` and, in the same application-code action, invoke `executeTenantDeletion()` (ADR-0039 §4's already-designed bounded, asynchronous, partition-aware deletion function) directly — not a second, parallel implementation. This execution runs under `app_user`'s own RLS-scoped connection (`withTenant()`), never under `platform_admin_role`'s bypass. Deletion covers: hard delete of `users`, `watchlists`, `platform_credentials` rows and their Key Vault secrets; hard delete of `social_posts` and `authors` hot rows plus archived `rawPayload` blobs; hard delete of hot and archived `ingestion_runs` (only after all referencing `social_posts` rows for the tenant are deleted).
- **Outputs:** Tenant's content fully removed across primary storage, archival tier, and Key Vault; `tenants.status = 'deleting'`; an audit-log entry for the confirmation action.
- **Error handling:** Confirmation before grace-period elapse is rejected (Section 5.4); a failed or partial async deletion job should be resumable/idempotent (BRD NFR-005) — already-deleted partitions/blobs are skipped on retry.
- **Edge cases:** `ingestion_runs` deletion is ordered after `social_posts` deletion for the same tenant (referential ordering); `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the tenant survive deletion as an unenforced, informational tombstone reference.

### 5.7 Feature / Capability: Audit Logging Across the Lifecycle

- **Description:** Records every lifecycle action (request, each export, cancellation, confirmation) to the existing `platform_admin_audit_log` table, giving Platform Admin the visibility Menno's instruction specifies as their sole role in this flow.
- **Triggers:** Any of the five lifecycle actions above.
- **Inputs:** The acting Tenant-Admin's identity, the action type, a timestamp.
- **Processing:** Calls `logPlatformAdminAction()` (or an equivalent path) via a new, narrow `INSERT` grant on `platform_admin_audit_log` for `app_user` — mirroring `tenant_signup_role`'s own precedent (a non-`platform_admin_role` writer with its own separate grant on the same shared table). `actorIdentity` is set to the requesting/confirming Tenant-Admin's own identity — the first time this field holds a non-Platform-Admin value, named as a deliberate, documented scope extension.
- **Outputs:** A durable, timestamped, attributable audit trail entry per lifecycle step, readable through Platform Admin's existing audit-log read path.
- **Error handling:** N/A — a logging side effect; failure to log should not block the underlying action but is not separately designed here.
- **Edge cases:** `platform_admin_audit_log`'s original framing ("every write performed through `platform_admin_role`'s bypass") no longer precisely describes every row after this flow ships — named explicitly so a future reader isn't misled.

### 5.8 Feature / Capability: Tenant Admin Offboarding UI (Story 6.13)

- **Description:** A dedicated UI screen letting the Tenant-Admin drive the full request/export/cancel/confirm lifecycle without scripting the API.
- **Triggers:** Tenant-Admin navigates to the settings/deletion screen (e.g., `/tenant/settings/delete`).
- **Inputs:** UI actions (request, export-download, cancel, confirm) mapped to the corresponding backend endpoints.
- **Processing:** Gated on `tenant_admin` role; `tenant_user` is redirected away and cannot see the entry point at all. Final-confirmation action uses high-friction copy requiring explicit acknowledgment that the action is irreversible.
- **Outputs:** Same backend state transitions as Sections 5.1–5.6, driven through the UI.
- **Error handling:** Surfaces backend rejection reasons (e.g., grace period not yet elapsed, with remaining-wait detail) to the user.
- **Edge cases:** None beyond what the backend already enforces; the UI layer is not the authorization boundary (consistent with ADR-0036's own "UI gating is UX convenience, not the real security boundary" principle).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Sole initiator of the entire deletion lifecycle for their own tenant |
| Tenant-User | Cannot initiate, view, or affect any step of this flow |
| Platform Admin | Observer only, via the audit log; no action, approval, or execution capability |
| Async deletion executor | Background process performing the bounded, partition-aware removal of tenant content |
| Live ingestion-polling scheduler / connectors | Consumers of the ingestion-halt guard at `runIngestionAttempt()` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Story 3.8 | Tenant-Admin who has decided to leave the platform | ...request deletion of my own tenant, have ingestion halt immediately, export my data as many times as needed during a grace period, and only finalize once that period has genuinely elapsed, with a real way to change my mind before then | ...I can leave the platform entirely under my own control, without waiting on a Platform Admin | Request sets `deletion_requested_at` and halts ingestion; re-triggerable CSV/JSON export; 30-day grace period with cancellation available throughout; confirmation invokes the bounded deletion function; every step logged with the Tenant-Admin's identity; `app_user` grants remain narrowly scoped |
| Story 6.13 | Tenant-Admin | ...have a dedicated UI to request, export, cancel, and confirm deletion of my own tenant | ...I can manage offboarding without scripting the API | `/tenant/settings/delete` gated on `tenant_admin`; exposes request/export/cancel/confirm actions with high-friction final-confirmation copy; `tenant_user` cannot see the entry point |
| Story 3.7 (historical, retired) | Platform Admin offboarding a departed tenant | ...export then delete a tenant's data in a bounded, auditable way | ...a departed tenant's data does not linger forever | Retired 2026-08-07 — built exactly as ADR-0039 §1 originally specified, found to collide with the "zero access" boundary, never committed; fully superseded by Story 3.8 |

### 6.3 Workflow Diagrams / Steps

**Workflow: full self-service deletion lifecycle**

1. Tenant-Admin opens the offboarding screen and requests deletion.
2. System verifies caller is `tenant_admin` for the target tenant; sets `deletion_requested_at = now()`; logs the action.
3. Ingestion halt takes effect immediately — any subsequent `runIngestionAttempt()` call for this tenant is refused before an `IngestionRun` opens.
4. During the grace period (30 days by default), the Tenant-Admin may export data (CSV or JSON) any number of times; each export is logged.
5. At any point before final execution, the Tenant-Admin may cancel — markers are nulled, ingestion resumes, cancellation is logged.
6. Once the grace period has genuinely elapsed, the Tenant-Admin submits final confirmation.
7. System sets `tenants.status = 'deleting'` and invokes `executeTenantDeletion()` under `app_user`'s RLS-scoped connection.
8. Async job removes hot rows (`users`, `watchlists`, `platform_credentials`), Key Vault secrets, `social_posts`/`authors` hot rows and archived `rawPayload` blobs, and `ingestion_runs` hot/archived rows (after referencing posts are gone).
9. Confirmation is logged; `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the tenant persist as a tombstone reference.
10. Platform Admin may at any time view the full request/export/cancel/confirm trail via the existing audit-log read path — no action available to them in this flow.

---

## 7. Data Requirements

### 7.1 Data Inputs

The caller's resolved identity (`role: 'tenant_admin'`, own `tenantId`); the current server time (for grace-period comparison); export format choice (CSV/JSON); confirmation/cancellation actions.

### 7.2 Data Outputs

Two new `timestamptz` markers on `tenants`; a `'deleting'` status value; downloadable CSV/JSON export bundles; audit-log rows in `platform_admin_audit_log`; complete removal of the tenant's rows across `users`, `watchlists`, `platform_credentials`, `social_posts`, `authors`, `ingestion_runs`, and associated Key Vault secrets and archived blobs.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `tenants` | New: `deletion_requested_at` (nullable `timestamptz`, `app_user`-writable), `deletion_confirmed_at` (nullable `timestamptz`, `app_user`-writable); `status` gains value `'deleting'` (writable only via the final execution step, still `platform_admin_role`-locked for other transitions per ADR-0030) | One row per tenant; `id`-scoped RLS via existing `tenant_isolation` policy |
| `users` | Tenant's registered user rows | New `app_user` `DELETE` grant (RLS-scoped) enables final-execution hard delete |
| `watchlists` | Tenant's saved queries/matching rules | Already `app_user`-deletable; removed during final execution |
| `platform_credentials` + Key Vault secrets | Tenant-wide/user-bound connector credentials and their Key Vault secret references | Secrets actively revoked/deleted, not merely dereferenced |
| `social_posts` | Ingested posts, including archived `rawPayload` blob pointers | Hard-deleted along with archived blobs during final execution |
| `authors` | Normalized authors referenced by the tenant's posts | Hard-deleted during final execution |
| `ingestion_runs` | Ingestion attempt records, hot and archived | Deleted only after all referencing `social_posts` rows for the tenant are deleted |
| `platform_admin_audit_log` | New: `app_user` `INSERT` grant (narrow, mirroring `tenant_signup_role`'s precedent); `actorIdentity` may now hold a Tenant-Admin's identity, not only a Platform Admin's | Rows referencing the deleted tenant are retained after deletion (tombstone) |
| `domain_signup_attempts` | Historical tenant provisioning/lifecycle records | Retained after tenant deletion, unenforced tombstone reference |

### 7.4 Validation Rules

- `deletion_requested_at`/`deletion_confirmed_at` writes must be scoped to the caller's own tenant via existing `tenant_isolation` RLS.
- Only a caller with `role === 'tenant_admin'` (never `tenant_user`, never `platform_admin`) may write these columns or invoke any of the five lifecycle endpoints.
- Confirmation must be rejected (never silently accepted or queued) if `now() < deletion_requested_at + grace_period`.
- `ingestion_runs` deletion must not precede deletion of the `social_posts` rows it is referenced by, for the same tenant.
- `tenants.status = 'deleting'` may be set only by the final execution step, never by request/export/grace-period/cancel steps.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Only `tenant_admin` may request, export, cancel, or confirm deletion for their own tenant; `tenant_user` and `platform_admin` cannot | All five lifecycle endpoints |
| BR2 | A deletion request is a separate, irreversible-once-confirmed action, never a side effect of suspension | Deletion request logic |
| BR3 | Final confirmation is rejected until the configured grace period has genuinely elapsed | Confirmation endpoint |
| BR4 | Export is offered, not mandatory; a tenant that never exports is still deletable once eligible | Export logic |
| BR5 | Cancellation is available from request until the moment final deletion is actually executed | Cancellation endpoint |
| BR6 | Archived `IngestionRun` data is hard-deleted only for the deleted tenant's own rows, and only after every referencing `SocialPost` row is also deleted | Deletion execution ordering |
| BR7 | `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the deleted tenant are retained as an unenforced tombstone | Post-deletion state |
| BR8 | Key Vault secrets referenced by `platform_credentials` must be actively revoked/deleted, not left orphaned | Deletion execution |
| BR9 | Ingestion for a tenant with an active deletion request is refused before a new `IngestionRun` is opened | `runIngestionAttempt()` guard |
| BR10 | Every request, export, cancellation, and confirmation is logged to `platform_admin_audit_log`, with `actorIdentity` set to the acting Tenant-Admin's identity | Audit logging |
| BR11 | `app_user` access is not broadened beyond the narrow, per-column/table grants needed for this flow; `tenants.status` (for other transitions), `license_seat_count`, and `domain` remain locked to `platform_admin_role` | Database privilege model |
| BR12 | The final, irreversible cross-table deletion step runs under `app_user`'s own RLS-scoped connection, never under `platform_admin_role`'s `BYPASSRLS` | Deletion execution authority |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `social-listening-core` deletion-lifecycle endpoints | Inbound (from Tenant-Admin) | Request, export, cancel, confirm | HTTPS/JSON REST |
| `runIngestionAttempt()` | Internal | Ingestion-halt enforcement point | In-process TypeScript |
| `executeTenantDeletion()` (reused from ADR-0039 §4) | Internal | Bounded, asynchronous, partition-aware deletion execution | In-process TypeScript, async job |
| Azure Blob Storage (archival tier) | Outbound (delete) | Removal of archived `rawPayload` blobs and archived `ingestion_runs` | Azure Blob Storage API |
| Azure Key Vault | Outbound (delete/revoke) | Active removal of connector credential secrets | Azure Key Vault API |
| `platform_admin_audit_log` / `logPlatformAdminAction()` | Internal | Durable, attributable audit trail | Postgres INSERT |
| Postgres + RLS | Internal | Tenant-scoped storage and enforcement | SQL |
| `social-listening-admin` (Story 6.13 UI) | Outbound (to user) | Offboarding screen exposing the full lifecycle | HTTP/React (Next.js) |
| Platform Admin audit-log read UI | Outbound (to Platform Admin) | Read-only visibility into this flow's lifecycle events | HTTP/React (Next.js) |

---

## 10. Non-Functional Considerations

- **Performance:** Export streaming is bounded to prevent memory/worker exhaustion; large exports may need to run asynchronously or fail with a clear size-exceeded message.
- **Security / access control:** RLS and own-tenant scoping enforced at every step; new `app_user` grants are narrowly column/table-scoped and do not widen access to `tenants.status` (for other transitions), `license_seat_count`, or `domain`; `platform_admin_role` receives zero new access to any tenant-content table.
- **Scalability:** Deletion execution is asynchronous, bounded, and partition-aware to handle potentially large tenant data volumes without long-running locks.
- **Reliability / availability:** The async deletion job should be resumable and idempotent — a failed job can be retried without duplicating work; already-deleted partitions/blobs are skipped on retry.
- **Audit and logging:** Every lifecycle step is durably logged with actor identity and timestamp, reachable through Platform Admin's existing read path.
- **Accessibility:** The offboarding UI (Story 6.13) uses high-friction, explicit-acknowledgment copy for the irreversible final-confirmation action.
- **Localization / internationalization:** Not addressed by this ADR/BRD; follows existing admin-UI conventions.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `tenant_user` or `platform_admin` attempts any lifecycle action | Authorization error | Request rejected; no state change |
| Confirmation attempted before grace period elapses | Rejection naming remaining wait time | HTTP 409; no state change; not silently ignored or queued |
| Ingestion attempted for a tenant with a pending deletion request | N/A (system-internal, non-retryable classified outcome) | `runIngestionAttempt()` refuses before opening an `IngestionRun` |
| Cancellation submitted after grace period has technically elapsed but before confirmation | Cancellation succeeds | Markers nulled; ingestion resumes |
| Async deletion job fails partway | Job status reflects failure/retry state | Job is resumable and idempotent; already-deleted partitions/blobs skipped on retry |
| Export requested for an extremely large tenant dataset | Size-exceeded message or async export handling | Bounded synchronous export, or asynchronous fallback |

---

## 12. Assumptions and Dependencies

- The caller is authenticated as `tenant_admin` for exactly one tenant, subject to RLS.
- `tenant_admin` role resolution happens at the application authorization layer, not via a separate Postgres role (ADR-0030 §1/ADR-0032).
- ADR-0039's export scope (§2), per-table deletion treatment (§3), and async/partition-aware execution design (§4) are reused as-is, not re-implemented.
- ADR-0018's tiered retention/archival mechanism is already built and in use.
- ADR-0014's Key Vault credential storage supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.
- Depends on: ADR-0039 (§2–§5 reused, §1 superseded), ADR-0030/0031/0032 (authorization/tenant schema), ADR-0018 (retention), ADR-0014 (Key Vault), ADR-0037/Story 5.15 (precedent for non-`platform_admin_role` audit-log insert grant).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Exact wording/channel of a user-facing warning as the grace period nears its end | UI/UX (Story 6.13 surface) | Not designed by ADR-0043; a real UX follow-up |
| Q2 | Whether a `requireTenantAdmin()` middleware helper is added vs. continuing the existing inline role-check pattern | Engineering | Left to implementation choice |
| Q3 | Whether this flow needs its own rate-limiting/abuse-prevention (e.g., repeated request/cancel cycles) | Engineering | Not designed; no demonstrated need yet |
| Q4 | Formal legal certification of GDPR Article 17/20 sufficiency | Legal/Compliance | External review, not an engineering deliverable |

---

## 14. Appendix

### Glossary

See BRD-0043 Section 15 for the full glossary (Tenant, Tenant-Admin, Tenant-User, Platform Admin, Grace period, `deletion_requested_at`/`deletion_confirmed_at`, `rawPayload`, Archival tier, IngestionRun, `platform_admin_audit_log`, `actorIdentity`, Key Vault, Tombstone reference, Data portability).

### Reference Links

- **ADR-0043:** `docs/adr/0043-self-service-tenant-initiated-deletion.md`
- **BRD-0043:** `docs/project docs/Business-Requirements/BRD-0043-Self-Service-Tenant-Initiated-Deletion.md`
- **Related ADRs:** ADR-0039 (offboarding data lifecycle, §2–§5 reused, §1 superseded), ADR-0030/0031 (Platform Admin boundary, tenants table shape), ADR-0032 (identity resolution), ADR-0018 (retention/archival), ADR-0014 (Key Vault), ADR-0037/Story 5.15 (audit-log grant precedent)
- **Stories:** Story 3.8 (backend, built 2026-08-07), Story 6.13 (UI, built 2026-08-13), Story 3.7 (historical/retired)
- **Related feature designs:** Feature design 10 (Data export), Feature design 15 (DSR self-service portal, future/broader), Feature design 16 (Compliance audit pack, future)

### Missing / Not Applicable Sources

- No `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file specific to self-service tenant deletion was found; this FDD, like BRD-0043, relies on ADR-0043, its related ADR family, and the named user stories, with Feature designs 10/15/16 noted as adjacent-but-not-directly-sourcing context.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0043 and BRD-0043, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
