# Business Requirements Document (BRD) — Self-Service, Tenant-Admin-Initiated Tenant Deletion

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Social Listening / Insights — Self-Service, Tenant-Admin-Initiated Tenant Deletion Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-07 |
| Author(s) | BRD Writer Agent (on behalf of Menno, Sole Operator) |
| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
| Status | Approved (Accepted 2026-08-07) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-07 | BRD Writer Agent | Initial draft from ADR-0043 and related user stories |
| 1.0 | 2026-08-07 | Menno | Approved as accepted by Menno: "Tenant Admin requests deletion → export window → grace period → Tenant Admin confirms → system deletes → Platform Admin only sees audit logs" |

---

## 2. Executive Summary

When a tenant decides to leave the platform, ADR-0039 previously prohibited any self-service mechanism for deleting the tenant's own account. That prohibition has been superseded by ADR-0043, which makes the `tenant_admin` the sole initiator of tenant deletion, with no Platform Admin approval or execution step anywhere in the path.

This BRD establishes a fully self-service offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion of that tenant, after which all data ingestion for the tenant halts immediately. The tenant admin receives a configurable grace period to download the tenant's data in CSV or JSON as many times as needed, may cancel the request at any point before final confirmation, and may confirm the deletion only once the grace period has genuinely elapsed. After confirmation, the system irreversibly deletes the tenant's content while preserving the platform's administrative audit trail. The Platform Admin's only role is to observe the audit log.

The expected business value is a buildable answer to data-portability and right-to-erasure expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline or weakening the accepted boundary that Platform Admins do not access tenant-content tables.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable fully self-service tenant deletion | A `tenant_admin` can request, export, and confirm deletion of their own tenant without any Platform Admin involvement |
| 2 | Provide a data-portability window before erasure | The tenant admin can generate and download CSV and JSON exports of the tenant's data multiple times during the grace period |
| 3 | Prevent accidental or premature irreversible deletion | Confirmation is rejected until the grace period has elapsed, and cancellation is available throughout the window |
| 4 | Preserve the platform's audit trail | Every request, export, cancellation, and confirmation is logged with the acting tenant admin's identity and is visible to Platform Admin |
| 5 | Enforce the accepted authorization boundary | No `platform_admin` or `tenant_user` identity can request, approve, or execute a tenant deletion |
| 6 | Halt data ingestion immediately upon request | No new ingestion runs are opened for a tenant once deletion has been requested |
| 7 | Reuse existing offboarding mechanisms | Deletion execution reuses the export scope, per-table deletion treatment, and async/partition-aware execution already defined by ADR-0039 §2–§5 |

---

## 4. Scope

### 4.1 In Scope

- A `tenant_admin`-initiated deletion request for the caller's own tenant, including immediate halt of new ingestion for that tenant.
- A re-triggerable data export during the grace period covering `social_posts` (including archived `rawPayload` resolved via blob pointer), `authors`, `watchlists`, and `ingestion_runs` (including archived rows).
- A configurable, named default grace period of 30 days between request and final confirmation.
- A cancellation option available from request until the moment final deletion is actually executed.
- Final confirmation as a separate, irreversible step that is rejected until the grace period has genuinely elapsed.
- Logging of every request, export, cancellation, and confirmation action to `platform_admin_audit_log` for Platform-Admin visibility.
- A new `tenants.status` value, `'deleting'`, set by the final execution step.
- Narrow, per-column `tenants` lifecycle fields (`deletion_requested_at`, `deletion_confirmed_at`) and narrow `platform_admin_audit_log` `INSERT` grants for `app_user`, without widening access to the locked `status`, `license_seat_count`, or `domain` columns.
- Asynchronous, bounded, partition-aware deletion of the tenant's content across primary storage, the archival tier, and Key Vault, reusing the mechanism already defined by ADR-0039 §2–§5.
- Retention of `platform_admin_audit_log` and `domain_signup_attempts` rows that reference the deleted tenant.

### 4.2 Out of Scope

- Platform-Admin-initiated deletion (superseded in full by ADR-0043; ADR-0039 Decision §1 is no longer in effect).
- A self-service deletion path for `tenant_user` identities.
- Formal legal certification that the design satisfies GDPR Article 17 or 20 (that remains a legal review activity).
- Rate-limiting or abuse-prevention rules for repeated request/cancel cycles (deferred until a demonstrated need exists).
- The exact wording, channel, or timing of grace-period reminder notifications (a UX decision for the admin UI surface).
- Whether a `requireTenantAdmin` middleware helper is added (an implementation choice, per ADR-0043 §8).
- A public, non-tenant DSR/DSAR portal for individual data subjects (out of scope; see feature design 15 for a future broader DSR portal).
- Backfill or retroactive application to tenants suspended before this feature ships.

### 4.3 Assumptions

- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- The `tenant_admin` role is resolved at the application authorization layer, not through a separate Postgres role (per ADR-0030 §1 / ADR-0032).
- ADR-0039's export scope, per-table deletion treatment, and async/partition-aware execution design are already accepted and available for reuse.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

### 4.4 Constraints

- The action is irreversible; therefore it requires a real grace period, multi-step confirmation, and a cancellation path.
- `platform_admin_role` must not be granted read or write access to tenant-content tables to satisfy the already-accepted ADR-0030 §2 boundary.
- The final deletion step for cross-table data must run as a bounded, asynchronous, partition-aware background job, not a single synchronous transaction, because data volumes are potentially large.
- The ordinary request/export/cancel/confirm steps must run under the tenant-scoped `app_user` path (or a dedicated, non-`BYPASSRLS` execution role for the final deletion step), not through `platform_admin_role`'s bypass.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary actor who requests, exports, and confirms deletion | High | Full control of own-tenant offboarding; clear export and cancellation options; no accidental irreversible action |
| Tenant-User | Tenant member who cannot initiate deletion | Low | Cannot lose data without a tenant admin's decision; no accidental exposure |
| Platform Admin | Observer of the offboarding audit trail only | Medium | Can see that deletions happened, by whom, and when; cannot be asked to perform or approve them |
| Legal / Compliance Advisor | Needs defensible erasure and portability | High | A mechanism that can be reviewed against GDPR Article 17/20; auditable logs; no claims of legal certification by engineering |
| Operations Engineer | Runs and monitors the async deletion job | Medium | Bounded job with status, SLA, failure handling, and no long-running locks |
| Sole-Operator / Product Owner | Overall owner of the product | High | Closes the ADR-0039 Open Question with an explicit, self-service mechanism that does not weaken existing security boundaries |

---

## 6. Current State (As-Is)

The platform currently has no self-service path for a tenant to delete its own account. Until this BRD:

- ADR-0039 Decision §1 explicitly stated that a tenant cannot self-delete via any self-service mechanism, and that any future self-service route would route through Platform Admin for review.
- A Platform-Admin-initiated path was specified by ADR-0039, but that path was found to conflict with the already-accepted boundary that `platform_admin_role` has zero access to tenant-content tables (Story 5.7 / ADR-0030 §2).
- Suspension (Story 5.7) is supported, but it is a status change, not a data-deletion action; all tenant-content rows, archived `rawPayload` blobs, and Key Vault secrets remain in place.
- `social_posts`, `authors`, `watchlists`, `users`, `platform_credentials`, and `ingestion_runs` continue to exist indefinitely for suspended or departed tenants.

**Pain points:**
- Departed tenants' data accumulates indefinitely, increasing storage cost and blast radius.
- There is no self-service data-portability path for a tenant that wants a copy of its data before leaving.
- The existing accepted design leaves the question of who may trigger deletion unresolved in a buildable way.
- There is no technical mechanism a legal review could evaluate against GDPR right-to-erasure or data-portability expectations that is fully under the tenant admin's own control.

---

## 7. Future State (To-Be)

A `tenant_admin` opens the self-service offboarding flow (Story 6.13) and requests deletion of their own tenant. From that moment, the system:

1. Records the deletion request and immediately halts all new ingestion for that tenant.
2. Starts a configurable grace period during which the tenant admin can export their data in CSV or JSON as many times as needed.
3. Allows the tenant admin to cancel the deletion request at any point before the final deletion is executed.
4. Refuses final confirmation until the grace period has genuinely elapsed.
5. Upon final confirmation, marks the tenant as `'deleting'` and queues an asynchronous, bounded deletion job.
6. The deletion job removes all tenant-content rows, archived `rawPayload` blobs, archived `IngestionRun` records, and Key Vault credentials for that tenant, while leaving platform audit and signup records intact.
7. The Platform Admin observes every lifecycle step through the existing `platform_admin_audit_log` read path, with no action, approval, or execution capability.

**Expected capabilities:**
- Fully self-service, own-tenant-only offboarding with no Platform Admin execution step.
- Immediate ingestion halt once a deletion is requested.
- Re-triggerable data export during the grace period.
- Grace-period enforcement with cancellation and final confirmation.
- Asynchronous, resumable, partition-aware deletion job with status and logging.
- Complete removal of secrets and archival-tier data, not just primary-storage rows.
- Explicit audit-log visibility for the Platform Admin without any role-widening for tenant-content access.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | A `tenant_admin` may request deletion of their own tenant only | Must | Request sets a deletion-requested marker for the caller's own tenant and is unreachable by `tenant_user` or `platform_admin` identities | Product Owner |
| BR-002 | New ingestion is halted for a tenant once deletion is requested | Must | Any ingestion attempt for that tenant is refused before an `IngestionRun` is opened and returns a non-retryable, tenant-deletion-requested outcome | Product Owner |
| BR-003 | The tenant admin may export their tenant's data during the grace period | Must | Export covers `social_posts` (incl. archived `rawPayload`), `authors`, `watchlists`, and `ingestion_runs` (incl. archived rows); available in CSV and JSON; re-triggerable | Product Owner |
| BR-004 | A configurable grace period must elapse before final confirmation | Must | Confirmation is rejected with a meaningful remaining-wait indication until the grace period has genuinely elapsed | Product Owner |
| BR-005 | The tenant admin may cancel the deletion request before final confirmation | Must | Cancellation nulls the deletion markers and immediately restores ingestion eligibility; cancellation is logged | Product Owner |
| BR-006 | Final confirmation triggers an irreversible, asynchronous deletion job | Must | Confirmation sets a deletion-confirmed marker and invokes the bounded, partition-aware deletion execution; no Platform Admin action is required | Product Owner |
| BR-007 | Hot rows for `users`, `watchlists`, and `platform_credentials` are hard-deleted | Must | After completion, no queryable rows for the deleted tenant remain in these tables; corresponding Key Vault secrets are actively revoked/deleted | Product Owner |
| BR-008 | Hot rows and archived `rawPayload` blobs for `social_posts` and `authors` are deleted | Must | Primary rows and any archived `rawPayload` blobs belonging to the tenant are removed; no orphaned blobs remain | Product Owner |
| BR-009 | Hot and archived `ingestion_runs` for the tenant are deleted, after referencing posts are gone | Must | `IngestionRun` archival copies and hot rows for the tenant are removed once every `social_posts` row referencing them for that tenant has also been deleted | Product Owner |
| BR-010 | `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the tenant are retained | Must | These records remain queryable after the tenant row is gone, using the tenant ID as an unenforced informational tombstone | Product Owner |
| BR-011 | The tenant's status reflects an in-progress or completed deletion | Must | The `tenants` record is updated so that stale sessions and ingestion attempts fail cleanly rather than silently operating on partially-deleted data | Product Owner |
| BR-012 | Every offboarding step is durably logged | Must | Request, each export, cancellation, and confirmation are recorded with the actor's identity and timestamp in the audit log | Product Owner |
| BR-013 | Platform Admin has visibility but no execution capability | Must | The audit log is reachable through Platform Admin's existing read path; no endpoint or workflow allows a Platform Admin to request or approve a deletion | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Row-level security and own-tenant scoping are enforced at every step | Security | Must | Contract tests confirm a caller can only request/export/delete their own tenant and cannot access another tenant's offboarding artifacts |
| NFR-002 | Export streaming is bounded to prevent memory or worker exhaustion | Performance | Must | Synchronous exports are capped by row count and/or size; larger exports run asynchronously or fail with a clear size-exceeded message |
| NFR-003 | Deletion job completes within a stated, configurable SLA | Reliability | Should | Job reports status and a due-by/completion bound; partial or slow progress is observable |
| NFR-004 | Key Vault secrets are removed, not merely dereferenced in the database | Security | Must | A test confirms that a previously valid credential is unreadable from Key Vault after deletion completes |
| NFR-005 | The async deletion job is resumable and idempotent | Reliability | Should | A failed job can be retried without duplicating work; already-deleted partitions/blobs are skipped on retry |
| NFR-006 | The offboarding UI is accessible and clearly marks irreversible actions | Usability | Should | Final confirmation uses high-friction copy, requires explicit action, and warns that the action cannot be undone |
| NFR-007 | No existing tenant/user authorization boundary is weakened | Security | Must | Tests confirm `app_user` still cannot write `tenants.status`, `license_seat_count`, or `domain`, and `platform_admin_role` still has no access to tenant-content tables | Product Owner |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Tenant deletion may only be requested by a `tenant_admin` for their own tenant; `tenant_user` and `platform_admin` identities cannot request, approve, or execute it. |
| BRU-002 | A deletion request is a separate, irreversible action and is never a side effect of tenant suspension. |
| BRU-003 | Final confirmation is rejected until the configured grace period has genuinely elapsed since the request. |
| BRU-004 | Export is offered, not mandatory; a tenant that does not export is still deleted once the grace period expires and final confirmation is given. |
| BRU-005 | Cancellation is available from request until the moment the final deletion is actually executed, including after the grace period has technically elapsed but before confirmation. |
| BRU-006 | Hard deletion of archived `IngestionRun` data is allowed only for a deleted tenant's own rows and only after every referencing `SocialPost` row for that tenant is also deleted. |
| BRU-007 | `platform_admin_audit_log` and `domain_signup_attempts` rows that reference the deleted tenant are retained; the tenant ID continues to exist in those records as an unenforced tombstone reference. |
| BRU-008 | Key Vault secrets referenced by `platform_credentials` must be actively revoked or deleted, not merely left orphaned. |
| BRU-009 | Ingestion for a tenant with an active deletion request is refused before a new `IngestionRun` is opened. |
| BRU-010 | The `tenants.status` value `'deleting'` is set only by the final execution step, not by the request, export, grace-period, or cancel steps. |
| BRU-011 | Every request, export, cancellation, and confirmation is logged to `platform_admin_audit_log`, with the acting `tenant_admin`'s own identity recorded as `actorIdentity`. |
| BRU-012 | `app_user` access is not broadened beyond the narrow, per-column/table grants needed for this flow; `tenants.status`, `license_seat_count`, and `domain` remain locked to `platform_admin_role`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.deletion_requested_at` | Timestamp when the tenant admin requested deletion | `tenants` table | Tenant-Admin / Platform | System metadata |
| `tenants.deletion_confirmed_at` | Timestamp when final deletion was confirmed after the grace period | `tenants` table | Tenant-Admin / Platform | System metadata |
| `tenants.status` | New value `'deleting'`, set by the final execution step | `tenants` table | Platform | System metadata |
| `social_posts` rows | Tenant's ingested social posts, including archival `rawPayload` pointers | Primary and archival storage | Tenant | Tenant content / potential PII |
| `authors` rows | Normalized authors referenced by the tenant's posts | Primary storage | Tenant | Tenant content |
| `watchlists` rows | Tenant's saved queries and matching rules | Primary storage | Tenant | Tenant content |
| `users` rows | Tenant's registered users | Primary storage | Tenant | Personal data |
| `platform_credentials` rows + Key Vault secrets | Tenant-wide or user-bound connector credentials and their secrets | Primary + Azure Key Vault | Tenant | High-sensitivity secrets |
| `ingestion_runs` rows | Ingestion attempt records, including hot and archived copies | Primary and archival storage | Platform operations | Operational / audit data |
| `platform_admin_audit_log` rows | Audit records of offboarding and other administrative actions | Primary storage | Platform | Audit / compliance data |
| `domain_signup_attempts` rows | Historical records of tenant provisioning/suspension/deletion lifecycle | Primary storage | Platform | Audit / compliance data |
| Exported CSV/JSON bundle | Machine-readable copy of the tenant's data generated during the grace period | Generated on request | Tenant | Tenant content / potential PII |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Tenant deletion requests initiated | Track self-service offboarding demand | Product / Operations | Weekly |
| Exports generated during grace periods | Measure data-portability usage | Product / Compliance | Weekly |
| Grace-period cancellations vs. confirmations | Understand user behavior and decision points | Product | Monthly |
| Deletion job completion rate and SLA | Ensure the async job is healthy | Operations | Real-time / Daily |
| Deletion job failures and retry counts | Surface operational issues | Operations | Real-time / Daily |
| Audit-log entries by offboarding step | Confirm every step is recorded and attributable | Compliance / Platform Admin | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The original ADR-0039 Decision §1 (Platform-Admin-initiated) is superseded by ADR-0043; teams may still reference the outdated text | Medium | High | This BRD, ADR-0043, and ADR-0039's own superseding note explicitly state the current, tenant-admin-initiated path; implementation follows ADR-0043 | Product Owner |
| R-002 | The design has not been certified as satisfying GDPR Article 17/20 | Medium | High | Treat the mechanism as a prerequisite; engage legal review; do not claim compliance certification in engineering documents | Legal / Compliance |
| R-003 | A tenant admin accidentally confirms an irreversible deletion | Low | High | Multi-step confirmation, 30-day default grace period, clear irreversibility warnings, and a cancel option throughout the window | Product Owner |
| R-004 | Removal of the human-in-the-loop Platform Admin review gate increases operational risk | Medium | High | Audit-log visibility, grace period, and cancellation provide real controls; the trade-off is explicitly accepted and documented in ADR-0043 | Product Owner |
| R-005 | A real, narrow widening of `app_user` database privileges for deletion lifecycle columns and audit logging | Medium | Medium | Keep grants column- or table-scoped, confined by existing RLS, with application-layer role enforcement; use a dedicated, non-`BYPASSRLS` execution role for the final cross-table deletion step | Engineering |
| R-006 | `platform_admin_audit_log`'s original framing no longer describes every row it contains | Low | Medium | Name the deliberate scope extension explicitly in this BRD and ADR-0043; future readers must know this ADR exists to interpret mixed `actorIdentity` values | Product Owner |
| R-007 | Large data volumes cause the async deletion job to run long or fail | Medium | Medium | Use partition-aware execution, bounded SLA, resumable job design, and observable status/retry | Operations |
| R-008 | Cross-tenant leakage in the export or deletion job | Low | High | Enforce row-level security and own-tenant scoping at every step; contract-test for no cross-tenant access | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0039 — Tenant offboarding data lifecycle: export and deletion (§2–§5 reused; §1 superseded) | Internal / Decision | Product Owner | Accepted 2026-08-06; superseded in part 2026-08-07 |
| D-002 | ADR-0030 / ADR-0031 — Tenant/user authorization and `tenants` table shape | Internal / Technical | Engineering | Built |
| D-003 | ADR-0032 — Identity resolution and `role` column | Internal / Technical | Engineering | Built |
| D-004 | ADR-0018 — Tiered data retention and archival | Internal / Technical | Engineering | Built |
| D-005 | ADR-0014 — Key Vault credential storage and active secret deletion | Internal / Technical | Engineering | Built |
| D-006 | ADR-0037 / Story 5.15 — Precedent for non-`platform_admin_role` `INSERT` on `platform_admin_audit_log` | Internal / Technical | Engineering | Built |
| D-007 | Story 3.8 — Self-service, Tenant-Admin-initiated tenant deletion backend | Internal / Delivery | Engineering | Built 2026-08-07 |
| D-008 | Story 6.13 — Self-service tenant deletion / offboarding UI | Internal / Delivery | Engineering | Built 2026-08-13 |
| D-009 | External legal review of GDPR Article 17/20 sufficiency | External / Compliance | Legal | TBD |

---

## 14. Acceptance Criteria

- A `tenant_admin` can request deletion for their own tenant, and the system immediately halts all new ingestion for that tenant.
- A `tenant_admin` can export their own tenant's data in CSV and JSON during the grace period, and the export is re-triggerable any number of times before confirmation.
- A configurable grace period of 30 days (by default) must elapse before final confirmation; an early confirmation attempt is rejected with a meaningful remaining-wait indication.
- The tenant admin can cancel the request at any point before final deletion is executed, and cancellation restores ingestion eligibility for the tenant.
- `tenant_user` and `platform_admin` identities cannot request, export, cancel, or confirm deletion.
- After the grace period and final confirmation, the system irreversibly removes `users`, `watchlists`, `platform_credentials`, `social_posts`, `authors`, archived `rawPayload` blobs, and archived/hot `ingestion_runs` for the tenant.
- Corresponding Key Vault secrets are actively revoked or deleted, not merely dereferenced in the database.
- `platform_admin_audit_log` and `domain_signup_attempts` records that reference the deleted tenant remain queryable.
- Every offboarding step — request, each export, cancellation, and confirmation — is recorded in the audit log with the acting tenant admin's identity.
- Deletion runs as an asynchronous, bounded, observable job rather than a single synchronous transaction.
- `platform_admin_role` does not receive any read or write access to tenant-content tables as a result of this flow.
- `app_user` access is not broadened beyond the narrow grants required for the deletion lifecycle columns and audit-log insertion.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A customer organization whose data is isolated from all other tenants by row-level security. |
| **Tenant-Admin** | The highest-privileged user within a tenant, authorized to manage users, settings, and offboarding for that tenant only. |
| **Tenant-User** | An ordinary user within a tenant; cannot initiate tenant-level offboarding. |
| **Platform Admin** | A platform-level operator who administers tenants, users, and platform-wide settings but does not access tenant-content tables. |
| **Grace period** | A configurable waiting window between a deletion request and final confirmation, during which the tenant admin may export data and cancel the request. |
| **`deletion_requested_at`** | A nullable `timestamptz` column on `tenants` recording when the tenant admin requested deletion. |
| **`deletion_confirmed_at`** | A nullable `timestamptz` column on `tenants` recording when the tenant admin confirmed final deletion. |
| **`rawPayload`** | The original, platform-provided JSON payload for a `SocialPost`. Hot values older than the retention window are replaced by a pointer to an archived blob. |
| **Archival tier** | Cheaper, non-primary storage (Azure Blob Storage) where `rawPayload` and `IngestionRun` rows are moved after their hot-storage window expires. |
| **IngestionRun** | A record of a single ingestion attempt, linked to every `SocialPost` it produced. |
| **`platform_admin_audit_log`** | The platform's shared audit table; under this BRD it also receives non-Platform-Admin actions performed by a tenant admin. |
| **`actorIdentity`** | The field in `platform_admin_audit_log` recording who performed the logged action; for this flow it may hold a tenant admin's identity rather than a Platform Admin's. |
| **Key Vault** | Azure Key Vault, where connector secrets referenced by `platform_credentials` are stored. |
| **Tombstone reference** | An unenforced, informational reference to a deleted tenant's ID in audit records, preserved so that historical audit entries remain meaningful. |
| **Data portability** | The ability of a tenant to obtain and reuse their data in a structured, machine-readable format. |

---

## 16. Appendices

### Reference documents

- [ADR-0043: Self-service, Tenant-Admin-initiated tenant deletion](../../adr/0043-self-service-tenant-initiated-deletion.md) (source ADR; now the sole tenant-deletion trigger)
- [ADR-0039: Tenant offboarding data lifecycle — export and deletion](../../adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md) (§2–§5 reused; Decision §1 superseded in full by ADR-0043 on 2026-08-07)
- [ADR-0030: Platform Admin role and authorization boundary](../../adr/0030-platform-admin-role-and-authorization-boundary.md)
- [ADR-0031: Tenants table shape and lifecycle fields](../../adr/0031-tenants-table-shape.md)
- [ADR-0032: Identity resolution and `role` column](../../adr/0032-identity-resolution-and-role-column.md)
- [ADR-0018: Data retention and archival](../../adr/0018-data-retention-and-archival.md)
- [ADR-0014: Credential storage in Azure Key Vault](../../adr/0014-credential-storage-in-azure-key-vault.md)
- [ADR-0037: Rate limiting and `tenant_signup_role`](../../adr/0037-rate-limiting-and-tenant-signup-role.md)
- [Feature design 10: Data export](../../product-research/feature-designs/10-data-export.md) (related portability/export context)
- [Feature design 15: DSR self-service portal](../../product-research/feature-designs/15-dsr-self-service-portal.md) (future, broader data-subject portal)
- [Feature design 16: Compliance audit pack](../../product-research/feature-designs/16-compliance-audit-pack.md) (future audit-pack context)

### Related user stories

#### Story 3.8 — Self-service, Tenant-Admin-initiated tenant deletion: request, export, grace period, confirmation

- **Intent:** As a Tenant-Admin who has decided to leave the platform, I want to request deletion of my own tenant, have ingestion halt immediately, export my own data in CSV or JSON as many times as I need during a grace period, and only be able to make the deletion final once that period has genuinely elapsed — with a real way to change my mind before then — so that I can leave the platform entirely under my own control, without waiting on a Platform Admin.
- **Status:** Done — built 2026-08-07. Now the sole tenant-deletion mechanism.
- **Key acceptance criteria:**
  1. A `tenant_admin`-only request sets `tenants.deletion_requested_at` and halts new ingestion.
  2. A `tenant_admin`-only, re-triggerable export of `social_posts` (incl. archived `rawPayload`), `authors`, `watchlists`, and `ingestion_runs` (incl. archived rows) is available in CSV or JSON.
  3. A 30-day (configurable) grace period must elapse before confirmation; cancellation is available at any point until execution.
  4. Final confirmation triggers the irreversible deletion-execution function.
  5. Every step is logged in `platform_admin_audit_log` with the acting Tenant-Admin's identity.
  6. `app_user` grants are column/table-scoped and do not weaken other tenant-authorization boundaries.

#### Story 6.13 — Self-service tenant deletion / offboarding UI

- **Intent:** As a Tenant-Admin, I want a dedicated UI to request, export, cancel, and confirm deletion of my own tenant, so that I can manage offboarding without scripting the API.
- **Status:** Done — built 2026-08-13.
- **Key acceptance criteria:**
  1. A `/tenant/settings/delete` page is gated on `tenant_admin`; `tenant_user` is redirected away from the entry point.
  2. The page exposes request, export, cancel, and confirm actions, with high-friction final-confirmation copy.
  3. `tenant_user` cannot see the offboarding entry point.

#### Story 3.7 — Tenant offboarding data lifecycle: export and deletion

- **Intent (historical record):** As a Platform Admin, offboarding a tenant that has left the platform, I want to give that tenant a chance to export their own data, then delete it completely across primary storage, archival storage, and Key Vault in a bounded, auditable way, so that a departed tenant's data does not linger forever.
- **Status:** Retired 2026-08-07 — never committed as originally specified; superseded in full by ADR-0043 and Story 3.8.

### Missing source material

- No `docs/product-research/feature-designs/<feature>.md` file or `docs/product-research/reports/<feature>-deep-research.md` file specific to self-service tenant deletion was found. This BRD relies on ADR-0043, the related ADR family (ADR-0039, ADR-0030, ADR-0031, ADR-0032, ADR-0018, ADR-0014, ADR-0037), the related user stories, and the data-export, DSR-portal, and compliance-audit-pack feature designs for adjacent context.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-07 |
| Product Owner | Menno | | 2026-08-07 |
| Technical Lead | Menno | | 2026-08-07 |
| Other Stakeholder | | | |
