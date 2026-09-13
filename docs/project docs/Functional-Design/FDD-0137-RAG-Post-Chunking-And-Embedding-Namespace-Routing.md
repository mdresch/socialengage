# Functional Design Document

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | FDD-0137 RAG Post Chunking and Embedding: Namespace Routing |
|| Version | 1.0 |
|| Date | 2026-09-13 |
|| Author(s) | Business & Requirements Analyst persona |
|| Reviewer(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved for Build |
|| Related Documents | ADR-0137 (Accepted 2026-08-28), BRD-0137 (v1.0), ADR-0082, ADR-0136, ADR-0015, ADR-0032, ADR-0043, Story 19.2 |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 1.0 | 2026-09-13 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, written ahead of Story 19.2 implementation, derived from ADR-0137's newly-drafted Decision text and direct inspection of the already-shipped `ragIndexingPipeline.ts`/`ragChunkingService.ts`/`backfill.ts`/`ragReconciliationService.ts`. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0137's Decision (Accepted 2026-08-28, drafted 2026-09-13) and BRD-0137 (v1.0) into a functional design for **Story 19.2**: (1) a formal, code-verified confirmation that the RAG chunking/embedding pipeline (`RAGChunkingService`, `indexPostForRAG()`) needs zero signature change under ADR-0136's namespace-per-tenant isolation model; (2) wiring the ADR-0136-authorized `ensureTenantNamespace?()` hook into `indexPostForRAG()` at exactly one call site; and (3) fixing `indexPostForRAG()`'s own direct `rag_chunks_sync` write, which today bypasses that table's RLS policy via the admin/superuser pool — the identical anti-pattern Story 19.1 already fixed for `rag_chunks`.

### 2.2 Scope

- **In scope:**
  - Confirm `RAGChunkingService.split()`/`.embed()` and `indexPostForRAG()`'s `connector.upsert(tenantId, embeddedChunks)` call require no change.
  - Add `await connector.ensureTenantNamespace?.(tenantId)` to `indexPostForRAG()`, immediately before the existing `connector.upsert(...)` call, inside the function's existing per-attempt retry block.
  - Replace `indexPostForRAG()`'s `rag_chunks_sync` write (`const pool = getAdminPool ? getAdminPool() : getPool(); await pool.query(...)`) with `await withTenant(tenantId, (client) => client.query(...))`.
  - Add a contract test proving the `rag_chunks_sync` write no longer executes via the admin/superuser pool.
  - (Should) Add a `FORCE ROW LEVEL SECURITY` migration on `rag_chunks_sync`, for parity with `rag_chunks`'s `0082_force_rls_rag_chunks.sql`.

- **Out of scope:**
  - Any Pinecone/Azure AI Search connector implementation or isolation mapping (ADR-0138, Story 19.3).
  - Any change to `PgvectorRAGConnector` itself (already fixed under Story 19.1).
  - `ragReconciliationService.ts`'s separate missing-`withTenant()` defect (flagged for Story 19.3, not this story).
  - `backfill.ts` (confirmed legitimate cross-tenant batch job, not an instance of the bug this story fixes).
  - The dead orphan-chunk-cleanup loop found in `indexPostForRAG()` Step 3 (flagged for a future ADR-0082/Story 9.8 revisit).
  - Any REST endpoint change (ADR-0139, Story 19.4) or UI/UX change (ADR-0140, Story 19.5).
  - Any new `RAGConnector` interface member — `ensureTenantNamespace?` already exists (ADR-0136/Story 19.1); this story adds a caller only.

### 2.3 Target Audience

Backend engineers implementing the pipeline call-site addition and the `rag_chunks_sync` RLS-enforcement fix; QA writing the new contract test; future engineers implementing Story 19.3, who need `ensureTenantNamespace?()` to already have a working call site before they build the first provider that implements it.

---

## 3. Context and Background

- **Problem or opportunity being addressed:** ADR-0136 twice forward-referenced ADR-0137 to confirm the chunking/embedding pipeline needs no change as a consequence of ADR-0136's namespace-per-tenant isolation decision — but ADR-0137 was a one-line stub, so that confirmation was never actually delivered, and two adjacent gaps (an unwired `ensureTenantNamespace?()` hook; an admin-pool-bypassing `rag_chunks_sync` write) went unaddressed as a result.
- **Verified current-state finding (not assumed):** `RAGChunkingService.split()`/`.embed()` carry no namespace/shard/RLS concept — confirmed by direct reading of `social-listening-core/src/rag/ragChunkingService.ts`. `indexPostForRAG()`'s `connector.upsert(tenantId, embeddedChunks)` call already matches the unchanged ADR-0081/ADR-0136 interface — confirmed by direct reading of `ragIndexingPipeline.ts`. That same file's own direct `rag_chunks_sync` write runs via `getAdminPool()` (fallback `getPool()`), bypassing RLS — confirmed by direct reading, and confirmed against `rag_chunks_sync`'s existing policy in `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`/`0047_fix_rag_chunks_permissions_and_rls.sql`, which already accepts `app.tenant_id` (the session variable `withTenant()` sets) — no policy text change is needed, only the call site.
- **Business/user value:** The same real, defense-in-depth database boundary already delivered for `rag_chunks` under Story 19.1, now extended to its sibling bookkeeping table, plus a working provisioning call site for a future namespace-capable provider (BRD-0137 §2, §3).
- **Source requirements:** ADR-0137 (Accepted 2026-08-28, drafted 2026-09-13), BRD-0137 (v1.0), Story 19.2 in `docs/user-stories/epic-19-adr-0136-to-0140.md`.
- **Constraints and dependencies:**
  - No breaking change to `RAGChunkingService` or `indexPostForRAG()`'s public call signatures.
  - No new retry/backoff/DLQ mechanism — both new/changed call sites must use the pipeline's existing bounded-retry loop (ADR-0082 Decision §5).
  - No new `RAGConnector` interface member, no new table, no vector-ID-scheme change.

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
||---|---|---|
|| G1 | Deliver the confirmation ADR-0136 already cited | ADR-0137's Decision §1 and "Relation to ADR-0136" section state the confirmation, backed by this FDD's own direct-inspection evidence |
|| G2 | Give `ensureTenantNamespace?()` its one call site | `indexPostForRAG()` calls `connector.ensureTenantNamespace?.(tenantId)` before `upsert(...)`, verified no-op for `pgvector` |
|| G3 | Make `rag_chunks_sync`'s existing RLS policy the real enforcement boundary for `indexPostForRAG()`'s write | A contract test proves the write executes under a non-superuser, RLS-subject role |
|| G4 | Introduce no new retry infrastructure | Both new/changed call sites ride the existing 3-retry exponential-backoff loop |
|| G5 | Do not scope-creep into ADR-0138/Story 19.3 or Story 9.8/ADR-0082's territory | `ragReconciliationService.ts`, `backfill.ts`, and the dead orphan-cleanup loop remain untouched |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Confirmation that `RAGChunkingService`/`indexPostForRAG()` require zero signature change

- **Description:** Formally records, with direct code citation, that `split()`, `.embed()`, and the `connector.upsert(tenantId, embeddedChunks)` call already match ADR-0136's unchanged interface.
- **Triggers:** N/A — a documentation/decision confirmation, not a runtime behavior.
- **Inputs:** N/A.
- **Processing:** No code change for this capability; it is verified, not implemented.
- **Outputs:** N/A.
- **Error handling:** N/A.
- **Edge cases:** None — this is a closed confirmation, not an open design question.

### 5.2 Feature / Capability: `ensureTenantNamespace?()` call site in `indexPostForRAG()`

- **Description:** Adds `await connector.ensureTenantNamespace?.(tenantId)` immediately before the existing `await connector.upsert(tenantId, embeddedChunks)` call, inside `indexPostForRAG()`'s existing per-attempt `try` block (the same block as Step 4).
- **Triggers:** Every `indexPostForRAG()` invocation, on every attempt of the existing retry loop.
- **Inputs:** `tenantId` (already an existing parameter).
- **Processing:** Optional-chained call; resolves to `undefined` immediately for any connector that does not implement the hook (today, `pgvector`, the only registered provider). No caching, no "has this tenant already been provisioned" state is introduced — idempotency is the provider's own responsibility (ADR-0137 Decision §2).
- **Outputs:** No new persisted state; behaviorally a no-op today.
- **Error handling:** If a future provider's implementation throws, that failure is caught by the same `try`/`catch` already wrapping this block, incrementing the existing retry counter and using the existing exponential-backoff delay — no new error-handling path is introduced.
- **Edge cases:** A provider whose `ensureTenantNamespace?()` implementation is not idempotent could see redundant provisioning calls on every indexing pass (not just once per tenant) — explicitly named as the provider's own responsibility to handle, not solved by this pipeline change (see BRD-0137 R-001).

### 5.3 Feature / Capability: `rag_chunks_sync` write routed through `withTenant()`

- **Description:** Replaces `indexPostForRAG()`'s direct `const pool = getAdminPool ? getAdminPool() : getPool(); await pool.query(...)` against `rag_chunks_sync` with `await withTenant(tenantId, (client) => client.query(...))`, using the identical `INSERT ... ON CONFLICT (tenant_id, post_id) DO UPDATE` statement already in place — only the pool/role and transaction wrapper change, not the SQL shape.
- **Triggers:** Every successful chunk-embed-upsert cycle inside `indexPostForRAG()` (Step 5 of the existing function).
- **Inputs:** `tenantId`, `post.id`, `embeddedChunks.length`, `'text-embedding-3-small'`, `'synced'` — all already-existing values, unchanged.
- **Processing:** `withTenant()` opens an explicit transaction, sets `app.tenant_id` transaction-locally via `set_config(..., true)`, executes the query against the non-superuser `app_user` role (via `getPool()` internally), then commits — exactly the pattern already applied to every `PgvectorRAGConnector` query under Story 19.1. `rag_chunks_sync`'s existing policy (migration `0047`) already accepts `app.tenant_id`, so no policy change is required.
- **Outputs:** Identical `rag_chunks_sync` row content to today; the only observable difference is which role/session context wrote it.
- **Error handling:** The existing `try { ... } catch { /* Handled in-memory */ }` wrapper around this write is unchanged — if the RLS-enforced write throws (e.g. session context not set for some unexpected reason), the function degrades to its existing in-memory `syncTracker` fallback exactly as it does today for any other DB failure, consistent with `withTenant()`'s own documented fail-closed behavior.
- **Edge cases:** None new — the fallback-to-in-memory behavior on any DB error already exists and is unchanged by this fix.

### 5.4 Feature / Capability: Contract test proving `rag_chunks_sync` write is no longer admin-pool-based

- **Description:** A new (or extended) contract test asserts that `indexPostForRAG()`'s `rag_chunks_sync` write path never calls `getAdminPool()`, and that a cross-tenant read of `rag_chunks_sync` under a second tenant's session context returns zero rows for the first tenant's write — independent of any application-level filter.
- **Triggers:** Part of Story 19.2's own contract-test suite, expected under `social-listening-core/contracts/epic-19/`.
- **Inputs:** Two tenants' worth of `indexPostForRAG()` calls, following the same tenantA/tenantB fixture pattern as `story-19.1.rag-connector-namespace-isolation.contract.test.ts`.
- **Processing:** A `jest.spyOn`-style call-site check (matching Story 19.1's own precedent) confirms `getAdminPool()` is never called from this write path; a real, unfiltered query under tenant B's `withTenant()` session context confirms tenant A's `rag_chunks_sync` row is unreachable.
- **Outputs:** A passing contract test demonstrating the fix is real, not merely asserted.
- **Error handling:** N/A (test-only concern).
- **Edge cases:** This test must not itself use `getAdminPool()` to prove the point — doing so would reproduce the exact bypass this story exists to close (same discipline as FDD-0136 §5.5's edge case).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
||---|---|
|| Engineering Lead / implementer | Implements the pipeline call-site addition and the `rag_chunks_sync` fix; writes the new contract test |
|| `indexPostForRAG()` (system actor) | The pipeline function whose call sequence and DB write both change |
|| `RAGChunkingService` (system actor) | Unaffected — confirmed unchanged |
|| Future Story 19.3 implementer (indirect actor) | Depends on `ensureTenantNamespace?()` already having a working call site |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
||---|---|---|---|---|
|| Story 19.2 | engineer implementing the RAG pipeline namespace-routing confirmation | confirm the chunking/embedding pipeline needs no change, wire in `ensureTenantNamespace?()`, and fix `rag_chunks_sync`'s admin-pool bypass | ADR-0136's forward reference is backed by real content and `rag_chunks_sync` gets the same real database-level tenant boundary `rag_chunks` already has | Confirmation delivered; `ensureTenantNamespace?.(tenantId)` called before every `upsert()`; `rag_chunks_sync` write routes through `withTenant()`; a contract test proves it; `RAGChunkingService`, `backfill.ts`, `ragReconciliationService.ts`, and the orphan-cleanup loop remain unchanged |

### 6.3 Workflow Diagrams / Steps

**Primary workflow — `indexPostForRAG()` after this story ships:**

1. `indexPostForRAG(tenantId, post)` is invoked exactly as today — no signature change.
2. Step 1–2 (unchanged): `chunkingService.split(post)`, then `chunkingService.embed(tenantId, rawChunks)`.
3. Step 3 (unchanged, still a known, separately-flagged gap): the orphan-cleanup loop runs but performs no delete.
4. **New:** `await connector.ensureTenantNamespace?.(tenantId)` — a no-op for `pgvector` today.
5. Step 4 (unchanged): `await connector.upsert(tenantId, embeddedChunks)`.
6. Step 5 (**changed**): the `rag_chunks_sync` bookkeeping write now executes via `await withTenant(tenantId, (client) => client.query(...))` instead of `getAdminPool()`/`getPool()` directly.
7. On any failure at any step, the existing per-attempt retry/backoff loop (up to `maxRetries`, default 3) applies unchanged; on exhaustion, the existing failed-record bookkeeping applies unchanged.

---

## 7. Data Requirements

### 7.1 Data Inputs

- The already-existing `rag_chunks_sync` table and its `rag_chunks_sync_tenant_isolation` RLS policy (migrations `0046`/`0047`) — no new columns required.
- `tenantId`, `post.id`, `embeddedChunks.length`, unchanged, on every existing call.

### 7.2 Data Outputs

- No new persisted data. The only new "output" is the (currently no-op) `ensureTenantNamespace?()` invocation and, if Open Question Q1 is resolved affirmatively, a `FORCE ROW LEVEL SECURITY` migration on `rag_chunks_sync` — left as an implementation detail, not specified here.

### 7.3 Data Model / Entities — code changes (TypeScript, illustrative)

```ts
// social-listening-core/src/rag/ragIndexingPipeline.ts — illustrative diff, not a new interface

// Step 4 (unchanged) + new call immediately before it:
await connector.ensureTenantNamespace?.(tenantId);
await connector.upsert(tenantId, embeddedChunks);

// Step 5's rag_chunks_sync write — before (admin-pool bypass):
// const pool = getAdminPool ? getAdminPool() : getPool();
// await pool.query(`INSERT INTO rag_chunks_sync (...) VALUES (...) ON CONFLICT ...`, [...]);

// Step 5's rag_chunks_sync write — after (RLS-enforced, ADR-0137 Decision §3):
await withTenant(tenantId, (client) =>
  client.query(
    `INSERT INTO rag_chunks_sync (
      tenant_id, post_id, chunk_count, embedding_model, status, last_indexed_at, error_message, updated_at
    ) VALUES ($1, $2, $3, $4, $5, now(), null, now())
    ON CONFLICT (tenant_id, post_id) DO UPDATE SET
      chunk_count = EXCLUDED.chunk_count,
      embedding_model = EXCLUDED.embedding_model,
      status = EXCLUDED.status,
      last_indexed_at = now(),
      error_message = null,
      updated_at = now()`,
    [tenantId, post.id, embeddedChunks.length, 'text-embedding-3-small', 'synced']
  )
);
```
No `RAGConnector`, `RAGChunkingService`, or `RAGChunk`/`RAGChunkMetadata` interface changes are introduced — `types.ts` is untouched by this story.

### 7.4 Existing schema referenced (unchanged by this story unless Q1 is resolved affirmatively)

```sql
-- From social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql (existing, unchanged):
CREATE TABLE IF NOT EXISTS rag_chunks_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  embedding_model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-3-small',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_indexed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rag_chunks_sync_tenant_post UNIQUE(tenant_id, post_id)
);

ALTER TABLE rag_chunks_sync ENABLE ROW LEVEL SECURITY;
-- NOTE: no FORCE ROW LEVEL SECURITY is set today — see §13 Q1, mirrors rag_chunks's
-- pre-migration-0082 state exactly.

-- From migration 0047 (existing, unchanged):
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
This story does not need to alter this schema unless the Open Question Q1 (`FORCE ROW LEVEL SECURITY` parity) is resolved affirmatively at implementation time — that migration's number is not assigned here.

### 7.5 Validation Rules

- `tenantId` remains mandatory on `indexPostForRAG()`, unchanged.
- The `rag_chunks_sync` write's SQL statement shape is unchanged — only the executing pool/role and transaction wrapper change.
- `ensureTenantNamespace?()`'s absence on a given connector must not throw or alter control flow — optional-chaining guarantees this without new validation code.

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
||---|---|---|
|| BR1 | Namespace/shard/RLS routing is fully encapsulated in `RAGConnector`; the pipeline never duplicates it. | `RAGChunkingService`, `indexPostForRAG()` |
|| BR2 | `ensureTenantNamespace?()` is called unconditionally before every `upsert()`; idempotency is the provider's responsibility. | `indexPostForRAG()` |
|| BR3 | `rag_chunks_sync` writes must execute under a non-superuser, RLS-subject role. | `indexPostForRAG()` |
|| BR4 | No new retry/backoff/DLQ mechanism is introduced. | `indexPostForRAG()` |
|| BR5 | `backfill.ts` and `ragReconciliationService.ts` are unchanged by this story. | Scope guard |
|| BR6 | The dead orphan-chunk-cleanup loop is unchanged by this story. | Scope guard |
|| BR7 | The vector ID scheme and `RAGConnector`/`RAGChunkingService` interfaces are unchanged. | Scope guard |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
||---|---|---|---|
|| `RAGChunkingService` | Called by `indexPostForRAG()` | Unaffected — no signature change | In-process TypeScript |
|| `RAGConnector.upsert()` | Called by `indexPostForRAG()` | Unaffected — no signature change | In-process TypeScript |
|| `RAGConnector.ensureTenantNamespace?()` | Called by `indexPostForRAG()` (new call site) | First and only caller in the codebase as of this story | In-process TypeScript |
|| Postgres (`rag_chunks_sync` table) | `indexPostForRAG()`'s data store | The write begins actually being subject to the existing RLS policy | SQL, existing policy (migrations 0046/0047) |
|| `withTenant()` (`social-listening-core/src/db/withTenant.ts`) | Mechanism for setting RLS session context, reused from Story 19.1's precedent | The fix's implementation mechanism | In-process TypeScript |
|| `backfill.ts` | Caller of `indexPostForRAG()` | Unaffected by this story's changes; benefits incidentally since its own call into `indexPostForRAG()` now writes `rag_chunks_sync` correctly | In-process TypeScript |

---

## 10. Non-Functional Considerations

- **Security / access control:** The role executing `indexPostForRAG()`'s `rag_chunks_sync` write must not be the superuser role reserved for schema-level maintenance (BRD-0137 NFR-001).
- **Reliability:** No regression to existing epic-9 (`story-9.7`–`9.10`) or Story 19.1's contract tests (BRD-0137 NFR-002).
- **Transparency / trust (internal):** This story delivers a confirmation ADR-0136 already cited as existing — the same discipline against overstating what is actually decided/enforced that this project applies elsewhere (BRD-0136 precedent).
- **Maintainability:** The `ensureTenantNamespace?()` call site is added ahead of any real need, so Story 19.3 does not have to make a second breaking pipeline change.
- **Performance:** Not benchmarked; the `ensureTenantNamespace?()` call is a no-op for the only currently-registered provider (BRD-0137 NFR-003, a "Should").

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
||---|---|---|
|| `ensureTenantNamespace?()` is undefined on the active connector (today, always true) | (internal; no tenant-facing surface change) | Optional chaining resolves to `undefined`; no error, no behavior change |
|| A future provider's `ensureTenantNamespace?()` implementation throws | (internal) | Caught by `indexPostForRAG()`'s existing per-attempt `try`/`catch`; counted against the existing `maxRetries`/backoff, same as any other step failure today |
|| `rag_chunks_sync` write fails under the new `withTenant()` path (e.g. unexpected session-context issue) | (internal) | Falls back to the existing in-memory `syncTracker`, exactly as any other DB failure does today — no new error path |

---

## 12. Assumptions and Dependencies

- `RAGChunkingService.split()`/`.embed()` carry no namespace/shard/RLS concept — verified directly against `ragChunkingService.ts`.
- `indexPostForRAG()`'s `connector.upsert(tenantId, embeddedChunks)` call already matches the unchanged ADR-0081/ADR-0136 interface — verified directly against `ragIndexingPipeline.ts`.
- `ensureTenantNamespace?` exists on `RAGConnector` (`types.ts`) but has no caller in the shipped codebase as of 2026-09-13 — verified by direct inspection.
- `rag_chunks_sync` already carries `ENABLE ROW LEVEL SECURITY` and a policy accepting `app.tenant_id` — verified directly against migrations `0046`/`0047`; no `FORCE ROW LEVEL SECURITY` is set (mirrors `rag_chunks`'s pre-Story-19.1 state).
- `indexPostForRAG()`'s `rag_chunks_sync` write runs via `getAdminPool()`/`getPool()`, never `withTenant()` — verified directly against `ragIndexingPipeline.ts`.
- `withTenant()` is this project's own established RLS-session-context mechanism, already used for the analogous `rag_chunks` fix in Story 19.1 — verified directly against `withTenant.ts` and `pgvectorConnector.ts`.

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
||---|---|---|---|
|| Q1 | Should `rag_chunks_sync` receive a `FORCE ROW LEVEL SECURITY` migration for parity with `rag_chunks`'s `0082_force_rls_rag_chunks.sql`? | Engineering Lead | At Story 19.2 implementation time; recommended, not mandated |
|| Q2 | What is the exact form of the new contract test proving the `rag_chunks_sync` fix (new `epic-19` file vs. extending an existing test)? | Engineering Lead | At Story 19.2 implementation time, following this project's contract-first convention |
|| Q3 | Should the dead orphan-chunk-cleanup loop in `indexPostForRAG()` Step 3 be fixed under a future ADR-0082/Story 9.8 revisit? | Product / Engineering Lead | Not decided by ADR-0137 or this document; explicitly deferred |

---

## 14. Appendix

### Glossary

- **Pipeline layer:** `RAGChunkingService` and `indexPostForRAG()` — distinct from the connector layer (`RAGConnector` implementations) ADR-0136 governs.
- **`ensureTenantNamespace?`:** The optional `RAGConnector` lifecycle hook (ADR-0136) for providers needing explicit per-tenant provisioning; this story gives it its one call site.
- **Inert RLS policy:** A `CREATE POLICY` statement present in the schema but never evaluated against a code path's real queries because those queries run under a superuser role.
- **Dead orphan-cleanup loop:** The Step 3 code in `indexPostForRAG()` that computes an obsolete vector ID but never deletes it — a real, verified, out-of-scope gap against ADR-0082 Decision §5.

### Reference links

- ADR: `docs/adr/0137-rag-post-chunking-and-embedding-namespace-routing.md`
- Refined ADR: `docs/adr/0082-rag-post-chunking-and-embedding.md`
- Sibling/authorizing ADR: `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md`
- BRD: `docs/project docs/Business-Requirements/BRD-0137-RAG-Post-Chunking-And-Embedding-Namespace-Routing.md`
- Related ADRs: `ADR-0015`/`ADR-0032` (tenant RLS pattern), `ADR-0043` (tenant offboarding, non-bypassing-role precedent)
- Sibling ADRs (out of scope here): `ADR-0138` (Story 19.3), `ADR-0139` (Story 19.4), `ADR-0140` (Story 19.5)
- Already-shipped code inspected directly for this FDD: `social-listening-core/src/rag/ragIndexingPipeline.ts`, `ragChunkingService.ts`, `backfill.ts`, `ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `social-listening-core/src/db/adminPool.ts`, `withTenant.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql`
- Related user story: Story 19.2, `docs/user-stories/epic-19-adr-0136-to-0140.md`
- Executable contract test citation: not yet created as of this writing — expected under `social-listening-core/contracts/epic-19/`, per this project's contract-first convention (see `story-19.1.rag-connector-namespace-isolation.contract.test.ts` for the pattern this story extends).

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

See §1 Document Control.
