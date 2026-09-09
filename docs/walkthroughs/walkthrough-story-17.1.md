# Walkthrough — Story 17.1: Deduplicated Prospecting List Export and Sharing ACLs

## 1. Summary of Accomplishments
Implemented granular prospecting list sharing scopes and cross-network author contact deduplication for CRM handoff in `social-listening-core` per **ADR-0129**, **BRD-0129**, **FDD-0129**, **TDS-0129**, and **Story 17.1**:

### 1.1 Data Model & RLS Refinements
- **DDL Migration (`0080_refine_prospecting_list_sharing_and_dedup.sql`):**
  - Added `sharing_scope TEXT NOT NULL DEFAULT 'private'` with check constraint `CHECK (sharing_scope IN ('private', 'workspace_read', 'workspace_write'))`.
  - Backfilled existing `shared = TRUE` rows to `sharing_scope = 'workspace_read'`.
  - Updated PostgreSQL Row Level Security (RLS) policies:
    - `prospecting_lists_tenant_select`: allows teammates to select lists with `sharing_scope IN ('workspace_read', 'workspace_write')` or `shared = TRUE`.
    - `prospecting_list_entries_select`: allows teammates to view entries for lists with `sharing_scope IN ('workspace_read', 'workspace_write')`.
    - `prospecting_list_entries_insert`, `update`, `delete`: allows teammates to insert, update, and delete entries when `pl.sharing_scope = 'workspace_write'`.
    - Preserved strict owner isolation for parent list updates and deletions (non-owner list mutations return `404` via RLS).

### 1.2 Store & Router Updates
- **Store Functions (`prospectingListStore.ts`):**
  - Updated `ProspectingList` interface with `sharing_scope: SharingScope`.
  - Updated `createProspectingList` and `updateProspectingList` to support `sharingScope` with legacy `shared` fallback mapping.
  - Implemented `updateProspectingListScope(tenantId, userId, listId, sharingScope)` setting both `sharing_scope` and synchronized `shared` boolean.
- **REST API Routes (`prospectingListsRouter.ts`):**
  - `POST /v1/prospecting-lists`: accepts `sharingScope`.
  - `PATCH /v1/prospecting-lists/:id/sharing`: role-gated endpoint allowing strictly `owner_id` to adjust sharing scope (`403 Forbidden` for non-owners, `400` for invalid scopes).
  - `POST /v1/prospecting-lists/:id/entries`: catches RLS policy check failures (`42501`) and returns `404 Not Found` when non-owner attempts additions on `workspace_read` lists.
  - `POST /v1/prospecting-lists/:id/crm-handoff`: accepts `?deduplicate=true` query parameter and delegates to the deduplication clustering pipeline.

### 1.3 Cross-Network Identity Clustering Engine (`prospectingDeduplicationEngine.ts` & `prospectingCRMHandoffService.ts`)
- Implemented `clusterDeduplicatedContacts()`:
  - Canonical handle normalization (case-insensitive, strips leading `@`, handles public profile URL paths).
  - Merges multi-platform entries for the same creator into a unified `DeduplicatedAuthorContact`:
    - Combined `matchedHandles: Array<{ platformId, handle, publicUrl }>`.
    - Highest `bestEngagementScore` and `bestInfluenceScore` across profiles.
    - Consolidated notes and union of tags.
  - Generates unified CRM payloads preserving traceability to all source `entryIds`.
  - Maintains separate distinct records when handles do not conclusively match (zero false-positive merges).

---

## 2. Verification Results

### 2.1 Story 17.1 Contract Test Suite
```bash
npm test contracts/epic-17/story-17.1.prospecting-list-refinements.contract.test.ts
```
**Output:**
```
PASS contracts/epic-17/story-17.1.prospecting-list-refinements.contract.test.ts (11.058 s)
  Story 17.1 — Prospecting List Model Refinements & Deduplicated CRM Sync Contract
    √ AC1: Schema refinement: sharing_scope defaults to private, accepts workspace_read / workspace_write, backfills shared=true (201 ms)
    √ AC2/AC3: Teammate can view lists and entries in workspace_read, but cannot add, update, or delete entries (returns 404) (184 ms)
    √ AC4: Teammate can add, update, and delete entries when sharing_scope is workspace_write (417 ms)
    √ AC5: Teammate cannot mutate list properties or delete list even under workspace_write scope (125 ms)
    √ AC6: Owner can update sharing scope via PATCH /v1/prospecting-lists/:id/sharing (138 ms)
    √ AC7: Cross-network author contact deduplication during CRM handoff (197 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        11.215 s
```

### 2.2 Predecessor Regression Suites (Stories 10.1 and 13.13)
```bash
npm test contracts/epic-10/story-10.1.prospecting-list-model.contract.test.ts contracts/epic-13/story-13.13.prospecting-list-export-and-crm-push.contract.test.ts
```
**Output:**
```
PASS contracts/epic-10/story-10.1.prospecting-list-model.contract.test.ts (16.104 s)
PASS contracts/epic-13/story-13.13.prospecting-list-export-and-crm-push.contract.test.ts (22.324 s)

Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
```

### 2.3 Typecheck
```bash
npx tsc --noEmit
```
**Output:** Clean (0 errors).
