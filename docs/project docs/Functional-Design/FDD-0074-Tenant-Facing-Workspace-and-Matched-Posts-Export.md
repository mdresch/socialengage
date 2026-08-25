# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0074 Tenant-Facing Workspace and Matched-Posts Export — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated from ADR-0074 / BRD-0074) |
| Reviewer(s) | Menno — Product Owner / Sole Developer |
| Status | Approved |
| Related Documents | ADR-0074, BRD-0074, ADR-0043 (self-service deletion export), ADR-0031 (`GET /v1/tenants/me`), ADR-0044 (watchlist ownership), ADR-0063 (`post_watchlist_matches`), ADR-0030/ADR-0041 (Platform-Admin content-free boundary), ADR-0111 (deferred async export), Stories 3.16, 6.40 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0074 (Accepted, 2026-08-23) and BRD-0074 into a functional design for two new tenant-facing, on-demand export endpoints in `social-listening-core` — a full workspace JSON archive and a matched-posts CSV export — and the `/tenant/settings` UI actions that call them. These endpoints exist so `social-listening-admin`'s Tenant Settings screen can be implemented against real backend data, with no client-side mock or fallback values.

ADR-0074's status is Accepted; this FDD reflects a settled design. As of this writing, the backend endpoints (Story 3.16) and the UI story (Story 6.40) are both Ready but not yet built — this FDD describes the full target design regardless of build status.

### 2.2 Scope

- **In scope:** `GET /v1/tenants/me/export/workspace` (workspace JSON archive, `tenant_admin` only); `GET /v1/posts/export.csv` (matched-posts CSV, `tenant_admin` and `tenant_user`); their authorization, RLS scoping, size/row caps, and column/field definitions; the `/tenant/settings` export buttons and their wiring through `core-client.ts`.
- **Out of scope:** async background export to Azure Blob Storage with job-polling for unbounded exports (deferred to ADR-0111); one-row-per-match "exploded" CSV expansion; any change to the existing deletion/offboarding export (`exportTenantData()`, ADR-0043) beyond factoring out shared assembly logic; raw `rawPayload`, credential secrets, OAuth refresh tokens, or Key Vault-encrypted envelopes in either export; client-side CSV generation or any `useApp()`/`exportTenantData()` browser-side helper; `platform_admin` access to either endpoint.

### 2.3 Target Audience

Backend and frontend engineers implementing Stories 3.16 and 6.40, QA writing contract tests, and the Product Owner reviewing acceptance criteria.

---

## 3. Context and Background

- **Problem:** SocialEngage tenants have no on-demand, self-service way to export their own data. The only existing export (`exportTenantData()` in `tenantDeletion.ts`, Story 3.8/ADR-0043) is an internal helper coupled to the 30-day self-service deletion/offboarding lifecycle, not a tenant-facing action. There is also no endpoint that produces a CSV of posts at all.
- **Immediate trigger:** the Google AI Studio `TenantSettingsView.tsx` design shows two export buttons ("Export Full Workspace (JSON)", "Export Matched Posts (CSV)") that must be wired to real API calls; the design's own `useApp()`/`exportTenantData()` client helpers do not exist in the project and must not be introduced as mocks.
- **Business/user value:** operational backup, GDPR/CCPA-style data portability, and downstream analysis (Excel/BI) for tenant data, without touching the deletion lifecycle.
- **Source requirements:** ADR-0074, BRD-0074, Stories 3.16, 6.40; related product-research context in `docs/product-research/feature-designs/10-data-export.md`.
- **Constraints/dependencies:** both endpoints run behind the existing `authMiddleware` (ADR-0029/ADR-0033) and `withTenant()` RLS path (ADR-0015); the workspace export must access all tenant users' watchlists, which requires the same `getAdminPool()` RLS exception already used by `exportTenantData()` (ADR-0044 §5c); the `platform_admin` zero-tenant-content boundary (ADR-0030 §2/ADR-0041) must hold for both endpoints; v1 is synchronous and capped — no background job infrastructure is introduced by this ADR.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Let `Tenant-Admin` back up the full tenant workspace on demand | `GET /v1/tenants/me/export/workspace` returns a valid, capped JSON archive for `tenant_admin` callers |
| G2 | Let `Tenant-Admin` and `Tenant-User` export the posts they can already see, as CSV | `GET /v1/posts/export.csv` returns the same result set as `GET /v1/posts` for the same filters, as a well-formed CSV |
| G3 | Preserve the platform-admin content-free boundary | Both endpoints reject any `platform_admin` identity |
| G4 | Eliminate mock/fallback data from the Tenant Settings export UI | Export buttons call real `social-listening-core` endpoints through `core-client.ts`; no `useApp()`/`exportTenantData()` client helper exists |
| G5 | Keep exports safe by construction | Neither export ever contains credential secrets, OAuth refresh tokens, or Key Vault envelopes |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `GET /v1/tenants/me/export/workspace`

- **Description:** Returns a full, safe-metadata JSON archive of the caller's tenant workspace — tenant record, users, all users' watchlists, connector activations, non-secret credential metadata, and canonical post rows.
- **Triggers:** `Tenant-Admin` clicks "Export Full Workspace (JSON)" on `/tenant/settings`, or any authenticated API caller invokes the endpoint directly.
- **Inputs:** Bearer/Entra session (ADR-0029/ADR-0033); no request body; no query filters in v1 (full workspace only).
- **Processing:**
  1. Authenticate the caller; resolve tenant and role.
  2. Reject with `403 Forbidden` unless the resolved role is `tenant_admin` (a `tenant_user` has no ownership right over other users' private watchlists or connector/credential metadata — ADR-0044 §5c).
  3. Reject any `platform_admin` identity outright (ADR-0030 §2/ADR-0041) — the content-free boundary applies before role-checking proceeds.
  4. Assemble the archive using a new, independent service function that reuses query/assembly logic shared with (but not owned by) `exportTenantData()`: tenant metadata (`name`, `domain`, `licenseSeatCount`, `activeSeatCount`, `status`, `createdAt`), tenant users, watchlists across all users (requiring the same `getAdminPool()` exception as the deletion export), connector activations, `platform_credentials` non-secret metadata (`provider`, `owner_type`, active/inactive, `created_at`), and canonical `social_posts` rows using the same field set as the CSV export (see 5.2).
  5. Explicitly exclude: `rawPayload`, full `enrichment` JSONB internals, credential secrets, OAuth refresh tokens, Key Vault envelopes, and archived `ingestion_runs` raw rows (run summary rows only, if audit continuity is required).
  6. Enforce a response document size cap (v1: 100 MB).
- **Outputs:** `200 OK` with the JSON archive body when within the size cap.
- **Error handling:** `403 Forbidden` for non-`tenant_admin` or `platform_admin` callers; `413 Payload Too Large` / `422` with code `EXPORT_TOO_LARGE` when the assembled document would exceed the size cap (never an unbounded/truncated stream).
- **Edge cases:** Tenant with an unusually large number of watchlists or posts approaching the size cap; tenant with zero users/watchlists/posts (archive still valid, mostly empty sections); concurrent workspace mutation during assembly (archive reflects a best-effort snapshot, not a transactional point-in-time guarantee beyond what the underlying queries provide).

### 5.2 Feature / Capability: `GET /v1/posts/export.csv`

- **Description:** Returns a flat, one-row-per-post CSV of the same posts the caller is authorized to see through `GET /v1/posts`, using the same filters.
- **Triggers:** `Tenant-Admin` or `Tenant-User` clicks "Export Matched Posts (CSV)" on `/tenant/settings` or the post feed, or any authenticated API caller invokes the endpoint directly with query parameters.
- **Inputs:** Bearer/Entra session; the same query parameters as `GET /v1/posts` (search, `provider`, `source`, `author`, `watchlistId` per ADR-0063, date range, cursor pagination).
- **Processing:**
  1. Authenticate the caller; resolve tenant. Both `tenant_admin` and `tenant_user` are permitted (the post feed itself is already visible to both roles — Story 6.11 — so the CSV export is the same result set in a different format).
  2. Reject any `platform_admin` identity (ADR-0030 §2/ADR-0041).
  3. Run the same filtered/RLS-scoped query as `GET /v1/posts`, ordered consistently.
  4. Stream the result to the HTTP response as CSV rows are produced (not buffered in full before responding), with columns: `id`, `published_at`, `provider`, `author_name`, `author_url`, `title`, `body_markdown`, `url`, `sentiment`, `keywords`, `watchlist_ids` (single column, comma-separated list of matched watchlist IDs — one-row-per-match expansion deferred).
  5. Emit UTF-8 with a BOM, RFC 4180-ish quoting, and a header row.
  6. Enforce a row cap (v1: 10,000 rows).
- **Outputs:** A streamed `200 OK` CSV response with header row and up to the row cap of data rows.
- **Error handling:** `403 Forbidden` for `platform_admin` callers; `413 Payload Too Large` / `422` with code `EXPORT_TOO_LARGE` when the filtered result set would exceed the row cap, returned before streaming begins (never a silently truncated file).
- **Edge cases:** A post matching multiple watchlists (all matched IDs listed in one comma-separated `watchlist_ids` value); a post with no watchlist match when `watchlistId` filter is absent; empty result set (header row only, still `200 OK`); filter combination that returns zero rows versus an invalid filter value (the latter follows the same validation as `GET /v1/posts`).

### 5.3 Feature / Capability: Tenant Settings export actions (UI)

- **Description:** The `/tenant/settings` page surfaces the two export actions as real, server-backed downloads.
- **Triggers:** User clicks "Export Full Workspace (JSON)" or "Export Matched Posts (CSV)" on the Tenant Settings page.
- **Inputs:** The caller's session (role, tenant); no additional form input in v1 (no filter picker on the settings page itself — filters are only relevant when exporting CSV from a filtered post-feed context).
- **Processing:**
  - Both buttons are plain links or form posts that route through `core-client.ts` (ADR-0036 §2) to the real `social-listening-core` endpoints, using the session bearer token server-side or a same-origin proxy — never a client-side `useApp()` context.
  - The "Export Full Workspace (JSON)" button is disabled (not hidden) with an explanatory state when the caller lacks `tenant_admin` role, or when the endpoint is unreachable.
  - The "Export Matched Posts (CSV)" button is available to both roles; it is disabled with an explanatory state only when the endpoint is unreachable.
- **Outputs:** A downloaded file (JSON or CSV) in the browser.
- **Error handling:** If the underlying endpoint returns `413`/`422 EXPORT_TOO_LARGE`, `403`, or a transport error, the UI surfaces an explanatory error state rather than silently failing or falling back to mock data.
- **Edge cases:** `tenant_user` session viewing the settings page (workspace export button disabled, CSV export button enabled); very large tenant hitting the cap (user sees the "too large" explanation, not a partial file).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Primary user of the full workspace export; sees the offboarding link |
| Tenant-User | Primary user of the matched-posts CSV export |
| Tenant-Brand-Reputation-Manager | Secondary user of the CSV export, for reporting/external sharing |
| Platform-Admin | Must have zero access to either endpoint (content-free boundary) |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (key) |
|---|---|---|---|---|
| Story 3.16 — Tenant-facing workspace and matched-posts export endpoints (Ready, not yet built) | Tenant-Admin or tenant user | Download a full workspace JSON archive and a CSV of matched posts on demand from `social-listening-core` | I can back up or analyze my tenant's data without going through the deletion/offboarding flow | `GET /v1/tenants/me/export/workspace` restricted to `tenant_admin` (`403` for `tenant_user`); workspace JSON includes tenant/users/all-users'-watchlists/connector activations/non-secret credential metadata/posts; `GET /v1/posts` supports `?format=csv` or `/export.csv` for both roles with the same filters as JSON; both exports bounded and fail safely with `413`/`422 EXPORT_TOO_LARGE`; no `platform_admin` access |
| Story 6.40 — Tenant settings screen: styled workspace profile, export actions, and offboarding link (Ready, depends on Story 3.16) | Tenant-Admin or tenant user | See the Tenant Settings page present workspace metadata in styled cards and offer real export/offboarding actions | The Google AI Studio design is implemented using only real `social-listening-core` data | Renders `name`/`domain`/seat counts/`createdAt` from `getMyTenant()` only; offboarding section shown only for `tenant_admin`; two export buttons call Story 3.16 endpoints via `core-client.ts`, disabled (not hidden) when unreachable or unauthorized; no `useApp()`/`exportTenantData()` helper; no edit affordance |

### 6.3 Workflow Diagrams / Steps

**Workspace export flow:**

1. `Tenant-Admin` opens `/tenant/settings` and clicks **Export Full Workspace (JSON)**.
2. UI calls `GET /v1/tenants/me/export/workspace` via `core-client.ts`.
3. Server authenticates, confirms `tenant_admin` role (`403` otherwise), and rejects any `platform_admin` identity.
4. Server assembles the archive (tenant metadata, users, all watchlists, connector activations, non-secret credential metadata, canonical posts), excluding secrets and raw payloads.
5. Server checks the assembled document against the 100 MB cap; if exceeded, returns `413`/`422 EXPORT_TOO_LARGE`.
6. On success, server returns `200 OK` with the JSON body; the browser downloads the file.

**Matched-posts CSV export flow:**

1. `Tenant-Admin` or `Tenant-User` clicks **Export Matched Posts (CSV)** on `/tenant/settings` (or the post feed).
2. UI calls `GET /v1/posts/export.csv` with the same filters as the current post view, via `core-client.ts`.
3. Server authenticates, rejects any `platform_admin` identity, and runs the same RLS-scoped filtered query as `GET /v1/posts`.
4. Server checks the filtered result count against the 10,000-row cap; if exceeded, returns `413`/`422 EXPORT_TOO_LARGE` before streaming begins.
5. Server streams the CSV (UTF-8 BOM, RFC 4180-ish quoting, header row, one row per post) to the response.
6. Browser downloads the CSV file; it opens correctly in Excel.

**Unauthorized/blocked flow:**

1. A `tenant_user` attempts the workspace export (button is disabled in the UI, but the server still validates independently) → `403 Forbidden`.
2. A `platform_admin` identity attempts either endpoint → rejected before any tenant content is touched.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Caller identity, tenant, and role from the Entra-backed session (ADR-0029/ADR-0033).
- Existing `tenants`, `users`, `watchlists`, `connector_activations`, `platform_credentials`, `social_posts` (and their `authors`/`ingestion_runs` associations) tables, all RLS-scoped to the caller's tenant.
- For the CSV export: the same query parameters accepted by `GET /v1/posts` (search, provider, source, author, `watchlistId`, date range, cursor).

### 7.2 Data Outputs

- A JSON document (workspace export) downloaded by the browser.
- A streamed CSV file (matched-posts export) downloaded by the browser.

### 7.3 Data Model / Entities

| Entity | Key Attributes (in export scope) | Relationships |
|---|---|---|
| `tenants` (existing) | `name`, `domain`, `licenseSeatCount`, `activeSeatCount`, `status`, `createdAt` | Root of the workspace export; RLS-scoped to the caller's own tenant |
| `users` (existing) | Tenant user emails/roles | Listed in the workspace export; owner of individual watchlists |
| `watchlists` (existing) | Query AST, owner, status | Included for **all** users in the tenant (not just the caller), via the same `getAdminPool()` exception used by `exportTenantData()` (ADR-0044 §5c) |
| `connector_activations` (existing) | Platform, active/inactive, tier | Included in the workspace export; no secrets |
| `platform_credentials` (existing) | `provider`, `owner_type`, active/inactive, `created_at` — non-secret fields only | Included in the workspace export; secrets/refresh tokens/Key Vault envelopes explicitly excluded |
| `social_posts` (existing) | `id`, `published_at`, `provider`, `author_name`, `author_url`, `title`, `body_markdown`, `url`, `sentiment`, `keywords`, `watchlist_ids` | Same canonical field set used by both the workspace JSON's post section and the CSV export; `rawPayload` and full `enrichment` JSONB internals excluded |
| `ingestion_runs` (existing) | Run summary only (no archived raw rows) | Referenced only if audit continuity is required in the workspace export |

### 7.4 Validation Rules

- Workspace export: caller role must resolve to `tenant_admin`; any `platform_admin` identity is rejected before role-checking. Assembled document must not exceed the 100 MB cap.
- CSV export: caller role must resolve to `tenant_admin` or `tenant_user`; any `platform_admin` identity is rejected. Filtered result set must not exceed the 10,000-row cap. Query parameters follow the same validation as `GET /v1/posts`.
- Both exports: never include credential secrets, OAuth refresh tokens, or Key Vault envelopes — contract-tested as an explicit exclusion list, not an accidental omission.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `Tenant-Admin` is the only role permitted to call `GET /v1/tenants/me/export/workspace`. | Workspace export |
| BR2 | `Tenant-User` and `Tenant-Admin` may call `GET /v1/posts/export.csv` for their own tenant's posts. | CSV export |
| BR3 | `Platform-Admin` cannot access either export endpoint or its content. | Both endpoints |
| BR4 | Workspace export must never include credential secrets, OAuth tokens, or Key Vault envelopes. | Workspace export |
| BR5 | Both exports are synchronous and bounded for v1; async unbounded export is deferred to ADR-0111. | Both endpoints |
| BR6 | The CSV export honors the same filters and RLS scoping as `GET /v1/posts`. | CSV export |
| BR7 | `watchlist_ids` is a single comma-separated column; one-row-per-match expansion is deferred. | CSV export |
| BR8 | Exceeding the size/row cap returns a bounded error (`413`/`422 EXPORT_TOO_LARGE`), never an unbounded or silently truncated response. | Both endpoints |
| BR9 | UI export actions must call real `core-client.ts`-mediated endpoints; no client-side mock/fallback data is permitted. | `/tenant/settings` UI |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `/tenant/settings` (Admin UI) | Outbound to API | Render export buttons and offboarding link; initiate downloads | HTTPS via `core-client.ts` / BFF session |
| `GET /v1/tenants/me/export/workspace` | Inbound from Admin UI / API caller | Produce the full workspace JSON archive | REST/JSON, Entra bearer session |
| `GET /v1/posts/export.csv` | Inbound from Admin UI / API caller | Produce the matched-posts CSV | REST/CSV (streamed), Entra bearer session |
| `GET /v1/tenants/me` (existing, ADR-0031) | Inbound | Supplies the read-only workspace metadata cards on the same settings page | REST/JSON |
| `tenantDeletion.ts` / `exportTenantData()` (existing, ADR-0043) | Internal (shared logic only) | Source of reusable query/assembly logic for the workspace export; not the same endpoint or lifecycle | Internal function call |
| Postgres (`withTenant()` / RLS) | Internal | Enforces tenant isolation for every export query (ADR-0015) | SQL, RLS-scoped |

---

## 10. Non-Functional Considerations

- **Performance:** Workspace export targets completion within 30 seconds under the v1 100 MB size cap; CSV export targets first-byte delivery within 5 seconds for the first 1,000 rows, achieved via row-by-row streaming rather than full in-memory buffering.
- **Security / access control:** RLS (`withTenant()`) wraps every export query; `platform_admin` is rejected on both endpoints (ADR-0030 §2/ADR-0041); workspace export requires the same bounded `getAdminPool()` exception as the existing deletion export to reach all users' watchlists, not a broader one.
- **Scalability:** Both exports are synchronous and capped for v1; genuinely large-tenant exports are explicitly deferred to an async, Blob-Storage-backed mechanism (ADR-0111), not solved by this ADR.
- **Reliability / availability:** Caps fail safely and explicitly (`413`/`422 EXPORT_TOO_LARGE`) rather than degrading into partial/truncated output.
- **Audit and logging:** Each export request is a candidate for audit logging (`tenant_id`, `user_id`, `export_type`) per BRD-0074 NFR-005, though this is a Should, not a Must, for v1.
- **Accessibility:** Export buttons follow the same accessible button/disabled-state patterns as other Tenant Settings actions (explanatory disabled state, not a hidden control).
- **Localization / internationalization:** No new localization requirement beyond existing UI copy conventions; CSV encoding (UTF-8 with BOM) ensures correct rendering of non-ASCII content in spreadsheet tools.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `tenant_user` calls workspace export | Export button disabled with explanatory tooltip in UI; direct API call rejected | `403 Forbidden` |
| `platform_admin` calls either endpoint | Not applicable in UI (no Platform-Admin access to tenant settings) | `403 Forbidden`, rejected before any tenant content is touched |
| Workspace document exceeds 100 MB | "Export too large" error state in UI | `413 Payload Too Large` / `422` with code `EXPORT_TOO_LARGE`; no partial document returned |
| CSV filtered result exceeds 10,000 rows | "Export too large" error state in UI, suggests narrowing filters | `413 Payload Too Large` / `422` with code `EXPORT_TOO_LARGE`, returned before streaming begins |
| Cross-tenant export attempt | Not reachable via UI; direct API call rejected | `403`/`404` — caller can only ever resolve their own tenant |
| Underlying endpoint unreachable | Export button shown disabled with explanatory state | UI never falls back to mock/client-generated data |

---

## 12. Assumptions and Dependencies

- ADR-0043's deletion export (`exportTenantData()`) remains the sole offboarding/deletion export path; this ADR's workspace export is additive and independent, sharing assembly logic where practical rather than duplicating it wholesale.
- `GET /v1/posts`'s existing filters and `watchlistId` matching (ADR-0063) are directly reusable for the CSV export's query shape.
- The workspace export's access to all users' watchlists relies on the same `getAdminPool()` RLS exception already established and accepted for the deletion export (ADR-0044 §5c) — no new RLS-bypass mechanism is introduced.
- `social-listening-admin`'s Tenant Settings UI (Story 6.40) depends on Story 3.16's endpoints existing first.
- The exact workspace JSON column set is contract-tested and versioned per the ADR's Resolved Questions, not left ambiguous at implementation time.
- `lucide-react` remains outside this ADR's scope; export button styling is a separate frontend concern.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should async background export to Azure Blob Storage with job-polling be built for large tenants exceeding the v1 caps? | Technical Lead | Deferred to ADR-0111 |
| Q2 | Should a one-row-per-match "exploded" CSV expansion be offered as an alternative to the single comma-separated `watchlist_ids` column? | Product Owner | Future story, not v1 |
| Q3 | Should exports be audit-logged (`tenant_id`, `user_id`, `export_type`) as a hard requirement rather than a Should? | Technical Lead | At Story 3.16 implementation time |
| Q4 | Should the Tenant Settings CSV export accept filter parameters directly from the settings page, or only from the post feed's filtered context? | Product Owner | At Story 6.40 implementation time |

---

## 14. Appendix

**Glossary**

| Term | Definition |
|---|---|
| Workspace export | A tenant-scoped, safe-metadata JSON archive of tenant, users, watchlists, connector activations, credential metadata, and posts. |
| Matched posts | Posts satisfying the filters and `watchlistId` supplied to `GET /v1/posts` / `GET /v1/posts/export.csv`. |
| Safe metadata | Data that excludes credentials, secrets, tokens, or raw internal payload structures. |
| Content-free boundary | The rule that `Platform-Admin` must not be able to read any tenant content (ADR-0030 §2/ADR-0041). |
| `EXPORT_TOO_LARGE` | Normalized error code returned when an export would exceed its size or row cap. |

**Reference links**

- [ADR-0074: Tenant-Facing Workspace and Matched-Posts Export](../../adr/0074-tenant-facing-workspace-and-posts-export.md)
- [BRD-0074: Tenant-Facing Workspace and Matched-Posts Export](../Business-Requirements/BRD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md)
- [ADR-0043: Self-Service Tenant-Initiated Deletion](../../adr/0043-self-service-tenant-initiated-deletion.md)
- [ADR-0031: Tenants Table Shape](../../adr/0031-tenants-table-shape.md)
- [ADR-0044: Watchlist API Design and Database Schema Standardization](../../adr/0044-watchlist-api-design-and-database-schema-standardization.md)
- [ADR-0063: `post_watchlist_matches` Junction Table and Server-Side Watchlist Filter](../../adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md)
- [ADR-0030: Admin-Tier Design / Platform-Admin RLS Exception](../../adr/0030-admin-tier-design-platform-admin-rls-exception.md)
- [ADR-0041: Platform-Admin Is a Distinct Identity Kind, Not a Role Value](../../adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md)
- [ADR-0111: Export Bounding, Streaming, and Size Caps](../../adr/0111-export-bounding-streaming-and-size-caps.md) (async/large-export follow-on)
- [Feature design: Data export](../../product-research/feature-designs/10-data-export.md)
- Stories: [Story 3.16 — Tenant-facing workspace and matched-posts export endpoints](../../user-stories/epic-3-data-model-storage-and-archival.md), [Story 6.40 — Tenant settings screen: styled workspace profile, export actions, and offboarding link](../../user-stories/epic-6-tenant-admin-ui.md)

**Revision history**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer | Regenerated from ADR-0074/BRD-0074 with a genuine per-capability Section 5 breakdown, replacing the prior defective BRD-duplicate/flat-table version. |
