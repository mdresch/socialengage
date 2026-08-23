# Business Requirements Document: Watchlist API Design and Database Schema Standardization

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document: Watchlist API Design and Database Schema Standardization |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0044-watchlist-api-design-and-database-schema-standardization.md, ../Business-Requirements/BRD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0044-watchlist-api-design-and-database-schema-standardization.md and the business requirements in BRD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md into functional design for **Watchlist API Design And Database Schema Standardization**.
This BRD formalizes the business requirements for the watchlist CRUD REST surface and the supporting database schema conventions introduced by ADR-0044. Watchlists are the primary, reusable filters that tenant users create to define what social content they want to monitor. Before this decision, the project had no standardized partial-update contract, no explicit HTTP error mapping for RLS and role-check failures, and no project-wide policy for maintaining `updated_at` on mutable tenant-scoped tables. The result was a growing risk that each new endpoint would invent its own semantics and that concurrent updates would silently overwrite each other.

ADR-0044 resolves these gaps by introducing RFC 7396 JSON Merge Patch, a clear 403/404 split, optimistic locking via a `version` column, and a trigger-maintained `updated_at` policy. It also confirms that watchlists are personal, per-user resources: both `tenant_admin` and `tenant_user` can create them, and neither can see another user's watchlists. This preserves user privacy, makes the API predictable for the admin UI, and keeps the watchlist row shape consistent with the Boolean-query AST model already decided in ADR-0021.

The expected business value is lower support burden, fewer concurrency-related data-loss incidents, a clearer debugging signal for administrators, and a stable foundation for future watchlist-driven features such as the Boolean query builder, volume preview, and analytics dashboards.

---

### 2.2 Scope
**In scope:**
- Standardized RFC 7396 JSON Merge Patch semantics for all `/v1` PATCH endpoints, with `watchlists` as the first consumer
- Explicit HTTP error-code mapping for `watchlists` and, by reference, all other mutable `/v1` resources
- Optimistic locking via a required `version` column and `If-Match` header on the `watchlists` PATCH endpoint
- A database-level `updated_at` policy: trigger-maintained for mutable tenant-scoped tables, with an explicit exempt list
- Reconciliation of the `watchlists` row shape with ADR-0021's Boolean-query AST, including `matchType`/`terms`/`booleanQuery` validation invariants
- RLS-enforced per-user ownership of `watchlists`: both `tenant_admin` and `tenant_user` may create, but neither can access another user's rows
- The `app.user_id` session-predicate propagation needed to enforce the new ownership predicate

**Out of scope:**
- Watchlist *matching* behavior (covered by ADR-0006 and ADR-0021)
- Tenant-identity propagation (covered by ADR-0032, ADR-0033)
- Per-user watchlist count or complexity quotas (deliberately left open pending usage data)
- A dedicated tenant-content mutation audit table (deferred; `version` + `updated_at` are the current change-tracking mechanism)
- The watchlist volume-preview feature (future `docs/product-research/feature-designs/26-watchlist-volume-preview.md` work)

## 3. Context and Background
Story 1.5 introduces tenant-scoped watchlists. Three concrete questions remain unanswered after ADR-0006 (connector-side vs post-fetch matching) and ADR-0021 (boolean-query AST + per-connector capability matrix) — and a fourth, ADR-0021's own §Open-Questions ("where does `supportedQueryFeatures` surface"), which this ADR explicitly defers to ADR-0021's own accepted answer (connector status page + watchlist-detail-view badge).

The four questions this ADR decides:

1. **PATCH semantics** — every prior `/v1` endpoint in this codebase (verified directly against `social-listening-core/src/http/versions/v1/watchlistsRouter.ts` and the rest of the v1 router family) uses PUT or POST; nothing has yet decided what PATCH means. ADR-0017's compatibility policy is silent on the wire shape of partial updates. A standardized PATCH contract is needed before more than one endpoint needs one, otherwise divergent per-endpoint shapes lock in.
2. **Error-code mapping** — ADR-0015 makes tenant isolation a database-enforced invariant. The application layer still has to *translate* RLS denials and "not your row" results into HTTP codes without leaking tenant existence (ADR-0006 §Consequences already notes the tenant-existence-leak concern indirectly via the capability-matrix surfacing). ADR-0030 §1 says Tenant-Admin authorization failures are an *application-layer role check*, not a tenant boundary — so 403 vs 404 cannot be collapsed into one rule.
3. **`updated_at` policy** — every mutable tenant-scoped table in this project already has an `updated_at` column (verified in `migrations/0002`–`migrations/0021`), but nothing in the ADR series decides whether it's application-set or trigger-set, or which tables are exempt. `IngestionRun` (ADR-0005) must be exempt — it is the immutable acquisition/audit anchor and may not have its `updated_at` rewritten by a `before update` trigger.
4. **Reconciliation with ADR-0021** — ADR-0021 is the durable decision for watchlist *matching*. A watchlist row needs a `filters` shape that is consistent with (not in conflict with) the AST/capability-matrix model, not an alternative matching model in JSONB.

This ADR does **not** decide, re-decide, or constrain:

- Watchlist *matching* semantics — ADR-0006 and ADR-0021 are the durable decisions for that; this ADR cross-references them and stays out of their way.
- Tenant identity propagation — ADR-0015 (RLS), ADR-0033 (`X-Tenant-Id` retirement) are the durable decisions.
- Watchlist creation authorization (who can create one) — deferred to whichever story implements `users.role = 'tenant_admin'`'s actual authorization boundary on `/v1/watchlists`; per ADR-0030 §1, it is an application-layer role check against `users.role`, not a database mechanism. Named as an Open Question below rather than invented here.
- `activity_logs` vs `platform_admin_audit_log` naming — out of scope; the prior draft of this ADR introduced a new audit table name without realizing ADR-0030 §5 / ADR-0031 §27 / ADR-0037 §125 had already converged on `platform_admin_audit_log`. Removed in this revision; cross-referenced instead.
This BRD formalizes the business requirements for the watchlist CRUD REST surface and the supporting database schema conventions introduced by ADR-0044. Watchlists are the primary, reusable filters that tenant users create to define what social content they want to monitor. Before this decision, the project had no standardized partial-update contract, no explicit HTTP error mapping for RLS and role-check failures, and no project-wide policy for maintaining `updated_at` on mutable tenant-scoped tables. The result was a growing risk that each new endpoint would invent its own semantics and that concurrent updates would silently overwrite each other.

ADR-0044 resolves these gaps by introducing RFC 7396 JSON Merge Patch, a clear 403/404 split, optimistic locking via a `version` column, and a trigger-maintained `updated_at` policy. It also confirms that watchlists are personal, per-user resources: both `tenant_admin` and `tenant_user` can create them, and neither can see another user's watchlists. This preserves user privacy, makes the API predictable for the admin UI, and keeps the watchlist row shape consistent with the Boolean-query AST model already decided in ADR-0021.

The expected business value is lower support burden, fewer concurrency-related data-loss incidents, a clearer debugging signal for administrators, and a stable foundation for future watchlist-driven features such as the Boolean query builder, volume preview, and analytics dashboards.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a consistent, safe watchlist editing experience for all tenant users | All watchlist create/read/update/delete operations pass contract tests for RFC 7396 PATCH, `If-Match` locking, and the defined error mapping |
| 2 | Prevent silent overwrites when multiple users or sessions edit watchlists | PATCH requests return `409` on stale `If-Match`; no lost-update bugs reported |
| 3 | Protect personal watchlist data from other users, including Tenant-Admins | Penetration/contract tests confirm same-tenant and cross-tenant access both return `404` and never expose another user's watchlist |
| 4 | Establish durable, project-wide conventions for partial updates and error codes | New mutable `/v1` resources reuse the same PATCH, locking, and `updated_at` patterns without per-endpoint divergence |
| 5 | Keep the watchlist data model aligned with the Boolean-query AST | No contradictory or duplicate filter-storage models are introduced; `matchType`/`terms`/`booleanQuery` invariants are enforced |

---

**Positive consequences (from ADR):**
**Positive**

- PATCH semantics, error mapping, optimistic locking, and `updated_at` policy are now durable, project-wide rules with one canonical answer each — eliminating the per-endpoint divergence risk that would otherwise lock in as more resources become mutable.
- The watchlist row shape is reconciled with ADR-0021's AST model rather than silently introducing an alternative matching model — no future connector author has to choose between two contradictory "what does a watchlist look like" sources.
- §4's exempt-list discipline (`IngestionRun`, `platform_admin_audit_log`, anything else named append-only) keeps the "trigger-set `updated_at`" rule from quietly violating ADR-0005's immutability invariant.
- §2's explicit 403-vs-404 split preserves the signal that distinguishes "you can't see this row at all" (404) from "you can see this row but you can't do this action" (403) — a distinction Tenant-Admin needs for debugging, and that ADR-0030 §1 already implies must exist.

**Negative**

- §1's RFC 7396 decision is a project-wide commitment; any future endpoint that would benefit from RFC 6902 (JSON Patch, targeted array-element updates) needs a deliberate exception logged in its own story, not silent divergence.
- §3's `version` column requires every client of a versioned PATCH to implement `If-Match` handling — a real, small client-side cost in exchange for the lost-update prevention.
- §4's trigger-maintained `updated_at` is a Postgres-level decision; any future read-replica or async-replication setup must propagate trigger executions correctly (true of all triggers, not new here, but named for completeness).

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| FR-001 | The system shall allow an authenticated tenant user or Tenant-Admin to create a watchlist via `POST /v1/watchlists` | Must | Server sets `user_id` from caller identity; response includes `version: 1`; `201` returned on success | Backend Engineer |
| FR-002 | The system shall list the caller's own watchlists via `GET /v1/watchlists`, optionally filtered by `matchType` | Must | Response contains only caller-owned rows; `?matchType=<type>` filters correctly | Backend Engineer |
| FR-003 | The system shall return a single watchlist via `GET /v1/watchlists/:id` | Must | Returns `200` for own watchlist; `404` for any other user's watchlist or cross-tenant row | Backend Engineer |
| FR-004 | The system shall update a watchlist via `PATCH /v1/watchlists/:id` using RFC 7396 JSON Merge Patch | Must | Omitted fields unchanged; `null` deletes nullable fields; arrays replaced in full; `200` returns current `version` | Backend Engineer |
| FR-005 | The system shall require an `If-Match: "<version>"` header for watchlist PATCH | Must | Missing header returns `428`; stale version returns `409` with `current_version`; matching version succeeds and increments `version` | Backend Engineer |
| FR-006 | The system shall delete the caller's own watchlist via `DELETE /v1/watchlists/:id` | Must | Returns `204` on success; `404` for non-owned or missing rows | Backend Engineer |
| FR-007 | The system shall enforce the `matchType`/`terms`/`booleanQuery` row-shape invariant on create and relevant PATCH | Must | `boolean` requires `booleanQuery` with `terms` null; `keyword`/`hashtag`/`account` require `terms` array with `booleanQuery` null; violations return `422` | Backend Engineer |
| FR-008 | The system shall propagate `app.user_id` session predicate for the `watchlists` RLS policy | Must | `withTenant`-style helper sets `app.user_id` transaction-locally alongside `app.tenant_id` | Backend Engineer |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User | Primary end user who creates personal watchlists | High | Simple, private watchlist CRUD; clear error feedback; no lost updates |
| Tenant-Admin | Creates own watchlists; manages tenant-wide connectors | High | Reliable API for admin UI; debugging signal when role/tenant checks fail |
| Platform Admin | Has no path to `watchlists` per ADR-0030 §2 | Low | Continued assurance of no bypass to tenant-content rows |
| Backend Engineer | Implements and maintains the API and RLS policies | High | Clear, reusable contracts and database conventions |
| Frontend / Admin UI Developer | Consumes the watchlist endpoints | High | Predictable PATCH semantics, explicit status codes, and `If-Match` flow |
| Product Owner / Menno | Sponsor and approver | High | A stable, privacy-preserving foundation for watchlist features |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.5 | epic-1-repository-and-api-foundation.md | As tenant user or Tenant-Admin, I want to create, read, update, and delete my own watchlists via REST endpoints, using standardized PATCH semantics, error co... | `social-listening-core/src/http/versions/v1/watchlistsRouter.ts` and `src/http/auth/requireTenantUser.ts` already resolve tenant identity from `req.identity`... |
| Story 6.4 | epic-6-tenant-admin-ui.md | As tenant user or Tenant-Admin, I want to create, view, edit, and delete *my own* watchlists from the admin UI, respecting the same version-checked, ownershi... | Lists all watchlists for the current tenant (`GET /v1/watchlists`, RLS-filtered per Story 1.5), showing name, match type, active state, and scoped platforms.... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `watchlists.id` | UUID primary key, generated default | Database | Backend | System |
| `watchlists.tenant_id` | Tenant to which the watchlist belongs; RLS predicate | `users.tenant_id` / identity resolution | Backend | Tenant-scoped |
| `watchlists.user_id` | Owner of the watchlist; new RLS predicate | Caller identity | Backend | Personal |
| `watchlists.name` | Human-readable watchlist name | User input (via API) | Tenant user | Tenant content |
| `watchlists.match_type` | One of `keyword`, `hashtag`, `account`, `boolean` | User input (via API) | Tenant user | Tenant content |
| `watchlists.terms` | Postgres `text[]` for non-Boolean match types | User input (via API) | Tenant user | Tenant content |
| `watchlists.boolean_query` | Source text parsed by ADR-0021 AST for Boolean match type | User input (via API) | Tenant user | Tenant content |
| `watchlists.version` | Optimistic-locking integer, `not null default 1` | Database / PATCH logic | Backend | System |
| `watchlists.created_at` | Row creation timestamp, default `now()` | Database | Backend | System |
| `watchlists.updated_at` | Trigger-maintained last-modified timestamp | Database trigger | Backend | System |
| `app.user_id` session var | New transaction-local config used by `watchlists` RLS | Identity resolution middleware | Backend | System |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Both `tenant_admin` and `tenant_user` may create watchlists; there is no separate "watchlist-admin" role. |
| BRU-002 | A watchlist is fully private to the `user_id` who created it; no Tenant-Admin or Platform Admin can view or modify another user's watchlist. |
| BRU-003 | For `matchType = 'boolean'`, `booleanQuery` is required and `terms` must be null; for `matchType` in `{'keyword','hashtag','account'}`, `terms` is required and `booleanQuery` must be null. |
| BRU-004 | In a PATCH body, `null` deletes a nullable field, omitted fields are left unchanged, and arrays are replaced in full. |
| BRU-005 | A PATCH on a versioned resource must include the observed `version` in an `If-Match` header; a stale version returns `409`, a missing header returns `428`. |
| BRU-006 | A request for a watchlist the caller cannot see (missing, cross-tenant, or another user's) always returns `404`; a `403` is only used for application-layer role-check failures on Tenant-Admin-only actions. |
| BRU-007 | Mutable tenant-scoped tables have `updated_at` maintained by a `before update` trigger; `IngestionRun` and `platform_admin_audit_log` are explicitly exempt. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 (RLS tenant isolation already decided) | Architecture | Menno | Accepted |
| D-002 | ADR-0017 (`/v1` versioning and compatibility policy) | Architecture | Menno | Accepted |
| D-003 | ADR-0021 (Boolean-query AST and capability matrix) | Architecture | Menno | Accepted |
| D-004 | ADR-0030 (role-check vs tenant boundary) | Architecture | Menno | Accepted |
| D-005 | ADR-0032 (identity resolution to `(tenantId, userId, role)`) | Architecture | Menno | Accepted |
| D-006 | ADR-0033 (`Authorization: Bearer` and `X-Tenant-Id` retirement) | Architecture | Menno | Accepted |
| D-007 | Story 1.5 (watchlist CRUD REST surface implementation) | Implementation | Backend Engineer | Built 2026-08-12 |
| D-008 | `docs/product-research/feature-designs/02-boolean-query-builder.md` (related watchlist/query-builder design) | Reference | Product Owner | High-level |
| D-009 | `docs/product-research/feature-designs/26-watchlist-volume-preview.md` (future related feature) | Reference | Product Owner | High-level |

---

- Identity resolution already produces `(tenantId, userId, role)` on every authenticated request (ADR-0032, ADR-0033)
- The `watchlists` table already exists (migration `0014_create_watchlists.sql`) and is extended additively
- All clients of the watchlist API are expected to read `version` before PATCHing and to handle `409`/`428` responses

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All `/v1` PATCH endpoints follow RFC 7396, not RFC 6902, unless explicitly excepted | Maintainability | Must | Code review and contract tests confirm no JSON Patch operations in v1 |
| NFR-002 | Optimistic locking is present on `watchlists` and on any future resource where concurrent PATCH could lose updates | Reliability | Must | `version` column and `If-Match` handling are tested for every versioned resource |
| NFR-003 | Error mapping follows the explicit cause-based table from ADR-0044 §2 | Usability | Must | Contract tests cover 400, 403, 404, 409, 422, 428, and 429 shapes |
| NFR-004 | `updated_at` on mutable tenant-scoped tables is trigger-maintained, not application-set | Maintainability | Must | Migration defines `update_updated_at_column()` trigger; no application `SET updated_at` clauses exist |
| NFR-005 | `watchlists` RLS enforces both tenant and user predicates at the database layer | Security | Must | Penetration tests confirm no cross-tenant or cross-user access, including for `tenant_admin` |

---

## 11. Error Handling and Exceptions
**Positive**

- PATCH semantics, error mapping, optimistic locking, and `updated_at` policy are now durable, project-wide rules with one canonical answer each — eliminating the per-endpoint divergence risk that would otherwise lock in as more resources become mutable.
- The watchlist row shape is reconciled with ADR-0021's AST model rather than silently introducing an alternative matching model — no future connector author has to choose between two contradictory "what does a watchlist look like" sources.
- §4's exempt-list discipline (`IngestionRun`, `platform_admin_audit_log`, anything else named append-only) keeps the "trigger-set `updated_at`" rule from quietly violating ADR-0005's immutability invariant.
- §2's explicit 403-vs-404 split preserves the signal that distinguishes "you can't see this row at all" (404) from "you can see this row but you can't do this action" (403) — a distinction Tenant-Admin needs for debugging, and that ADR-0030 §1 already implies must exist.

**Negative**

- §1's RFC 7396 decision is a project-wide commitment; any future endpoint that would benefit from RFC 6902 (JSON Patch, targeted array-element updates) needs a deliberate exception logged in its own story, not silent divergence.
- §3's `version` column requires every client of a versioned PATCH to implement `If-Match` handling — a real, small client-side cost in exchange for the lost-update prevention.
- §4's trigger-maintained `updated_at` is a Postgres-level decision; any future read-replica or async-replication setup must propagate trigger executions correctly (true of all triggers, not new here, but named for completeness).

## 12. Assumptions and Dependencies
- Identity resolution already produces `(tenantId, userId, role)` on every authenticated request (ADR-0032, ADR-0033)
- The `watchlists` table already exists (migration `0014_create_watchlists.sql`) and is extended additively
- All clients of the watchlist API are expected to read `version` before PATCHing and to handle `409`/`428` responses

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | RFC 7396 lock-in later prevents an endpoint from expressing targeted array-element updates | Low | Medium | Document a rule-of-three exception path in the relevant story/ADR if a third resource genuinely needs RFC 6902 | Product Owner |
| R-002 | Clients fail to implement `If-Match`, producing a poor update experience | Medium | Medium | Return explicit `428` and document the pattern in the admin UI and any SDKs; UI pre-fetches before PATCH | Frontend Lead |
| R-003 | A future read-replica or replication setup does not propagate `updated_at` trigger executions correctly | Low | Medium | Test trigger semantics in any replication topology before promotion; document the dependency in infrastructure runbooks | Backend Engineer |
| R-004 | No per-user watchlist cap allows one user to consume a disproportionate share of the per-tenant connector quota | Medium | Medium | Monitor per-user watchlist counts and query complexity; revisit a cap once real usage data exists (ADR-0044 Open Question) | Product Owner |
| R-005 | Error-code mapping is applied inconsistently on new endpoints | Medium | High | Add the ADR-0044 Appendix B checklist to PR templates and enforce it in code review | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0044-watchlist-api-design-and-database-schema-standardization.md`
- BRD: `../Business-Requirements/BRD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md`
- Feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md``
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md``
- Feature design: `docs/product-research/feature-designs/02-boolean-query-builder.md`
- Feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above