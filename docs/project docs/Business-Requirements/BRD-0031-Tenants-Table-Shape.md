# Business Requirements Document — ADR-0031: `tenants` Table Shape

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage `tenants` Table Shape — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | AI Business & Requirements Analyst | Initial draft from ADR-0031, related ADRs, and user stories |
| 1.0 | 2026-08-19 | Menno | Accepted as BRD-0031 |

---

## 2. Executive Summary

Today, every tenant-scoped table in SocialEngage (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) carries a `tenant_id` column, but no table actually defines what a tenant is. `tenant_id` has been an unvalidated UUID convention since Phase 0, which makes it impossible to offer tenant self-service, license enforcement, or a trustworthy Platform Admin provisioning flow.

This BRD records the business need for a real `tenants` table and a Row-Level Security (RLS) policy scoped by the table's own primary key. The proposed shape gives every other `tenant_id`-bearing table a genuine referent, enables a Platform Admin to provision and suspend tenants without accessing tenant content, and captures each tenant's sign-up email domain so future self-service sign-ups can be routed toward the right organization.

The expected business value is a stable multi-tenant foundation: clear tenant identity, license-seat accounting, auditable Platform Admin operations, and a future-proof hook for same-domain sign-up routing.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Give every `tenant_id` in the system a real, queryable referent | All tenant-scoped tables can reference a validated `tenants.id` foreign key |
| 2 | Enforce the Platform Admin "zero tenant-data access" boundary at the column level | `platform_admin_role` can touch only `tenants` table administrative columns, not tenant content tables |
| 3 | Enable tenant self-view and license management without custom authorization paths | Tenant-Admin and tenant user can read their own tenant row through the existing tenant-scoped session |
| 4 | Provide a foundation for same-domain sign-up routing | `tenants.domain` is captured, validated for public-email exclusion, and unique when populated |
| 5 | Keep database machinery minimal and consistent with existing patterns | No ORM, no triggers, no migration frameworks; reuse ADR-0015's RLS pattern and ADR-0030's bypass role |

---

## 4. Scope

### 4.1 In Scope

- A new `tenants` table with the columns, defaults, and constraints described in ADR-0031 §1.
- An RLS policy on `tenants` scoped by `id` (the table's own primary key) following ADR-0015's fail-closed pattern.
- Application-layer maintenance of `active_seat_count` and enforcement of the `license_seat_count` ceiling.
- The columns that `platform_admin_role` may write: `status`, `license_seat_count`, `domain` (per ADR-0037 §9), and `name` (per 2026-08-12 enhancement).
- A nullable `domain` column with a partial unique index, used for future same-domain sign-up routing.
- The requirement that all Platform-Admin-bypassed writes to `tenants` be durably audited (schema left to the broader audit-log decision in ADR-0030 §5).

### 4.2 Out of Scope

- The exact schema of the `platform_admin_audit_log` table (owned by ADR-0030 §5).
- Resolution of the seat-count race condition under concurrent invites (implementation-time concern; see §12).
- The exact public/free-email-provider exclusion mechanism for `domain` matching (now decided in ADR-0037 but out of scope for this ADR).
- The exact sign-up "rerouting" UX on a domain match (owned by ADR-0032/ADR-0037).
- Tenant deletion/offboarding (explicitly deferred in `docs/open-items-and-deferred-work.md` §C and ADR-0043).
- Whether connector activation needs a separate table or a tenant can have multiple activations of one platform (candidate ADR #6).
- `name` uniqueness constraints or slug/subdomain fields (candidate ADR #7).

### 4.3 Assumptions

- The existing ADR-0015 RLS pattern and `withTenant()` session abstraction remain in place.
- ADR-0030 is accepted, providing the `platform_admin_role` with `BYPASSRLS` and an audit-log requirement.
- ADR-0037 is accepted, extending `platform_admin_role` to also update `tenants.domain`.
- PostgreSQL remains the database engine (ADR-0016).

### 4.4 Constraints

- Minimal database machinery: no triggers, no stored-procedure seat enforcement, no ORM or query-builder migration framework.
- `platform_admin_role` must never write or read tenant content tables (`users`, `watchlists`, `social_posts`, `platform_credentials`).
- All schema changes must be expressed as SQL migrations.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Day-to-day administrator of one tenant | High | View own tenant name, status, and seat counts without a special authorization path |
| Tenant User | End user within a tenant | Medium | Trust that their data is isolated from other tenants |
| Platform Admin | Platform operator | High | Provision, suspend, and license tenants without accessing tenant content |
| Security / Compliance | Risk and audit | High | Auditable Platform Admin writes and fail-closed RLS isolation |
| Engineering | Backend implementation | High | A clear, single source of truth for the `tenants` concept and migration plan |
| New Self-Service User | Prospective first Tenant-Admin | Medium | Be routed to the right organization when signing up from the same email domain |

---

## 6. Current State (As-Is)

Every production table that holds tenant data knows which tenant it belongs to through a `tenant_id` UUID, but that value is not validated against any registry. There is no `tenants` table, so:

- `tenant_id` is a runtime convention, not a genuine foreign key.
- There is no central place to store a tenant's name, status, licensed seat ceiling, or active seat count.
- Platform Admin provisioning and suspension of tenants cannot be modeled as ordinary database writes against a tenant registry.
- Self-service sign-up has no place to record the sign-up email domain, so there is no way to recognize that two users from `acme.com` belong to the same organization.

**Pain points:**
- No referential integrity for the `tenant_id` values that already exist across six tables.
- No license enforcement can be built because the seat ceiling has no persistent home.
- Platform Admin actions lack a bounded, auditable target table.
- Future onboarding flows cannot use domain as a routing signal.

---

## 7. Future State (To-Be)

A single `tenants` table becomes the canonical definition of a tenant. Its primary key is the tenant identity, and an RLS policy lets a normal tenant-scoped session see exactly its own row. A separate `platform_admin_role` with `BYPASSRLS` can create, list, suspend, and relicense tenants, but is column-scoped so it cannot modify `active_seat_count` or any tenant-content table.

**Expected capabilities:**
- Every `tenant_id` in the system can become a real foreign key to `tenants.id`.
- Tenant-Admin and tenant user can call `GET /v1/tenants/me` (Story 1.8) and receive only their own tenant's metadata.
- Platform Admin can list, create, and administer tenants through `GET/POST/PATCH /v1/admin/tenants` (Story 5.12).
- `active_seat_count` is maintained by the same application transaction that changes `users` status, and new activations are rejected when the ceiling is reached.
- `tenants.domain` captures the sign-up email domain, excludes public/free providers, and is unique when non-null, enabling future same-domain routing (ADR-0037).
- Every Platform-Admin write to `tenants` is durably logged in an audit log.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall maintain a `tenants` table with `id`, `name`, `status`, `license_seat_count`, `active_seat_count`, `domain`, `created_at`, and `updated_at` | Must | Schema matches ADR-0031 §1; `id` is `uuid` primary key; `status` defaults to `'active'` | Engineering |
| BR-002 | The system shall enforce an RLS policy on `tenants` scoped by `id` using the current `app.tenant_id` setting | Must | `tenant_isolation` policy exists; ordinary session sees only its own row; two-tenant test proves isolation | Engineering |
| BR-003 | The system shall allow a Tenant-Admin or tenant user to read their own tenant row through the existing `app_user` session | Must | `GET /v1/tenants/me` returns one row and only one row; no custom auth path | Product Owner |
| BR-004 | The system shall let `platform_admin_role` create tenants and update only `name`, `status`, `license_seat_count`, and `domain` | Must | Column-scoped migration grants `UPDATE` on these columns only; attempts to write other columns fail at the database layer | Engineering |
| BR-005 | The system shall not let `platform_admin_role` write `active_seat_count` | Must | Direct `UPDATE` of `active_seat_count` by the bypass role is rejected in contract tests | Engineering |
| BR-006 | The system shall increment and decrement `active_seat_count` in the same application transaction that changes `users` status | Must | Counter moves only on `invited` → `active` or `active` → `removed/ended`; seat is not occupied at invite time | Engineering |
| BR-007 | The system shall reject a new user activation or invitation that would exceed `license_seat_count` | Must | A test fills all seats and confirms the next invite is rejected with `409` | Product Owner |
| BR-008 | The system shall store a nullable sign-up `domain` with a partial unique index when non-null | Should | `NULL` allowed; duplicate non-null domain rejected; public/free provider domains excluded from capture | Engineering |
| BR-009 | The system shall durably log every `platform_admin_role` write to `tenants` | Must | Each create, update, or suspend creates an `platform_admin_audit_log` row with actor, operation, target, and timestamp (per ADR-0030 §5) | Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | RLS on `tenants` is fail-closed: an unset or empty `app.tenant_id` returns zero rows | Security | Must | Verified by contract test with `app.tenant_id = ''` |
| NFR-002 | `platform_admin_role` has no grants on tenant-content tables (`users`, `watchlists`, `social_posts`, `platform_credentials`) | Security | Must | Verified by `aclcheck` or equivalent query in contract tests |
| NFR-003 | Seat-count enforcement is deterministic under non-concurrent load | Reliability | Must | Contract suite passes with sequential invites and removals |
| NFR-004 | The seat-count race condition under concurrent invites is documented and tracked until closed | Reliability | Should | Open risk recorded; implementation selects a locking strategy (e.g., `SELECT ... FOR UPDATE`) before shipping |
| NFR-005 | All schema migrations are plain SQL, consistent with existing migration conventions | Maintainability | Must | No ORM or query-builder artifacts introduced |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A tenant's primary key `id` is its own identity; the RLS policy uses `id = NULLIF(current_setting('app.tenant_id', true), '')::uuid` and never a separate `tenant_id` column. |
| BRU-002 | `platform_admin_role` may create `tenants` and may update only the administrative metadata columns (`name`, `status`, `license_seat_count`, `domain`). It may never write or read tenant content. |
| BRU-003 | `active_seat_count` is a denormalized counter maintained by application code, not by a database trigger or the bypass role. |
| BRU-004 | A seat is occupied only when a `users` row's status moves to `active`; creating an `invited` user does not increment `active_seat_count`. |
| BRU-005 | A new user activation or invitation that would make `active_seat_count >= license_seat_count` must be rejected. |
| BRU-006 | `tenants.domain` is nullable. When non-null, it must be unique across tenants and must not be a common public/free email provider domain. |
| BRU-007 | Every Platform-Admin write to `tenants` is recorded in the audit log with actor identity, operation, target tenant, and timestamp. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.id` | UUID primary key, the canonical tenant identity | Generated at creation | Engineering | Tenant identifier |
| `tenants.name` | Display name of the tenant or organization | Platform Admin or sign-up flow | Product Owner | Public to tenant members |
| `tenants.status` | Tenant lifecycle state (`active` / `suspended`) | Platform Admin actions | Product Owner | Public to tenant members |
| `tenants.license_seat_count` | Number of seats the tenant is licensed for | Platform Admin | Product Owner | Public to tenant members |
| `tenants.active_seat_count` | Currently occupied seats, maintained by app logic | Application code | Engineering | Public to tenant members |
| `tenants.domain` | Sign-up email domain, used for future same-domain routing | Self-service sign-up or Platform Admin recovery | Product Owner | Public to tenant members |
| `tenants.created_at` / `tenants.updated_at` | Row timestamps | Database | Engineering | Operational |
| `platform_admin_audit_log` entries | Durable record of bypassed `tenants` writes | Application code on bypass | Engineering / Security | Audit trail, restricted read |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Active vs. suspended tenant count | Platform health and churn | Platform Admin | Daily / on demand |
| License utilization by tenant (`active_seat_count / license_seat_count`) | Capacity and upsell signal | Platform Admin | Weekly |
| New tenant provisioning and suspension audit log | Compliance and incident review | Security / Compliance | On demand |
| Domain-match sign-up attempts (once built) | Onboarding funnel and routing effectiveness | Product team | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Concurrent invites read a stale `active_seat_count` and exceed the license ceiling | Medium | High | Select a locking/atomic update strategy at implementation time (e.g., `SELECT ... FOR UPDATE` or conditional `UPDATE ... RETURNING`); do not ship without resolving this | Engineering |
| R-002 | Public/free email providers (gmail.com, outlook.com, etc.) are captured as `domain`, causing unrelated tenants to be linked | Medium | High | Maintain a static denylist or heuristic (decided in ADR-0037); validate `domain` before saving | Engineering |
| R-003 | A single legitimate organization wants multiple separate tenants under one corporate domain | Low | Medium | Document as known limitation; support future override via Platform Admin or dedicated multi-tenant flag | Product Owner |
| R-004 | Migrating six existing tables to add a real foreign key to `tenants.id` is mechanical but error-prone | Medium | Medium | Run a single migration batch, verify with full contract suite, preserve existing RLS policy text | Engineering |
| R-005 | Audit-log schema is not fully specified, leaving a compliance gap until ADR-0030 §5 closes | Low | High | Track as dependency; do not ship `platform_admin_role` writes without a durable, queryable audit log | Engineering / Security |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 RLS pattern and `withTenant()` session mechanism | Internal / Architectural | Engineering | Already accepted |
| D-002 | ADR-0030 `platform_admin_role` and `BYPASSRLS` authorization + audit-log requirement | Internal / Architectural | Engineering | Already accepted |
| D-003 | ADR-0037 self-service sign-up and `UPDATE (domain)` grant | Internal / Architectural | Engineering | Already accepted |
| D-004 | ADR-0032 `users` table shape, status values, and RLS policy | Internal / Architectural | Engineering | Already accepted |
| D-005 | PostgreSQL engine and migration infrastructure (ADR-0016) | Internal / Technical | Engineering | Already in place |
| D-006 | Related user stories: 1.8, 5.7, 5.8, 5.12, 5.15, 6.7, 3.8 | Internal / Delivery | Product Owner | Ready / built (see Appendix C) |

---

## 14. Acceptance Criteria

1. The `tenants` table is created with the exact schema described in ADR-0031 §1, including the nullable `domain` column added at review.
2. `ALTER TABLE tenants ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` are applied, and a `tenant_isolation` policy scopes access by `id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
3. A normal tenant-scoped session (`app_user`) reading `tenants` sees exactly one row: its own.
4. `platform_admin_role` can `INSERT` new tenants and can `UPDATE` only `name`, `status`, `license_seat_count`, and `domain`.
5. `platform_admin_role` cannot write `active_seat_count` at the database layer.
6. A test confirms `active_seat_count` is incremented/decremented by the same application transaction that changes a `users` row's status.
7. A new user invitation or activation is rejected once `active_seat_count >= license_seat_count` for that tenant.
8. A partial unique index exists on `tenants.domain` where `domain IS NOT NULL`.
9. Common public/free email provider domains are not stored as `tenants.domain` (per ADR-0037's denylist).
10. Every `platform_admin_role` write to `tenants` produces a durable, queryable audit log entry (per ADR-0030 §5).

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Tenant** | An organization or workspace in SocialEngage, represented by a single `tenants` row. |
| **Tenant-Admin** | A user with administrative rights inside one tenant, scoped to that tenant by RLS. |
| **Tenant User** | A non-admin member of a tenant, also scoped by RLS. |
| **Platform Admin** | An operator who manages the platform's tenant registry, authenticated via a separate identity table and using `BYPASSRLS`. |
| **RLS (Row-Level Security)** | PostgreSQL feature that filters rows per policy for each query, used as the tenant boundary in this project. |
| **BYPASSRLS** | A Postgres role attribute that allows a user to bypass RLS; granted only to `platform_admin_role`. |
| **License seat count** | The `license_seat_count` ceiling a tenant is allowed to occupy. |
| **Active seat count** | The `active_seat_count` counter of currently active users in a tenant. |
| **Domain** | The email domain captured at tenant sign-up (e.g., `acme.com`) for future same-domain routing. |
| **Public/free email provider** | A consumer email domain (e.g., `gmail.com`, `outlook.com`, `yahoo.com`) that must be excluded from domain matching. |

---

## 16. Appendices

### Appendix A — Reference Documents

- [ADR-0031: `tenants` table shape and its own Row-Level Security policy](../../adr/0031-tenants-table-shape.md)
- ADR-0015: Row-Level Security pattern
- ADR-0030: `platform_admin_role` and `BYPASSRLS`
- ADR-0032: `users` table, RLS, and identity resolution
- ADR-0037: Self-service tenant sign-up and first Tenant-Admin provisioning
- ADR-0033: Retire `X-Tenant-Id` as a trust mechanism

### Appendix B — Feature Design and Research

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for ADR-0031's `tenants` table shape. The relevant context is embedded in the ADR itself and in the related Platform Admin / multi-user workspace feature designs (`docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`).

### Appendix C — Related User Stories

| Story | Epic | Source / Status | One-line intent | Key acceptance criteria |
|---|---|---|---|---|
| Story 1.8 | Epic 1 | ADR-0031 — Built | As a Tenant-Admin or tenant user, I want `GET /v1/tenants/me` to return my own tenant's metadata so I don't need a special auth path. | Route mounted behind normal auth; returns only the caller's tenant; no write verbs. |
| Story 5.7 | Epic 5 | ADR-0030 — Built | As a Platform Admin, I want audited, narrowly-scoped RLS bypass so tenant administration never becomes an unaudited path to tenant data. | `BYPASSRLS` only on `tenants` and the Platform Admin table; every write logged; no grants on tenant-content tables. |
| Story 5.8 | Epic 5 | ADR-0031 — Built | As a Tenant-Admin, I want to see my own tenant's row through the existing tenant-scoped session. | RLS policy by `id`; one row visible; `platform_admin_role` cannot write `active_seat_count`; seat ceiling enforced. |
| Story 5.12 | Epic 5 | ADR-0030, ADR-0031 — Built | As a Platform Admin, I want REST endpoints to list, create, and administer tenants. | `GET/POST/PATCH /v1/admin/tenants`; column-scoped `PATCH`; every write audited. |
| Story 5.15 | Epic 5 | ADR-0037 — Built | As a new user, I want a backend endpoint to provision my tenant and make me its first Tenant-Admin. | Domain validation; denylist of public/free providers; audit logging. |
| Story 6.7 | Epic 6 | ADR-0037 — Ready / Built (UI) | As a new user, I want a self-service sign-up screen so I can become the first Tenant-Admin of a new tenant. | UI half of the self-service sign-up flow; depends on Story 5.15 backend. |

### Appendix D — Supersession Notes

- **ADR-0037 (Accepted 2026-08-04)** resolves two of ADR-0031's open questions: the public/free-email-provider exclusion mechanism is a static denylist, and the domain-match reroute UX is a rejection toward the existing invite flow (plus a "Same-Domain Invite Assist" proposal surfaced to the matched tenant's Tenant-Admin).
- **ADR-0037 §9** also extends `platform_admin_role` with `UPDATE (domain)` on `tenants`, giving Platform Admin a recovery path for wrong or squatted `domain` values.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-19 |
| Product Owner | Menno | — | 2026-08-19 |
| Technical Lead | Menno | — | 2026-08-19 |
| Other Stakeholder | — | — | — |
