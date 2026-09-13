# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0136 RAG Connector Provider Abstraction: Namespace-Per-Tenant Isolation |
|| Version | 1.0 |
|| Date | 2026-09-13 |
|| Author(s) | Business & Requirements Analyst persona |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved for Build |
|| Related Documents | ADR-0136 (Accepted 2026-08-28), BRD-0136 (v1.0), ADR-0081, ADR-0015, ADR-0032, ADR-0043, Story 19.1 |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 1.0 | 2026-09-13 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, written ahead of Story 19.1 implementation, derived from ADR-0136's already-Accepted Decision text and direct inspection of the already-shipped Story 9.7/9.8/9.9 code it revises. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0136's Decision (Accepted 2026-08-28) and BRD-0136 (v1.0) into a functional design for **Story 19.1**: the `RAGConnector` interface addition (`ensureTenantNamespace?`, an isolation-model status field) and making Postgres Row-Level Security the actually-enforced tenant boundary for the already-shipped `PgvectorRAGConnector` (Story 9.7), with the existing application-level `tenant_id` filter retained as mandatory defense-in-depth. It supersedes Story 9.7/9.8/9.9's isolation model for pgvector specifically; it does not touch chunking/embedding, search/ask endpoints, or any non-pgvector provider.

### 2.2 Scope

- **In scope:**
  - `RAGConnector` interface: add optional `ensureTenantNamespace?(tenantId: string): Promise<void>`.
  - Connector status: add an isolation-model field (see §13 Open Questions for which existing type it attaches to) reporting `'namespace' | 'shard' | 'row-level-rls' | 'metadata-filter-only'`.
  - `PgvectorRAGConnector`: make the already-existing `rag_chunks` RLS policy (migrations `0046`/`0047`) the real, operative isolation mechanism for this connector's actual query path — today it is inert because all queries run via `getAdminPool()` (Postgres superuser, bypasses RLS unconditionally).
  - Retain the existing application-level `tenant_id` equality filters unchanged, as mandatory defense-in-depth (not the sole mechanism, once this story ships).
  - Confirm `deleteTenant()` mechanics (`DELETE ... WHERE tenant_id = $1`) and the deterministic vector ID scheme (`${tenantId}:${postId}:${chunkIndex}`) are unchanged.
  - Correct Story 9.9's contract test so a test named "RLS" actually exercises the database-level policy (BRD-0136 BR-008).

- **Out of scope:**
  - Any Pinecone or Azure AI Search connector implementation or per-provider isolation mapping (ADR-0138, Story 19.3) — no such connector exists in this codebase today (`ragConnectorRegistry.ts` registers only `pgvector`).
  - Chunking/embedding namespace routing (ADR-0137, Story 19.2).
  - Search/ask endpoint namespace resolution or any REST response-contract change to `/v1/rag/search`, `/v1/rag/ask`, `/v1/rag/status` (ADR-0139, Story 19.4).
  - Resolving ADR-0136's own [Q-0136-1] (Azure AI Search physical isolation) — explicitly deferred by the ADR itself.
  - Any UI/UX change (ADR-0140, Story 19.5).
  - Backfilling or re-indexing existing `rag_chunks` rows.

### 2.3 Target Audience

Backend engineers implementing the interface change and the pgvector RLS-enforcement fix; QA writing/extending the contract test that verifies database-level isolation; future engineers implementing Story 19.2/19.3/19.4, who need this interface addition to be stable before they build on it.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** ADR-0081 Decision §11 treated a shared-index metadata filter as pgvector's primary tenant boundary, leaving this project's own established Postgres RLS pattern (ADR-0015, ADR-0032) unused for `rag_chunks` in practice, even though a `CREATE POLICY` statement was added at table-creation time (migration 0046). ADR-0136 corrects the framing: physical/database isolation becomes primary, the metadata filter mandatory secondary (BRD-0136 §2).
- **Verified current-state finding (not assumed):** `PgvectorRAGConnector`'s queries run exclusively through `getAdminPool()` (`social-listening-core/src/db/adminPool.ts`), which connects as `PGUSER ?? 'postgres'` — Postgres superuser. A superuser bypasses RLS unconditionally, regardless of `FORCE ROW LEVEL SECURITY` (which migration 0046 does not even set on `rag_chunks`). This means the existing `tenant_isolation` policy on `rag_chunks` has never actually been evaluated against this connector's real traffic. Story 9.9's own contract test file, `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts`, asserts "guarantees tenant isolation: search with high similarity in Tenant A returns nothing from Tenant B" — but that assertion passes purely because of the connector's in-process application-level `chunk.metadata.tenant_id !== tenantId` check and its SQL `WHERE tenant_id = $1` clause, not because of the RLS policy. The test's own filename claims RLS coverage it does not provide.
- **Business/user value:** A real, defense-in-depth database boundary for tenant-scoped vector data, matching the standard already applied to every other tenant table in this project (BRD-0136 §2, §3).
- **Source requirements:** ADR-0136 (Accepted 2026-08-28), BRD-0136 (v1.0), Story 19.1 in `docs/user-stories/epic-19-adr-0136-to-0140.md`.
- **Constraints and dependencies:**
  - No breaking change to `RAGChunkingService`, `ragIndexingPipeline.ts`, `RAGSearchService`/`ragSearchService.ts`, `ragReconciliationService.ts`, or `ragRouter.ts` call signatures.
  - The mechanism used to make RLS operative must not grant `PgvectorRAGConnector`'s runtime queries broader privileges than the tenant-scoped operations require (least privilege; see `adminPool.ts`'s own docstring on why its privilege level is reserved for schema-level maintenance).
  - Only `pgvector` is a registered provider; this story must not add a second provider.

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
||---|---|---|
|| G1 | Extend `RAGConnector` per ADR-0136 Decision §1 without breaking any caller | `ensureTenantNamespace?` added as optional; zero signature change to `upsert`/`search`/`deletePost`/`deleteTenant`; all four existing RAG callers compile and pass unchanged |
|| G2 | Make the existing `rag_chunks` RLS policy the real enforcement boundary for `PgvectorRAGConnector` | A contract test proves cross-tenant rows are unreachable at the database layer under the role/session-context this story establishes |
|| G3 | Retain the application-level filter as defense-in-depth | Existing `tenant_id` checks remain, unmodified in behavior, and all pre-existing tests referencing them still pass |
|| G4 | Report an accurate isolation-model value | `PgvectorRAGConnector.status()` returns an isolation-model value of `'row-level-rls'` only once G2 is genuinely true, verified by a test, not merely asserted |
|| G5 | Do not scope-creep into ADR-0137/0138/0139 | `ragConnectorRegistry.ts` still registers only `pgvector`; no chunking, embedding, or REST-endpoint file is touched by this story |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `RAGConnector.ensureTenantNamespace?` interface addition

- **Description:** Adds an optional lifecycle hook to the `RAGConnector` interface for providers that require explicit per-tenant provisioning of a physical scope (namespace, shard, RLS-backed table) before first write. Providers where scope creation is implicit-on-write, or where the scope is a static, already-provisioned table-level construct (pgvector's RLS policy), may omit it.
- **Triggers:** N/A at the interface level — this is a type addition. A future caller (not in this story's scope) would invoke it before a tenant's first `upsert()` for a provider that implements it.
- **Inputs:** `tenantId: string`.
- **Processing:** Interface-only change in this story; no caller invokes it yet (no in-scope provider needs it).
- **Outputs:** N/A (interface addition only).
- **Error handling:** N/A — unimplemented on `PgvectorRAGConnector` is the expected, correct state, not an error.
- **Edge cases:** A future provider (Story 19.3) that does implement it is out of this story's scope; this story only adds the type-level hook.

### 5.2 Feature / Capability: `isolationModel` connector-status reporting

- **Description:** The connector-status shape gains a field reporting which physical-isolation mechanism is actually operative for a given connector instance/tenant: `'namespace' | 'shard' | 'row-level-rls' | 'metadata-filter-only'`.
- **Triggers:** Every call to `status()`.
- **Inputs:** Optional `tenantId` (existing parameter, unchanged).
- **Processing:** `PgvectorRAGConnector.status()` returns `isolationModel: 'row-level-rls'` — but only once §5.3 is actually implemented and verified; the value must never be hardcoded ahead of the real enforcement mechanism being in place (BRD-0136 BRU-004).
- **Outputs:** The existing status response, with the new field added.
- **Error handling:** N/A.
- **Edge cases:** See §13 Open Questions — which concrete TypeScript type this field is added to (the ADR's literal `ConnectorStatus` name vs. the shipped `RAGConnectorStatus` in `types.ts`) is not resolved by this document; implementation must verify against the actually-shipped type before adding the field, and should prefer the shipped type since that is what `ragRouter.ts`'s `GET /v1/rag/status` endpoint and all existing tests actually consume.

### 5.3 Feature / Capability: Make the existing `rag_chunks` RLS policy the actual enforcement mechanism

- **Description:** `PgvectorRAGConnector`'s runtime queries (`upsert`, `search`, `deletePost`, `deleteTenant`, `status`) must execute in a way that makes the already-existing `tenant_isolation` policy on `rag_chunks` (migrations `0046`/`0047`) the real, operative tenant boundary, rather than a policy that is structurally present but never evaluated because every query currently runs as Postgres superuser via `getAdminPool()`.
- **Triggers:** Every `PgvectorRAGConnector` database operation.
- **Inputs:** `tenantId` (existing parameter on every method).
- **Processing (deliberately left as an implementation decision, not prescribed here — see §13 Q1):** The connector's queries must stop running exclusively under a role that unconditionally bypasses RLS. Candidate mechanisms this project already has a precedent for, cited for reference only, not mandated:
  1. Route `PgvectorRAGConnector`'s queries through `withTenant()` (`social-listening-core/src/db/withTenant.ts`), which sets the transaction-local `app.tenant_id` session variable the existing policy's `USING`/`WITH CHECK` clauses read, against a pool connecting as a non-superuser role (e.g. the existing `app_user` role migration 0047 already `GRANT`s `SELECT, INSERT, UPDATE, DELETE` to).
  2. Add `FORCE ROW LEVEL SECURITY` to `rag_chunks` (migration 0046 does not set this) — necessary but not sufficient on its own, since `FORCE` still does not bind a superuser.
  3. Some combination of the two, plus retaining `getAdminPool()` only for any genuinely schema-level operation this connector might need (none identified today).
  Whichever mechanism is chosen must satisfy BRD-0136 NFR-001 (least privilege) and must not change `upsert`/`search`/`deletePost`/`deleteTenant`/`status`'s public signatures.
- **Outputs:** Identical data-layer behavior to today from the caller's perspective; the difference is enforceable only by a test that specifically tries to bypass the application-level filter and confirms the database still blocks cross-tenant access.
- **Error handling:** If the chosen mechanism causes a query to fail closed (e.g. `app.tenant_id` not set, policy denies all rows), that must surface as zero results / a caught error, not a silent cross-tenant leak in either direction — matching `withTenant.ts`'s own documented "fails closed" property.
- **Edge cases:** The in-memory fallback path in `PgvectorRAGConnector` (used when the DB query throws, per its existing `catch` blocks) is unaffected by this change — it was never a database-RLS concern to begin with and remains an application-level, single-process concern.

### 5.4 Feature / Capability: Retain application-level filter as defense-in-depth

- **Description:** The existing `tenant_id` equality checks already present in `upsert()` (metadata assignment), `search()` (candidate filtering), `deletePost()`, and `deleteTenant()` remain exactly as they are today.
- **Triggers:** Every existing call path, unchanged.
- **Inputs:** Unchanged.
- **Processing:** No code deletion or weakening of these checks; §5.3's change is additive (a second, database-level boundary), not a replacement.
- **Outputs:** Unchanged from today.
- **Error handling:** Unchanged from today.
- **Edge cases:** None new; this is a preservation requirement, not a new capability.

### 5.5 Feature / Capability: Correct Story 9.9's mislabeled RLS contract test

- **Description:** `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts` is named for RLS but, as verified by direct reading, its "guarantees tenant isolation" test only proves the application-level filter works. This story must add or extend a test that specifically exercises the database-level policy (e.g. by issuing a raw query under the new role/session-context mechanism with the application-level filter deliberately not applied, and confirming the database itself returns zero cross-tenant rows).
- **Triggers:** Part of this story's own contract-test suite (new, under `social-listening-core/contracts/epic-19/`, following the naming convention of the `epic-9` RAG contract tests).
- **Inputs:** Two tenants' worth of `rag_chunks` rows, as in the existing Story 9.9 test's own tenantA/tenantB fixture pattern.
- **Processing:** A query executed against `rag_chunks` under the new mechanism, with tenant B's session context, attempting to read tenant A's row by primary key or an unfiltered `SELECT`, confirming the database returns zero rows even without an application-level `WHERE tenant_id` clause in that specific test query.
- **Outputs:** A passing contract test that actually demonstrates database-level isolation.
- **Error handling:** N/A (test-only concern).
- **Edge cases:** This new/extended test must not itself require `getAdminPool()` to prove the point — using the superuser pool to test RLS would reproduce the exact bypass this story exists to close.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Engineering Lead / implementer | Implements the interface addition and the RLS-enforcement mechanism; writes the corrected contract test |
|| `PgvectorRAGConnector` (system actor) | The connector whose query path changes |
|| `ragConnectorRegistry.ts` (system actor) | Unchanged — still registers only `pgvector` |
|| Future Story 19.2/19.3/19.4 implementers (indirect actors) | Depend on this story's interface addition being stable and non-breaking |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 19.1 | engineer implementing the RAG isolation correction | extend `RAGConnector` with `ensureTenantNamespace?`/an isolation-model status field, and make pgvector's existing RLS policy actually enforced | tenant data in `rag_chunks` is protected by a real database-level boundary, not solely application code, matching this project's own established pattern | `ensureTenantNamespace?` added, optional, non-breaking; isolation-model field added and accurately reports `'row-level-rls'` for pgvector only once genuinely true; a contract test proves database-level cross-tenant blocking independent of the application filter; `deleteTenant()`/vector-ID scheme unchanged; only `pgvector` registered at story end |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — a tenant-scoped RAG operation after this story ships:**

1. A caller (`ragIndexingPipeline.ts`, `ragSearchService.ts`, `ragReconciliationService.ts`, or `ragRouter.ts`) invokes `upsert()`/`search()`/`deletePost()`/`deleteTenant()`/`status()` on `PgvectorRAGConnector` exactly as it does today — no signature change.
2. Internally, `PgvectorRAGConnector` executes its query via the mechanism established in §5.3 (a non-superuser-bypassing role/session-context path), so the `rag_chunks` `tenant_isolation` policy is evaluated by Postgres itself.
3. The existing application-level `tenant_id` filter is still applied on top, unchanged (§5.4) — two independent layers now enforce the same boundary.
4. `status()` reports `isolationModel: 'row-level-rls'`, reflecting step 2's real, verified state.
5. A dedicated contract test (§5.5) independently confirms step 2 by attempting a cross-tenant read that bypasses the application-level filter and asserting the database itself returns zero rows.

---

## 7. Data Requirements

### 7.1 Data Inputs

- The already-existing `rag_chunks` table and its `tenant_isolation` RLS policy (migrations `0046`/`0047`) — no new columns are required by anything ADR-0136 Decision §1–§4 specifies for pgvector.
- `tenantId`, unchanged, on every existing `RAGConnector` method.

### 7.2 Data Outputs

- No new persisted data. The only new "output" is the `isolationModel` field on the in-memory status response, and (if the chosen §5.3 mechanism requires it) a migration granting/adjusting role privileges — left as an implementation detail per §13 Q1, not specified here.

### 7.3 Data Model / Entities — interface changes (TypeScript)

The following reproduces ADR-0136 Decision §1 verbatim for traceability; it is the ADR's own Decision text, not a new design choice made in this FDD. Note the discrepancy from the actually-shipped `types.ts` flagged in §13 Q2 below.

```ts
// ADR-0136 Decision §1's own Decision text (reproduced for traceability):
interface RAGConnector {
  id: string;
  upsert(
    tenantId: string,
    vectors: Array<{ id: string; values: number[]; metadata: RAGChunkMetadata }>
  ): Promise<void>;
  search(
    tenantId: string,
    query: number[],
    options: RAGSearchOptions
  ): Promise<RAGSearchResult[]>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<ConnectorStatus>;
  // NEW — optional lifecycle hook (ADR-0136 Decision §1)
  ensureTenantNamespace?(tenantId: string): Promise<void>;
}

interface ConnectorStatus {
  indexingLag: number;
  chunkCount: number;
  storeErrors?: string[];
  // NEW — reports which physical-isolation mechanism is actually in effect
  isolationModel: 'namespace' | 'shard' | 'row-level-rls' | 'metadata-filter-only';
}
```

The actually-shipped `social-listening-core/src/rag/types.ts` (Story 9.7) has a *different* status interface name and field set than the `ConnectorStatus` shown above:

```ts
// Actually shipped (social-listening-core/src/rag/types.ts) — verified by direct read:
export interface RAGConnectorStatus {
  provider: string;
  isAvailable: boolean;
  dimension: number;
  indexedChunksCount?: number;
  lastError?: string | null;
}

export interface RAGConnector {
  id: string;
  upsert(tenantId: string, vectors: RAGChunk[]): Promise<void>;
  search(tenantId: string, query: number[], options: RAGSearchOptions): Promise<RAGSearchResult[]>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<RAGConnectorStatus>;
  updateMetadata?(tenantId: string, postId: string, partialMetadata: Partial<RAGChunkMetadata>): Promise<void>;
}
```

This drift predates ADR-0136 — ADR-0081's own Decision text already didn't match what Story 9.7 shipped, and ADR-0136 simply restates ADR-0081's original text without reconciling it. **This FDD does not resolve which shape `isolationModel`/`ensureTenantNamespace?` land on** — see §13 Q2. It recommends (does not mandate) adding both to the shipped `RAGConnectorStatus`/`RAGConnector` in `types.ts`, since that is what every real caller (`ragRouter.ts`, `ragSearchService.ts`, the epic-9 contract tests) actually uses.

### 7.4 Existing schema referenced (unchanged by this story)

```sql
-- From social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql (existing, unchanged):
CREATE TABLE IF NOT EXISTS rag_chunks (
  id VARCHAR(255) PRIMARY KEY, -- deterministic format ${tenant_id}:${post_id}:${chunk_index}
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  platform_id VARCHAR(64) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  watchlist_ids UUID[] DEFAULT '{}',
  sentiment VARCHAR(32),
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
-- NOTE: no FORCE ROW LEVEL SECURITY is set today — see §13 Q1.

CREATE POLICY rag_chunks_tenant_isolation ON rag_chunks
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- From migration 0047 (existing, unchanged): GRANTs SELECT/INSERT/UPDATE/DELETE to app_user,
-- and aligns the policy to also accept 'app.tenant_id' (the withTenant.ts session-variable name)
-- alongside the original 'app.current_tenant_id'.
```

This story does not need to alter this schema unless the implementation decision in §13 Q1 requires an additional migration (e.g. `FORCE ROW LEVEL SECURITY`, or a further role/grant adjustment) — that migration's number is not assigned here and is an implementation detail, not specified by ADR-0136.

### 7.5 Validation Rules

- `tenantId` remains mandatory on every existing method; never client-suppliable via `RAGFilter` (unchanged, ADR-0081 Decision §1).
- `isolationModel` must never report a mechanism that is not genuinely operative for that connector instance (BRD-0136 BRU-004) — this is a documentation/design rule, not a runtime-enforced constraint, since there is no automatic way to verify a self-reported enum value at runtime; it is enforced by the contract test in §5.5 proving the underlying mechanism, not by validating the string itself.
- `deleteTenant()`'s SQL statement shape (`DELETE ... WHERE tenant_id = $1`) is unchanged.

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | Physical/database isolation is primary where available; the application-level filter is mandatory secondary defense-in-depth, never removed. | `PgvectorRAGConnector` |
|| BR2 | `ensureTenantNamespace?` is optional; pgvector may omit it. | `RAGConnector` interface |
|| BR3 | `isolationModel` must accurately reflect the mechanism actually in effect, never an aspirational label. | `status()` |
|| BR4 | No breaking change to `upsert`/`search`/`deletePost`/`deleteTenant` signatures. | `RAGConnector` interface |
|| BR5 | `deleteTenant()`'s deletion mechanics for pgvector are unchanged. | `PgvectorRAGConnector` |
|| BR6 | The vector ID scheme (`${tenantId}:${postId}:${chunkIndex}`) is unchanged. | `PgvectorRAGConnector` |
|| BR7 | Only `pgvector` is registered in `ragConnectorRegistry.ts` at the end of this story. | Registry |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
||---|---|---|---|
|| `ragIndexingPipeline.ts` | Caller of `RAGConnector.upsert()`/`deletePost()`/`deleteTenant()` | Unaffected — no signature change | In-process TypeScript |
|| `ragSearchService.ts` | Caller of `RAGConnector.search()` | Unaffected — no signature change | In-process TypeScript |
|| `ragReconciliationService.ts` | Caller of `RAGConnector` methods | Unaffected — no signature change | In-process TypeScript |
|| `ragRouter.ts` (`GET /v1/rag/status`, Story 9.10) | Caller of `RAGConnector.status()` | Unaffected unless a future story (not this one) decides to surface `isolationModel` in the HTTP response — see §13 Q3 | HTTPS REST, JSON |
|| Postgres (`rag_chunks` table) | `PgvectorRAGConnector`'s data store | The connector's queries begin actually being subject to the existing RLS policy | SQL, existing RLS policy (migrations 0046/0047) |
|| `withTenant()` (`social-listening-core/src/db/withTenant.ts`) | Candidate mechanism (not mandated) for setting RLS session context | Cited as this project's existing precedent, not prescribed as the only valid approach | In-process TypeScript |

---

## 10. Non-Functional Considerations

- **Security / access control:** The database role executing `PgvectorRAGConnector`'s runtime queries must not be the superuser role reserved for schema-level maintenance (BRD-0136 NFR-001); least privilege is an explicit acceptance bar, not an aspiration.
- **Reliability:** No regression to the four existing epic-9 RAG contract tests (`story-9.7`, `story-9.8`, `story-9.9`, `story-9.10`) is acceptable (BRD-0136 NFR-002).
- **Transparency / trust (internal):** `isolationModel` must not overstate what is actually enforced — the same discipline this project already applies to Tier 1/2/3 delivery labeling elsewhere (BRD-0131 NFR-003 precedent) applies here: don't report a mechanism that isn't real.
- **Maintainability:** The interface addition is purely additive (`ensureTenantNamespace?` optional, `isolationModel` a new status field) so Story 19.2/19.3/19.4 can build on a stable contract without a second breaking change later.
- **Performance:** Not benchmarked in this document; BRD-0136 NFR-003 treats this as a "Should," not a "Must."

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| RLS session context not set (e.g. a future code path forgets to set `app.tenant_id`) under the new mechanism | (internal; no tenant-facing surface changes in this story) | Policy denies all rows for that connection — fails closed, consistent with `withTenant.ts`'s own documented behavior; caller receives an empty result set or a thrown error depending on which query path this occurs in, not a cross-tenant leak in either direction |
|| A future caller invokes `ensureTenantNamespace?` on `PgvectorRAGConnector`, which does not implement it | (internal; no in-scope caller does this) | `undefined` — calling code must already guard with the optional-chaining pattern ADR-0136 implies (`connector.ensureTenantNamespace?.(tenantId)`); no runtime error from the interface itself |
|| Existing in-memory fallback path triggers (DB query throws) | Unaffected by this story | Unchanged from today's behavior |

---

## 12. Assumptions and Dependencies

- Only `pgvector` is a registered `RAGConnector` implementation as of 2026-09-13 — verified directly against `ragConnectorRegistry.ts`.
- `rag_chunks` already has `ENABLE ROW LEVEL SECURITY` and a `tenant_isolation` policy, but no `FORCE ROW LEVEL SECURITY` — verified directly against migrations `0046`/`0047`.
- `PgvectorRAGConnector`'s queries run exclusively via `getAdminPool()` (Postgres superuser) — verified directly against `pgvectorConnector.ts` and `adminPool.ts`.
- `withTenant()` is this project's own established mechanism for RLS session context, with a documented precedent (ADR-0043 / tenant-deletion role) for a role that does not bypass RLS — verified directly against `withTenant.ts`'s own docstring.
- Story 9.9's own contract test does not currently exercise the database-level RLS policy — verified directly by reading `story-9.9.rag-vector-rls.contract.test.ts`.

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
||---|---|---|---|
|| Q1 | Which specific database role/session-context mechanism makes the existing `rag_chunks` RLS policy actually operative for `PgvectorRAGConnector`'s runtime queries (a `withTenant()`-style wrapper against a non-superuser pool, `FORCE ROW LEVEL SECURITY`, a new dedicated role, or a combination)? | Engineering Lead | At Story 19.1 implementation time, evaluated against the least-privilege constraint (BRD-0136 NFR-001) |
|| Q2 | Does `isolationModel` (and `ensureTenantNamespace?`) attach to the ADR's literal, never-shipped `ConnectorStatus`/`RAGConnector` interface names, or to the actually-shipped `RAGConnectorStatus`/`RAGConnector` in `social-listening-core/src/rag/types.ts`? | Engineering Lead | At Story 19.1 implementation time; this FDD recommends the shipped type but does not mandate it |
|| Q3 | Should `GET /v1/rag/status` (Story 9.10, ADR-0084) be changed to surface `isolationModel` in its HTTP response body? | Product / Engineering Lead | Not decided by ADR-0136 or this document; plausibly ADR-0139/Story 19.4's territory if pursued at all |
|| Q4 | What is the exact form of the corrected/extended contract test proving database-level enforcement (a new assertion inside the existing `story-9.9` file, or a new `epic-19` test file)? | Engineering Lead | At Story 19.1 implementation time, following this project's contract-first convention |

---

## 14. Appendix

### Glossary

- **Physical isolation:** Tenant separation enforced structurally by the database/vector-store (namespace, shard, or RLS), not solely by application code.
- **Metadata filter:** The existing application-level `tenant_id` equality check, retained as mandatory defense-in-depth.
- **Inert RLS policy:** A `CREATE POLICY` statement present in the schema but never evaluated against a given code path's real queries because those queries run under a role (here, Postgres superuser) that bypasses RLS regardless of the policy.
- **`isolationModel`:** The new status field reporting which physical-isolation mechanism is actually in effect.
- **`ensureTenantNamespace?`:** The new optional `RAGConnector` lifecycle hook for providers needing explicit per-tenant provisioning; not needed by pgvector.

### Reference links

- ADR: `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md`
- Superseded-in-part ADR: `docs/adr/0081-rag-connector-provider-abstraction.md`
- BRD: `docs/project docs/Business-Requirements/BRD-0136-RAG-Connector-Provider-Abstraction-Namespace-Per-Tenant.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector` precedent), `ADR-0028` (credential ownership tiers), `ADR-0015`/`ADR-0032` (tenant RLS pattern), `ADR-0043` (tenant offboarding, non-bypassing-role precedent)
- Sibling ADRs (out of scope here): `ADR-0137` (Story 19.2), `ADR-0138` (Story 19.3), `ADR-0139` (Story 19.4), `ADR-0140` (Story 19.5)
- Already-shipped code inspected directly for this FDD: `social-listening-core/src/rag/types.ts`, `social-listening-core/src/rag/pgvectorConnector.ts`, `social-listening-core/src/rag/ragConnectorRegistry.ts`, `social-listening-core/src/db/adminPool.ts`, `social-listening-core/src/db/withTenant.ts`, `social-listening-core/src/http/versions/v1/ragRouter.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `social-listening-core/migrations/0047_fix_rag_chunks_permissions_and_rls.sql`, `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts`
- Related user story: Story 19.1, `docs/user-stories/epic-19-adr-0136-to-0140.md`
- Executable contract test citation: not yet created as of this writing — expected under `social-listening-core/contracts/epic-19/`, per this project's contract-first convention (see `social-listening-core/contracts/epic-9/story-9.7.rag-connector.contract.test.ts` and `story-9.9.rag-vector-rls.contract.test.ts` for the pattern this story extends).

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
