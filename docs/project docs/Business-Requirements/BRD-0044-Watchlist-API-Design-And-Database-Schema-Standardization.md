# Business Requirements Document: Watchlist API Design and Database Schema Standardization

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0044 – Watchlist API Design and Database Schema Standardization |
| Version | 1.0 |
| Date | 2026-08-11 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-11 | BRD Writer Agent | Initial BRD derived from accepted ADR-0044 and Story 1.5 |

---

## 2. Executive Summary

This BRD formalizes the business requirements for the watchlist CRUD REST surface and the supporting database schema conventions introduced by ADR-0044. Watchlists are the primary, reusable filters that tenant users create to define what social content they want to monitor. Before this decision, the project had no standardized partial-update contract, no explicit HTTP error mapping for RLS and role-check failures, and no project-wide policy for maintaining `updated_at` on mutable tenant-scoped tables. The result was a growing risk that each new endpoint would invent its own semantics and that concurrent updates would silently overwrite each other.

ADR-0044 resolves these gaps by introducing RFC 7396 JSON Merge Patch, a clear 403/404 split, optimistic locking via a `version` column, and a trigger-maintained `updated_at` policy. It also confirms that watchlists are personal, per-user resources: both `tenant_admin` and `tenant_user` can create them, and neither can see another user's watchlists. This preserves user privacy, makes the API predictable for the admin UI, and keeps the watchlist row shape consistent with the Boolean-query AST model already decided in ADR-0021.

The expected business value is lower support burden, fewer concurrency-related data-loss incidents, a clearer debugging signal for administrators, and a stable foundation for future watchlist-driven features such as the Boolean query builder, volume preview, and analytics dashboards.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a consistent, safe watchlist editing experience for all tenant users | All watchlist create/read/update/delete operations pass contract tests for RFC 7396 PATCH, `If-Match` locking, and the defined error mapping |
| 2 | Prevent silent overwrites when multiple users or sessions edit watchlists | PATCH requests return `409` on stale `If-Match`; no lost-update bugs reported |
| 3 | Protect personal watchlist data from other users, including Tenant-Admins | Penetration/contract tests confirm same-tenant and cross-tenant access both return `404` and never expose another user's watchlist |
| 4 | Establish durable, project-wide conventions for partial updates and error codes | New mutable `/v1` resources reuse the same PATCH, locking, and `updated_at` patterns without per-endpoint divergence |
| 5 | Keep the watchlist data model aligned with the Boolean-query AST | No contradictory or duplicate filter-storage models are introduced; `matchType`/`terms`/`booleanQuery` invariants are enforced |

---

## 4. Scope

### 4.1 In Scope

- Standardized RFC 7396 JSON Merge Patch semantics for all `/v1` PATCH endpoints, with `watchlists` as the first consumer
- Explicit HTTP error-code mapping for `watchlists` and, by reference, all other mutable `/v1` resources
- Optimistic locking via a required `version` column and `If-Match` header on the `watchlists` PATCH endpoint
- A database-level `updated_at` policy: trigger-maintained for mutable tenant-scoped tables, with an explicit exempt list
- Reconciliation of the `watchlists` row shape with ADR-0021's Boolean-query AST, including `matchType`/`terms`/`booleanQuery` validation invariants
- RLS-enforced per-user ownership of `watchlists`: both `tenant_admin` and `tenant_user` may create, but neither can access another user's rows
- The `app.user_id` session-predicate propagation needed to enforce the new ownership predicate

### 4.2 Out of Scope

- Watchlist *matching* behavior (covered by ADR-0006 and ADR-0021)
- Tenant-identity propagation (covered by ADR-0032, ADR-0033)
- Per-user watchlist count or complexity quotas (deliberately left open pending usage data)
- A dedicated tenant-content mutation audit table (deferred; `version` + `updated_at` are the current change-tracking mechanism)
- The watchlist volume-preview feature (future `docs/product-research/feature-designs/26-watchlist-volume-preview.md` work)

### 4.3 Assumptions

- Identity resolution already produces `(tenantId, userId, role)` on every authenticated request (ADR-0032, ADR-0033)
- The `watchlists` table already exists (migration `0014_create_watchlists.sql`) and is extended additively
- All clients of the watchlist API are expected to read `version` before PATCHing and to handle `409`/`428` responses

### 4.4 Constraints

- The project is committed to RFC 7396 for v1 PATCH; any future need for RFC 6902 JSON Patch must be explicitly excepted
- `updated_at` must be trigger-maintained; application-set timestamps are not allowed for mutable tenant-scoped tables
- Per-user ownership is enforced at the database layer, not solely in route handlers

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User | Primary end user who creates personal watchlists | High | Simple, private watchlist CRUD; clear error feedback; no lost updates |
| Tenant-Admin | Creates own watchlists; manages tenant-wide connectors | High | Reliable API for admin UI; debugging signal when role/tenant checks fail |
| Platform Admin | Has no path to `watchlists` per ADR-0030 §2 | Low | Continued assurance of no bypass to tenant-content rows |
| Backend Engineer | Implements and maintains the API and RLS policies | High | Clear, reusable contracts and database conventions |
| Frontend / Admin UI Developer | Consumes the watchlist endpoints | High | Predictable PATCH semantics, explicit status codes, and `If-Match` flow |
| Product Owner / Menno | Sponsor and approver | High | A stable, privacy-preserving foundation for watchlist features |

---

## 6. Current State (As-Is)

Watchlists already exist in `social-listening-core`, but the underlying CRUD contract is incomplete. Before ADR-0044 the code had no `GET /v1/watchlists/:id` route, no `version` column, no `user_id` column, and no explicit PATCH contract. The prior contract test did not assert RFC 7396 semantics, `If-Match` locking, 422/409/428 handling, or the per-user ownership boundary. As a result:

- Concurrent PATCHes could overwrite each other without warning.
- Error responses for cross-tenant, missing, and unauthorized access were not differentiated.
- The `updated_at` policy was inherited from existing migrations but not explicitly standardized across all mutable tenant-scoped tables.
- The relationship between the stored `watchlists` filters and the ADR-0021 AST model was not explicitly defined, risking a second, contradictory source of truth.

---

## 7. Future State (To-Be)

After ADR-0044 and Story 1.5 are implemented, the watchlist API behaves as follows:

1. The caller is authenticated; `req.identity` provides `tenantId`, `userId`, and `role`.
2. `POST /v1/watchlists` creates a watchlist whose `user_id` is set by the server to the caller's own identity.
3. `GET /v1/watchlists` and `GET /v1/watchlists/:id` return only the caller's own watchlists; another user's watchlist, even in the same tenant, returns `404`.
4. `PATCH /v1/watchlists/:id` requires an `If-Match` header containing the current `version`. The body follows RFC 7396: omitted fields are unchanged, `null` deletes nullable fields, and arrays are replaced in full.
5. The application maps each failure cause to a specific HTTP status code (`400`, `403`, `404`, `409`, `422`, `428`) with a consistent body shape.
6. `updated_at` on the `watchlists` row is maintained by the existing `update_updated_at_column()` trigger; the `version` is incremented by the application on successful PATCH.
7. The `matchType`/`terms`/`booleanQuery` invariant is validated on create and on any PATCH that touches those fields, returning `422` on violation.
8. These same conventions become the default for every future mutable `/v1` resource.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All `/v1` PATCH endpoints follow RFC 7396, not RFC 6902, unless explicitly excepted | Maintainability | Must | Code review and contract tests confirm no JSON Patch operations in v1 |
| NFR-002 | Optimistic locking is present on `watchlists` and on any future resource where concurrent PATCH could lose updates | Reliability | Must | `version` column and `If-Match` handling are tested for every versioned resource |
| NFR-003 | Error mapping follows the explicit cause-based table from ADR-0044 §2 | Usability | Must | Contract tests cover 400, 403, 404, 409, 422, 428, and 429 shapes |
| NFR-004 | `updated_at` on mutable tenant-scoped tables is trigger-maintained, not application-set | Maintainability | Must | Migration defines `update_updated_at_column()` trigger; no application `SET updated_at` clauses exist |
| NFR-005 | `watchlists` RLS enforces both tenant and user predicates at the database layer | Security | Must | Penetration tests confirm no cross-tenant or cross-user access, including for `tenant_admin` |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Watchlist count per user and per tenant | Track adoption and quota sizing | Product Owner | Weekly |
| PATCH `409` version-conflict rate | Detect concurrency hot spots and UI retry quality | Backend Engineer / Product | Daily |
| Watchlist distribution by `matchType` | Inform connector and query-builder prioritization | Product Owner | Monthly |
| API error-code distribution for watchlist endpoints | Validate that error mapping is clear and not abused | Backend Engineer | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | RFC 7396 lock-in later prevents an endpoint from expressing targeted array-element updates | Low | Medium | Document a rule-of-three exception path in the relevant story/ADR if a third resource genuinely needs RFC 6902 | Product Owner |
| R-002 | Clients fail to implement `If-Match`, producing a poor update experience | Medium | Medium | Return explicit `428` and document the pattern in the admin UI and any SDKs; UI pre-fetches before PATCH | Frontend Lead |
| R-003 | A future read-replica or replication setup does not propagate `updated_at` trigger executions correctly | Low | Medium | Test trigger semantics in any replication topology before promotion; document the dependency in infrastructure runbooks | Backend Engineer |
| R-004 | No per-user watchlist cap allows one user to consume a disproportionate share of the per-tenant connector quota | Medium | Medium | Monitor per-user watchlist counts and query complexity; revisit a cap once real usage data exists (ADR-0044 Open Question) | Product Owner |
| R-005 | Error-code mapping is applied inconsistently on new endpoints | Medium | High | Add the ADR-0044 Appendix B checklist to PR templates and enforce it in code review | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- Watchlist create, list, get, PATCH, and delete endpoints are reachable under `/v1/watchlists` and enforce caller-owned, RLS-filtered results.
- `PATCH /v1/watchlists/:id` follows RFC 7396: omitted fields unchanged, `null` deletes nullable fields, arrays replaced in full.
- `PATCH` requires `If-Match`; stale `version` returns `409` with `current_version`, missing header returns `428`.
- Cross-tenant, missing, and another same-tenant user's watchlist all return `404` with `code: "not_found"`; `403` is reserved for explicit Tenant-Admin role-check failures elsewhere.
- `matchType`/`terms`/`booleanQuery` validation returns `422` with `code: "validation_failed"` and details.
- `watchlists` table includes `version` and `user_id`; `updated_at` is maintained by the `update_updated_at_column()` trigger.
- `app.user_id` is set transaction-locally and used by the `watchlists` RLS policy alongside `app.tenant_id`.
- Both `tenant_admin` and `tenant_user` can create watchlists; neither can access another user's watchlist.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Watchlist** | A user-defined, persisted filter that determines which posts a user wants to monitor. |
| **RFC 7396 (JSON Merge Patch)** | A lightweight JSON partial-update format where `null` deletes keys, omitted keys are unchanged, and arrays are replaced wholesale. |
| **If-Match** | An HTTP request header used to carry the `version` observed by the client so the server can detect concurrent modification. |
| **Optimistic locking** | A concurrency-control strategy that detects conflicts by comparing a version value at update time rather than holding a database lock. |
| **RLS (Row-Level Security)** | Postgres feature that filters rows automatically based on session-level predicates. |
| **Tenant-scoped** | Data that belongs to one tenant and is invisible to other tenants. |
| **Per-user ownership** | A stronger boundary than tenant-scoped: each row belongs to an individual user and is invisible to other users, including Tenant-Admins. |
| **Match type** | The watchlist query category: `keyword`, `hashtag`, `account`, or `boolean`. |
| **Boolean query AST** | The abstract syntax tree used to evaluate Boolean watchlists, as decided in ADR-0021. |
| **`updated_at` trigger** | A `before update` Postgres trigger that sets `updated_at` to `now()` on every row update, independent of application code. |

---

## 16. Appendices

- **ADR-0044:** `docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md` — source architecture decision.
- **Story 1.5:** `docs/user-stories/epic-1-repository-and-api-foundation.md` — implementation user story for the watchlist CRUD surface.
- **Feature design (related):** `docs/product-research/feature-designs/02-boolean-query-builder.md` — watchlist query-builder concepts that consume this API contract.
- **Feature design (future):** `docs/product-research/feature-designs/26-watchlist-volume-preview.md` — volume-preview feature that builds on the watchlist API.
- **Note:** No `docs/product-research/reports/<feature>-deep-research.md` file was found specifically for this ADR or feature.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
