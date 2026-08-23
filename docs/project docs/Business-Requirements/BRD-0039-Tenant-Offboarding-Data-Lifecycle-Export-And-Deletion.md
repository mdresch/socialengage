# Business Requirements Document (BRD) — Tenant Offboarding Data Lifecycle: Export and Deletion

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Social Listening / Insights — Tenant Offboarding Data Lifecycle: Export and Deletion Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (on behalf of Menno, Sole Operator) |
| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-06 | BRD Writer Agent | Initial draft from ADR-0039 and related user stories |
| 1.0 | 2026-08-23 | Menno | Approved; ADR-0043 supersession of Decision §1 incorporated (tenant-admin-initiated deletion is the sole path) |

---

## 2. Executive Summary

When a tenant leaves the platform, its data currently remains in every tenant-content table — `social_posts`, `authors`, `ingestion_runs`, `watchlists`, `platform_credentials`, and `users` — indefinitely. Suspension (Story 5.7) only blocks access; it does not remove data. Archived `rawPayload` blobs and `IngestionRun` records created by the tiered retention mechanism (ADR-0018) are equally unaffected, and Key Vault secrets for connectors remain live. This leaves a real storage, security, and GDPR-adjacent compliance gap that the project has explicitly deferred twice before (ADR-0018, ADR-0031).

This BRD establishes a self-service, tenant-controlled offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion, receive a configurable grace period during which they can export their data, and then confirm the request. Upon confirmation, the platform irreversibly deletes the tenant's content across primary storage, the archival tier, and Key Vault, while preserving the platform's own administrative audit trail. The original ADR-0039 Decision §1 described a Platform-Admin-only path; that path was superseded in full by ADR-0043 (2026-08-07) after implementation showed it would violate the accepted "Platform Admin has zero access to tenant-content tables" boundary. The mechanism in this BRD therefore follows the corrected, tenant-admin-initiated flow.

The expected business value is a buildable answer to right-to-erasure and data-portability expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a data-portability path for departing tenants | A tenant admin can export their tenant's posts, authors, watchlists, and ingestion runs in at least one machine-readable format before deletion completes |
| 2 | Remove all tenant data at the end of the offboarding lifecycle | No queryable tenant-content rows, archived `rawPayload` blobs, or Key Vault credentials remain for a deleted tenant after the async job finishes |
| 3 | Preserve the platform's audit trail | `platform_admin_audit_log` and `domain_signup_attempts` records for the tenant remain queryable after the tenant row is removed |
| 4 | Keep suspension and deletion as two distinct, reversible-versus-irreversible actions | A suspension can be undone; a deletion requires its own explicit confirmation and grace period and cannot be reversed |
| 5 | Enforce the accepted authorization boundary | No `platform_admin_role` or `tenant_user` identity can trigger, approve, or execute a tenant deletion |
| 6 | Reuse existing retention and partitioning mechanisms | Deletion execution reuses ADR-0018's partition-aware infrastructure and runs as a bounded, asynchronous background job |

---

## 4. Scope

### 4.1 In Scope

- A `tenant_admin`-initiated deletion request for the caller's own tenant, including immediate halt of new ingestion for that tenant.
- A re-triggerable data export during the grace period covering `social_posts` (including archived `rawPayload` resolved via blob pointer), `authors`, `watchlists`, and `ingestion_runs` (including archived rows).
- A configurable grace period between request and final confirmation, with an explicit cancellation option.
- Final confirmation as a separate, irreversible step that is rejected until the grace period has genuinely elapsed.
- Asynchronous, bounded deletion of the following for the target tenant:
  - `users`, `watchlists`, `platform_credentials` (hot Postgres rows).
  - Key Vault secrets referenced by `platform_credentials` (actively revoked/deleted, not merely dereferenced).
  - `social_posts` and `authors` (hot Postgres rows) plus archived `rawPayload` blobs belonging to the tenant.
  - `ingestion_runs` (hot and already-archived-out-of-Postgres rows) for the tenant, after every referencing `social_posts` row for that tenant is also gone.
- Retention of `platform_admin_audit_log` and `domain_signup_attempts` rows that reference the deleted tenant.
- Logging of every request, export, cancellation, and confirmation action.
- Status exposure on the tenant record so stale sessions and ingestion attempts fail cleanly once deletion is in progress or complete.

### 4.2 Out of Scope

- Platform-Admin-initiated deletion (superseded by ADR-0043; ADR-0039 Decision §1 is no longer in effect).
- A self-service deletion path for `tenant_user` identities.
- Formal legal certification that the design satisfies GDPR Article 17 or 20 (that remains a legal review activity).
- The exact export file format and delivery mechanism beyond a downloadable, bundled archive.
- The numeric default for the grace-period length, the notice window, or the deletion-job SLA (these are implementation defaults, not architecture decisions).
- A public, non-tenant DSR/DSAR portal for individual data subjects (out of scope of the tenant-deletion ADR; see feature design 15 for a future DSR portal).
- Backfill or retroactive deletion for tenants suspended before this feature ships.

### 4.3 Assumptions

- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

### 4.4 Constraints

- The action is irreversible; therefore it requires a real grace period and multi-step confirmation.
- `platform_admin_role` must not be granted read or write access to tenant-content tables to satisfy the already-accepted ADR-0030/0031 boundary.
- Data volumes are potentially large, so deletion cannot be a single synchronous transaction and must run as a bounded background job.
- Archived `IngestionRun` data may only be hard-deleted for a deleted tenant, and only after every referencing `SocialPost` row for that tenant is deleted — a scoped exception to ADR-0018's general "archived, never hard-deleted" rule.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary actor who requests, exports, and confirms deletion | High | Full control of own-tenant offboarding; clear export and cancellation options; no accidental irreversible action |
| Tenant-User | Tenant member who cannot initiate deletion | Low | Cannot lose data without a tenant admin's decision; no accidental exposure |
| Platform Admin | Observer of the offboarding audit trail only | Medium | Can see that deletions happened, by whom, and when; cannot be asked to perform or approve them |
| Legal / Compliance Advisor | Needs defensible erasure and portability | High | A mechanism that can be reviewed against GDPR Article 17/20; auditable logs; no claims of legal certification by engineering |
| Operations Engineer | Runs and monitors the async deletion job | Medium | Bounded job with status, SLA, failure handling, and no long-running locks |
| Sole-Operator / Product Owner | Overall owner of the product | High | Closes a twice-deferred gap without weakening existing security boundaries |

---

## 6. Current State (As-Is)

The platform can suspend a tenant (Story 5.7), but suspension is a status change, not a data-deletion action. After suspension, every tenant-content table continues to hold the tenant's data:

- `social_posts` and `authors` remain in primary storage; for older posts, `rawPayload` has already moved to Blob Storage under ADR-0018.
- `ingestion_runs` remain in primary storage for up to 18 months and then move to the archival tier, where ADR-0018 currently requires them to be retained indefinitely.
- `watchlists`, `users`, and `platform_credentials` remain in primary storage.
- Connector secrets referenced by `platform_credentials` continue to exist in Key Vault.
- `platform_admin_audit_log` and `domain_signup_attempts` records exist, but there is no policy for what to do with them if the tenant is later removed.

**Pain points:**
- Departed tenants' data accumulates indefinitely, increasing storage cost and blast radius.
- There is no data-portability path for a tenant that wants a copy of its data before leaving.
- There is no technical mechanism a legal review could evaluate against GDPR right-to-erasure or data-portability expectations.
- Suspension and deletion are conflated in casual conversation, but the system only supports the former.

---

## 7. Future State (To-Be)

A tenant admin opens the offboarding flow from the tenant settings UI (Story 6.13). They request deletion of their own tenant. From that moment, the system:

1. Halts new ingestion for that tenant immediately.
2. Starts a configurable grace period during which the tenant admin can export their data in CSV or JSON as many times as needed.
3. Allows the tenant admin to cancel the deletion request at any point before final confirmation.
4. Refuses final confirmation until the grace period has genuinely elapsed.
5. Upon final confirmation, sets a deletion-confirmed marker and queues an asynchronous, bounded deletion job.
6. The deletion job removes all tenant-content rows, archived `rawPayload` blobs, archived `IngestionRun` records, and Key Vault credentials for that tenant, while leaving platform audit and signup records intact.
7. The tenant status is updated so that any remaining sessions, ingestion attempts, or API calls fail cleanly and do not operate against partially-deleted data.

**Expected capabilities:**
- Self-service, own-tenant-only offboarding with no Platform Admin execution step.
- Re-triggerable data export during the grace period.
- Grace-period enforcement with cancellation and final confirmation.
- Asynchronous, resumable, partition-aware deletion job with status and logging.
- Complete removal of secrets and archival-tier data, not just primary-storage rows.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | A `tenant_admin` may request deletion of their own tenant only | Must | Request sets a deletion-requested marker for the caller's own tenant and is unreachable by `tenant_user` or `platform_admin` identities | Product Owner |
| BR-002 | New ingestion is halted for a tenant once deletion is requested | Must | Any ingestion attempt for that tenant is refused before an `IngestionRun` is opened and returns a non-retryable, tenant-deletion-requested outcome | Product Owner |
| BR-003 | The tenant admin may export their tenant's data during a grace period | Must | Export covers `social_posts` (incl. archived `rawPayload`), `authors`, `watchlists`, and `ingestion_runs` (incl. archived rows); available in CSV and JSON; re-triggerable | Product Owner |
| BR-004 | A configurable grace period must elapse before final confirmation | Must | Confirmation is rejected with a meaningful remaining-wait indication until the grace period has genuinely elapsed | Product Owner |
| BR-005 | The tenant admin may cancel the deletion request before final confirmation | Must | Cancellation nulls the deletion markers and immediately restores ingestion eligibility; cancellation is logged | Product Owner |
| BR-006 | Final confirmation triggers an irreversible, asynchronous deletion job | Must | Confirmation sets a deletion-confirmed marker and invokes the bounded, partition-aware deletion execution; no Platform Admin action is required | Product Owner |
| BR-007 | Hot rows for `users`, `watchlists`, and `platform_credentials` are hard-deleted | Must | After completion, no queryable rows for the deleted tenant remain in these tables; corresponding Key Vault secrets are actively revoked/deleted | Product Owner |
| BR-008 | Hot rows and archived `rawPayload` blobs for `social_posts` and `authors` are deleted | Must | Primary rows and any archived `rawPayload` blobs belonging to the tenant are removed; no orphaned blobs remain | Product Owner |
| BR-009 | Hot and archived `ingestion_runs` for the tenant are deleted, after referencing posts are gone | Must | `IngestionRun` archival copies and hot rows for the tenant are removed once every `social_posts` row referencing them for that tenant has also been deleted | Product Owner |
| BR-010 | `platform_admin_audit_log` and `domain_signup_attempts` rows referencing the tenant are retained | Must | These records remain queryable after the tenant row is gone, using the tenant ID as an unenforced informational tombstone | Product Owner |
| BR-011 | The tenant's status reflects an in-progress or completed deletion | Must | Stale sessions and ingestion attempts fail cleanly against the tenant record rather than silently operating on partially-deleted data | Product Owner |
| BR-012 | Every offboarding step is durably logged | Must | Request, each export, cancellation, and confirmation are recorded with the actor's identity and timestamp in the audit log | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Export streaming is bounded to prevent memory or worker exhaustion | Performance | Must | Synchronous exports are capped by row count and/or size; larger exports run asynchronously or fail with a clear size-exceeded message |
| NFR-002 | Deletion job completes within a stated, configurable SLA | Reliability | Should | Job reports status and a due-by/completion bound; partial or slow progress is observable |
| NFR-003 | Row-level security and own-tenant scoping are enforced at every step | Security | Must | Contract tests confirm a caller can only request/export/delete their own tenant and cannot access another tenant's offboarding artifacts |
| NFR-004 | Key Vault secrets are removed, not merely dereferenced in the database | Security | Must | A test confirms that a previously valid credential is unreadable from Key Vault after deletion completes |
| NFR-005 | The async deletion job is resumable and idempotent | Reliability | Should | A failed job can be retried without duplicating work; already-deleted partitions/blobs are skipped on retry |
| NFR-006 | The offboarding UI is accessible and clearly marks irreversible actions | Usability | Should | Final confirmation uses high-friction copy, requires explicit action, and warns that the action cannot be undone |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Tenant deletion may only be requested by a `tenant_admin` for their own tenant; `tenant_user` and `platform_admin` identities cannot request, approve, or execute it. |
| BRU-002 | A deletion request is a separate, irreversible action and is never a side effect of tenant suspension. |
| BRU-003 | Final confirmation is rejected until the configured grace period has genuinely elapsed since the request. |
| BRU-004 | Export is offered, not mandatory; a tenant that does not export is still deleted once the grace period expires and final confirmation is given. |
| BRU-005 | Hard deletion of archived `IngestionRun` data is allowed only for a deleted tenant's own rows and only after every referencing `SocialPost` row for that tenant is also deleted. |
| BRU-006 | `platform_admin_audit_log` and `domain_signup_attempts` rows that reference the deleted tenant are retained; the tenant ID continues to exist in those records as an unenforced tombstone reference. |
| BRU-007 | Key Vault secrets referenced by `platform_credentials` must be actively revoked or deleted, not merely left orphaned. |
| BRU-008 | Ingestion for a tenant with an active deletion request is refused before a new `IngestionRun` is opened. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.deletion_requested_at` | Timestamp when the tenant admin requested deletion | `tenants` table | Tenant-Admin / Platform | System metadata |
| `tenants.deletion_confirmed_at` | Timestamp when final deletion was confirmed after the grace period | `tenants` table | Tenant-Admin / Platform | System metadata |
| `social_posts` rows | Tenant's ingested social posts, including archival `rawPayload` pointers | Primary and archival storage | Tenant | Tenant content / potential PII |
| `authors` rows | Normalized authors referenced by the tenant's posts | Primary storage | Tenant | Tenant content |
| `watchlists` rows | Tenant's saved queries and matching rules | Primary storage | Tenant | Tenant content |
| `users` rows | Tenant's registered users | Primary storage | Tenant | Personal data |
| `platform_credentials` rows + Key Vault secrets | Tenant-wide or user-bound connector credentials and their secrets | Primary + Azure Key Vault | Tenant | High-sensitivity secrets |
| `ingestion_runs` rows | Ingestion attempt records, including hot and archived copies | Primary and archival storage | Platform operations | Operational / audit data |
| `platform_admin_audit_log` rows | Audit records of offboarding and other administrative actions | Primary storage | Platform | Audit / compliance data |
| `domain_signup_attempts` rows | Historical records of tenant provisioning/suspension/deletion lifecycle | Primary storage | Platform | Audit / compliance data |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Tenant deletion requests initiated | Track offboarding demand | Product / Operations | Weekly |
| Exports generated during grace periods | Measure data-portability usage | Product / Compliance | Weekly |
| Deletion job completion rate and SLA | Ensure the async job is healthy | Operations | Real-time / Daily |
| Deletion job failures and retry counts | Surface operational issues | Operations | Real-time / Daily |
| Grace-period cancellations vs. confirmations | Understand user behavior | Product | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The original ADR-0039 Decision §1 (Platform-Admin-initiated) is superseded by ADR-0043; teams may still reference the outdated text | Medium | High | This BRD and ADR-0039's own superseding note explicitly state the current, tenant-admin-initiated path; implementation follows ADR-0043 | Product Owner |
| R-002 | The design has not been certified as satisfying GDPR Article 17/20 | Medium | High | Treat the mechanism as a prerequisite; engage legal review; do not claim compliance certification in engineering documents | Legal / Compliance |
| R-003 | A tenant admin accidentally confirms an irreversible deletion | Low | High | Multi-step confirmation, configurable grace period, clear irreversibility warnings, and a cancel option throughout the window | Product Owner |
| R-004 | Large data volumes cause the async deletion job to run long or fail | Medium | Medium | Use partition-aware execution, bounded SLA, resumable job design, and observable status/retry | Operations |
| R-005 | "Deleted" blobs may still be recoverable due to Blob Storage soft-delete or versioning | Medium | Medium | Verify storage-account settings during implementation and include a verification step in the deletion job | Engineering |
| R-006 | Cross-tenant leakage in the export or deletion job | Low | High | Enforce row-level security and own-tenant scoping at every step; contract-test for no cross-tenant access | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0018 — Tiered data retention and archival (already built) | Internal / Technical | Engineering | Built |
| D-002 | ADR-0043 — Self-service tenant-initiated deletion (Accepted 2026-08-07) | Internal / Decision | Product Owner | Accepted |
| D-003 | ADR-0030 / ADR-0031 — Tenant/user authorization and `tenants` table shape | Internal / Technical | Engineering | Built |
| D-004 | ADR-0014 — Key Vault credential storage and active secret deletion capability | Internal / Technical | Engineering | Built |
| D-005 | Story 3.8 — Self-service deletion backend (request, export, grace, confirm) | Internal / Delivery | Engineering | Built 2026-08-07 |
| D-006 | Story 6.13 — Self-service tenant deletion / offboarding UI | Internal / Delivery | Engineering | Built 2026-08-13 |
| D-007 | External legal review of GDPR Article 17/20 sufficiency | External / Compliance | Legal | TBD |

---

## 14. Acceptance Criteria

- A `tenant_admin` can request deletion for their own tenant, and the system halts ingestion for that tenant immediately.
- A `tenant_admin` can export their own tenant's data in CSV and JSON during the grace period, and the export is re-triggerable.
- Final confirmation is rejected until the grace period has elapsed.
- The tenant admin can cancel the request before final confirmation, and cancellation restores ingestion eligibility.
- `tenant_user` and `platform_admin` identities cannot request, export, or confirm deletion.
- After final confirmation, the system removes `users`, `watchlists`, `platform_credentials`, `social_posts`, `authors`, archived `rawPayload` blobs, and archived/hot `ingestion_runs` for the tenant.
- Corresponding Key Vault secrets are no longer readable after deletion.
- `platform_admin_audit_log` and `domain_signup_attempts` records that reference the deleted tenant remain queryable.
- Every offboarding step is recorded in the audit log with the actor's identity.
- Deletion runs as an asynchronous, bounded, observable job rather than a single synchronous transaction.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A customer organization whose data is isolated from all other tenants by row-level security. |
| **Tenant-Admin** | The highest-privileged user within a tenant, authorized to manage users, settings, and offboarding for that tenant only. |
| **Platform Admin** | A platform-level operator who administers tenants, users, and platform-wide settings but does not access tenant-content tables. |
| **Grace period** | A configurable waiting window between a deletion request and final confirmation, during which the tenant admin may export data and cancel the request. |
| **rawPayload** | The original, platform-provided JSON payload for a `SocialPost`. Hot values older than the retention window are replaced by a pointer to an archived blob. |
| **Archival tier** | Cheaper, non-primary storage (Azure Blob Storage) where `rawPayload` and `IngestionRun` rows are moved after their hot-storage window expires. |
| **Tombstone reference** | An unenforced, informational reference to a deleted tenant's ID in audit records, preserved so that historical audit entries remain meaningful. |
| **Key Vault** | Azure Key Vault, where connector secrets referenced by `platform_credentials` are stored. |
| **Data portability** | The ability of a tenant to obtain and reuse their data in a structured, machine-readable format. |

---

## 16. Appendices

### Reference documents

- [ADR-0039: Tenant offboarding data lifecycle — export and deletion](../../adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md) (source ADR; Decision §1 superseded in full by ADR-0043 on 2026-08-07)
- [ADR-0043: Self-service tenant-initiated deletion](../../adr/0043-self-service-tenant-initiated-deletion.md) (corrected and accepted 2026-08-07; now the sole deletion trigger)
- [ADR-0018: Data retention and archival](../../adr/0018-data-retention-and-archival.md) (the retention mechanism this BRD reuses and creates a scoped exception for)
- [ADR-0030: Platform Admin role and authorization boundary](../../adr/0030-platform-admin-role-and-authorization-boundary.md)
- [ADR-0031: Tenants table shape and lifecycle fields](../../adr/0031-tenants-table-shape.md)
- [ADR-0014: Credential storage in Azure Key Vault](../../adr/0014-credential-storage-in-azure-key-vault.md)
- [Feature design 10: Data export](../../product-research/feature-designs/10-data-export.md)
- [Feature design 15: DSR self-service portal](../../product-research/feature-designs/15-dsr-self-service-portal.md) (future, broader data-subject portal)
- [Feature design 16: Compliance audit pack](../../product-research/feature-designs/16-compliance-audit-pack.md)

### Related user stories

#### Story 3.7 — Tenant offboarding data lifecycle: export and deletion

- **Intent (As a / I want / so that):** As a Platform Admin, offboarding a tenant that has left the platform, I want to give that tenant a chance to export their own data, then delete it completely across primary storage, archival storage, and Key Vault in a bounded, auditable way, so that a departed tenant's data does not linger forever.
- **Status:** Retired 2026-08-07; never committed as specified (original Platform-Admin-gated `POST /v1/admin/tenants/:id/export` and `.../delete`).
- **Key acceptance criteria (historical record):**
  1. A structured export covering `social_posts` (incl. archived `rawPayload`), `authors`, `watchlists`, and `ingestion_runs` (incl. archived rows) was to be available before any deletion action.
  2. Deletion was to be a distinct, two-step, bounded, asynchronous, partition-aware job, not a side effect of suspension.
  3. Hard deletion was to cover `users`, `watchlists`, `platform_credentials`, `social_posts`, `authors`, and `ingestion_runs` (incl. archived copies), while retaining `platform_admin_audit_log` and `domain_signup_attempts`.

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

### Missing source material

- No `docs/product-research/reports/<feature>-deep-research.md` file specific to tenant offboarding was found. This BRD relies on the ADR, user stories, and the data-export, DSR-portal, and compliance-audit-pack feature designs.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-23 |
| Product Owner | Menno | | 2026-08-23 |
| Technical Lead | Menno | | 2026-08-23 |
| Other Stakeholder | | | |
