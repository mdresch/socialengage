# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0138 RAG Vector Store: Namespace-Per-Tenant Isolation and pgvector RLS |
|| Version | 1.0 |
|| Date | 2026-09-14 |
|| Author(s) | Business & Requirements Analyst persona |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved for Build |
|| Related Documents | ADR-0138 (Accepted 2026-08-28), BRD-0138 (v1.0), ADR-0083, ADR-0136, ADR-0137, ADR-0015, ADR-0032, Story 19.3 |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 1.0 | 2026-09-14 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, written ahead of Story 19.3 implementation, derived from ADR-0138's newly-drafted Decision text and direct inspection of the already-shipped `ragReconciliationService.ts`/`pgvectorConnector.ts`/`types.ts`/`ragConnectorRegistry.ts`. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0138's Decision (Accepted 2026-08-28, drafted 2026-09-14) and BRD-0138 (v1.0) into a functional design for **Story 19.3**: (1) a formal, code-verified confirmation that pgvector's RLS-based tenant isolation was already delivered by Story 19.1/ADR-0136, not re-decided here; (2) fixing `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s fail-closed defect, where its real-DB branch never sets RLS session context at all; and (3) architecture-level documentation (no code) of Pinecone namespace-per-tenant and Weaviate dedicated-shard-per-tenant isolation mechanics, for a future provider-adding story.

### 2.2 Scope

- **In scope:**
  - Confirm pgvector's RLS isolation is already delivered (cited, not re-implemented).
  - Fix `reconcileOrphanedRAGChunks()`'s real-DB branch to route its `SELECT` (against `rag_chunks`/`social_posts`) and its loop's `DELETE FROM rag_chunks_sync` through a single `withTenant(tenantId, ...)` call.
  - Add a contract test proving the fix: a cross-tenant orphan-detection query, run through the real call site, is correctly tenant-scoped.
  - Document (narrative/architecture only, no code) Pinecone namespace-per-tenant and Weaviate shard-per-tenant mechanics.

- **Out of scope:**
  - Any scheduler, cron job, or periodic invocation of `RAGReconciliationService` — a real, separate gap against ADR-0083 Decision §4, item 5, not this story's to close.
  - Any Pinecone or Weaviate connector implementation — `ragConnectorRegistry.ts` continues to register only `pgvector`.
  - Azure AI Search — still open per ADR-0136's own Q-0136-1.
  - Any change to `PgvectorRAGConnector`, `RAGChunkMetadata`, the `RAGConnector` interface, the vector ID scheme, or `ensureTenantNamespace?()`'s existing call site.
  - Any REST endpoint change (ADR-0139, Story 19.4) or UI/UX change (ADR-0140, Story 19.5).
  - A "Supersession update" note on ADR-0083 itself — a documentation-governance follow-up, not a Story 19.3 deliverable.

### 2.3 Target Audience

Backend engineers implementing the `reconcileOrphanedRAGChunks()` fix; QA writing the new contract test; future engineers implementing a Pinecone or Weaviate connector, who need a concrete mapping to build against; future engineers implementing an ADR-0083 reconciliation-scheduler revisit, who need the current gap documented rather than rediscovered.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** ADR-0136 named ADR-0138 as the owner of the detailed per-provider physical-isolation mapping, but ADR-0138 was a one-line stub, so that mapping was never actually written down, and a real, verified defect in the one piece of code closest to this area (`RAGReconciliationService`) went unaddressed.
- **Verified current-state finding (not assumed):** `PgvectorRAGConnector`'s queries already execute via `withTenant()`/`app_user`, and `rag_chunks` already carries `FORCE ROW LEVEL SECURITY` (migration `0082`) — confirmed by direct reading of `social-listening-core/src/rag/pgvectorConnector.ts` and that migration file. `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s real-DB branch calls `getPool().query(...)` directly, with no `withTenant()` call anywhere in the method — confirmed by direct reading of `social-listening-core/src/rag/ragReconciliationService.ts`. Because `rag_chunks`, `rag_chunks_sync` (migration `0083`), and `social_posts` (migration `0002`) all carry `FORCE ROW LEVEL SECURITY` and their policies key off `app.tenant_id`/`app.current_tenant_id`, the method's orphan-detection query returns zero rows unconditionally in production. A codebase-wide search confirms no caller of this service exists anywhere, and no scheduler references it.
- **Business/user value:** A reconciliation query that is correct whenever it is eventually invoked (BRD-0138 §6/§7), plus a concrete, sourced design for a future Pinecone or Weaviate connector implementer, so no second architecture pass is needed when that story is picked up.
- **Source requirements:** ADR-0138 (Accepted 2026-08-28, drafted 2026-09-14), BRD-0138 (v1.0), Story 19.3 in `docs/user-stories/epic-19-adr-0136-to-0140.md`.
- **Constraints and dependencies:**
  - No breaking change to `RAGReconciliationService`'s public method signature or return shape.
  - No new database migration.
  - No scheduler/cron infrastructure introduced.
  - No `RAGConnector` provider implementation, no `RAGChunkMetadata`/interface change, no vector-ID-scheme change.

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
||---|---|---|
|| G1 | Confirm pgvector's RLS isolation is already delivered | ADR-0138 Decision §1 and "Relation to ADR-0136" cite the specific mechanism, backed by this FDD's own direct-inspection evidence |
|| G2 | Make `reconcileOrphanedRAGChunks()`'s real-DB branch correctly tenant-scoped | A contract test proves the query no longer returns zero rows unconditionally for a tenant with real orphaned chunks |
|| G3 | Document Pinecone/Weaviate isolation mechanics at implementation-ready detail | ADR-0138 Decision §3/§4 map every `RAGConnector` method onto each provider's own primitive |
|| G4 | Explicitly name the still-unresolved reconciliation-scheduler gap | ADR-0138 Decision §6/Open Questions and this FDD §13 record it as a gap against ADR-0083, not Story 19.3 |
|| G5 | Do not scope-creep into a connector build, Azure AI Search research, or scheduler design | `ragConnectorRegistry.ts` unchanged; no new scheduler file; Azure AI Search untouched |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Confirmation that pgvector's RLS isolation requires no further change

- **Description:** Formally records, with direct code citation, that `PgvectorRAGConnector`'s tenant-scoped queries already execute via `withTenant()`/`app_user`, that `rag_chunks` already carries `FORCE ROW LEVEL SECURITY`, and that `status()` already reports `isolationModel: 'row-level-rls'` honestly.
- **Triggers:** N/A — a documentation/decision confirmation, not a runtime behavior.
- **Inputs:** N/A.
- **Processing:** No code change for this capability; it is verified, not implemented.
- **Outputs:** N/A.
- **Error handling:** N/A.
- **Edge cases:** None — a closed confirmation, not an open design question.

### 5.2 Feature / Capability: `reconcileOrphanedRAGChunks()` real-DB branch routed through `withTenant()`

- **Description:** Replaces the method's real-DB branch's two direct `getPool().query(...)` calls (the orphan-detection `SELECT` and the loop's `DELETE FROM rag_chunks_sync`) with a single `withTenant(tenantId, async (client) => { ... })` call wrapping both.
- **Triggers:** Every invocation of `reconcileOrphanedRAGChunks(tenantId)` where `existingPostIds` is not supplied (the real-DB branch; the mocked/in-memory branch is unaffected).
- **Inputs:** `tenantId` (already an existing parameter, mandatory — the method already early-returns `{ deletedOrphansCount: 0 }` if falsy).
- **Processing:** `withTenant()` opens an explicit transaction, sets `app.tenant_id` transaction-locally via `set_config(..., true)`, and executes both queries against the non-superuser `app_user` role, then commits — exactly the pattern already applied to `PgvectorRAGConnector` (Story 19.1) and `indexPostForRAG()`'s `rag_chunks_sync` write (Story 19.2). Inside the callback's loop, `this.connector.deletePost(tenantId, row.post_id)` is called exactly as today — it manages its own independent `withTenant()` call/transaction on a separate pooled connection, unaffected by the outer transaction. No policy text change is required — `rag_chunks_tenant_isolation` (migration `0047`), `social_posts`' `tenant_isolation` (migration `0002`), and `rag_chunks_sync_tenant_isolation` (migrations `0046`/`0047`) all already accept `app.tenant_id`.
- **Outputs:** Identical `{ deletedOrphansCount: number }` return shape; the only observable difference is that the count now reflects real, correctly-scoped orphan rows rather than always being `0` from an empty result set.
- **Error handling:** The existing outer `try { ... } catch { /* Handled gracefully */ }` wrapper around the real-DB branch is unchanged — if the `withTenant()`-wrapped query throws (e.g. an unexpected connection failure), the method still degrades to returning `{ deletedOrphansCount: deletedCount }` with whatever count had accumulated before the failure, exactly as today's error handling already does.
- **Edge cases:**
  - A tenant with zero real orphaned chunks: the query now correctly returns zero rows *because there are none*, not because RLS context was never set — behaviorally identical output, structurally different (and now correct) reason.
  - `this.connector.deletePost()` throwing mid-loop: caught by the existing outer `try`/`catch`, exactly as today; `deletedCount` reflects only rows processed before the failure, unchanged behavior.
  - The mocked/in-memory branch (`existingPostIds` supplied): entirely unaffected — it never queries the database and requires no change.

### 5.3 Feature / Capability: Contract test proving the fix

- **Description:** A new (or extended) contract test asserts that a cross-tenant orphan-detection scenario — tenant A has an orphaned `rag_chunks` row (a chunk whose `post_id` no longer exists in `social_posts`), tenant B does not — resolves correctly when `reconcileOrphanedRAGChunks(tenantA)` is called through the real production call site, proving the query is genuinely tenant-scoped rather than unconditionally empty.
- **Triggers:** Part of Story 19.3's own contract-test suite, expected under `social-listening-core/contracts/epic-19/`.
- **Inputs:** Two tenants' worth of fixture data — a `rag_chunks` row with no matching `social_posts` row for tenant A, following the same tenantA/tenantB fixture pattern as `story-19.1.rag-connector-namespace-isolation.contract.test.ts` and `story-19.2.rag-chunking-embedding-namespace-routing.contract.test.ts`.
- **Processing:** A real (not mocked) invocation of `reconcileOrphanedRAGChunks(tenantA)` against the real, per-run-isolated test database, followed by an assertion that `deletedOrphansCount` reflects the real orphaned row and that tenant B's data is untouched.
- **Outputs:** A passing contract test demonstrating the fix is real, not merely asserted.
- **Error handling:** N/A (test-only concern).
- **Edge cases:** This test must not itself bypass `withTenant()` to set up or verify state in a way that would mask the very bug it exists to prove fixed (same discipline as FDD-0136 §5.5's and FDD-0137 §5.4's edge cases).

### 5.4 Feature / Capability: Pinecone namespace-per-tenant architecture (documentation only)

- **Description:** Documents, for a future `PineconeRAGConnector`, how each `RAGConnector` method maps onto Pinecone's namespace primitive: `upsert`/`search`/`deletePost` scoped via `index.namespace(tenantId)`; `deleteTenant` as a namespace-delete; `ensureTenantNamespace?` correctly omitted (namespaces are created lazily on first write); `status(tenantId)` reporting `isolationModel: 'namespace'`.
- **Triggers:** N/A — architecture documentation, not a runtime behavior. No code is written for this capability under Story 19.3.
- **Inputs / Processing / Outputs / Error handling:** N/A — no implementation exists to describe these for.
- **Edge cases:** The `RAGFilter`-to-Pinecone-filter translation is already decided (ADR-0083 Decision §3's Mongo-style `$in`/`$eq`/`$and` operators) and not re-derived here.

### 5.5 Feature / Capability: Weaviate dedicated-shard-per-tenant architecture (documentation only)

- **Description:** Documents, for a future `WeaviateRAGConnector`, how each `RAGConnector` method maps onto Weaviate's native multi-tenancy model: `upsert`/`search`/`deletePost` scoped via `.withTenant(tenantId)`; `deleteTenant` via Weaviate's own tenant-deletion API (drops the shard); `ensureTenantNamespace?` correctly **implemented**, idempotently, since Weaviate requires explicit tenant creation before a tenant's first write; `status(tenantId)` reporting `isolationModel: 'shard'`.
- **Triggers:** N/A — architecture documentation only. No code is written for this capability under Story 19.3.
- **Inputs / Processing / Outputs / Error handling:** N/A.
- **Edge cases:** The exact `RAGFilter`-to-Weaviate-native-filter translation is explicitly **not specified** — the research brief findings ADR-0136/ADR-0138 cite describe Weaviate's physical shard architecture, not its filter operator syntax, and ADR-0083's own filter-translation table never included Weaviate. Left open (ADR-0138 Q-0138-2), not invented here.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Engineering Lead / implementer | Implements the `reconcileOrphanedRAGChunks()` fix; writes the new contract test |
|| `RAGReconciliationService` (system actor) | The service whose real-DB query-execution path changes |
|| `PgvectorRAGConnector` (system actor) | Unaffected — confirmed unchanged |
|| Future Pinecone/Weaviate connector implementer (indirect actor) | Depends on Decision §3/§4's architecture being concrete enough to build against |
|| Future ADR-0083 scheduler-revisit implementer (indirect actor) | Depends on the reconciliation-scheduler gap being clearly named, not rediscovered |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 19.3 | engineer implementing the RAG vector-store namespace isolation and pgvector RLS confirmation | confirm pgvector's isolation is already delivered, fix `RAGReconciliationService`'s fail-closed defect, and document Pinecone/Weaviate architecture | ADR-0136's forward reference is backed by real content and the reconciliation worker's query is correct whenever it is eventually invoked | Confirmation delivered; `reconcileOrphanedRAGChunks()` routes through `withTenant()`; a contract test proves it; `ragConnectorRegistry.ts`, `PgvectorRAGConnector`, and `RAGChunkMetadata` remain unchanged; no scheduler is built |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — `reconcileOrphanedRAGChunks()` after this story ships:**

1. `reconcileOrphanedRAGChunks(tenantId, existingPostIds?)` is invoked exactly as today — no signature change.
2. If `existingPostIds` is supplied (mocked/in-memory branch, unchanged): behavior is identical to today.
3. Otherwise (real-DB branch, **changed**): a single `withTenant(tenantId, async (client) => { ... })` call opens a tenant-scoped transaction.
4. Inside it: `client.query(...)` runs the orphan-detection `SELECT` against `rag_chunks`/`social_posts`, now correctly scoped by `app.tenant_id`.
5. For each orphaned row: `this.connector.deletePost(tenantId, row.post_id)` runs (its own independent `withTenant()` call, unaffected), then `client.query('DELETE FROM rag_chunks_sync ...')` runs inside the same outer transaction, then `deletedCount` increments.
6. The outer transaction commits; `{ deletedOrphansCount: deletedCount }` is returned, exactly the same shape as today.
7. On any failure, the existing outer `try`/`catch` degrades gracefully, exactly as today.

---

## 7. Data Requirements

### 7.1 Data Inputs

- The already-existing `rag_chunks`, `rag_chunks_sync`, and `social_posts` tables and their existing RLS policies (migrations `0002`, `0046`, `0047`, `0082`, `0083`) — no new columns required.
- `tenantId`, unchanged, on every existing call.

### 7.2 Data Outputs

- No new persisted data. The only "output" is a `{ deletedOrphansCount: number }` value that now reflects real, correctly-scoped orphan rows rather than always `0`.

### 7.3 Data Model / Entities — code changes (TypeScript, illustrative)

```ts
// social-listening-core/src/rag/ragReconciliationService.ts — illustrative diff, not a new interface

// Before (fail-closed — no withTenant() anywhere in the real-DB branch):
// const pool = getPool();
// const res = await pool.query(
//   `SELECT DISTINCT rc.post_id FROM rag_chunks rc
//    LEFT JOIN social_posts sp ON rc.tenant_id = sp.tenant_id AND rc.post_id = sp.id
//    WHERE rc.tenant_id = $1 AND sp.id IS NULL`,
//   [tenantId]
// );
// for (const row of res.rows) {
//   await this.connector.deletePost(tenantId, row.post_id);
//   await pool.query('DELETE FROM rag_chunks_sync WHERE tenant_id = $1 AND post_id = $2', [tenantId, row.post_id]);
//   deletedCount++;
// }

// After (ADR-0138 Decision §2 — RLS-enforced, correctly scoped):
await withTenant(tenantId, async (client) => {
  const res = await client.query(
    `SELECT DISTINCT rc.post_id FROM rag_chunks rc
     LEFT JOIN social_posts sp ON rc.tenant_id = sp.tenant_id AND rc.post_id = sp.id
     WHERE rc.tenant_id = $1 AND sp.id IS NULL`,
    [tenantId]
  );
  for (const row of res.rows) {
    await this.connector.deletePost(tenantId, row.post_id);
    await client.query(
      'DELETE FROM rag_chunks_sync WHERE tenant_id = $1 AND post_id = $2',
      [tenantId, row.post_id]
    );
    deletedCount++;
  }
});
```
No `RAGConnector`, `RAGChunkMetadata`, or `RAGConnectorStatus` interface changes are introduced — `types.ts` is untouched by this story. The `getPool` import in `ragReconciliationService.ts` is replaced by a `withTenant` import; no other file changes.

### 7.4 Existing schema referenced (unchanged by this story)

```sql
-- rag_chunks (migration 0046, RLS enabled; migration 0047, policy; migration 0082, FORCE):
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY rag_chunks_tenant_isolation ON rag_chunks
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- social_posts (migration 0002, RLS enabled + FORCE + policy):
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_posts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- rag_chunks_sync (migration 0046, RLS enabled + policy; migration 0083, FORCE — added Story 19.2):
ALTER TABLE rag_chunks_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks_sync FORCE ROW LEVEL SECURITY;
CREATE POLICY rag_chunks_sync_tenant_isolation ON rag_chunks_sync
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```
This story does not alter any of this schema — all three tables already have everything Decision §2's fix needs; only the call site in `ragReconciliationService.ts` changes.

### 7.5 Validation Rules

- `tenantId` remains mandatory on `reconcileOrphanedRAGChunks()`, unchanged (the existing `if (!tenantId) return { deletedOrphansCount: 0 };` guard is untouched).
- The SQL statement shapes (the `SELECT`, the `DELETE FROM rag_chunks_sync`) are unchanged — only the executing pool/role and transaction wrapper change.
- The mocked/in-memory branch's behavior must remain byte-for-byte identical — no new validation code is introduced there.

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | Every tenant-scoped query in this method's real-DB branch must execute under `withTenant()`. | `RAGReconciliationService.reconcileOrphanedRAGChunks()` |
|| BR2 | The mocked/in-memory branch is unaffected. | `RAGReconciliationService.reconcileOrphanedRAGChunks()` |
|| BR3 | `this.connector.deletePost()`'s own independent transaction management is not duplicated or altered. | `RAGReconciliationService.reconcileOrphanedRAGChunks()` |
|| BR4 | No new migration, interface member, or scheduler is introduced. | Scope guard |
|| BR5 | Pinecone/Weaviate architecture is documented, not implemented. | ADR-0138 Decision §3/§4 |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
||---|---|---|---|
|| `RAGReconciliationService.reconcileOrphanedRAGChunks()` | Fixed by this story | Real-DB branch now RLS-correctly scoped | In-process TypeScript |
|| `PgvectorRAGConnector.deletePost()` | Called by `reconcileOrphanedRAGChunks()` | Unaffected — already RLS-enforced (Story 19.1) | In-process TypeScript |
|| Postgres (`rag_chunks`, `rag_chunks_sync`, `social_posts`) | This method's data store | The queries begin actually being subject to their existing RLS policies | SQL, existing policies (migrations 0002, 0046, 0047, 0082, 0083) |
|| `withTenant()` (`social-listening-core/src/db/withTenant.ts`) | Mechanism for setting RLS session context, reused from Stories 19.1/19.2's precedent | The fix's implementation mechanism | In-process TypeScript |
|| `ragConnectorRegistry.ts` | Referenced, not modified | Confirms no Pinecone/Weaviate provider exists to attach Decision §3/§4 to yet | In-process TypeScript |

---

## 10. Non-Functional Considerations

- **Security / access control:** The role executing `reconcileOrphanedRAGChunks()`'s queries must not be the superuser role reserved for schema-level maintenance (BRD-0138 NFR-001).
- **Reliability:** No regression to existing epic-9 (`story-9.7`–`9.10`) or Stories 19.1/19.2's contract tests (BRD-0138 NFR-002); error-handling shape unchanged (NFR-003).
- **Transparency / trust (internal):** This story delivers a confirmation of already-shipped work and a fix to a named, real defect — the same discipline against overstating what is actually decided/enforced this project applies elsewhere (BRD-0136/BRD-0137 precedent). It also explicitly does *not* claim the reconciliation worker is now operationally running.
- **Maintainability:** A future Pinecone/Weaviate connector implementer has a concrete design to build against; a future ADR-0083 scheduler revisit has a clearly documented starting point.
- **Performance:** Not benchmarked; the fix changes which role/session executes an already-existing query, not its shape or cost.

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| `withTenant()`-wrapped query throws (e.g. unexpected connection failure) | (internal; no tenant-facing surface — this method has no caller today) | Caught by the existing outer `try`/`catch`; returns `{ deletedOrphansCount: deletedCount }` with whatever count accumulated before the failure, exactly as today |
|| `this.connector.deletePost()` throws mid-loop | (internal) | Caught by the same outer `try`/`catch`, unchanged behavior |
|| `existingPostIds` supplied (mocked/in-memory branch) | (internal) | Entirely unaffected by this story's change |

---

## 12. Assumptions and Dependencies

- `PgvectorRAGConnector`'s queries already execute via `withTenant()`/`app_user`, and `rag_chunks` already carries `FORCE ROW LEVEL SECURITY` — verified directly against `pgvectorConnector.ts` and migration `0082`.
- `reconcileOrphanedRAGChunks()`'s real-DB branch calls `getPool()` directly with no `withTenant()` call anywhere — verified directly against `ragReconciliationService.ts`.
- `rag_chunks`, `rag_chunks_sync`, and `social_posts` all already carry RLS policies matching on `app.tenant_id` — verified directly against migrations `0002`, `0046`, `0047`, `0082`, `0083`.
- No caller of `RAGReconciliationService`/`reconcileOrphanedRAGChunks` exists anywhere in the codebase, and no scheduler references it — verified by a codebase-wide search.
- `ragConnectorRegistry.ts` registers only `pgvector` — verified directly; no Pinecone or Weaviate connector exists.
- `withTenant()` is this project's own established RLS-session-context mechanism, already used for the analogous `rag_chunks` fix (Story 19.1) and `rag_chunks_sync` fix (Story 19.2) — verified directly against `withTenant.ts`, `pgvectorConnector.ts`, and `ragIndexingPipeline.ts`.

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
||---|---|---|---|
|| Q1 | What is the exact form of the new contract test proving the `reconcileOrphanedRAGChunks()` fix (new `epic-19` file vs. extending an existing `epic-9` test)? | Engineering Lead | At Story 19.3 implementation time, following this project's contract-first convention |
|| Q2 | How and when should `RAGReconciliationService` actually be invoked periodically? | Product / Engineering Lead | Not decided by ADR-0138 or this document; deferred to a future ADR-0083 revisit |
|| Q3 | What is the exact `RAGFilter`-to-Weaviate-native-filter translation for a future Weaviate connector? | Engineering Lead | Deferred to whoever implements a Weaviate `RAGConnector`; not covered by the cited research findings |
|| Q4 | Should ADR-0083 receive a dated "Supersession update" note now that ADR-0138 carries real content? | Engineering Lead / documentation governance | Not made in this pass; flagged as a required follow-up edit to ADR-0083 itself |

---

## 14. Appendix

### Glossary

- **Fail-closed defect:** A bug where a missing security/session-context mechanism causes a query to return no results rather than the wrong results — here, `reconcileOrphanedRAGChunks()` silently finding nothing rather than leaking cross-tenant data.
- **Reconciliation worker:** `RAGReconciliationService.reconcileOrphanedRAGChunks()` (Story 9.9, ADR-0083 §4.5) — compares `rag_chunks`/`rag_chunks_sync` against `social_posts` to garbage-collect orphaned vector records. Exists and is callable, has no caller anywhere in the codebase.
- **Namespace-per-tenant (Pinecone):** Pinecone's own multi-tenancy primitive — one namespace per tenant, created lazily on first write.
- **Shard-per-tenant (Weaviate):** Weaviate's own native multi-tenancy primitive — one physical shard per tenant, requiring explicit tenant creation before first write.

### Reference links

- ADR: `docs/adr/0138-rag-vector-store-namespace-per-tenant-isolation.md`
- Refined ADR: `docs/adr/0083-rag-vector-store-rls-and-metadata.md`
- Sibling/authorizing ADR: `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md`
- Sibling ADR in the same batch: `docs/adr/0137-rag-post-chunking-and-embedding-namespace-routing.md`
- BRD: `docs/project docs/Business-Requirements/BRD-0138-RAG-Vector-Store-Namespace-Per-Tenant-Isolation.md`
- Related ADRs: `ADR-0015`/`ADR-0032` (tenant RLS pattern), `ADR-0043` (tenant offboarding)
- Sibling ADRs (out of scope here): `ADR-0139` (Story 19.4), `ADR-0140` (Story 19.5)
- Already-shipped code inspected directly for this FDD: `social-listening-core/src/rag/ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `ragConnectorRegistry.ts`, `ragIndexingPipeline.ts`, `social-listening-core/src/db/withTenant.ts`, `adminPool.ts`, `social-listening-core/migrations/0002_enable_rls_social_posts.sql`, `0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql`, `0083_force_rls_rag_chunks_sync.sql`
- Related user story: Story 19.3, `docs/user-stories/epic-19-adr-0136-to-0140.md`
- Executable contract test citation: not yet created as of this writing — expected under `social-listening-core/contracts/epic-19/`, per this project's contract-first convention (see `story-19.1.rag-connector-namespace-isolation.contract.test.ts` / `story-19.2.rag-chunking-embedding-namespace-routing.contract.test.ts` for the pattern this story extends).

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
