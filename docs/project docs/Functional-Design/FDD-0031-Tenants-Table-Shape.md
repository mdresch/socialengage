# Business Requirements Document — ADR-0031: `tenants` Table Shape

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — ADR-0031: `tenants` Table Shape |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0031-tenants-table-shape.md, ../Business-Requirements/BRD-0031-Tenants-Table-Shape.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0031-tenants-table-shape.md and the business requirements in BRD-0031-Tenants-Table-Shape.md into functional design for **Tenants Table Shape**.
Today, every tenant-scoped table in SocialEngage (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) carries a `tenant_id` column, but no table actually defines what a tenant is. `tenant_id` has been an unvalidated UUID convention since Phase 0, which makes it impossible to offer tenant self-service, license enforcement, or a trustworthy Platform Admin provisioning flow.

This BRD records the business need for a real `tenants` table and a Row-Level Security (RLS) policy scoped by the table's own primary key. The proposed shape gives every other `tenant_id`-bearing table a genuine referent, enables a Platform Admin to provision and suspend tenants without accessing tenant content, and captures each tenant's sign-up email domain so future self-service sign-ups can be routed toward the right organization.

The expected business value is a stable multi-tenant foundation: clear tenant identity, license-seat accounting, auditable Platform Admin operations, and a future-proof hook for same-domain sign-up routing.

---

### 2.2 Scope
**In scope:**
- A new `tenants` table with the columns, defaults, and constraints described in ADR-0031 §1.
- An RLS policy on `tenants` scoped by `id` (the table's own primary key) following ADR-0015's fail-closed pattern.
- Application-layer maintenance of `active_seat_count` and enforcement of the `license_seat_count` ceiling.
- The columns that `platform_admin_role` may write: `status`, `license_seat_count`, `domain` (per ADR-0037 §9), and `name` (per 2026-08-12 enhancement).
- A nullable `domain` column with a partial unique index, used for future same-domain sign-up routing.
- The requirement that all Platform-Admin-bypassed writes to `tenants` be durably audited (schema left to the broader audit-log decision in ADR-0030 §5).

**Out of scope:**
- The exact schema of the `platform_admin_audit_log` table (owned by ADR-0030 §5).
- Resolution of the seat-count race condition under concurrent invites (implementation-time concern; see §12).
- The exact public/free-email-provider exclusion mechanism for `domain` matching (now decided in ADR-0037 but out of scope for this ADR).
- The exact sign-up "rerouting" UX on a domain match (owned by ADR-0032/ADR-0037).
- Tenant deletion/offboarding (explicitly deferred in `docs/open-items-and-deferred-work.md` §C and ADR-0043).
- Whether connector activation needs a separate table or a tenant can have multiple activations of one platform (candidate ADR #6).
- `name` uniqueness constraints or slug/subdomain fields (candidate ADR #7).

## 3. Context and Background
Every currently-shipped table (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) carries a `tenant_id` column that *references* a tenant, but no table has ever *defined* what a tenant is — `tenant_id` has been a bare UUID convention since Phase 0. This ADR gives it a real table. ADR-0030 already decided the authorization *mechanism* (a `platform_admin_role` with `BYPASSRLS`, scoped to this table and to a future Platform Admin identity table); this ADR decides this table's own columns and its own RLS policy shape — a table that, unlike every other tenant-scoped table so far, does not merely carry a `tenant_id` foreign key, it defines what one is.
Today, every tenant-scoped table in SocialEngage (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) carries a `tenant_id` column, but no table actually defines what a tenant is. `tenant_id` has been an unvalidated UUID convention since Phase 0, which makes it impossible to offer tenant self-service, license enforcement, or a trustworthy Platform Admin provisioning flow.

This BRD records the business need for a real `tenants` table and a Row-Level Security (RLS) policy scoped by the table's own primary key. The proposed shape gives every other `tenant_id`-bearing table a genuine referent, enables a Platform Admin to provision and suspend tenants without accessing tenant content, and captures each tenant's sign-up email domain so future self-service sign-ups can be routed toward the right organization.

The expected business value is a stable multi-tenant foundation: clear tenant identity, license-seat accounting, auditable Platform Admin operations, and a future-proof hook for same-domain sign-up routing.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Give every `tenant_id` in the system a real, queryable referent | All tenant-scoped tables can reference a validated `tenants.id` foreign key |
| 2 | Enforce the Platform Admin "zero tenant-data access" boundary at the column level | `platform_admin_role` can touch only `tenants` table administrative columns, not tenant content tables |
| 3 | Enable tenant self-view and license management without custom authorization paths | Tenant-Admin and tenant user can read their own tenant row through the existing tenant-scoped session |
| 4 | Provide a foundation for same-domain sign-up routing | `tenants.domain` is captured, validated for public-email exclusion, and unique when populated |
| 5 | Keep database machinery minimal and consistent with existing patterns | No ORM, no triggers, no migration frameworks; reuse ADR-0015's RLS pattern and ADR-0030's bypass role |

---

**Positive consequences (from ADR):**
**Positive**
- Gives every existing `tenant_id`-bearing table (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) a real referent for the first time — `tenant_id uuid` can now be a genuine foreign key to `tenants.id`, not a bare convention.
- Reuses ADR-0015's exact RLS pattern with no new mechanism, and ADR-0030's exact bypass mechanism with no new mechanism — this ADR introduces one new table, not one new kind of enforcement.
- Concretely resolves what "Platform Admin... zero tenant-data access" means at the column level, not just as a documented intention.
- **Added at review, 2026-08-03:** `domain` (§5) gives future sign-ups a real chance to be recognized as belonging to an already-onboarded organization, rather than every sign-up necessarily producing a new, disconnected tenant.

**Negative**
- The seat-count race condition (§3) is a real, currently-unresolved correctness gap, not a hypothetical one — flagged for whoever implements this table's story to close before or during that implementation, not silently assumed away. **Confirmed at review, 2026-08-03:** Menno reviewed this gap directly and confirmed it stays exactly as scoped — out of this ADR's design, left for implementation time — not an oversight.
- Adding `tenant_id` as a real foreign key to every existing tenant-scoped table's migration is real, if mechanical, schema-migration work across six existing tables — not free, even though each table's own RLS policy text does not need to change.
- **Added at review, 2026-08-03:** `domain` (§5) is only as safe as its public-email-provider exclusion list, which this ADR does not design — built carelessly or incompletely, it risks incorrectly linking unrelated tenants that happen to share a common free-email domain. It also complicates, without forbidding, a legitimate multi-tenant single-organization case (§5).

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Day-to-day administrator of one tenant | High | View own tenant name, status, and seat counts without a special authorization path |
| Tenant User | End user within a tenant | Medium | Trust that their data is isolated from other tenants |
| Platform Admin | Platform operator | High | Provision, suspend, and license tenants without accessing tenant content |
| Security / Compliance | Risk and audit | High | Auditable Platform Admin writes and fail-closed RLS isolation |
| Engineering | Backend implementation | High | A clear, single source of truth for the `tenants` concept and migration plan |
| New Self-Service User | Prospective first Tenant-Admin | Medium | Be routed to the right organization when signing up from the same email domain |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.8 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or tenant user, I want `GET /v1/tenants/me` to return my own tenant's name, status, and seat counts, so that I can see my own tenant's settin... | `GET /v1/tenants/me` is mounted in `createV1Router()` behind the same `authMiddleware` every other substantive `/v1` route uses (the same pattern Story 5.11 ... |
| Story 5.7 | epic-5-security-isolation-and-messaging.md | As platform operator provisioning or suspending a SocialEngage tenant, I want my actions to run through a database role that can see the tenant registry but ... | A dedicated Postgres role (e.g. `platform_admin_role`) is granted the `BYPASSRLS` attribute and `SELECT`/`INSERT`/`UPDATE` **only** on the `tenants` table an... |
| Story 5.8 | epic-5-security-isolation-and-messaging.md | As Tenant-Admin, I want to see my own tenant's name, status, and seat counts through the same tenant-scoped session I already use for everything else, so tha... | `tenants` has an active RLS policy scoped by `id` (not a separate `tenant_id` column), following ADR-0015's `NULLIF(..., '')`-normalized, fail-closed pattern... |
| Story 5.11 | epic-5-security-isolation-and-messaging.md | As admin UI (or any future authenticated REST caller) that holds a validated bearer token but has no way to know its own resolved tenant/role/Platform-Admin ... | `GET /v1/me` is mounted in `createV1Router()` (`src/http/versions/v1/router.ts`) behind the same `authMiddleware` (`createTenantAuthMiddleware()`) every othe... |
| Story 5.12 | epic-5-security-isolation-and-messaging.md |  | `GET /v1/admin/tenants` lists every tenant (`id`, `name`, `domain`, `status`, `licenseSeatCount`, `activeSeatCount`, `createdAt`) — reachable only through a ... |
| Story 5.17 | epic-5-security-isolation-and-messaging.md | As Tenant-Admin (or Platform Admin, for the break-glass path), I want every change to a user's `access_ends_at` durably recorded — who changed it, when, and ... | `user_access_audit_log` (new table): `id`, `tenant_id`, `user_id`, `changed_by` (the acting user's own `id`), `previous_value` (nullable timestamptz), `new_v... |
| Story 6.6 | epic-7-platform-admin-ui.md |  | Tenant list screen: name, domain, status, seat ceiling/active count, created date (ADR-0031's schema) — reading from a new `GET /v1/admin/tenants`-shaped cor... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 RLS pattern and `withTenant()` session mechanism | Internal / Architectural | Engineering | Already accepted |
| D-002 | ADR-0030 `platform_admin_role` and `BYPASSRLS` authorization + audit-log requirement | Internal / Architectural | Engineering | Already accepted |
| D-003 | ADR-0037 self-service sign-up and `UPDATE (domain)` grant | Internal / Architectural | Engineering | Already accepted |
| D-004 | ADR-0032 `users` table shape, status values, and RLS policy | Internal / Architectural | Engineering | Already accepted |
| D-005 | PostgreSQL engine and migration infrastructure (ADR-0016) | Internal / Technical | Engineering | Already in place |
| D-006 | Related user stories: 1.8, 5.7, 5.8, 5.12, 5.15, 6.7, 3.8 | Internal / Delivery | Product Owner | Ready / built (see Appendix C) |

---

- The existing ADR-0015 RLS pattern and `withTenant()` session abstraction remain in place.
- ADR-0030 is accepted, providing the `platform_admin_role` with `BYPASSRLS` and an audit-log requirement.
- ADR-0037 is accepted, extending `platform_admin_role` to also update `tenants.domain`.
- PostgreSQL remains the database engine (ADR-0016).

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | RLS on `tenants` is fail-closed: an unset or empty `app.tenant_id` returns zero rows | Security | Must | Verified by contract test with `app.tenant_id = ''` |
| NFR-002 | `platform_admin_role` has no grants on tenant-content tables (`users`, `watchlists`, `social_posts`, `platform_credentials`) | Security | Must | Verified by `aclcheck` or equivalent query in contract tests |
| NFR-003 | Seat-count enforcement is deterministic under non-concurrent load | Reliability | Must | Contract suite passes with sequential invites and removals |
| NFR-004 | The seat-count race condition under concurrent invites is documented and tracked until closed | Reliability | Should | Open risk recorded; implementation selects a locking strategy (e.g., `SELECT ... FOR UPDATE`) before shipping |
| NFR-005 | All schema migrations are plain SQL, consistent with existing migration conventions | Maintainability | Must | No ORM or query-builder artifacts introduced |

---

## 11. Error Handling and Exceptions
**Positive**
- Gives every existing `tenant_id`-bearing table (`social_posts`, `authors`, `ingestion_runs`, `platform_credentials`, `watchlists`, `author_topic_signals`) a real referent for the first time — `tenant_id uuid` can now be a genuine foreign key to `tenants.id`, not a bare convention.
- Reuses ADR-0015's exact RLS pattern with no new mechanism, and ADR-0030's exact bypass mechanism with no new mechanism — this ADR introduces one new table, not one new kind of enforcement.
- Concretely resolves what "Platform Admin... zero tenant-data access" means at the column level, not just as a documented intention.
- **Added at review, 2026-08-03:** `domain` (§5) gives future sign-ups a real chance to be recognized as belonging to an already-onboarded organization, rather than every sign-up necessarily producing a new, disconnected tenant.

**Negative**
- The seat-count race condition (§3) is a real, currently-unresolved correctness gap, not a hypothetical one — flagged for whoever implements this table's story to close before or during that implementation, not silently assumed away. **Confirmed at review, 2026-08-03:** Menno reviewed this gap directly and confirmed it stays exactly as scoped — out of this ADR's design, left for implementation time — not an oversight.
- Adding `tenant_id` as a real foreign key to every existing tenant-scoped table's migration is real, if mechanical, schema-migration work across six existing tables — not free, even though each table's own RLS policy text does not need to change.
- **Added at review, 2026-08-03:** `domain` (§5) is only as safe as its public-email-provider exclusion list, which this ADR does not design — built carelessly or incompletely, it risks incorrectly linking unrelated tenants that happen to share a common free-email domain. It also complicates, without forbidding, a legitimate multi-tenant single-organization case (§5).

## 12. Assumptions and Dependencies
- The existing ADR-0015 RLS pattern and `withTenant()` session abstraction remain in place.
- ADR-0030 is accepted, providing the `platform_admin_role` with `BYPASSRLS` and an audit-log requirement.
- ADR-0037 is accepted, extending `platform_admin_role` to also update `tenants.domain`.
- PostgreSQL remains the database engine (ADR-0016).

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Concurrent invites read a stale `active_seat_count` and exceed the license ceiling | Medium | High | Select a locking/atomic update strategy at implementation time (e.g., `SELECT ... FOR UPDATE` or conditional `UPDATE ... RETURNING`); do not ship without resolving this | Engineering |
| R-002 | Public/free email providers (gmail.com, outlook.com, etc.) are captured as `domain`, causing unrelated tenants to be linked | Medium | High | Maintain a static denylist or heuristic (decided in ADR-0037); validate `domain` before saving | Engineering |
| R-003 | A single legitimate organization wants multiple separate tenants under one corporate domain | Low | Medium | Document as known limitation; support future override via Platform Admin or dedicated multi-tenant flag | Product Owner |
| R-004 | Migrating six existing tables to add a real foreign key to `tenants.id` is mechanical but error-prone | Medium | Medium | Run a single migration batch, verify with full contract suite, preserve existing RLS policy text | Engineering |
| R-005 | Audit-log schema is not fully specified, leaving a compliance gap until ADR-0030 §5 closes | Low | High | Track as dependency; do not ship `platform_admin_role` writes without a durable, queryable audit log | Engineering / Security |

---

## 14. Appendix
- ADR: `../../adr/0031-tenants-table-shape.md`
- BRD: `../Business-Requirements/BRD-0031-Tenants-Table-Shape.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above