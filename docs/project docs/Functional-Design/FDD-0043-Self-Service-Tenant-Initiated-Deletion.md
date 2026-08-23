# Business Requirements Document (BRD) — Self-Service, Tenant-Admin-Initiated Tenant Deletion

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Self-Service, Tenant-Admin-Initiated Tenant Deletion |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0043-self-service-tenant-initiated-deletion.md, ../Business-Requirements/BRD-0043-Self-Service-Tenant-Initiated-Deletion.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0043-self-service-tenant-initiated-deletion.md and the business requirements in BRD-0043-Self-Service-Tenant-Initiated-Deletion.md into functional design for **Self Service Tenant Initiated Deletion**.
When a tenant decides to leave the platform, ADR-0039 previously prohibited any self-service mechanism for deleting the tenant's own account. That prohibition has been superseded by ADR-0043, which makes the `tenant_admin` the sole initiator of tenant deletion, with no Platform Admin approval or execution step anywhere in the path.

This BRD establishes a fully self-service offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion of that tenant, after which all data ingestion for the tenant halts immediately. The tenant admin receives a configurable grace period to download the tenant's data in CSV or JSON as many times as needed, may cancel the request at any point before final confirmation, and may confirm the deletion only once the grace period has genuinely elapsed. After confirmation, the system irreversibly deletes the tenant's content while preserving the platform's administrative audit trail. The Platform Admin's only role is to observe the audit log.

The expected business value is a buildable answer to data-portability and right-to-erasure expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline or weakening the accepted boundary that Platform Admins do not access tenant-content tables.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Platform-Admin-initiated deletion (superseded in full by ADR-0043; ADR-0039 Decision §1 is no longer in effect).
- A self-service deletion path for `tenant_user` identities.
- Formal legal certification that the design satisfies GDPR Article 17 or 20 (that remains a legal review activity).
- Rate-limiting or abuse-prevention rules for repeated request/cancel cycles (deferred until a demonstrated need exists).
- The exact wording, channel, or timing of grace-period reminder notifications (a UX decision for the admin UI surface).
- Whether a `requireTenantAdmin` middleware helper is added (an implementation choice, per ADR-0043 §8).
- A public, non-tenant DSR/DSAR portal for individual data subjects (out of scope; see feature design 15 for a future broader DSR portal).
- Backfill or retroactive application to tenants suspended before this feature ships.

## 3. Context and Background
ADR-0039 (Accepted 2026-08-06, hours before this ADR was drafted, same session) designed the tenant offboarding data lifecycle — export scope, per-table deletion treatment, async/bounded/partition-aware execution — and its own Decision §1 states, as a "deliberate, named limitation": **"A tenant cannot self-delete its own account via any self-service mechanism."** That same section named a possible future direction it explicitly declined to design: *"A future self-service deletion request could route to Platform Admin as a reviewed request (mirroring ADR-0030 §3's break-glass request/execute pattern) — named as a real possible future direction, not designed further here (Open Questions, below)."*

Menno has now resolved that Open Question directly — and resolved it *more aggressively* than the direction ADR-0039 §1 itself anticipated. ADR-0039's own aside assumed any future self-service path would still route through Platform Admin for review (the break-glass request/execute pattern, where a human Platform Admin picks up and executes a pending request). Menno's actual instruction removes that review step entirely: **"Fully self-service, Platform Admin only sees the audit trail"** — no Platform Admin approval gate anywhere in the request-export-wait-confirm flow.

This is a real reversal of ADR-0039 Decision §1's own stated prohibition and its own stated reasoning (*"an irreversible, cross-table deletion affecting every tenant-content table is not a self-service action at this project's current scale, consistent with ADR-0030 §3's own 'narrowest possible' framing"*) — not a parameter tweak, not an implicit-requirement clarification, and not merely resolving an Open Question in the direction that Open Question already assumed. `docs/adr/README.md`'s own governance table, row 1, is squarely on point: *"The underlying decision itself changes → New ADR, or a superseding ADR that says so explicitly."*

**Why a new ADR, not an in-place, dated revision to ADR-0039 itself, despite both being drafted the same session, hours apart:**

1. ADR-0039's own Acceptance note states, verbatim: *"Accepted by Menno, verbatim: 'Good news ADR 0039 is approved.' Accepted as drafted, no revisions."* That sentence is itself a specific, dated, quoted historical claim about what was decided and confirmed unrevised. Editing Decision §1's own text now would make that Acceptance note materially misleading to a future reader who trusts it — the whole reason this series' governance table treats an Accepted ADR's Decision/Consequences text as "a historical record [that] stays put" (table's own closing line).
2. The ADR-0030/ADR-0032 precedent this task explicitly asked to be weighed against is not, on inspection, the same situation: both of those were revised in place **before** Menno's acceptance action — while still Proposed, during their own first review round, per their own Amendment Log entries ("Revised at review, before acceptance... per this project's own convention, an in-place revision before acceptance is not a supersession — see ADR-0026/0027/0028/0029's own precedent," ADR-0030's Amendment Log, verbatim). ADR-0039's Decision §1 text, by contrast, was already Accepted, verbatim, no revisions, hours ago. Editing genuinely-Accepted Decision text is a different governance act than editing genuinely-Proposed draft text mid-review, however close in wall-clock time the two events are — using elapsed time as the deciding factor (rather than acceptance status) would create an undefined, indefensible boundary ("how many hours count as still-same-review-round?") that this series has never needed before and shouldn't invent now.
3. The reversal turns out not to be narrowly about "who may initiate deletion" at all — closing this gap for real (see Decision, below) surfaces a genuine, additional architectural boundary question ADR-0039 itself never touched: `tenants.status` is not merely policy-restricted to Platform Admin, it is **database-GRANT-restricted** to `platform_admin_role` (`migrations/0017_create_tenants.sql`: `GRANT UPDATE (status, license_seat_count) ON tenants TO platform_admin_role`; `app_user` — the role every Tenant-Admin session runs as — is granted only `UPDATE (active_seat_count)`). A self-service deletion flow either needs a new, narrow, explicitly-granted write path for a Tenant-Admin session, or a background executor that performs the eventual state transition under `platform_admin_role`'s own connection without a live Platform Admin's judgment call triggering it. That is a real "hard-to-reverse, real architectural boundary" decision by this series' own established ADR-worthiness bar (ADR-0027/0028/0030/0035/0036/0037's own bar, restated at ADR-0041's acceptance) — not a detail that belongs folded into a dated note on an already-Accepted ADR whose own Decision text never contemplated it.

**A "superseding ADR that says so explicitly" (the governance table's own named option in row 1) is the mechanism this ADR uses**, per the same pattern this file already uses for a still-Proposed ADR changing part of an Accepted one's decision (row 5's "Pending supersession note," e.g. ADR-0018 ← ADR-0039 itself) — see "Note on relation to ADR-0039," below.
When a tenant decides to leave the platform, ADR-0039 previously prohibited any self-service mechanism for deleting the tenant's own account. That prohibition has been superseded by ADR-0043, which makes the `tenant_admin` the sole initiator of tenant deletion, with no Platform Admin approval or execution step anywhere in the path.

This BRD establishes a fully self-service offboarding lifecycle. A `tenant_admin` for a given tenant may request deletion of that tenant, after which all data ingestion for the tenant halts immediately. The tenant admin receives a configurable grace period to download the tenant's data in CSV or JSON as many times as needed, may cancel the request at any point before final confirmation, and may confirm the deletion only once the grace period has genuinely elapsed. After confirmation, the system irreversibly deletes the tenant's content while preserving the platform's administrative audit trail. The Platform Admin's only role is to observe the audit log.

The expected business value is a buildable answer to data-portability and right-to-erasure expectations, a bounded storage lifecycle for departed tenants, and an auditable, irreversible deletion process that reuses the existing retention, RLS, and audit-log infrastructure rather than creating a parallel pipeline or weakening the accepted boundary that Platform Admins do not access tenant-content tables.

---

## 4. Goals and Objectives
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

**Positive consequences (from ADR):**
**Positive**
- Closes the exact gap ADR-0039 §1 named as a real possible future direction, resolved directly rather than left open a second time.
- Reuses every mechanism this project already has a real, working precedent for — `active_seat_count`'s narrow per-column `app_user` grant (ADR-0031 §1), `tenant_signup_role`'s own separate `INSERT` grant on `platform_admin_audit_log` (ADR-0037 §2/Story 5.15), and Story 3.7's own deletion-execution function (ADR-0039 §4) — rather than inventing a new bypass mechanism, a new deletion pipeline, or a new audit path.
- Gives a tenant a genuine, reversible-until-the-last-moment path to leave the platform entirely under their own control, addressing the general spirit of GDPR Article 17 (right to erasure) more directly than a Platform-Admin-only path could — the same caveat ADR-0039 §2 already names applies here too: this ADR does not itself certify legal compliance.
- Names, rather than silently produces, two real scope extensions to `platform_admin_audit_log` (a non-`platform_admin_role`-executed write category; a non-Platform-Admin `actorIdentity` value) so a future reader of ADR-0030 §5 alone isn't misled about what every row in that table now means.

**Negative**
- **A real, DB-level privilege widening for `app_user`, however narrow**: two new `UPDATE`-granted columns on `tenants` (Decision §2), `DELETE` on `users` and `tenants` (Decision §2, revised 2026-08-07 — needed now that final execution runs under `app_user` rather than `platform_admin_role`'s bypass), and a new `INSERT` grant on `platform_admin_audit_log` (Decision §7). All are scoped as narrowly as this project's own existing precedents (`active_seat_count`, `tenant_signup_role`'s audit-log grant), and every table involved was already RLS-confined to `tenant_id`/`id` before this ADR — but every `tenant_user` session shares the same Postgres role as every `tenant_admin` session (ADR-0030 §1's own "Tenant-Admin requires no database-level RLS exception... enforced entirely at the application authorization layer"), so the actual restriction to `tenant_admin` specifically is enforced only at the application layer for these writes, not the database layer, the same trade-off ADR-0030 §1 already accepted for every other Tenant-Admin-specific action.
- **`platform_admin_audit_log`'s own name and original framing (ADR-0030 §5) no longer precisely describes every row it contains** — a future reader must know this ADR exists to understand why some `actorIdentity` values are Tenant-Admins, not Platform Admins. Named explicitly (Decision §7) rather than left implicit, but a real, permanent documentation burden this ADR adds.
- **No self-service, Tenant-Admin-initiated deletion path existed at all until this ADR** — the operational risk ADR-0039 §1 originally named (an irreversible, cross-table deletion, self-triggered with no human-in-the-loop review) is real and does not disappear because export and a 30-day, cancellable grace period exist; those are real, meaningful controls, not a full substitute for the human review ADR-0039 §1's original reasoning relied on. This is a genuine, accepted trade-off this ADR makes on Menno's own explicit instruction, not a risk this ADR argues away.
- **A departed/deleted tenant's own audit trail (`platform_admin_audit_log` rows referencing it) survives the tenant's own deletion**, exactly as ADR-0039 §3 already decided for the Platform-Admin-initiated path — unchanged here, but worth restating since this path adds new row *kinds* (request/export/cancel/confirm) to that same surviving trail.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**Status:** Accepted (2026-08-07) — drafted by the AI Business & Requirements Analyst persona, revised in place before acceptance (see below), then accepted by Menno as revised.
**Acceptance note (2026-08-07):** Accepted by Menno, verbatim: *"Tenant Admin requests deletion → export window → grace period → Tenant Admin confirms → system deletes → Platform Admin only sees audit logs."* Confirmed separately, verbatim: *"yes approved."* No Platform Admin approval/deny gate — confirmed explicitly, fully self-service as drafted. Story 3.8 moves to Ready.
**Source:** Menno's own instruction, verbatim, relayed this session: *"could you check tenant admin can request tenant delete at which all connectors stop and no more data ingestion takes place for the tenant. a time period for download all available data in .csv or json format soft delete period then confirmation tenant delete is final."* When asked to clarify Platform Admin's role in this flow, Menno confirmed directly, via a structured choice: **"Fully self-service, Platform Admin only sees the audit trail."**
**Revised 2026-08-07, before acceptance, in-place per this project's own convention for a still-Proposed ADR (ADR-0030/0032's precedent):** this ADR originally described Platform Admin's own Story 3.7 path as "confirmed unaffected, additive." Story 3.7 was then built exactly as ADR-0039 Decision §1 originally specified — `platform_admin_role`-gated — and the resulting contract suite surfaced a real collision with Story 5.7's own already-accepted "platform_admin_role has zero access to tenant-content tables" boundary. Menno reviewed this directly and corrected the decision, verbatim: *"platform admin cannot touch update delete tenant admin information so that contract stands strong now failing... Story 3.7 should have drafted that only a tenant admin delete it own data"* and *"I am very sure we agreed that the tenant admin does so on self service deletion that the platform admin does not interfere."* This ADR now supersedes ADR-0039 Decision §1 **in full** — there is no separate, additive Platform-Admin-initiated path. The mechanism this ADR designs below is the sole tenant-deletion trigger.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary actor who requests, exports, and confirms deletion | High | Full control of own-tenant offboarding; clear export and cancellation options; no accidental irreversible action |
| Tenant-User | Tenant member who cannot initiate deletion | Low | Cannot lose data without a tenant admin's decision; no accidental exposure |
| Platform Admin | Observer of the offboarding audit trail only | Medium | Can see that deletions happened, by whom, and when; cannot be asked to perform or approve them |
| Legal / Compliance Advisor | Needs defensible erasure and portability | High | A mechanism that can be reviewed against GDPR Article 17/20; auditable logs; no claims of legal certification by engineering |
| Operations Engineer | Runs and monitors the async deletion job | Medium | Bounded job with status, SLA, failure handling, and no long-running locks |
| Sole-Operator / Product Owner | Overall owner of the product | High | Closes the ADR-0039 Open Question with an explicit, self-service mechanism that does not weaken existing security boundaries |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.8 | epic-3-data-model-storage-and-archival.md |  | See epic file. |
| Story 6.13 | epic-6-tenant-admin-ui.md | As Tenant-Admin, I want to request, review, and either cancel or confirm deletion of my own tenant through the admin UI, so that I can actually exercise the ... | A `/tenant/settings/delete` (or similarly placed, clearly-separated) screen, visible only to `tenant_admin` resolved identities (Story 6.2's role-gating) — `... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- The `tenant_admin` role is resolved at the application authorization layer, not through a separate Postgres role (per ADR-0030 §1 / ADR-0032).
- ADR-0039's export scope, per-table deletion treatment, and async/partition-aware execution design are already accepted and available for reuse.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

**Status:** Accepted (2026-08-07) — drafted by the AI Business & Requirements Analyst persona, revised in place before acceptance (see below), then accepted by Menno as revised.
**Acceptance note (2026-08-07):** Accepted by Menno, verbatim: *"Tenant Admin requests deletion → export window → grace period → Tenant Admin confirms → system deletes → Platform Admin only sees audit logs."* Confirmed separately, verbatim: *"yes approved."* No Platform Admin approval/deny gate — confirmed explicitly, fully self-service as drafted. Story 3.8 moves to Ready.
**Source:** Menno's own instruction, verbatim, relayed this session: *"could you check tenant admin can request tenant delete at which all connectors stop and no more data ingestion takes place for the tenant. a time period for download all available data in .csv or json format soft delete period then confirmation tenant delete is final."* When asked to clarify Platform Admin's role in this flow, Menno confirmed directly, via a structured choice: **"Fully self-service, Platform Admin only sees the audit trail."**
**Revised 2026-08-07, before acceptance, in-place per this project's own convention for a still-Proposed ADR (ADR-0030/0032's precedent):** this ADR originally described Platform Admin's own Story 3.7 path as "confirmed unaffected, additive." Story 3.7 was then built exactly as ADR-0039 Decision §1 originally specified — `platform_admin_role`-gated — and the resulting contract suite surfaced a real collision with Story 5.7's own already-accepted "platform_admin_role has zero access to tenant-content tables" boundary. Menno reviewed this directly and corrected the decision, verbatim: *"platform admin cannot touch update delete tenant admin information so that contract stands strong now failing... Story 3.7 should have drafted that only a tenant admin delete it own data"* and *"I am very sure we agreed that the tenant admin does so on self service deletion that the platform admin does not interfere."* This ADR now supersedes ADR-0039 Decision §1 **in full** — there is no separate, additive Platform-Admin-initiated path. The mechanism this ADR designs below is the sole tenant-deletion trigger.

## 10. Non-Functional Considerations
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

## 11. Error Handling and Exceptions
**Positive**
- Closes the exact gap ADR-0039 §1 named as a real possible future direction, resolved directly rather than left open a second time.
- Reuses every mechanism this project already has a real, working precedent for — `active_seat_count`'s narrow per-column `app_user` grant (ADR-0031 §1), `tenant_signup_role`'s own separate `INSERT` grant on `platform_admin_audit_log` (ADR-0037 §2/Story 5.15), and Story 3.7's own deletion-execution function (ADR-0039 §4) — rather than inventing a new bypass mechanism, a new deletion pipeline, or a new audit path.
- Gives a tenant a genuine, reversible-until-the-last-moment path to leave the platform entirely under their own control, addressing the general spirit of GDPR Article 17 (right to erasure) more directly than a Platform-Admin-only path could — the same caveat ADR-0039 §2 already names applies here too: this ADR does not itself certify legal compliance.
- Names, rather than silently produces, two real scope extensions to `platform_admin_audit_log` (a non-`platform_admin_role`-executed write category; a non-Platform-Admin `actorIdentity` value) so a future reader of ADR-0030 §5 alone isn't misled about what every row in that table now means.

**Negative**
- **A real, DB-level privilege widening for `app_user`, however narrow**: two new `UPDATE`-granted columns on `tenants` (Decision §2), `DELETE` on `users` and `tenants` (Decision §2, revised 2026-08-07 — needed now that final execution runs under `app_user` rather than `platform_admin_role`'s bypass), and a new `INSERT` grant on `platform_admin_audit_log` (Decision §7). All are scoped as narrowly as this project's own existing precedents (`active_seat_count`, `tenant_signup_role`'s audit-log grant), and every table involved was already RLS-confined to `tenant_id`/`id` before this ADR — but every `tenant_user` session shares the same Postgres role as every `tenant_admin` session (ADR-0030 §1's own "Tenant-Admin requires no database-level RLS exception... enforced entirely at the application authorization layer"), so the actual restriction to `tenant_admin` specifically is enforced only at the application layer for these writes, not the database layer, the same trade-off ADR-0030 §1 already accepted for every other Tenant-Admin-specific action.
- **`platform_admin_audit_log`'s own name and original framing (ADR-0030 §5) no longer precisely describes every row it contains** — a future reader must know this ADR exists to understand why some `actorIdentity` values are Tenant-Admins, not Platform Admins. Named explicitly (Decision §7) rather than left implicit, but a real, permanent documentation burden this ADR adds.
- **No self-service, Tenant-Admin-initiated deletion path existed at all until this ADR** — the operational risk ADR-0039 §1 originally named (an irreversible, cross-table deletion, self-triggered with no human-in-the-loop review) is real and does not disappear because export and a 30-day, cancellable grace period exist; those are real, meaningful controls, not a full substitute for the human review ADR-0039 §1's original reasoning relied on. This is a genuine, accepted trade-off this ADR makes on Menno's own explicit instruction, not a risk this ADR argues away.
- **A departed/deleted tenant's own audit trail (`platform_admin_audit_log` rows referencing it) survives the tenant's own deletion**, exactly as ADR-0039 §3 already decided for the Platform-Admin-initiated path — unchanged here, but worth restating since this path adds new row *kinds* (request/export/cancel/confirm) to that same surviving trail.

## 12. Assumptions and Dependencies
- The caller is authenticated as `tenant_admin` for exactly one tenant and is subject to row-level security.
- The `tenant_admin` role is resolved at the application authorization layer, not through a separate Postgres role (per ADR-0030 §1 / ADR-0032).
- ADR-0039's export scope, per-table deletion treatment, and async/partition-aware execution design are already accepted and available for reuse.
- ADR-0018's tiered retention and archival mechanism is already built and stores `rawPayload` in Blob Storage and `ingestion_runs` in an archival tier.
- ADR-0014's Key Vault credential storage is in use and supports active secret deletion/revocation.
- `social_posts` and `ingestion_runs` are range-partitioned in a way that allows tenant-scoped deletion without whole-table scans.

## 13. Open Questions / Risks
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

## 14. Appendix
- ADR: `../../adr/0043-self-service-tenant-initiated-deletion.md`
- BRD: `../Business-Requirements/BRD-0043-Self-Service-Tenant-Initiated-Deletion.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above