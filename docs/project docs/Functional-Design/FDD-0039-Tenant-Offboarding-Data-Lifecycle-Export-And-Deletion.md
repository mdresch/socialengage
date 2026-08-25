# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0039 Tenant Offboarding Data Lifecycle: Export and Deletion — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, ../Business-Requirements/BRD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0039-tenant-offboarding-data-lifecycle-export-and-deletion.md and the business requirements in BRD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md into functional design for **Tenant Offboarding Data Lifecycle Export And Deletion**.
When a tenant leaves the platform, its data currently remains in every tenant-content table — `social_posts`, `authors`, `ingestion_runs`, `watchlists`, `platform_credentials`, and `users` — indefinitely. Suspension (Story 5.7) only blocks access; it does not remove data. Archived `rawPayload` blobs and `IngestionRun` records created by the tiered retention mechanism (ADR-0018) are equally unaffected, and Key Vault secrets for connectors remain live. This leaves a real storage, security, and GDPR-adjacent compliance gap that the project has explicitly deferred twice before (ADR-0018, ADR-0031).

This BRD establishes a self-service, tenant-controlled offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion, receive a configurable grace period during which they can export their data, and then confirm the request. Upon confirmation, the platform irreversibly deletes the tenant's content across primary storage, the archival tier, and Key Vault, while preserving the platform's own administrative audit trail. The original ADR-0039 Decision §1 described a Platform-Admin-only path; that path was superseded in full by ADR-0043 (2026-08-07) after implementation showed it would violate the accepted "Platform Admin has zero access to tenant-content tables" boundary. The mechanism in this BRD therefore follows the corrected, tenant-admin-initiated flow.

The expected business value is a buildable answer to right-to-erasure and data-portability expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Platform-Admin-initiated deletion (superseded by ADR-0043; ADR-0039 Decision §1 is no longer in effect).
- A self-service deletion path for `tenant_user` identities.
- Formal legal certification that the design satisfies GDPR Article 17 or 20 (that remains a legal review activity).
- The exact export file format and delivery mechanism beyond a downloadable, bundled archive.
- The numeric default for the grace-period length, the notice window, or the deletion-job SLA (these are implementation defaults, not architecture decisions).
- A public, non-tenant DSR/DSAR portal for individual data subjects (out of scope of the tenant-deletion ADR; see feature design 15 for a future DSR portal).
- Backfill or retroactive deletion for tenants suspended before this feature ships.

## 3. Context and Background
Story 5.7 (built) lets Platform Admin suspend a tenant (`tenants.status`), but suspension is not deletion — a suspended tenant's `social_posts`, `authors`, `ingestion_runs`, `watchlists`, `platform_credentials`, and `users` rows all continue to exist, fully intact, indefinitely. Nothing in this project currently answers:

- What "delete a tenant" actually does to each of those tables, and to `platform_credentials`' own Key-Vault-stored secrets (ADR-0014).
- Whether a tenant gets to export their own data before it's gone, and in what format.
- How this interacts with ADR-0018's own tiered retention/archival mechanism — a `SocialPost` whose `rawPayload` has already moved to Blob Storage (post-90-days) and an `IngestionRun` whose row has already left Postgres entirely for the archival tier (post-18-months, per ADR-0018's own 2026-07-30 implementation-default note that `IngestionRun`'s archival is "the whole row leaves Postgres") both need a deletion story that accounts for data that may no longer be a simple Postgres row at all.
- Whether this is even fully deletable given ADR-0005's audit-anchor design (`SocialPost.acquisitionId` referencing `IngestionRun`, already application-enforced only, not a DB constraint, per ADR-0018's own 2026-07-30 amendment) and ADR-0018's "archived, never hard-deleted" treatment of `IngestionRun` specifically.

This is squarely ADR territory by this series' own established bar (ADR-0027/0028/0035/0036/0038's "hard-to-reverse, real security/compliance consequence, not just a new field/endpoint shape"): a real, irreversible data-deletion decision, a genuine GDPR-adjacent compliance question this project has twice already named and twice already declined to design (ADR-0018, ADR-0031), and a decision that must reconcile with an already-Accepted, already-implemented retention/archival mechanism rather than design in a vacuum.
When a tenant leaves the platform, its data currently remains in every tenant-content table — `social_posts`, `authors`, `ingestion_runs`, `watchlists`, `platform_credentials`, and `users` — indefinitely. Suspension (Story 5.7) only blocks access; it does not remove data. Archived `rawPayload` blobs and `IngestionRun` records created by the tiered retention mechanism (ADR-0018) are equally unaffected, and Key Vault secrets for connectors remain live. This leaves a real storage, security, and GDPR-adjacent compliance gap that the project has explicitly deferred twice before (ADR-0018, ADR-0031).

This BRD establishes a self-service, tenant-controlled offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion, receive a configurable grace period during which they can export their data, and then confirm the request. Upon confirmation, the platform irreversibly deletes the tenant's content across primary storage, the archival tier, and Key Vault, while preserving the platform's own administrative audit trail. The original ADR-0039 Decision §1 described a Platform-Admin-only path; that path was superseded in full by ADR-0043 (2026-08-07) after implementation showed it would violate the accepted "Platform Admin has zero access to tenant-content tables" boundary. The mechanism in this BRD therefore follows the corrected, tenant-admin-initiated flow.

The expected business value is a buildable answer to right-to-erasure and data-portability expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a data-portability path for departing tenants | A tenant admin can export their tenant's posts, authors, watchlists, and ingestion runs in at least one machine-readable format before deletion completes |
| 2 | Remove all tenant data at the end of the offboarding lifecycle | No queryable tenant-content rows, archived `rawPayload` blobs, or Key Vault credentials remain for a deleted tenant after the async job finishes |
| 3 | Preserve the platform's audit trail | `platform_admin_audit_log` and `domain_signup_attempts` records for the tenant remain queryable after the tenant row is removed |
| 4 | Keep suspension and deletion as two distinct, reversible-versus-irreversible actions | A suspension can be undone; a deletion requires its own explicit confirmation and grace period and cannot be reversed |
| 5 | Enforce the accepted authorization boundary | No `platform_admin_role` or `tenant_user` identity can trigger, approve, or execute a tenant deletion |
| 6 | Reuse existing retention and partitioning mechanisms | Deletion execution reuses ADR-0018's partition-aware infrastructure and runs as a bounded, asynchronous background job |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a real, twice-already-named gap (ADR-0018, ADR-0031) with a concrete, buildable design rather than leaving it perpetually deferred.
- Reuses existing mechanisms wherever possible (ADR-0030's Platform-Admin-only authority, ADR-0018's partitioning) rather than inventing a second, parallel deletion pipeline.
- Names a real data-portability path (export before deletion) that this project has never designed anywhere before, addressing the general spirit of GDPR Article 20 without overclaiming formal legal certification this ADR is not positioned to give.
- Explicitly reconciles with ADR-0018's own "archived, never hard-deleted" `IngestionRun` framing rather than silently contradicting it — the departure is scoped and named, not an unstated exception.

**Negative**
- **This is a real, named departure from ADR-0018's own "never discarded"/"archived, never hard-deleted" language**, even though scoped narrowly to the deleted tenant's own rows only — a future reader of ADR-0018 alone, without also reading this ADR, could reasonably believe `IngestionRun` is never hard-deleted under any circumstance; both ADRs' own cross-reference notes (Amendment Log, below, and a forward-pointer added to ADR-0018) are the mitigation, not a rewrite of either ADR's original text.
- **This ADR does not itself resolve whether this project's tenant-deletion design satisfies GDPR Article 17 as a matter of law** — that is a legal question beyond what an architecture-decision record can certify; this ADR designs the technical mechanism a legal review would need to exist before any such certification could be made, consistent with how ADR-0018's own Context already scoped itself to a technical retention policy, not a compliance certification.
- **A real, accepted operational cost:** actively deleting archived `IngestionRun` rows and Blob-Storage-tier `rawPayload` requires the archival mechanism to support targeted deletion by tenant, not only whole-partition export/detach as ADR-0018's own Mechanism section originally described — genuine, if bounded, new implementation surface on top of what Story 3.5 already built.
- **No self-service tenant-initiated deletion exists** — a real, named limitation (Decision §1), not an oversight; revisit only if a real, demonstrated need for self-service deletion is later identified.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary actor who requests, exports, and confirms deletion | High | Full control of own-tenant offboarding; clear export and cancellation options; no accidental irreversible action |
| Tenant-User | Tenant member who cannot initiate deletion | Low | Cannot lose data without a tenant admin's decision; no accidental exposure |
| Platform Admin | Observer of the offboarding audit trail only | Medium | Can see that deletions happened, by whom, and when; cannot be asked to perform or approve them |
| Legal / Compliance Advisor | Needs defensible erasure and portability | High | A mechanism that can be reviewed against GDPR Article 17/20; auditable logs; no claims of legal certification by engineering |
| Operations Engineer | Runs and monitors the async deletion job | Medium | Bounded job with status, SLA, failure handling, and no long-running locks |
| Sole-Operator / Product Owner | Overall owner of the product | High | Closes a twice-deferred gap without weakening existing security boundaries |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.7 | epic-3-data-model-storage-and-archival.md |  | `POST /v1/admin/tenants/:id/export` (Platform-Admin-only, `platform_admin_role`) triggers a structured export of the named tenant's `social_posts` (including... |
| Story 3.8 | epic-3-data-model-storage-and-archival.md |  | See epic file. |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

## 10. Non-Functional Considerations
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

## 11. Error Handling and Exceptions
**Positive**
- Closes a real, twice-already-named gap (ADR-0018, ADR-0031) with a concrete, buildable design rather than leaving it perpetually deferred.
- Reuses existing mechanisms wherever possible (ADR-0030's Platform-Admin-only authority, ADR-0018's partitioning) rather than inventing a second, parallel deletion pipeline.
- Names a real data-portability path (export before deletion) that this project has never designed anywhere before, addressing the general spirit of GDPR Article 20 without overclaiming formal legal certification this ADR is not positioned to give.
- Explicitly reconciles with ADR-0018's own "archived, never hard-deleted" `IngestionRun` framing rather than silently contradicting it — the departure is scoped and named, not an unstated exception.

**Negative**
- **This is a real, named departure from ADR-0018's own "never discarded"/"archived, never hard-deleted" language**, even though scoped narrowly to the deleted tenant's own rows only — a future reader of ADR-0018 alone, without also reading this ADR, could reasonably believe `IngestionRun` is never hard-deleted under any circumstance; both ADRs' own cross-reference notes (Amendment Log, below, and a forward-pointer added to ADR-0018) are the mitigation, not a rewrite of either ADR's original text.
- **This ADR does not itself resolve whether this project's tenant-deletion design satisfies GDPR Article 17 as a matter of law** — that is a legal question beyond what an architecture-decision record can certify; this ADR designs the technical mechanism a legal review would need to exist before any such certification could be made, consistent with how ADR-0018's own Context already scoped itself to a technical retention policy, not a compliance certification.
- **A real, accepted operational cost:** actively deleting archived `IngestionRun` rows and Blob-Storage-tier `rawPayload` requires the archival mechanism to support targeted deletion by tenant, not only whole-partition export/detach as ADR-0018's own Mechanism section originally described — genuine, if bounded, new implementation surface on top of what Story 3.5 already built.
- **No self-service tenant-initiated deletion exists** — a real, named limitation (Decision §1), not an oversight; revisit only if a real, demonstrated need for self-service deletion is later identified.

## 12. Assumptions and Dependencies
- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The original ADR-0039 Decision §1 (Platform-Admin-initiated) is superseded by ADR-0043; teams may still reference the outdated text | Medium | High | This BRD and ADR-0039's own superseding note explicitly state the current, tenant-admin-initiated path; implementation follows ADR-0043 | Product Owner |
| R-002 | The design has not been certified as satisfying GDPR Article 17/20 | Medium | High | Treat the mechanism as a prerequisite; engage legal review; do not claim compliance certification in engineering documents | Legal / Compliance |
| R-003 | A tenant admin accidentally confirms an irreversible deletion | Low | High | Multi-step confirmation, configurable grace period, clear irreversibility warnings, and a cancel option throughout the window | Product Owner |
| R-004 | Large data volumes cause the async deletion job to run long or fail | Medium | Medium | Use partition-aware execution, bounded SLA, resumable job design, and observable status/retry | Operations |
| R-005 | "Deleted" blobs may still be recoverable due to Blob Storage soft-delete or versioning | Medium | Medium | Verify storage-account settings during implementation and include a verification step in the deletion job | Engineering |
| R-006 | Cross-tenant leakage in the export or deletion job | Low | High | Enforce row-level security and own-tenant scoping at every step; contract-test for no cross-tenant access | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md`
- BRD: `../Business-Requirements/BRD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above