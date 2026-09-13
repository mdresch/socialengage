# ADR-0137: RAG post chunking and embedding — namespace routing

**Status:** Accepted (2026-08-28)

**Authorizes:** (1) formal confirmation that `RAGChunkingService` and the `indexPostForRAG()` pipeline function require **zero signature changes** under ADR-0136's namespace/shard/RLS-per-tenant isolation model — namespace/shard/RLS routing is fully encapsulated inside the `RAGConnector` implementation, not the chunking/embedding layer; (2) a call to the new `RAGConnector.ensureTenantNamespace?()` hook (ADR-0136 Decision §1) from `indexPostForRAG()`, immediately before `connector.upsert(...)`, so a future namespace/shard-capable provider's per-tenant scope is provisioned on first write without a second breaking pipeline change; and (3) extending ADR-0136 Decision §2's "physical isolation primary, application-level filter secondary" principle to `indexPostForRAG()`'s own direct `rag_chunks_sync` bookkeeping write, which today bypasses `rag_chunks_sync`'s existing RLS policy via a superuser/admin-pool connection — the same anti-pattern Story 19.1 already fixed for `rag_chunks` in `PgvectorRAGConnector`.

*(Note: this ADR's original one-line stub read "routing vector upserts directly to target tenant namespaces/shards rather than flat index insertion" — that framing has been corrected here. Routing vector upserts to a target namespace/shard is `RAGConnector`'s own job, decided by ADR-0136, not this ADR's; this ADR's actual, narrower job — as ADR-0136 itself twice forward-references, see Context §1 below — is confirming the chunking/embedding pipeline needs no change as a result, plus one directly-adjacent bugfix.)*

**Source:** Story 19.2 (`docs/user-stories/epic-19-adr-0136-to-0140.md`); ADR-0136 (Accepted 2026-08-28 — Context §4 and Consequences #4 both forward-reference this ADR by name and number); ADR-0082 (Accepted 2026-08-25, the ADR this one refines); direct inspection of `social-listening-core/src/rag/ragIndexingPipeline.ts`, `ragChunkingService.ts`, `backfill.ts`, `ragReconciliationService.ts`, `pgvectorConnector.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql` (all read 2026-09-13).

---

## Context

### 1. ADR-0136 already committed this ADR to a specific confirmation it never delivered
ADR-0136 Context §4: "ADR-0137 (successor to ADR-0082) ... confirm[s] what does and does not need to change in the chunking/embedding pipeline ... as a consequence." ADR-0136 Consequences #4 goes further, asserting as settled fact something this ADR had never actually said: "`RAGChunkingService`/`RAGIndexingWorker` (ADR-0137) ... still call `upsert(tenantId, ...)` ... exactly as before — namespace/shard/RLS routing is fully encapsulated inside the connector implementation. This is confirmed explicitly in ADR-0137 and ADR-0139's own 'Relation to ADR-0136' sections." Until this rewrite, ADR-0137 was a one-line stub with no Decision text at all — the confirmation ADR-0136 already cites as delivered did not exist. This ADR closes that gap, the same "Accepted but never actually decided" pattern this project already resolved for ADR-0131 (Story 17.3) and ADR-0136's own BRD/FDD (Story 19.1).

### 2. Direct inspection confirms ADR-0136's claim is true, but the pipeline layer was never told about the new optional hook ADR-0136 itself added
`RAGChunkingService.split(post)` (`social-listening-core/src/rag/ragChunkingService.ts`) and `.embed(tenantId, chunks)` operate purely on `tenant_id`/`post_id`/`chunk_index`/`content` — neither method has, needs, or references any concept of a namespace, shard, or RLS session. `indexPostForRAG()` (`social-listening-core/src/rag/ragIndexingPipeline.ts`) calls `chunkingService.split(post)`, then `chunkingService.embed(tenantId, rawChunks)`, then `connector.upsert(tenantId, embeddedChunks)` — the exact ADR-0081/ADR-0136 `upsert(tenantId, vectors)` signature, unchanged. ADR-0136 Consequences #4's claim is verified true by this inspection, not merely repeated. However, ADR-0136 Decision §1 added a *new* optional interface member, `ensureTenantNamespace?(tenantId: string): Promise<void>`, and nothing in the shipped pipeline code calls it from anywhere — the hook exists on the interface (confirmed in `social-listening-core/src/rag/types.ts`, added by Story 19.1) but no caller wires it in. Leaving it uncalled is a second, quieter way this ADR could fail to be actually decided while looking finished.

### 3. `indexPostForRAG()` has its own direct, unencapsulated `rag_chunks_sync` write that repeats the exact anti-pattern Story 19.1 just fixed for `rag_chunks`
Reading `ragIndexingPipeline.ts` directly:
```ts
try {
  const pool = getAdminPool ? getAdminPool() : getPool();
  await pool.query(
    `INSERT INTO rag_chunks_sync (
      tenant_id, post_id, chunk_count, embedding_model, status, last_indexed_at, error_message, updated_at
    ) VALUES ($1, $2, $3, $4, $5, now(), null, now())
    ON CONFLICT (tenant_id, post_id) DO UPDATE SET ...`,
    [tenantId, post.id, embeddedChunks.length, 'text-embedding-3-small', 'synced']
  );
} catch { /* Handled in-memory */ }
```
`getAdminPool()` connects as the Postgres superuser (`PGUSER ?? 'postgres'`, per `social-listening-core/src/db/adminPool.ts`), which bypasses RLS unconditionally. `rag_chunks_sync` already has `ENABLE ROW LEVEL SECURITY` and a `rag_chunks_sync_tenant_isolation` policy from the *same* migrations that created `rag_chunks`'s policy (`0046_create_rag_chunks_and_sync_tables.sql`, aligned in `0047_fix_rag_chunks_permissions_and_rls.sql` to accept either `app.tenant_id` or `app.current_tenant_id`) — this is not a different table with a different shape, it is the literal sibling table Story 19.1 did not touch because Story 19.1's scope was `PgvectorRAGConnector` (the connector layer), not `ragIndexingPipeline.ts` (the pipeline layer that owns `rag_chunks_sync` per ADR-0082 Decision §5). The policy is structurally present and, as written today, never evaluated against this code path's real traffic, for the identical reason `rag_chunks`'s policy was inert before Story 19.1: the executing role is a superuser.

### 4. Two adjacent files were inspected and are confirmed genuinely out of scope, not missed instances of the same bug

- **`social-listening-core/src/rag/backfill.ts`** reads `social_posts`/`post_watchlist_matches` across all tenants via `getAdminPool()` to drive a one-time/on-demand re-indexing CLI (`backfillRAG(tenantId?)`, invoked directly via `require.main === module`, not a request-serving code path). This matches this project's own already-documented, sanctioned exception for "a background/batch job operating across all tenants" (`.claude/skills/postgres-tenant-db/SKILL.md`'s Known Gaps section — the same category as `refresh_author_topic_signals()`). Its *reads* are legitimately cross-tenant by design; its one write path is a call into `indexPostForRAG()` itself, which after Decision §3 below is no longer an admin-pool bypass. Not changed by this ADR.
- **`social-listening-core/src/rag/ragReconciliationService.ts`**'s `reconcileOrphanedRAGChunks()` calls `getPool()` directly and never calls `withTenant()` at all — no `app.tenant_id` (or `app.current_tenant_id`) session variable is ever set for its `rag_chunks`/`social_posts` orphan-detection query. This is a *different* defect shape from Decision §3's fix (total absence of the sanctioned session-context mechanism, versus presence of the wrong, RLS-bypassing pool) and fails closed — the query returns zero rows unconditionally in production, silently disabling reconciliation rather than leaking cross-tenant data. This sits closer to ADR-0138/Story 19.3's vector-store-RLS territory than to this ADR's chunking/embedding-pipeline scope. Flagged here as a real, verified, out-of-scope gap for whoever picks up Story 19.3 — not fixed or re-scoped into ADR-0137.

### 5. A third, unrelated defect found during this inspection is named but explicitly not this ADR's to fix
`indexPostForRAG()`'s Step 3 ("Handle orphan cleanup if new chunk count is less than previous") computes `obsoleteId` inside a loop but never calls `connector.deletePost()`, issues a delete, or does anything else with that value — it is dead code:
```ts
if (previousSync && embeddedChunks.length < previousSync.chunk_count) {
  for (let i = embeddedChunks.length; i < previousSync.chunk_count; i++) {
    const obsoleteId = `${tenantId}:${post.id}:${i}`;
    // Delete specific chunk or update
  }
}
```
This means ADR-0082 Decision §5's own orphan-chunk-cleanup requirement ("the worker explicitly deletes the obsolete vector IDs ... before upserting the new chunks") has never actually been implemented, despite ADR-0082's Consequences #6 and Resolved Questions describing it as done. This is a real, verified gap — but it is a correctness defect against ADR-0082's chunk-lifecycle Decision, not a namespace/shard/RLS-routing question, and is orthogonal to everything ADR-0136 asked this ADR to confirm. **Named explicitly here so it is not silently rediscovered as if unknown, but not fixed under this ADR's authorization** — it belongs to whoever next revisits Story 9.8/ADR-0082.

---

## Decision

### 1. Confirmation: `RAGChunkingService` and `indexPostForRAG()` require zero signature changes
`RAGChunkingService.split()`/`.embed()` and `indexPostForRAG()`'s call to `connector.upsert(tenantId, embeddedChunks)` are **unchanged by this ADR**. Tenant isolation (namespace, shard, or RLS) is fully encapsulated inside the `RAGConnector` implementation per ADR-0136 Decision §2; the chunking/embedding layer neither knows nor needs to know which physical-isolation mechanism a given connector uses. This formally delivers the confirmation ADR-0136 Context §4/Consequences #4 already forward-referenced (see Relation to ADR-0136 below).

### 2. `indexPostForRAG()` shall call `connector.ensureTenantNamespace?.(tenantId)` immediately before `connector.upsert(...)`
The call is optional-chained (`?.`), making it a no-op for any provider that does not implement the hook — today, that is every registered provider (`pgvector`, per `ragConnectorRegistry.ts`, does not implement it, correctly, per ADR-0136's own reasoning that a static, already-provisioned RLS policy needs no per-tenant provisioning step). The call site sits inside `indexPostForRAG()`'s existing per-attempt `try` block (the same block containing Step 4's `connector.upsert(...)` call), so that if a future namespace-capable provider's `ensureTenantNamespace?()` implementation fails, that failure is covered by the pipeline's *already-existing* bounded retry/backoff loop (ADR-0082 Decision §5's 3-retry exponential-backoff-then-DLQ policy) rather than requiring new retry infrastructure. Idempotency of repeated `ensureTenantNamespace?()` calls (one per indexing pass, not once per tenant lifetime) is the responsibility of each provider's own implementation — consistent with ADR-0136 Decision §1's framing of "provisioning ... before first write," which implies a provider-side create-if-not-exists semantic, not a caller-side once-only guarantee. No new interface member, new table, or new pipeline state is introduced to track "has this tenant's namespace already been provisioned" — that bookkeeping, if a future provider needs it, is that provider's own concern (ADR-0138/Story 19.3), not this pipeline's.

### 3. `indexPostForRAG()`'s direct `rag_chunks_sync` write shall route through `withTenant(tenantId, ...)` instead of `getAdminPool()`/`getPool()`
The existing `pool.query(...)` call against `rag_chunks_sync` (Context §3) is replaced with the same pattern Story 19.1 already applied to every tenant-scoped query in `PgvectorRAGConnector`: `await withTenant(tenantId, (client) => client.query(...))` (`social-listening-core/src/db/withTenant.ts`), which executes as the non-superuser `app_user` role and sets `app.tenant_id` transaction-locally, the exact session variable `rag_chunks_sync`'s existing policy (migration `0047`) already accepts. **No policy change is required** — `rag_chunks_sync_tenant_isolation` already matches on `app.tenant_id` OR `app.current_tenant_id`; only the call site changes, from an RLS-bypassing pool to an RLS-subject one. The `getAdminPool ? getAdminPool() : getPool()` fallback expression is removed entirely, not narrowed — there is no longer a legitimate reason for this call site to reach for the admin pool at all. This extends ADR-0136 Decision §2's "physical isolation primary, application-level filter secondary" principle — established there for `RAGConnector` implementations — to a table owned by the pipeline layer instead of the connector layer, closing an instance of the identical gap that happens to sit one layer up.

Consistent with Story 19.1's own treatment of `rag_chunks` (migration `0082_force_rls_rag_chunks.sql`, added for parity even though not strictly required since `app_user` is a non-owner grantee), `rag_chunks_sync` **should** also receive a `FORCE ROW LEVEL SECURITY` migration for the same defense-in-depth consistency — `0046_create_rag_chunks_and_sync_tables.sql` enables RLS on `rag_chunks_sync` but never forces it, the identical gap `rag_chunks` had before migration `0082`. This is a **Should**, not a **Must**, and its exact migration number/filename is deliberately left to Story 19.2 implementation time (see Open Questions), not assigned here — this ADR does not invent new schema, only extends an already-decided, already-shipped pattern to its sibling table.

### 4. Explicit scope exclusions
- **`backfill.ts` is out of scope** — a legitimate, already-sanctioned cross-tenant batch/admin job (Context §4), not a missed instance of this ADR's finding. No change authorized.
- **`ragReconciliationService.ts`'s missing-`withTenant()` bug is out of scope** — a separate, more severe defect (Context §4), flagged for ADR-0138/Story 19.3, not decided or fixed here.
- **The dead orphan-chunk-cleanup loop in `indexPostForRAG()`'s Step 3 is out of scope** — a real gap against ADR-0082 Decision §5 (Context §5), unrelated to namespace/RLS routing, flagged for whoever next revisits Story 9.8/ADR-0082, not decided or fixed here.
- **No new `RAGConnector` provider, no new interface member beyond the already-ADR-0136-decided `ensureTenantNamespace?`, and no change to the deterministic vector ID scheme** are authorized by this ADR.

---

## Relation to ADR-0136

This ADR is the confirmation ADR-0136 named twice and delivers it explicitly:

- **ADR-0136 Context §4**'s claim that ADR-0137 "confirm[s] what does and does not need to change in the chunking/embedding pipeline" is satisfied by this ADR's Decision §1: nothing changes in `RAGChunkingService.split()`/`.embed()`'s signatures or behavior, verified by direct inspection (Context §2), not merely asserted.
- **ADR-0136 Consequences #4**'s claim that "`RAGChunkingService`/`RAGIndexingWorker` (ADR-0137) ... still call `upsert(tenantId, ...)` ... exactly as before — namespace/shard/RLS routing is fully encapsulated inside the connector implementation" is confirmed true by this ADR's Decision §1 and Context §2 — this is the "Relation to ADR-0136" section ADR-0136 itself said would carry that confirmation.
- **ADR-0136 Decision §1**'s new optional `ensureTenantNamespace?()` hook is given its one, specific call site by this ADR's Decision §2 — ADR-0136 added the interface member but named no caller; this ADR is that caller.
- **ADR-0136 Decision §2**'s "physical isolation primary, metadata-filter-secondary" principle, decided there for `RAGConnector` implementations, is extended by this ADR's Decision §3 to `rag_chunks_sync`, a table the pipeline layer (not the connector layer) owns per ADR-0082 Decision §5 — the same principle, a different layer, not a new one.
- **No part of ADR-0136's Decision is superseded, revised, or reopened by this ADR.** This ADR is additive/confirmatory with respect to ADR-0136, and refines ADR-0082 (its own stated Authorizes relationship) rather than ADR-0136 itself.

---

## Consequences

1. **ADR-0136's forward reference is now actually true, not merely asserted.** A reader following ADR-0136 Consequences #4's citation to "ADR-0137's own 'Relation to ADR-0136' section" now finds real content there, verified against the shipped pipeline code, not a stub.
2. **The new `ensureTenantNamespace?` hook has exactly one caller**, wired in ahead of any provider actually needing it (Story 19.3/ADR-0138) — a future namespace/shard-capable provider gets its per-tenant scope provisioned on first indexing pass without a second breaking change to `ragIndexingPipeline.ts`.
3. **`rag_chunks_sync` gains the same real, database-enforced tenant boundary `rag_chunks` gained under Story 19.1** — closing an identical, previously-unflagged instance of the same admin-pool-bypass anti-pattern, one layer up from where Story 19.1 looked.
4. **No new retry/backoff/DLQ infrastructure is introduced.** Both the new `ensureTenantNamespace?()` call and the corrected `rag_chunks_sync` write ride the pipeline's already-existing bounded-retry loop.
5. **Two adjacent, superficially-similar issues remain unfixed on purpose** (`ragReconciliationService.ts`'s missing-`withTenant()` bug; the dead orphan-cleanup loop) — named explicitly (Context §4, §5) so neither is later mistaken for something this ADR silently missed, and so each is traceable to the right future story instead of being rediscovered from scratch.
6. **`backfill.ts` remains unchanged and is confirmed, not merely assumed, to be a legitimate exception** to the pattern this ADR otherwise closes.

---

## Alternatives considered

1. **Leave `ensureTenantNamespace?()` uncalled anywhere until Story 19.3 actually needs it.**
   - *Rejected:* this would just relocate the "authorized but never wired in" gap from the interface (ADR-0136) to the pipeline (this ADR) rather than closing it, and would hand Story 19.3 a second breaking change to `ragIndexingPipeline.ts` — exactly what ADR-0136 Decision §1's own framing ("before first write") is meant to avoid.
2. **Fix `rag_chunks_sync` by moving its write into `PgvectorRAGConnector` (or a future `RAGConnector` method) instead of fixing `ragIndexingPipeline.ts`'s own call site.**
   - *Rejected:* `rag_chunks_sync` is chunking/indexing bookkeeping owned by the pipeline layer per ADR-0082 Decision §5 ("a new `rag_chunks_sync` table tracks indexing state"), not part of the `RAGConnector` interface contract ADR-0081/ADR-0136 define. Moving it into the connector would blur an ownership boundary this project has kept clean since ADR-0082, for no benefit — the fix needed is a pool/role change at the existing call site, not a relocation.
3. **Fold `ragReconciliationService.ts`'s missing-`withTenant()` bug into this ADR since it lives in the same directory and touches the same tables.**
   - *Rejected:* it is a functionally different defect (total absence of the session-context mechanism, fails closed, versus this ADR's fix of presence-of-the-wrong-pool) and sits closer to ADR-0138/Story 19.3's vector-store-RLS-mapping scope than to chunking/embedding namespace routing. Folding it in here would also make this ADR's own "narrow, confirmatory + one-bugfix" scope (its stated Authorizes) inaccurate.
4. **Also fix the dead orphan-chunk-cleanup loop while editing this same file.**
   - *Rejected:* unrelated to namespace/shard/RLS routing; it is a correctness gap against ADR-0082's chunk-lifecycle Decision, not this ADR's subject. Fixing it here would silently expand this ADR's scope beyond what its Authorizes line states, and beyond what Story 19.2's own source story asks for.

---

## Resolved questions

- **Does `RAGChunkingService.split()`/`.embed()` need any namespace-aware parameter or behavior change?** No — verified by direct inspection; neither method has or needs any concept of namespace/shard/RLS. (Decision §1, Context §2.)
- **Does this ADR change the deterministic vector ID scheme?** No — `${tenantId}:${postId}:${chunkIndex}` is unchanged, carried forward from ADR-0081/ADR-0136 Decision §4.
- **Does `rag_chunks_sync`'s existing RLS policy need a text/predicate change to support the Decision §3 fix?** No — migration `0047` already accepts `app.tenant_id` (the session variable `withTenant()` sets), so only the call site changes, not the policy.
- **Is a new `RAGConnector` interface member introduced by this ADR?** No — `ensureTenantNamespace?` already exists on the interface as of ADR-0136/Story 19.1; this ADR gives it its first caller, it does not add or modify the interface.

## Open Questions

- [ ] **[Q-0137-1]** Should `rag_chunks_sync` receive a `FORCE ROW LEVEL SECURITY` migration for parity with `rag_chunks` (migration `0082_force_rls_rag_chunks.sql`)? Recommended (Decision §3) for defense-in-depth consistency, not functionally required since `app_user` is a non-owner grantee — left as an implementation-time decision at Story 19.2 build time, migration number not assigned here.
- [ ] **[Q-0137-2]** What is the exact form of the contract test proving the Decision §3 fix (a new test under `social-listening-core/contracts/epic-19/`, following the `story-19.1.rag-connector-namespace-isolation.contract.test.ts` pattern, versus extending an existing epic-9 test)? Left to Story 19.2 implementation time, per this project's contract-first convention.
- [ ] **[Q-0137-3]** (Not this ADR's to resolve, recorded for traceability only) Should the dead orphan-chunk-cleanup code in `indexPostForRAG()` Step 3 (Context §5) be fixed as part of a future ADR-0082/Story 9.8 revisit, and if so, via explicit per-ID `deletePost` calls or a full `deletePost`-then-`upsert` re-index (ADR-0082 Decision §5 names both as acceptable)? Flagged, not decided, here.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Refined ADR: `docs/adr/0082-rag-post-chunking-and-embedding.md` (Accepted 2026-08-25)
- Sibling/authorizing ADR: `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md` (Accepted 2026-08-28) — source of the `ensureTenantNamespace?` hook and the primary/secondary isolation principle this ADR extends
- Sibling ADRs in the same batch: ADR-0138 (vector-store RLS and metadata, namespace-per-tenant isolation), ADR-0139 (search/ask endpoint, namespace resolution), ADR-0140 (UI/UX refinements)
- Related ADRs: `ADR-0015`/`ADR-0032` (tenant RLS pattern), `ADR-0043` (tenant offboarding, non-bypassing-role precedent for `withTenant()`)
- Already-shipped code inspected directly for this ADR: `social-listening-core/src/rag/ragIndexingPipeline.ts`, `ragChunkingService.ts`, `backfill.ts`, `ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `social-listening-core/src/db/adminPool.ts`, `withTenant.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql`
- Precedent for this resolution pattern: Story 17.3 (ADR-0131), Story 19.1 (ADR-0136's own BRD/FDD) — see `docs/implementation-log.md`'s corresponding entries
