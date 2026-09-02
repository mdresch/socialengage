---
name: prospecting-lists
description: Prospecting list management, author qualification, sharing model, snapshot scoring, export, CRM handoff, and CRUD API (ADR-0086, ADR-0117, Stories 10.1, 13.13).
---

# Prospecting Lists (ADR-0086 / ADR-0117)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.1.prospecting-list-model.contract.test.ts` — Story 10.1 contract test.
- `social-listening-core/contracts/epic-13/story-13.13.prospecting-list-export-and-crm-push.contract.test.ts` — Story 13.13 contract test.

## Purpose
Enables `Social-Selling-Strategist` to create, annotate, qualify, and share lead lists derived from discovered authors without exposing private contact data or allowing unauthorized modifications.

## Invariants
1. **Tenant & Owner Scoping:** Lists and entries are partitioned by `tenant_id`. Write mutations (`INSERT`, `UPDATE`, `DELETE`, `PATCH`, and sharing toggle) are restricted strictly to `owner_id`.
2. **Sharing Semantics:** A list with `shared = true` is readable by other `tenant_user` and `tenant_admin` accounts within the same tenant. Teammates have **read-only** access; they cannot add/edit/remove entries or mutate the list.
3. **No Role Override:** A non-owner's write attempt on a visible shared list returns `404` via RLS query boundary, never `403` and never allows `tenant_admin` bypass.
4. **Deduplication:** `UNIQUE (prospecting_list_id, author_id)` enforces single appearance per list. Duplicate add returns `409 Conflict`.
5. **Score Snapshotting:** At entry creation, `engagement_score`, `authenticity_score`, `influence_score`, and `reach_score` are snapshotted from `authors` (ADR-0108) and never updated in place.
6. **Entry Author Metadata:** At entry creation, `author_name` and `public_url` are denormalized from `authors` (or supplied explicitly). They feed the metadata-only CSV and CRM payloads.
7. **Relationship Stages:** Constrained to `new`, `contacted`, `engaged`, `converted`, `passed`.
8. **Pagination:** `GET /v1/prospecting-lists/:id/entries` is cursor-paginated (default limit 50, max 200).
9. **Export Authorization:** `GET /v1/prospecting-lists/:id/export(.csv)` and `POST /v1/prospecting-lists/:id/export` are restricted to the list owner and gated by the `exports` feature.
10. **CRM Handoff Authorization:** `POST /v1/prospecting-lists/:id/crm-handoff` is restricted to the list owner, gated by the `prospecting_crm` feature, and records one `outbound_activities` row per pushed entry with `activity_type='crm_prospect'`.

## Known ADR conflicts
- ADR-0117 §5 names "list owner, a user with edit share, or tenant_admin" as actors for export/push. ADR-0086 §2 rejects tenant-admin override and the repository has no per-list "edit share" table. Story 13.13 therefore enforces owner-only for v1; edit-share and tenant-admin override remain deferred to the proposed ADR-0129 (list sharing refinement).

## Endpoints
- `POST /v1/prospecting-lists`: Create prospecting list
- `GET /v1/prospecting-lists`: List owned and shared prospecting lists
- `GET /v1/prospecting-lists/:id`: Get prospecting list metadata
- `PATCH /v1/prospecting-lists/:id`: Update name, description, shared
- `DELETE /v1/prospecting-lists/:id`: Delete prospecting list
- `POST /v1/prospecting-lists/:id/entries`: Add author entry
- `GET /v1/prospecting-lists/:id/entries`: Get cursor-paginated entries
- `PATCH /v1/prospecting-lists/:id/entries/:entryId`: Update entry stage, notes, tags, custom attributes
- `DELETE /v1/prospecting-lists/:id/entries/:entryId`: Delete entry
- `GET /v1/prospecting-lists/:id/export(.csv)`: Synchronous, metadata-only CSV export (≤ 5,000 rows)
- `POST /v1/prospecting-lists/:id/export`: Asynchronous CSV export (up to 100,000 rows); status via `GET /v1/posts/exports/:jobId`
- `POST /v1/prospecting-lists/:id/crm-handoff`: Push selected entries (or all) to a CRM connector as `lead`
