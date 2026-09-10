---
name: prospecting-lists
description: Prospecting list management, author qualification, granular sharing scopes, snapshot scoring, export, deduplicated CRM handoff, and CRUD API (ADR-0086, ADR-0117, ADR-0129, Stories 10.1, 13.13, 17.1).
---

# Prospecting Lists (ADR-0086 / ADR-0117 / ADR-0129)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.1.prospecting-list-model.contract.test.ts` — Story 10.1 contract test.
- `social-listening-core/contracts/epic-13/story-13.13.prospecting-list-export-and-crm-push.contract.test.ts` — Story 13.13 contract test.
- `social-listening-core/contracts/epic-17/story-17.1.prospecting-list-refinements.contract.test.ts` — Story 17.1 contract test.

## Purpose
Enables `Social-Selling-Strategist` and sales team collaborators to create, annotate, qualify, and share lead lists derived from discovered authors without exposing private contact data or allowing unauthorized modifications, supporting collaborative lead entry under workspace-write scope and automated cross-network deduplication on CRM handoff.

## Invariants
1. **Tenant & Owner Scoping:** Lists and entries are partitioned by `tenant_id`. Parent list deletion and sharing scope changes are restricted strictly to `owner_id`.
2. **Granular Sharing Scopes (ADR-0129):**
   - `'private'`: Only the list owner can view and mutate the list and its entries.
   - `'workspace_read'`: Teammates within the tenant can read the list and its entries, but cannot add, edit, or remove entries (mutation returns `404`).
   - `'workspace_write'`: Teammates within the tenant can add, edit, and delete entries (`prospecting_list_entries`), but cannot delete the list or reassign list ownership/sharing scope (attempts return `403 Forbidden` on PATCH, `404 Not Found` on DELETE via RLS).
3. **No Role Override for Owner Actions:** Modifying list properties or deleting the list remains strictly restricted to `owner_id`; `tenant_admin` cannot override ownership mutation boundaries.
4. **Cross-Network CRM Contact Deduplication (ADR-0129):**
   - When pushing to CRM with `deduplicate=true`, entries sharing canonical author handles or verified links are clustered into a single `DeduplicatedAuthorContact` CRM payload with merged notes, union of tags, and best snapshot scores.
5. **Deduplication:** `UNIQUE (prospecting_list_id, author_id)` enforces single appearance of an author record per list. Duplicate add returns `409 Conflict`.
6. **Score Snapshotting:** At entry creation, `engagement_score`, `authenticity_score`, `influence_score`, and `reach_score` are snapshotted from `authors` (ADR-0108) and never updated in place.
7. **Entry Author Metadata:** At entry creation, `author_name` and `public_url` are denormalized from `authors` (or supplied explicitly). They feed the metadata-only CSV and CRM payloads.
8. **Relationship Stages:** Constrained to `new`, `contacted`, `engaged`, `converted`, `passed`.
9. **Pagination:** `GET /v1/prospecting-lists/:id/entries` is cursor-paginated (default limit 50, max 200).
10. **Export Authorization:** `GET /v1/prospecting-lists/:id/export(.csv)` and `POST /v1/prospecting-lists/:id/export` are restricted to the list owner and gated by the `exports` feature.
11. **CRM Handoff Authorization:** `POST /v1/prospecting-lists/:id/crm-handoff` is restricted to authorized list viewers/owners, gated by the `prospecting_crm` feature, and records one `outbound_activities` row per pushed contact with `activity_type='crm_prospect'`.

## Endpoints
- `POST /v1/prospecting-lists`: Create prospecting list (accepts `sharingScope` / legacy `shared`)
- `GET /v1/prospecting-lists`: List owned and shared prospecting lists
- `GET /v1/prospecting-lists/:id`: Get prospecting list metadata
- `PATCH /v1/prospecting-lists/:id`: Update name, description (owner only)
- `PATCH /v1/prospecting-lists/:id/sharing`: Update sharing scope (`private`, `workspace_read`, `workspace_write` — owner only)
- `DELETE /v1/prospecting-lists/:id`: Delete prospecting list (owner only)
- `POST /v1/prospecting-lists/:id/entries`: Add author entry (owner or teammate if `workspace_write`)
- `GET /v1/prospecting-lists/:id/entries`: Get cursor-paginated entries
- `PATCH /v1/prospecting-lists/:id/entries/:entryId`: Update entry stage, notes, tags, custom attributes (owner or teammate if `workspace_write`)
- `DELETE /v1/prospecting-lists/:id/entries/:entryId`: Delete entry (owner or teammate if `workspace_write`)
- `GET /v1/prospecting-lists/:id/export(.csv)`: Synchronous, metadata-only CSV export (≤ 5,000 rows)
- `POST /v1/prospecting-lists/:id/export`: Asynchronous CSV export (up to 100,000 rows); status via `GET /v1/posts/exports/:jobId`
- `POST /v1/prospecting-lists/:id/crm-handoff`: Push entries to CRM as `lead`, supporting `?deduplicate=true` cross-platform author clustering


## Relations to other components

- **`authors` table / ADR-0108** — author `engagement_score`, `authenticity_score`, `influence_score`, and `reach_score` are snapshotted into `prospecting_list_entries` at creation; also `author_name` and `public_url` are denormalized from `authors`. Score columns are never updated in-place on the entry.
- **`outbound_activities` table** — `POST /v1/prospecting-lists/:id/crm-handoff` writes one `outbound_activities` row per pushed contact with `activity_type='crm_prospect'`; this is the same audit table used by the reply/publish framework (ADR-0073/0075).
- **`withTenant()` (RLS middleware)** — all router handlers run inside `withTenant()`, scoping every query to the caller's `tenant_id` via the `app_user` role and PostgreSQL RLS.
- **`prospecting-list-ui` (admin SKILL.md)** — the frontend counterpart (Story 10.2, ADR-0086) consuming `GET/POST/PATCH/DELETE /v1/prospecting-lists/**` and the CRM handoff endpoint.
- **`crm-handoff-ui` (admin SKILL.md)** — frontend modal for the CRM push flow that calls `/api/prospecting-lists/:id/crm-handoff`.
- **`posts-csv-export` skill** — `POST /v1/prospecting-lists/:id/export` delegates async export jobs through the shared `postExportEngine.ts` and the same `export_jobs` table.
