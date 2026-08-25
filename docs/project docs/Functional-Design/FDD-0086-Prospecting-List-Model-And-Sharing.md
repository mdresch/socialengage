# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0086 Prospecting List Model and Sharing — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Draft |
| Related Documents | ADR-0086 (prospecting list model and sharing), ADR-0004 (`Author` model), ADR-0007 (`AuthorTopicSignal`), ADR-0044 (watchlist ownership pattern), ADR-0091/ADR-0117 (CRM connector, future), BRD-0086, `docs/product-research/feature-designs/18-prospecting-list.md`, Stories 10.1 and 10.2 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0086's decision — the `prospecting_lists`/`prospecting_list_entries` data model, tenant-admin-gated sharing rule, CRUD endpoints, and metadata-only export/CRM-handoff contract — into a functional design covering the capabilities the backend must expose and the UI workflow that manages leads within it.

**Note:** ADR-0086's Status is **Proposed**, not Accepted. This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:** the `prospecting_lists` and `prospecting_list_entries` tables and their RLS/ownership rules; list and entry CRUD endpoints; the `shared` sharing toggle and its `tenant_admin`-only authorization; `relationship_stage` as a constrained label; metadata-only CSV export; the `POST .../crm-handoff` contract shape (delivery mechanism deferred); the "Add to prospecting list" UI entry point; the list/detail UI views.
- **Out of scope:** a workflow engine or enforced `relationship_stage` transitions; automated email follow-ups/reminders/outreach sequences; public or anonymous list sharing; automatic scraping/storage of private contact data; the full real-time `CRMConnector` implementation (future ADR-0091/0117); AI-driven stage recommendations, outreach drafting, or duplicate detection; bulk import from external spreadsheets.

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
| G3 | Enable controlled, tenant-scoped collaboration | Only `tenant_admin` can share a list; sharing never crosses tenant boundaries |
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
  - `PATCH` may update `name`/`description`; changing `shared` is a distinct, more restrictively authorized operation (see Section 5.3).
  - `DELETE` removes the list; cascades to its entries.
- **Outputs:** The created/updated list record; a filtered list collection; a delete confirmation.
- **Error handling:** A request against a list outside the caller's tenant or ownership/sharing visibility returns `404` (not `403`, so as not to reveal existence of another tenant's list). Updating a nonexistent list returns `404`.
- **Edge cases:** Deleting a list a user does not own (even within the same tenant, if not shared) is rejected/`404`. A `shared` list can be read by any `tenant_user`/`tenant_admin` in the tenant but only updated/deleted by its `owner_id` (or per whatever tenant-admin override policy is defined — see Open Question).

### 5.2 Feature / Capability: Prospecting List Entry CRUD

- **Description:** Add, update, and remove author entries within a list.
- **Triggers:** `POST /v1/prospecting-lists/:id/entries`, `PATCH /v1/prospecting-lists/:id/entries/:entryId`, `DELETE /v1/prospecting-lists/:id/entries/:entryId`.
- **Inputs:** `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score` (at add time, typically populated from `AuthorTopicSignal`); `relationship_stage`, `notes`, `tags` (user-curated, editable over time).
- **Processing:**
  - An entry references `Author` by `author_id` only; no author fields are duplicated beyond what is explicitly captured on the entry (`platform_id`, `topic`, scores as of add time).
  - `relationship_stage` must be one of `new`, `contacted`, `engaged`, `converted`, `passed`; it is a free-standing label with no enforced transition rules in v1.
  - `notes` and `tags` are freely editable by any user with write access to the list (owner, or any tenant user if the list is shared — see Open Question on shared-list entry write permissions).
  - `added_by_user_id` and `added_at` are stamped at creation and not user-editable thereafter.
  - The entry inherits its parent list's visibility: if the list is private, its entries are private; if shared, its entries are shared.
- **Outputs:** The created/updated entry; a delete confirmation.
- **Error handling:** Adding an entry referencing a nonexistent or cross-tenant `author_id` is rejected. An invalid `relationship_stage` value is rejected with a validation error. Operating on an entry in a list the caller cannot access returns `404`.
- **Edge cases:** Adding the same `author_id` to the same list twice — behavior (duplicate entry vs. reject vs. update-in-place) should be handled gracefully per BR-002's "duplicate or invalid authors are handled gracefully" (see Open Question for exact policy). Removing the last entry from a list leaves an empty, still-valid list.

### 5.3 Feature / Capability: List Sharing Control

- **Description:** Gate the `shared` visibility flag to `tenant_admin` only.
- **Triggers:** A `tenant_admin` toggles sharing on a list (via `PATCH /v1/prospecting-lists/:id` or a dedicated sharing action).
- **Inputs:** `id`, desired `shared` boolean value, caller's role.
- **Processing:** The handler verifies the caller's role is `tenant_admin` before allowing a change to `shared`; any other field on the same `PATCH` may still be caller-owner-editable, but the `shared` field specifically requires the admin role.
- **Outputs:** The updated list with the new `shared` value.
- **Error handling:** A non-`tenant_admin` caller attempting to change `shared` is rejected (role-authorization failure), even if they own the list.
- **Edge cases:** A `tenant_admin` who is not the list's owner can still toggle sharing on another user's list (admin override), consistent with `tenant_admin` scope elsewhere in the platform — this should be confirmed against the project's general admin-override conventions.

### 5.4 Feature / Capability: Metadata-Only CSV Export

- **Description:** Exports a list's entries to CSV, deliberately excluding automatically-scraped private contact data.
- **Triggers:** `POST /v1/prospecting-lists/:id/export`.
- **Inputs:** `id` of the list to export; caller's visibility into that list.
- **Processing:** Produces a CSV containing `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `relationship_stage`, `notes`, `tags`, and a link to the author's public profile (where available). No email, phone, or other private contact field is included unless the user explicitly typed it into `notes` — and even then, only the tenant's own curated text, never anything scraped automatically.
- **Outputs:** A CSV file/stream.
- **Error handling:** Exporting a list the caller cannot access returns `404`. An empty list exports a header-only CSV, not an error.
- **Edge cases:** A `notes` field containing commas/newlines/quotes must be correctly CSV-escaped. Very large lists (approaching the entries-per-list ceiling, see Open Question) should export within the performance target (NFR-004 in BRD-0086: p95 < 2s for lists up to 5,000 entries).

### 5.5 Feature / Capability: CRM Handoff Contract (Definition Only)

- **Description:** Defines the request/response shape for pushing selected list entries toward a future CRM connector, without implementing real delivery in this ADR's scope.
- **Triggers:** `POST /v1/prospecting-lists/:id/crm-handoff`.
- **Inputs:** `id` of the list; selected entry IDs; a target CRM connector identifier (structure anticipates the future `CRMConnector` abstraction, ADR-0091/ADR-0117).
- **Processing:** Validates the caller's access to the list and the selected entries; the actual push to an external CRM is out of scope here and depends on the future `CRMConnector` ADR/story (Story 13.13/13.14) being implemented.
- **Outputs:** An acknowledgment that the handoff request is accepted/queued, or an explicit "not yet available" response if no connector is configured, pending the downstream capability.
- **Error handling:** A request naming a connector that does not exist/is not configured returns a clear, distinct error rather than silently no-op-ing.
- **Edge cases:** This endpoint is deliberately a placeholder contract; behavior when no CRM connector exists at all should be explicit and documented, not undefined.

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
  - `ProspectingListsView` shows all lists visible to the user, with create/rename/delete actions and a sharing indicator (and toggle, for `tenant_admin`).
  - `ProspectingListDetailView` shows entries in a table/list, with inline editing of `relationship_stage`, `notes`, and `tags`; sortable/filterable by score and stage.
  - Export and CRM-handoff actions are present in the UI and call the corresponding endpoints (5.4, 5.5).
- **Outputs:** Rendered list/detail views; inline edits persisted via the entry-update endpoint.
- **Error handling:** Inline edit failures (e.g., invalid `relationship_stage`) surface a validation message without discarding the user's other unsaved edits where feasible.
- **Edge cases:** A shared list viewed by a non-owner may present read/write affordances differently depending on the resolved write-access policy (Open Question).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| `Social-Selling-Strategist` | Primary user; creates/manages lists, adds authors, records stage/notes/tags |
| `Tenant-User` | Secondary user; views shared lists, may contribute prospects |
| `Tenant-Admin` | Controls the `shared` toggle; may have broader write access to tenant lists |
| `Tenant-Business-Analyst` | Consumes CSV exports for correlation with sales/CRM data |
| Backend Engineer | Implements schema, RLS, and endpoints |
| Frontend Engineer | Implements the list/detail UI |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 10.1) | Backend engineer | Have `prospecting_lists`/`prospecting_list_entries` tables with RLS and sharing | `Social-Selling-Strategist` can save, score, and share lead lists | Tables exist with tenant RLS; CRUD endpoints tenant-scoped/user-owned; `shared` toggle restricted to `tenant_admin`; `relationship_stage` constrained; entry CRUD references `Author`; metadata-only export; `crm-handoff` defined but deferred; contract tests cover CRUD/sharing/cross-tenant 404 |
| US2 (Story 10.2) | `Social-Selling-Strategist` | Have a prospecting list page to add authors, set stages, add notes, and share lists | Manage leads and hand them off to outreach | `ProspectingListsView`/`ProspectingListDetailView` implemented; add from discovery/post feed; inline stage/notes/tags editing; sharing toggle for `tenant_admin`; no enforced workflow transitions; metadata-only CSV export; export/CRM-handoff buttons present |

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
1. `Tenant-Admin` opens the list and toggles `shared = true` → `PATCH /v1/prospecting-lists/:id`.
2. Other `tenant_user`/`tenant_admin` accounts in the tenant can now see the list via `GET /v1/prospecting-lists`.

**Export / handoff:**
1. User clicks "Export" on a list → `POST /v1/prospecting-lists/:id/export` → CSV downloaded, metadata-only.
2. User selects entries and clicks "Send to CRM" (when a connector is configured) → `POST /v1/prospecting-lists/:id/crm-handoff` → request accepted/queued pending the future `CRMConnector`.

---

## 7. Data Requirements

### 7.1 Data Inputs

User-supplied list `name`/`description`; author selections from discovery/search/post-feed surfaces (`author_id`, `platform_id`, `topic`, scores from `AuthorTopicSignal`); user-curated `relationship_stage`/`notes`/`tags`; the authenticated caller's `tenant_id`, `user_id`, and role.

### 7.2 Data Outputs

Persisted list/entry rows; CSV export files; CRM-handoff acknowledgment responses; rendered UI views.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `prospecting_lists` | `id`, `tenant_id`, `owner_id`, `name`, `description`, `shared` (default `false`), `created_at`, `updated_at` | One list has many `prospecting_list_entries`; belongs to one `tenant_id` and one `owner_id` (a user) |
| `prospecting_list_entries` | `id`, `prospecting_list_id`, `tenant_id`, `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `relationship_stage` (`new`/`contacted`/`engaged`/`converted`/`passed`), `notes`, `tags` (array), `added_by_user_id`, `added_at` | Belongs to one `prospecting_lists` row; references `Author` by `author_id` (no duplication of author fields beyond what's captured here) |
| `Author` (external, ADR-0004) | Author identity/public metadata | Referenced by `prospecting_list_entries.author_id`; not duplicated |
| `AuthorTopicSignal` (external, ADR-0007) | Topical relevance/derived scores | Source for `engagement_score`/`authenticity_score` populated at add time |

### 7.4 Validation Rules

- `prospecting_lists.tenant_id` and `owner_id` are required and immutable after creation.
- `shared` may only be set to `true`/`false` by a caller with the `tenant_admin` role.
- `prospecting_list_entries.relationship_stage` must be one of the five defined enum values.
- `prospecting_list_entries.author_id` must reference an `Author` within the same `tenant_id` (or the tenant-visible author scope, per existing `Author` rules).
- `tags` is an array of user-supplied strings; no fixed vocabulary enforced in v1.
- CSV export must never include automatically-derived contact fields (email, phone) — only fields explicitly in the defined column set, plus `notes` as free text.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A prospecting list belongs to exactly one tenant and one owner. | `prospecting_lists` |
| BR2 | A list is visible to its owner and, if `shared = true`, to all `tenant_user`/`tenant_admin` in the same tenant. | List visibility |
| BR3 | Only `tenant_admin` can set `shared = true`. | Sharing control |
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
| `AuthorTopicSignal` (ADR-0007) | Inbound (read) | Source of `engagement_score`/`authenticity_score` at add time | SQL / internal service |
| Influencer discovery UI (ADR-0108) | Inbound (entry point) | Supplies the "Add to prospecting list" action | Internal UI integration |
| Post feed | Inbound (entry point) | Alternate "Add to prospecting list" surface | Internal UI integration |
| Future `CRMConnector` (ADR-0091/ADR-0117) | Outbound (deferred) | Real CRM push delivery | Internal connector abstraction, not yet implemented |
| `ProspectingListsView` / `ProspectingListDetailView` | Outbound (consumer) | Calls the CRUD/export/handoff endpoints | REST / JSON over HTTPS |

---

## 10. Non-Functional Considerations

- **Security / access control:** Lists and entries are strictly tenant-scoped via RLS (NFR-001); only `tenant_admin` can toggle `shared` (NFR-002).
- **Compliance:** No automatic harvesting/storage of private contact info beyond user-curated `notes`; export excludes PII by default (NFR-003).
- **Performance:** List/entry operations and export should respond within 2 seconds p95 for lists up to 5,000 entries (NFR-004).
- **Accessibility:** The list UI should be keyboard-navigable and screen-reader friendly, with clear ARIA semantics on tables and actions (NFR-005).
- **Maintainability:** The model reuses `Author` rather than duplicating it — only `author_id` and derived per-entry scores are stored (NFR-006).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Access to a list outside caller's tenant/ownership/sharing | Not found | `404`, not `403`, to avoid revealing existence |
| Non-`tenant_admin` attempts to toggle `shared` | Authorization error | Request rejected; other fields on the same update may still succeed independently, or the whole update is rejected (implementation choice, must be consistent) |
| Invalid `relationship_stage` value | Validation error | Entry create/update rejected |
| `author_id` references a nonexistent/cross-tenant author | Validation error | Entry create rejected |
| Export of a list the caller cannot access | Not found | `404` |
| CRM handoff to an unconfigured/nonexistent connector | Explicit "connector not available" error | Request rejected, not silently queued |

---

## 12. Assumptions and Dependencies

- `Author` and `AuthorTopicSignal` (ADR-0004, ADR-0007) already exist and are stable.
- Influencer discovery/scoring (ADR-0108) provides the "Add to prospecting list" entry point (Stories 12.15/12.16).
- Tenant and user identity plus role-based access are already in place.
- CRM handoff delivery depends on a future `CRMConnector` abstraction (ADR-0091/ADR-0117, Stories 13.13/13.14); this FDD only covers the request/response contract shape, not real delivery.
- Depends on ADR-0086 being accepted before Stories 10.1/10.2 are implemented.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `engagement_score` and `authenticity_score` be recomputed on demand or denormalized at add time (and left stale thereafter)? | Technical Lead | Before implementation |
| Q2 | Should `prospecting_list_entries` support custom fields per tenant? | Product Owner | Post-v1 candidate |
| Q3 | What is the maximum number of entries per list — is pagination required in v1? | Technical Lead | Before implementation |
| Q4 | Should `relationship_stage` transitions be logged in `platform_admin_audit_log` in the future? | Technical Lead | Future consideration |
| Q5 | Exact write-access policy for entries/notes/tags on a shared list — can any tenant user with read access also edit, or only the owner/admin? | Product Owner | Before implementation |
| Q6 | Behavior when adding a duplicate `author_id` to the same list — reject, merge, or allow duplicates? | Product Owner | Before implementation |

---

## 14. Appendix

- **ADR:** `docs/adr/0086-prospecting-list-model-and-sharing.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0086-Prospecting-List-Model-And-Sharing.md`
- **Feature design:** `docs/product-research/feature-designs/18-prospecting-list.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0004 (`Author`), ADR-0007 (`AuthorTopicSignal`), ADR-0044 (watchlist ownership pattern), ADR-0091/ADR-0117 (future CRM connector), ADR-0108 (influencer discovery)
- **User stories:** Story 10.1 (backend), Story 10.2 (frontend) in `docs/user-stories/epic-10-adr-0086-to-0094.md`; related Stories 12.15/12.16 (influencer discovery UI, epic-12), 13.13/13.14 (CRM export/push, epic-13) — Blocked, pending ADR acceptance
- **Glossary:**
  - *Prospecting list* — a tenant-scoped, user-owned named list of authors tracked for social-selling outreach.
  - *Relationship stage* — a user-managed label (`new`/`contacted`/`engaged`/`converted`/`passed`) indicating outreach status.
  - *CRM handoff* — the API contract for pushing selected list entries to a connected CRM, pending a future connector.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0086/BRD-0086.
