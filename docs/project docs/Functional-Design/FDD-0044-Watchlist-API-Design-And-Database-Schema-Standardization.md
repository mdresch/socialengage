# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0044 Watchlist API Design and Database Schema Standardization — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Sponsor / Technical Lead) |
| Status | Approved (ADR-0044 Accepted 2026-08-11; built via Story 1.5) |
| Related Documents | ADR-0044, BRD-0044, ADR-0006, ADR-0015, ADR-0017, ADR-0021, ADR-0030, ADR-0032, ADR-0033, Story 1.5 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0044's architecture decision and BRD-0044's business requirements into the functional design of the watchlist CRUD REST surface and the project-wide database/API conventions it establishes: RFC 7396 JSON Merge Patch semantics, explicit cause-based HTTP error mapping, optimistic locking via a `version` column, a trigger-maintained `updated_at` policy, and per-user (not just per-tenant) RLS-enforced ownership of watchlists. Story 1.5 (built 2026-08-12) implements this design; this FDD documents the shipped functional behavior for traceability and future maintenance.

### 2.2 Scope

- **In scope:** `POST/GET/PATCH/DELETE /v1/watchlists[/:id]`; RFC 7396 PATCH semantics (project-wide, first applied here); the `version`/`If-Match` optimistic-locking mechanism; the full cause-based HTTP error mapping (400/403/404/409/422/428/429); the `updated_at` trigger policy and its explicit exempt list; the `watchlists` row shape reconciled with ADR-0021's boolean-query AST; RLS-enforced per-user ownership via a new `app.user_id` session predicate.
- **Out of scope:** watchlist matching semantics (ADR-0006/ADR-0021, cross-referenced not re-decided); tenant-identity propagation mechanics (ADR-0032/ADR-0033); a per-user watchlist count/complexity cap (explicitly left open pending usage data); a dedicated tenant-mutation audit table (`activity_logs`, deferred); the watchlist volume-preview feature.

### 2.3 Target Audience

Backend engineers building or extending `/v1` mutable resources; frontend engineers consuming the watchlist API and implementing `If-Match`-aware PATCH flows; QA writing contract tests for RLS/ownership/error-mapping behavior; reviewers using Appendix B's PR checklist for any new mutable resource.

---

## 3. Context and Background

Story 1.5 introduced tenant-scoped watchlists but left four questions unanswered by prior ADRs: what PATCH means (no `/v1` endpoint had used PATCH before), how RLS denials and role-check failures map to HTTP codes without leaking tenant existence, whether `updated_at` is application-set or trigger-set, and how the `watchlists` row shape reconciles with ADR-0021's boolean-query AST model. A prior draft of this ADR had introduced a new audit table name (`activity_logs`) and an "always-404" error model without realizing ADR-0030/0031/0037 had already converged on `platform_admin_audit_log`, and without recognizing that Tenant-Admin authorization failures (ADR-0030 §1) are an application-layer role check that must remain distinguishable (403) from a genuine tenant/ownership boundary failure (404). The ADR was revised twice in place before acceptance: once to correct `terms` to `text[]` (matching the already-shipped migration/store code) and the trigger function name to `update_updated_at_column()`, and again to resolve a further Open Question — watchlist creation authorization — by deciding watchlists are personal, per-user resources with no Tenant-Admin oversight override, RLS-enforced via a new `app.user_id` predicate alongside the existing `app.tenant_id` one.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Establish one canonical, project-wide PATCH contract | Every `/v1` PATCH endpoint follows RFC 7396 JSON Merge Patch; no per-endpoint divergence |
| G2 | Distinguish "can't see this row" from "can see it but can't do this" | 404 used for not-found/cross-tenant/cross-user; 403 reserved for Tenant-Admin-only role-check failures |
| G3 | Prevent silent lost updates on concurrent PATCH | `version` + `If-Match` produce a `409` on stale writes, never a silent overwrite |
| G4 | Keep `updated_at` honest regardless of write path | Trigger-maintained on all mutable tenant-scoped tables except the named append-only exempt list |
| G5 | Reconcile the watchlist row shape with the AST matching model | `matchType`/`terms`/`booleanQuery` invariant enforced server-side; no second, contradictory filter-storage model |
| G6 | Make watchlists genuinely private, including from Tenant-Admin | RLS-enforced `user_id` ownership predicate with no oversight bypass for any role |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Watchlist Creation (`POST /v1/watchlists`)

- **Description:** Creates a new, personal watchlist owned by the authenticated caller.
- **Triggers:** Authenticated `tenant_admin` or `tenant_user` submits a create request.
- **Inputs:** `name`, `matchType` (`keyword`|`hashtag`|`account`|`boolean`), and either `terms` (array) or `booleanQuery` (string) per the matching invariant.
- **Processing:** Server sets `tenant_id` and `user_id` from the caller's resolved identity, never from the request body. Validates the `matchType`↔`terms`/`booleanQuery` invariant (§5.5). Initializes `version = 1`.
- **Outputs:** `201 Created` with the new watchlist row including `version: 1`.
- **Error handling:** A request violating the matchType invariant returns `422` with `code: "validation_failed"`; an unparseable body returns `400`.
- **Edge cases:** No role gate on creation — both `tenant_admin` and `tenant_user` may create; there is no "watchlist-admin" role.

### 5.2 Feature / Capability: Watchlist Listing and Retrieval (`GET /v1/watchlists`, `GET /v1/watchlists/:id`)

- **Description:** Returns only the caller's own watchlists, optionally filtered by `matchType`.
- **Triggers:** Authenticated caller issues a list or get request.
- **Inputs:** Optional `?matchType=<type>` query parameter; a watchlist `id` for the single-resource form.
- **Processing:** RLS (§5.6) restricts the visible row set to `tenant_id = caller's tenant AND user_id = caller's user`, transparently — no application-layer ownership filter is needed beyond what RLS already enforces.
- **Outputs:** `200` with the caller-owned row(s).
- **Error handling:** A request for another user's watchlist — whether same tenant or cross-tenant — returns `404` with `code: "not_found"`, identically in both cases (no distinguishing signal that would allow existence enumeration).
- **Edge cases:** A Tenant-Admin requesting another user's watchlist in their own tenant still receives `404` — there is no oversight override, by design (§5.6).

### 5.3 Feature / Capability: Watchlist Partial Update (`PATCH /v1/watchlists/:id`)

- **Description:** Applies a partial update to a watchlist using RFC 7396 JSON Merge Patch semantics, protected by optimistic locking.
- **Triggers:** Authenticated owner submits a PATCH request with an `If-Match` header.
- **Inputs:** A JSON Merge Patch body; an `If-Match: "<version>"` header carrying the client's last-observed version.
- **Processing:** A `null` value in the patch body deletes the targeted nullable key; omitted keys are left unchanged (no "absent = null" inference); arrays are replaced in full, never merged element-wise. The server compares `If-Match`'s version against the row's current `version`; on match, applies the patch, re-validates the `matchType` invariant if any of `matchType`/`terms`/`booleanQuery` changed, and increments `version`. `updated_at` is set by the database trigger, not application code.
- **Outputs:** `200` with the updated row and new `version`.
- **Error handling:** Missing `If-Match` on a resource that requires it (watchlists do) returns `428 Precondition Required`. A stale (mismatched) version returns `409 Conflict` with `code: "version_conflict"` and `current_version`. A patch that violates the matchType invariant returns `422`. A malformed body returns `400`.
- **Edge cases:** Switching `matchType` in one PATCH (e.g., `boolean` → `keyword`) must simultaneously supply the newly-required field and null out the no-longer-valid one in the same request, or the invariant check fails with `422`.

### 5.4 Feature / Capability: Watchlist Deletion (`DELETE /v1/watchlists/:id`)

- **Description:** Deletes the caller's own watchlist.
- **Triggers:** Authenticated owner submits a delete request.
- **Inputs:** Watchlist `id`.
- **Processing:** RLS confines the delete to a row where `tenant_id`/`user_id` match the caller; a non-owned or nonexistent id yields no visible row to delete.
- **Outputs:** `204 No Content` on success.
- **Error handling:** `404` for a non-owned, cross-tenant, or missing row.
- **Edge cases:** None beyond the same ownership boundary applied to read/update.

### 5.5 Feature / Capability: `matchType`/`terms`/`booleanQuery` Row-Shape Invariant

- **Description:** Enforces that a watchlist's stored filter shape matches its declared `matchType`, keeping the row shape consistent with ADR-0021's AST matching model rather than introducing a second, contradictory filter representation.
- **Triggers:** Any create or PATCH that sets or changes `matchType`, `terms`, or `booleanQuery`.
- **Inputs:** The resulting `matchType`, `terms`, `booleanQuery` values after the operation is applied.
- **Processing:** If `matchType = 'boolean'`: `booleanQuery` must be a non-null, non-empty string, and `terms` must be null. If `matchType ∈ {'keyword','hashtag','account'}`: `terms` must be a non-null, non-empty array, and `booleanQuery` must be null. `terms` is a Postgres `text[]`, used for containment matching on non-boolean types; `boolean_query` is source text parsed into an AST at query time by ADR-0021's parser — the two are not alternative representations of the same thing, they apply to disjoint `matchType` values.
- **Outputs:** A validly-shaped row that a downstream matching engine (ADR-0006/ADR-0021) can consume without ambiguity.
- **Error handling:** A violation (both populated, or both absent, for the resulting `matchType`) fails with `422 validation_failed` — never silently coerced or partially applied.
- **Edge cases:** A PATCH that only changes `name` (leaving `matchType`/`terms`/`booleanQuery` untouched) does not re-trigger this validation — RFC 7396's "omitted = unchanged" rule means the existing, already-valid shape is preserved.

### 5.6 Feature / Capability: RLS-Enforced Per-User Ownership

- **Description:** Extends the project's existing tenant-isolation RLS pattern with a second predicate that restricts every `watchlists` row to its creating user — the first table in the project where RLS enforces ownership, not just tenant membership.
- **Triggers:** Every read/write against `watchlists`, at the database layer, for every caller regardless of role.
- **Inputs:** Session-local `app.tenant_id` and `app.user_id` values, both set transaction-locally via the existing `withTenant`-style helper, using the `tenantId`/`userId` identity resolution already produces per request.
- **Processing:** The RLS policy's `USING`/`WITH CHECK` clauses require both `tenant_id = app.tenant_id` and `user_id = app.user_id` to match for any row to be visible or writable. No role-based bypass exists in the policy itself — `tenant_admin` and `tenant_user` sessions are treated identically.
- **Outputs:** A caller can only ever see, list, PATCH, or delete their own rows.
- **Error handling:** N/A — enforcement is unconditional at the database layer, not an application-level check that could be bypassed by a missed code path.
- **Edge cases:** Deliberately extends ADR-0030 §2's "Platform Admin never queries `watchlists`" precedent one level further to Tenant-Admin — there is no oversight override for any role, ever, by design.

### 5.7 Feature / Capability: Project-Wide Error-Code Mapping

- **Description:** A single, cause-based HTTP status/body mapping applied to `watchlists` first and, by reference, to every other mutable `/v1` resource going forward.
- **Triggers:** Any request failure against a mutable `/v1` endpoint.
- **Inputs:** The specific failure cause (row not visible under RLS; role-check failure; validation failure; unparseable body; version conflict; missing precondition; rate limit).
- **Processing:** Maps deterministically per the table in ADR-0044 §2 — see Section 8 (Business Rules) below for the full mapping restated as rules.
- **Outputs:** A consistent `{ code: "...", ...details }` body shape per cause, distinguishing debuggable role-check failures (403) from existence-hiding not-found responses (404).
- **Error handling:** Per-endpoint deviations from this mapping must be logged in that endpoint's own story with an explicit "deviates from ADR-0044 §2 because…" rationale — never silent divergence.
- **Edge cases:** Cross-tenant and same-tenant-but-not-owned failures both return the identical `404` body — deliberately indistinguishable, to prevent both tenant-existence and user-existence enumeration.

### 5.8 Feature / Capability: `updated_at` Trigger Policy

- **Description:** Maintains `updated_at` via a Postgres `before update` trigger on every mutable tenant-scoped table, rather than relying on application code to set it correctly on every write path.
- **Triggers:** Any `UPDATE` against a covered table, through any code path (application, direct SQL, migration).
- **Inputs:** N/A — trigger-driven, no application input required.
- **Processing:** `update_updated_at_column()` sets `NEW.updated_at := now()` before every update on a covered table.
- **Outputs:** A reliably current `updated_at` regardless of which code path performed the write.
- **Error handling:** N/A.
- **Edge cases:** `IngestionRun` (immutable acquisition/audit anchor, ADR-0005) and `platform_admin_audit_log` (append-only) are explicitly exempt — no `updated_at` column, no trigger, and an attempted `UPDATE` on either must fail at the application layer. New mutable tenant-scoped tables get this trigger by convention; its absence is a PR-review finding (Appendix B), not silently accepted.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-User | Creates, reads, updates, and deletes their own personal watchlists |
| Tenant-Admin | Same watchlist capabilities as Tenant-User — no elevated access to other users' watchlists |
| Platform Admin | No path to `watchlists` at all (ADR-0030 §2, unaffected by this ADR) |
| Backend Engineer | Implements the CRUD surface, RLS policy, and error mapping; applies the PR checklist to future mutable resources |
| Frontend / Admin UI Developer | Consumes the API, implements `If-Match` pre-fetch-then-PATCH flow |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Story 1.5 | Tenant-User or Tenant-Admin | ...create, list, view, update, and delete my own personal watchlists via a predictable REST API | ...I have a safe, private way to define what content I want to monitor, without losing concurrent edits or exposing my data to others | `POST/GET/PATCH/DELETE /v1/watchlists[/:id]` implemented with RFC 7396 PATCH, `If-Match` optimistic locking, the full cause-based error mapping, the `matchType` invariant, and RLS-enforced per-user ownership with no oversight override |

### 6.3 Workflow Diagrams / Steps

**Workflow: create → fetch → PATCH with optimistic locking**

1. Caller authenticates; identity resolution yields `tenantId`, `userId`, `role`.
2. Caller `POST`s a new watchlist; server sets `tenant_id`/`user_id` from identity, validates the matchType invariant, returns `201` with `version: 1`.
3. Caller later `GET`s the watchlist to display it for editing, noting the current `version`.
4. Caller submits `PATCH` with `If-Match: "<observed version>"` and a JSON Merge Patch body.
5. Server compares the header's version against the row's actual current version.
   - If equal: applies the patch (re-validating the matchType invariant if relevant fields changed), increments `version`, lets the `updated_at` trigger fire, returns `200`.
   - If not equal: returns `409` with `current_version`, so the client can refetch and retry.
   - If `If-Match` is missing entirely: returns `428`.

**Workflow: attempted access to another user's watchlist**

1. Any caller (including a Tenant-Admin) issues `GET/PATCH/DELETE /v1/watchlists/:id` for a row they do not own.
2. RLS's ownership predicate (`user_id = app.user_id`) makes the row invisible at the database layer — the query returns zero rows regardless of tenant match.
3. Application layer returns `404 { code: "not_found" }` — identical whether the row belongs to another user in the same tenant or to a different tenant entirely.

**Workflow: PR review for a future mutable `/v1` resource**

1. Engineer builds a new mutable resource.
2. Reviewer applies Appendix B's checklist: RFC 7396 PATCH compliance, `version`/`If-Match` presence if concurrent PATCH could lose an update, ADR-0044 §2 error mapping (or a logged deviation), trigger-maintained `updated_at` (or exempt-list membership), and — if the resource has an ownership dimension — an RLS-enforced boundary with no role-based bypass.

---

## 7. Data Requirements

### 7.1 Data Inputs

Authenticated caller identity (`tenantId`, `userId`, `role`) from identity resolution (ADR-0032/ADR-0033); request bodies for create/PATCH; the `If-Match` header for PATCH.

### 7.2 Data Outputs

`watchlists` rows (created/updated/deleted); HTTP responses with cause-specific status codes and body shapes; `platform_admin_audit_log` is explicitly **not** used for watchlist mutations (out of scope — `version`+`updated_at` are the current change-tracking mechanism).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `watchlists` | `id` (uuid PK); `tenant_id` (FK `tenants`); `user_id` (FK `users`, ownership); `name`; `match_type` (`keyword`\|`hashtag`\|`account`\|`boolean`); `terms` (`text[]`, non-boolean types); `boolean_query` (text, boolean type); `version` (int, default 1); `created_at`; `updated_at` (trigger-maintained) | Belongs to one tenant and one user; matched against by the ADR-0006/ADR-0021 matching engine at query time |
| RLS policy `tenant_isolation` on `watchlists` | `USING`/`WITH CHECK`: `tenant_id = app.tenant_id AND user_id = app.user_id` | First table in the project enforcing ownership via RLS, not just tenant membership |
| `app.tenant_id` / `app.user_id` (session variables) | Set transaction-locally via `withTenant`-style helper | Sourced from identity resolution (ADR-0032 §5); `app.user_id` is new, propagating a value that already existed but wasn't previously used as an RLS predicate |
| `update_updated_at_column()` (trigger function) | `NEW.updated_at := now()` | Applied `BEFORE UPDATE` on `watchlists` and, by convention, every other mutable tenant-scoped table not on the exempt list |
| Exempt tables (`IngestionRun`, `platform_admin_audit_log`) | No `updated_at`, no trigger, UPDATE forbidden at application layer | Named explicitly so the trigger-by-default convention doesn't silently violate their immutability/append-only invariants |

### 7.4 Validation Rules

- `matchType = 'boolean'` requires non-null, non-empty `booleanQuery` and requires `terms` to be null.
- `matchType ∈ {'keyword','hashtag','account'}` requires non-null, non-empty `terms` and requires `booleanQuery` to be null.
- PATCH requests against `watchlists` must include `If-Match`; a missing header is rejected (`428`), not defaulted.
- A PATCH's `If-Match` version must equal the row's current `version`; a mismatch is rejected (`409`), never silently applied against a stale base.
- `tenant_id` and `user_id` are always server-derived from the authenticated identity, never accepted from the request body.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Every `/v1` PATCH endpoint uses RFC 7396 JSON Merge Patch: `null` deletes a nullable key, omitted keys are unchanged, arrays are replaced in full | All `/v1` PATCH endpoints |
| BR2 | Resource not visible under RLS (same-tenant-not-found or cross-tenant) → `404 { code: "not_found" }`, identical body in both cases | Error mapping |
| BR3 | Caller authenticated but lacking the required role for a Tenant-Admin-only action → `403 { code: "forbidden", required_role: "tenant_admin" }` | Error mapping (role-check failures only) |
| BR4 | Body fails semantic validation → `422 { code: "validation_failed", details: [...] }` | Error mapping |
| BR5 | Body is unparseable or wrong-shaped → `400 { code: "bad_request" }` | Error mapping |
| BR6 | PATCH with stale `If-Match` → `409 { code: "version_conflict", current_version }` | Error mapping |
| BR7 | PATCH missing required `If-Match` → `428 { code: "precondition_required" }` | Error mapping |
| BR8 | Rate-limited request → `429`, per ADR-0040's response shape | Error mapping |
| BR9 | `watchlists` requires optimistic locking by default; other resources opt in per their own story | Optimistic locking |
| BR10 | Both `tenant_admin` and `tenant_user` may create watchlists; no separate "watchlist-admin" role exists | Creation authorization |
| BR11 | A watchlist is fully private to its creating `user_id`; no Tenant-Admin or Platform Admin oversight override exists | Ownership |
| BR12 | Mutable tenant-scoped tables get a trigger-maintained `updated_at`, except the explicit append-only exempt list | `updated_at` policy |
| BR13 | New mutable tenant-scoped tables get the `updated_at` trigger and (if they have an ownership dimension) RLS ownership by convention; absence is a PR-review finding, not silent | Future resource conventions |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `social-listening-core` watchlists router | Inbound (from client) | CRUD surface for `/v1/watchlists` | HTTPS/JSON REST |
| Identity resolution middleware (ADR-0032/ADR-0033) | Internal | Supplies `tenantId`/`userId`/`role` to every request | In-process TypeScript |
| `withTenant`-style DB helper | Internal | Sets `app.tenant_id`/`app.user_id` transaction-locally | In-process TypeScript / Postgres `set_config` |
| Postgres RLS (`watchlists` policy) | Internal | Enforces tenant + ownership boundary at the database layer | SQL |
| `update_updated_at_column()` trigger | Internal | Maintains `updated_at` independent of application code | Postgres `plpgsql` trigger |
| ADR-0006/ADR-0021 matching engine | Internal (downstream consumer) | Reads `matchType`/`terms`/`booleanQuery` at match time | In-process TypeScript |
| Frontend / Admin UI | Outbound (to client) | Consumes the CRUD surface, implements pre-fetch-then-PATCH `If-Match` flow | HTTP/JSON |

---

## 10. Non-Functional Considerations

- **Performance:** Existing `(tenant_id, match_type)` indexes are sufficient for v1 non-boolean containment lookups; a GIN index on `terms` is a deferred optimization, not a default, to be revisited only when real per-tenant watchlist volume justifies it.
- **Security / access control:** Ownership is enforced at the database layer (RLS), not solely in route handlers, so the invariant holds regardless of which future code path queries the table. `platform_admin_role`'s zero-access boundary to `watchlists` (ADR-0030 §2) is unaffected.
- **Scalability:** No per-user watchlist count/complexity cap exists yet — named as an open risk (a single user's watchlists on a connector-side-matched platform can consume a disproportionate share of the shared per-`(tenantId, providerId)` quota, ADR-0003), deliberately left unresolved pending real usage data.
- **Reliability / availability:** Optimistic locking prevents silent lost updates under concurrent PATCH; trigger-maintained `updated_at` remains correct regardless of write path.
- **Audit and logging:** Watchlist mutations are not written to `platform_admin_audit_log`; `version`+`updated_at` are the current change-tracking mechanism, with a dedicated audit table left as a future, separately-scoped ADR if a real compliance need surfaces.
- **Accessibility:** Not addressed by this ADR/BRD — a UI-layer concern for the consuming admin app.
- **Localization / internationalization:** Not addressed; error `code` values are machine-readable strings, not localized user-facing text.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Watchlist not visible under RLS (missing, cross-tenant, or another user's) | Generic "not found" | `404 { code: "not_found" }` |
| Tenant-Admin-only action attempted by a `tenant_user` | "Forbidden, requires tenant_admin" | `403 { code: "forbidden", required_role: "tenant_admin" }` |
| Create/PATCH body fails the matchType invariant | Validation error with details | `422 { code: "validation_failed", details: [...] }` |
| Unparseable or malformed request body | Bad request | `400 { code: "bad_request" }` |
| PATCH submitted with a stale `If-Match` version | "Someone else changed this, please refresh" | `409 { code: "version_conflict", current_version }` |
| PATCH submitted with no `If-Match` header | "Precondition required" | `428 { code: "precondition_required" }` |
| Request exceeds rate limit | Rate-limit message per ADR-0040 | `429`, per ADR-0040's response shape |

---

## 12. Assumptions and Dependencies

- Identity resolution already produces `(tenantId, userId, role)` on every authenticated request (ADR-0032, ADR-0033).
- The `watchlists` table already exists (migration `0014_create_watchlists.sql`) and is extended additively, not replaced.
- All clients of the watchlist API read `version` before PATCHing and handle `409`/`428` responses.
- Depends on: ADR-0006/ADR-0021 (matching semantics, cross-referenced not re-decided), ADR-0015 (RLS tenant isolation), ADR-0017 (`/v1` versioning), ADR-0030 (role-check vs. tenant boundary), ADR-0032/ADR-0033 (identity resolution and propagation).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should personal, per-user watchlists have a cap on count or complexity, given the shared per-tenant `(tenantId, providerId)` quota (ADR-0003)? | Whoever next touches ADR-0003 or the watchlist-creation story | Deliberately left open pending real usage data |
| Q2 | Will a real compliance need eventually surface for tenant-mutation audit history beyond `version`+`updated_at`? | Product Owner / Architecture | If yes, a separate ADR for an `activity_logs`-style table; not pre-decided |
| Q3 | Is a partial GIN index on `terms` (where `match_type != 'boolean'`) or a separate-column split the cleaner future migration? | Engineering | Implementation choice; both acceptable under this ADR |

---

## 14. Appendix

### Glossary

See BRD-0044 Section 15 for the full glossary (Watchlist, RFC 7396/JSON Merge Patch, If-Match, Optimistic locking, RLS, Tenant-scoped, Per-user ownership, Match type, Boolean query AST, `updated_at` trigger).

### Reference Links

- **ADR-0044:** `docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md`
- **BRD-0044:** `docs/project docs/Business-Requirements/BRD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md`
- **Related ADRs:** ADR-0006 (connector-side vs. post-fetch matching), ADR-0015 (RLS), ADR-0017 (`/v1` versioning), ADR-0021 (boolean-query AST + capability matrix), ADR-0030 (Platform Admin role-check boundary), ADR-0032 (identity resolution), ADR-0033 (`Authorization: Bearer`, `X-Tenant-Id` retirement)
- **Story:** Story 1.5 (`docs/user-stories/epic-1-repository-and-api-foundation.md`), built 2026-08-12
- **Related feature designs:** `docs/product-research/feature-designs/02-boolean-query-builder.md` (query-builder concepts consuming this API); `docs/product-research/feature-designs/26-watchlist-volume-preview.md` (future, builds on this API)
- **ADR-0044 Appendix A/B:** concrete PATCH request/response examples, and the PR review checklist for any new mutable `/v1` resource — reused directly, not re-derived, in this FDD's Section 6.3 workflow steps.

### Missing / Not Applicable Sources

- No `docs/product-research/reports/<feature>-deep-research.md` file was found specifically for this ADR or feature; this FDD, like BRD-0044, relies on ADR-0044, its cross-referenced ADR family, Story 1.5, and the two related feature-design files.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0044 and BRD-0044, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
