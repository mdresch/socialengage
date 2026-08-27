---
name: prospecting-lists
description: Prospecting list management, author qualification, sharing model, snapshot scoring, and CRUD API (ADR-0086, Story 10.1).
---

# Prospecting Lists (ADR-0086)

## Purpose
Enables `Social-Selling-Strategist` to create, annotate, qualify, and share lead lists derived from discovered authors without exposing private contact data or allowing unauthorized modifications.

## Invariants
1. **Tenant & Owner Scoping:** Lists and entries are partitioned by `tenant_id`. Write mutations (`INSERT`, `UPDATE`, `DELETE`, `PATCH`, and sharing toggle) are restricted strictly to `owner_id`.
2. **Sharing Semantics:** A list with `shared = true` is readable by other `tenant_user` and `tenant_admin` accounts within the same tenant. Teammates have **read-only** access; they cannot add/edit/remove entries or mutate the list.
3. **No Role Override:** A non-owner's write attempt on a visible shared list returns `404` via RLS query boundary, never `403` and never allows `tenant_admin` bypass.
4. **Deduplication:** `UNIQUE (prospecting_list_id, author_id)` enforces single appearance per list. Duplicate add returns `409 Conflict`.
5. **Score Snapshotting:** At entry creation, `engagement_score`, `authenticity_score`, `influence_score`, and `reach_score` are snapshotted from `authors` (ADR-0108) and never updated in place.
6. **Relationship Stages:** Constrained to `new`, `contacted`, `engaged`, `converted`, `passed`.
7. **Pagination:** `GET /v1/prospecting-lists/:id/entries` is cursor-paginated (default limit 50, max 200).

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
