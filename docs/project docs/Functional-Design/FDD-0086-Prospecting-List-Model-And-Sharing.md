# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0086 Prospecting List Model and Sharing — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-27 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Approved |
| Related Documents | ADR-0086 (prospecting list model and sharing, Accepted 2026-08-27), ADR-0004 (`Author` model), ADR-0007 (`AuthorTopicSignal`), ADR-0044 (watchlist ownership pattern), ADR-0092 (author-initiated takedown), ADR-0108 (`Author` scoring), ADR-0095 (`CRMConnector`), ADR-0117/FDD-0117 (export/CRM-push contract), BRD-0086, `docs/product-research/feature-designs/18-prospecting-list.md`, Stories 10.1 and 10.2 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0086's accepted decision — the `prospecting_lists`/`prospecting_list_entries` data model, owner-only sharing rule, CRUD endpoints, and metadata-only export/CRM-handoff contract — into a functional design covering the capabilities the backend must expose and the UI workflow that manages leads within it.

**Note:** ADR-0086 was **Accepted** on 2026-08-27, as revised through architectural review. Stories 10.1/10.2 are Ready. This FDD reflects the accepted decision, not the original 2026-08-23 draft.

### 2.2 Scope

- **In scope:** the `prospecting_lists` and `prospecting_list_entries` tables and their RLS/ownership rules; list and entry CRUD endpoints; the `shared` sharing toggle, owner-only, with no `tenant_admin` override; `relationship_stage` as a constrained label; the export/CRM-handoff endpoint *scoping* (wire contracts owned by ADR-0117/FDD-0117); the "Add to prospecting list" UI entry point; the list/detail UI views.
- **Out of scope:** a workflow engine or enforced `relationship_stage` transitions; automated email follow-ups/reminders/outreach sequences; public or anonymous list sharing; automatic scraping/storage of private contact data; the full `CRMConnector` implementation and export wire contract (owned by ADR-0095/ADR-0117, see FDD-0117); AI-driven stage recommendations, outreach drafting, or duplicate detection; bulk import from external spreadsheets.

### 2.3 Target Audience

Backend engineers implementing the schema and endpoints, frontend engineers implementing the list/detail UI, QA authoring contract tests for CRUD/sharing/cross-tenant isolation, and the Product Owner.

---

## 3. Context and Background

Social selling is a growth use case for SocialEngage: a `Social-Selling-Strategist` discovers promising authors through influencer discovery and topic analysis, but today has no tenant-native place to save, score, annotate, and prioritize those leads — this happens today in external spreadsheets, fragmenting the workflow, preventing collaboration, and creating PII/compliance risk when contact data is copied outside the platform. `AuthorTopicSignal` and the `Author` table (ADR-0004, ADR-0007) already capture author metadata and topical relevance, so the prospecting list is designed as a thin, user-curated layer referencing `author_id` rather than duplicating author data — mirroring the existing watchlist ownership pattern (ADR-0044) for RLS and sharing.

Source requirements: ADR-0086, BRD-0086, Stories 10.1 (backend) and 10.2 (frontend) in `docs/user-stories/epic-10-adr-0086-to-0094.md`. Related feature design: `docs/product-research/feature-designs/18-prospecting-list.md`.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Give `Social-Selling-Strategist` a persistent, tenant-native lead list | Lists and entries persist and are reachable via CRUD endpoints and a UI |
| G2 | Support prioritization without duplicating author data | Entries reference `Author` by `author_id` only; scores/topic are stored per-entry as curated context |
| G3 | Enable controlled, tenant-scoped collaboration | Only a list's own owner can share it (no `tenant_admin` override); sharing never crosses tenant boundaries and grants read-only access |
| G4 | Provide a safe export/handoff path | CSV export and the CRM-handoff contract are metadata-only by default, excluding private contact data |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Prospecting List CRUD

- **Description:** Create, list, rename/update, and delete tenant-scoped, user-owned prospecting lists.
- **Triggers:** `POST /v1/prospecting-lists`, `GET /v1/prospecting-lists`, `PATCH /v1/prospecting-lists/:id`, `DELETE /v1/prospecting-lists/:id`.
- **Inputs:** `name`, `description` (create/update); `id` (update/delete/read); authenticated caller's `tenant_id` and `user_id`.
- **Processing:**
  - On create, the list is stamped with `tenant_id` (from the caller's session) and `owner_id` (the caller); `shared` defaults to `false`.
  - `GET /v1/prospecting-lists` returns lists visible to the caller: lists the caller owns, plus any lists in the tenant with `shared = true`.
  - `PATCH` may update `name`/`description`/`shared` — all three are owner-only writes; see Section 5.3 for the `shared` toggle specifically.
  - `DELETE` removes the list; cascades to its entries. Owner-only.
- **Outputs:** The created/updated list record; a filtered list collection; a delete confirmation.
- **Error handling:** A request against a list outside the caller's tenant, ownership, or sharing visibility returns `404` (not `403`, so as not to reveal existence). A non-owner's `PATCH`/`DELETE` against a list they can *see* (because it's shared) also returns `404` — RLS restricts the write-eligible row set to `owner_id`, so the request matches zero rows exactly as if the list didn't exist for that operation. Updating a nonexistent list returns `404`.
- **Edge cases:** A `shared` list is readable by any `tenant_user`/`tenant_admin` in the tenant but writable — including toggling `shared` back off — only by its own `owner_id`. There is no `tenant_admin` override (ADR-0044 §5c parity, ADR-0086 §2).

### 5.2 Feature / Capability: Prospecting List Entry CRUD

- **Description:** Add, update, and remove author entries within a list.
- **Triggers:** `POST /v1/prospecting-lists/:id/entries`, `PATCH /v1/prospecting-lists/:id/entries/:entryId`, `DELETE /v1/prospecting-lists/:id/entries/:entryId`.
- **Inputs:** `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `influence_score`, `reach_score` (all four snapshotted at add time from `Author`'s ADR-0108 columns); `relationship_stage`, `notes`, `tags`, `custom_attributes` (user-curated, editable over time).
- **Processing:**
  - An entry references `Author` by `author_id` only; no author fields are duplicated beyond what is explicitly captured on the entry (`platform_id`, `topic`, the four scores as of add time).
  - `relationship_stage` must be one of `new`, `contacted`, `engaged`, `converted`, `passed`; it is a free-standing label with no enforced transition rules in v1.
  - `notes`, `tags`, and `custom_attributes` are editable only by the list's `owner_id` — including when the list is shared, since sharing grants read-only visibility, not collaborative write access.
  - `added_by_user_id` and `added_at` are stamped at creation and not user-editable thereafter. `added_by_user_id` is always the owner in practice, since only the owner can add entries.
  - The entry inherits its parent list's visibility and write-ownership: if the list is private, its entries are private; if shared, its entries are tenant-readable but still owner-only to mutate.
- **Outputs:** The created/updated entry; a delete confirmation.
- **Error handling:** Adding an entry referencing a nonexistent or cross-tenant `author_id` is rejected. An invalid `relationship_stage` value is rejected with a validation error. Operating on an entry in a list the caller cannot access, or attempting a write as a non-owner, returns `404`. Adding an `author_id` already present in the list returns `409 Conflict` (`UNIQUE (prospecting_list_id, author_id)`).
- **Edge cases:** To change an existing entry's `topic`/`notes`/`tags`/`custom_attributes` for an author already on the list, use `PATCH .../entries/:entryId` — `POST` never upserts. Removing the last entry from a list leaves an empty, still-valid list.

### 5.3 Feature / Capability: List Sharing Control

- **Description:** Gate the `shared` visibility flag to the list's own owner — no role-based override.
- **Triggers:** The list's `owner_id` toggles sharing (via `PATCH /v1/prospecting-lists/:id`).
- **Inputs:** `id`, desired `shared` boolean value, caller's `user_id` (from session).
- **Processing:** RLS restricts the `UPDATE` (including a `shared` change) to rows where `owner_id` matches the caller's `app.user_id` session variable — the same mechanism ADR-0044 §5c established for watchlists. This is a database-level ownership check, not an application-layer role check, and applies identically regardless of the caller's role (`tenant_user` or `tenant_admin`).
- **Outputs:** The updated list with the new `shared` value.
- **Error handling:** A non-owner caller attempting to change `shared` — including a `tenant_admin` — matches zero rows under RLS and receives `404`, not a `403` authorization error.
- **Edge cases:** Sharing a list only ever grants **read** access to teammates; it never grants any other tenant member (admin included) the ability to edit or un-share it. Only the owner can share, and only the owner can un-share.

### 5.4 Feature / Capability: Metadata-Only CSV Export

- **Description:** Exports a list's entries to CSV, deliberately excluding automatically-scraped private contact data. The endpoint is scoped by ADR-0086; its exact column set and wire behavior are owned by **ADR-0117 / FDD-0117**.
- **Triggers:** `GET /v1/prospecting-lists/:id/export.csv`.
- **Inputs:** `id` of the list to export; caller's visibility into that list.
- **Processing:** Per ADR-0086 §5, export is metadata-only by default: no email, phone, or other private contact field is included unless the user explicitly typed it into `notes` — and even then, only the tenant's own curated text, never anything scraped automatically. See FDD-0117 for the exact column set, streaming behavior, and size/timeout handling.
- **Outputs:** A CSV file/stream (per FDD-0117).
- **Error handling:** Exporting a list the caller cannot access returns `404`.
- **Edge cases:** See FDD-0117 for CSV-escaping and large-list streaming behavior. There is no fixed entries-per-list cap (ADR-0086 Open Questions, resolved) — export must handle arbitrarily large lists via the streaming approach FDD-0117 defines.

### 5.5 Feature / Capability: CRM Handoff Contract (Definition Only)

- **Description:** Defines the endpoint's scope for pushing selected list entries toward a CRM. The request/response shape, `CRMConnector` reuse, and delivery mechanics are owned by **ADR-0117 / FDD-0117**, reusing the `CRMConnector` abstraction from **ADR-0095**.
- **Triggers:** `POST /v1/prospecting-lists/:id/crm-handoff`.
- **Inputs:** `id` of the list; selected entry IDs; a target CRM connector identifier — exact shape per FDD-0117.
- **Processing:** Validates the caller's access to the list and the selected entries (owner-only, per §5.3); the payload mapping and connector push are implemented per ADR-0117/ADR-0095 (Story 13.13/13.14).
- **Outputs:** Per FDD-0117: `outboundActivityIds`, `pushedCount`, `skippedCount`, and an optional `crmUrl`.
- **Error handling:** Access to a list the caller cannot write to (including a non-owner viewing a shared list) returns `404`. Connector-level errors are defined in FDD-0117.
- **Edge cases:** See FDD-0117.

### 5.6 Feature / Capability: "Add to Prospecting List" UI Entry Point

- **Description:** Lets a user add a discovered author into a new or existing list directly from discovery/search/post-feed surfaces.
- **Triggers:** User clicks "Add to prospecting list" from an author card in influencer discovery, search, or the post feed.
- **Inputs:** The author's `author_id` and available context (`platform_id`, `topic`, current scores) to prefill the new entry.
- **Processing:** Presents a picker to select an existing list (limited to lists the user can write to) or create a new one inline; on confirmation, calls the entry-add endpoint (Section 5.2).
- **Outputs:** A confirmation that the author was added, and/or a link to the list.
- **Error handling:** If the author is already in the selected list, the UI surfaces that state rather than silently succeeding or erroring unhelpfully.
- **Edge cases:** A user with no lists yet is prompted to create their first list inline as part of the add flow.

### 5.7 Feature / Capability: `ProspectingListsView` and `ProspectingListDetailView`

- **Description:** The list and detail UI surfaces for managing prospecting lists.
- **Triggers:** Navigation to the prospecting lists section of the admin UI.
- **Inputs:** The caller's visible lists (owned + shared) and, on the detail view, the selected list's entries.
- **Processing:**
  - `ProspectingListsView` shows all lists visible to the user, with create/rename/delete/share actions shown only on lists the user owns, and a read-only sharing indicator on lists shared by others.
  - `ProspectingListDetailView` shows entries in a table/list; inline editing of `relationship_stage`, `notes`, `tags`, and `custom_attributes` is available only to the owner. A non-owner viewing a shared list sees the same data in a read-only presentation — no edit controls rendered at all, not just disabled ones.
  - Export and CRM-handoff actions are present in the UI and call the corresponding endpoints (5.4, 5.5).
- **Outputs:** Rendered list/detail views; inline edits persisted via the entry-update endpoint.
- **Error handling:** Inline edit failures (e.g., invalid `relationship_stage`) surface a validation message without discarding the user's other unsaved edits where feasible.
- **Edge cases:** None — the read/write split is fixed (owner writes, everyone-in-tenant-with-access reads), so there is no ambiguous state to resolve here.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| `Social-Selling-Strategist` | Primary user; creates/manages lists, adds authors, records stage/notes/tags |
| `Tenant-User` | Secondary user; views shared lists, may contribute prospects |
| `Tenant-Admin` | No special access to prospecting lists — same as any other `tenant_user`: may view a list shared by its owner, cannot toggle sharing or write to a list they don't own |
| `Tenant-Business-Analyst` | Consumes CSV exports for correlation with sales/CRM data |
| Backend Engineer | Implements schema, RLS, and endpoints |
| Frontend Engineer | Implements the list/detail UI |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 10.1) | Backend engineer | Have `prospecting_lists`/`prospecting_list_entries` tables with RLS and sharing | `Social-Selling-Strategist` can save, score, and share lead lists | Tables exist with tenant RLS; CRUD endpoints tenant-scoped, writes owner-scoped; `shared` toggle owner-only, no `tenant_admin` override, non-owner write returns 404; `relationship_stage` constrained; entry CRUD references `Author` with all four ADR-0108 scores snapshotted; duplicate `author_id` returns 409; export/crm-handoff endpoints scoped here, wire contracts in ADR-0117; contract tests cover CRUD/owner-only-write/duplicate-409/cross-tenant-404 |
| US2 (Story 10.2) | `Social-Selling-Strategist` | Have a prospecting list page to add authors, set stages, add notes, and share lists | Manage leads and hand them off to outreach | `ProspectingListsView`/`ProspectingListDetailView` implemented; add from discovery/post feed; inline stage/notes/tags/custom-attributes editing for the owner; sharing toggle owner-only, read-only view for everyone else including `Tenant-Admin`; no enforced workflow transitions; metadata-only CSV export; export/CRM-handoff buttons present |

### 6.3 Workflow Diagrams / Steps

**Create list and add an author:**
1. User opens `ProspectingListsView`, clicks "New list", supplies `name`/`description` → `POST /v1/prospecting-lists`.
2. From influencer discovery/search/post feed, user clicks "Add to prospecting list" on an author card.
3. User selects the new list (or an existing one) → `POST /v1/prospecting-lists/:id/entries` with `author_id` and available topic/scores.
4. Entry appears in `ProspectingListDetailView` with `relationship_stage = 'new'` by default.

**Manage and prioritize:**
1. User opens `ProspectingListDetailView`, sorts/filters entries by `engagement_score`/`authenticity_score`/`relationship_stage`.
2. User edits `relationship_stage`, `notes`, or `tags` inline → `PATCH /v1/prospecting-lists/:id/entries/:entryId`.

**Share a list:**
1. The list's owner opens the list and toggles `shared = true` → `PATCH /v1/prospecting-lists/:id`.
2. Other `tenant_user`/`tenant_admin` accounts in the tenant can now see (read-only) the list via `GET /v1/prospecting-lists` — none of them, including `tenant_admin`, can edit it or toggle it back off.

**Export / handoff:**
1. User clicks "Export" on a list → `GET /v1/prospecting-lists/:id/export.csv` → CSV downloaded, metadata-only (contract: ADR-0117/FDD-0117).
2. User selects entries and clicks "Send to CRM" → `POST /v1/prospecting-lists/:id/crm-handoff` → pushed via `CRMConnector` (contract: ADR-0117/ADR-0095, FDD-0117).

---

## 7. Data Requirements

### 7.1 Data Inputs

User-supplied list `name`/`description`; author selections from discovery/search/post-feed surfaces (`author_id`, `platform_id`, `topic`, the four ADR-0108 scores from `Author`); user-curated `relationship_stage`/`notes`/`tags`/`custom_attributes`; the authenticated caller's `tenant_id` and `user_id`.

### 7.2 Data Outputs

Persisted list/entry rows; CSV export files; CRM-handoff acknowledgment responses; rendered UI views.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `prospecting_lists` | `id`, `tenant_id`, `owner_id`, `name`, `description`, `shared` (default `false`), `created_at`, `updated_at` | One list has many `prospecting_list_entries`; belongs to one `tenant_id` and one `owner_id` (a user) |
| `prospecting_list_entries` | `id`, `prospecting_list_id`, `tenant_id`, `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `influence_score`, `reach_score`, `relationship_stage` (`new`/`contacted`/`engaged`/`converted`/`passed`), `notes`, `tags` (array), `custom_attributes` (jsonb), `added_by_user_id`, `added_at`; `UNIQUE (prospecting_list_id, author_id)` | Belongs to one `prospecting_lists` row; references `Author` by `author_id` (no duplication of author fields beyond what's captured here); `author_id` has no `ON DELETE` cascade (ADR-0092 never hard-deletes `authors`); `owner_id`/`added_by_user_id` cascade on user deletion |
| `Author` (external, ADR-0004) | Author identity/public metadata | Referenced by `prospecting_list_entries.author_id`; not duplicated |
| `Author` scoring columns (external, ADR-0108) | `engagement_score`, `authenticity_score`, `influence_score`, `reach_score` | Source for the four snapshot columns, populated at add time; `AuthorTopicSignal` (ADR-0007) itself carries no score |

### 7.4 Validation Rules

- `prospecting_lists.tenant_id` and `owner_id` are required and immutable after creation.
- `shared` may only be set to `true`/`false` by the row's own `owner_id` (RLS-enforced, not a role check).
- `prospecting_list_entries.relationship_stage` must be one of the five defined enum values.
- `prospecting_list_entries.author_id` must reference an `Author` within the same `tenant_id` (or the tenant-visible author scope, per existing `Author` rules).
- `(prospecting_list_id, author_id)` must be unique — an author appears at most once per list; a duplicate add is a `409`, not a silent no-op or an upsert.
- `tags` is an array of user-supplied strings; `custom_attributes` is unstructured `jsonb` — no fixed vocabulary or schema enforced in v1.
- CSV export must never include automatically-derived contact fields (email, phone) — see FDD-0117 for the exact column set.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A prospecting list belongs to exactly one tenant and one owner. | `prospecting_lists` |
| BR2 | A list is visible (read-only unless owned) to its owner and, if `shared = true`, to all `tenant_user`/`tenant_admin` in the same tenant. | List visibility |
| BR3 | Only the list's own `owner_id` can set `shared = true`; there is no `tenant_admin` override (ADR-0044 §5c parity). | Sharing control |
| BR4 | `prospecting_list_entries` inherit the visibility of their parent list. | Entry visibility |
| BR5 | `relationship_stage` is a user-managed label; v1 enforces no workflow transitions, email automation, or reminders. | Entries |
| BR6 | Only public author metadata and user-curated notes may be stored or exported; private contact data is never scraped automatically. | Entries, export |
| BR7 | Export to CSV is metadata-only by default and excludes email, phone, or other private contact fields. | Export |
| BR8 | An author is added to a list by reference to `Author.id` only; full author records are never duplicated into `prospecting_list_entries`. | Entries |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `Author` table (ADR-0004) | Inbound (read) | Source of author identity referenced by `author_id` | SQL (Postgres, RLS-scoped) |
| `Author` scoring columns (ADR-0108) | Inbound (read) | Source of `engagement_score`/`authenticity_score`/`influence_score`/`reach_score` at add time | SQL / internal service |
| Influencer discovery UI (ADR-0108) | Inbound (entry point) | Supplies the "Add to prospecting list" action | Internal UI integration |
| Post feed | Inbound (entry point) | Alternate "Add to prospecting list" surface | Internal UI integration |
| `CRMConnector` (ADR-0095) via ADR-0117 | Outbound | Real CRM push delivery | Internal connector abstraction; wire contract in FDD-0117 |
| `ProspectingListsView` / `ProspectingListDetailView` | Outbound (consumer) | Calls the CRUD/export/handoff endpoints | REST / JSON over HTTPS |

---

## 10. Non-Functional Considerations

- **Security / access control:** Lists and entries are strictly tenant-scoped via RLS (NFR-001); only a list's own owner can toggle `shared` or write to it at any time, including while shared — no `tenant_admin` override (NFR-002).
- **Compliance:** No automatic harvesting/storage of private contact info beyond user-curated `notes`; export excludes PII by default (NFR-003).
- **Performance:** List/entry operations and export should respond within 2 seconds p95 for lists up to 5,000 entries (NFR-004).
- **Accessibility:** The list UI should be keyboard-navigable and screen-reader friendly, with clear ARIA semantics on tables and actions (NFR-005).
- **Maintainability:** The model reuses `Author` rather than duplicating it — only `author_id` and derived per-entry scores are stored (NFR-006).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Access to a list outside caller's tenant/ownership/sharing | Not found | `404`, not `403`, to avoid revealing existence |
| Non-owner attempts to toggle `shared`, or to write to a list/entry at all (including a `tenant_admin` viewing a shared list) | Not found | `404`, never `403` — RLS restricts the write-eligible row set to `owner_id`, so the request matches zero rows; this is a database-level ownership check, not a role check |
| Invalid `relationship_stage` value | Validation error | Entry create/update rejected |
| `author_id` references a nonexistent/cross-tenant author | Validation error | Entry create rejected |
| `author_id` already present on the list | Conflict | `409 Conflict`; use `PATCH .../entries/:entryId` to update the existing entry instead |
| Export of a list the caller cannot access | Not found | `404` |
| CRM handoff errors (unconfigured connector, etc.) | Per FDD-0117 | Defined in FDD-0117, not duplicated here |

---

## 12. Assumptions and Dependencies

- `Author`, `AuthorTopicSignal` (ADR-0004, ADR-0007), and the `Author` scoring columns (ADR-0108) already exist and are stable.
- Influencer discovery/scoring (ADR-0108) provides the "Add to prospecting list" entry point (Stories 12.15/12.16).
- Tenant and user identity plus the `app.user_id` session mechanism (ADR-0044 §5c) are already in place.
- CRM handoff delivery depends on the `CRMConnector` abstraction (ADR-0095) and its prospecting-list wire contract (ADR-0117, Stories 13.13/13.14); this FDD only covers this endpoint's scoping, not the contract itself (see FDD-0117).
- ADR-0086 accepted 2026-08-27; Stories 10.1/10.2 are Ready.

---

## 13. Open Questions — all resolved in ADR-0086's accepted revision

| ID | Question | Resolution |
|---|---|---|
| Q1 | Should `engagement_score`/`authenticity_score` be recomputed on demand or denormalized at add time? | **Denormalized.** All four ADR-0108 scores (`engagement_score`, `authenticity_score`, `influence_score`, `reach_score`) are snapshotted at add time and never recomputed in place. |
| Q2 | Should `prospecting_list_entries` support custom fields per tenant? | **Yes** — `custom_attributes jsonb`, unstructured, no fixed schema in v1. |
| Q3 | What is the maximum number of entries per list — is pagination required in v1? | **No fixed cap.** `GET .../entries` is cursor-paginated (default 50, max 200); inventing an entry-count ceiling without usage data was rejected as inconsistent with ADR-0044/ADR-0020's precedent. |
| Q4 | Should `relationship_stage` transitions be logged in `platform_admin_audit_log`? | **Deferred**, and redirected: not `platform_admin_audit_log` (scoped to platform-admin actions elsewhere in this codebase) — a future workflow-engine ADR would use `outbound_activities`, matching ADR-0073/0075/0095/0117's pattern for tenant-level outward actions. v1 only touches `updated_at`. |
| Q5 | Exact write-access policy for entries/notes/tags on a shared list? | **Owner-only**, always — sharing grants read-only visibility, never write access to anyone else, including `tenant_admin` (ADR-0044 §5c parity). |
| Q6 | Behavior when adding a duplicate `author_id` to the same list? | **Reject** with `409 Conflict` (`UNIQUE (prospecting_list_id, author_id)`); use `PATCH .../entries/:entryId` to update the existing entry instead. |

---

## 14. Appendix

- **ADR:** `docs/adr/0086-prospecting-list-model-and-sharing.md` (Status: **Accepted**, 2026-08-27)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0086-Prospecting-List-Model-And-Sharing.md`
- **Feature design:** `docs/product-research/feature-designs/18-prospecting-list.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0004 (`Author`), ADR-0007 (`AuthorTopicSignal`), ADR-0044 (watchlist ownership pattern), ADR-0092 (author-initiated takedown), ADR-0108 (`Author` scoring), ADR-0095 (`CRMConnector`), ADR-0117 (export/CRM-push wire contract)
- **User stories:** Story 10.1 (backend, **Ready**), Story 10.2 (frontend, Blocked — depends on Story 10.1) in `docs/user-stories/epic-10-adr-0086-to-0094.md`; related Stories 12.15/12.16 (influencer discovery UI, epic-12), 13.13/13.14 (CRM export/push, epic-13)
- **Glossary:**
  - *Prospecting list* — a tenant-scoped, owner-controlled named list of authors tracked for social-selling outreach.
  - *Relationship stage* — a user-managed label (`new`/`contacted`/`engaged`/`converted`/`passed`) indicating outreach status.
  - *CRM handoff* — the API contract for pushing selected list entries to a connected CRM, via `CRMConnector` (ADR-0095); wire contract in ADR-0117.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0086/BRD-0086. v0.2, 2026-08-27 — synced to ADR-0086's accepted revision: owner-only sharing (no `tenant_admin` override), all six Open Questions resolved, corrected ADR-0095/0117 citations, all four ADR-0108 scores, `custom_attributes`, dedup `409`, non-owner-write `404` (not `403`), export/CRM wire contract deferred to FDD-0117.
