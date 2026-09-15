# ADR-0138: RAG vector store — namespace-per-tenant isolation and pgvector RLS

**Status:** Accepted (2026-08-28)

**Authorizes:** refinements to ADR-0083 — (1) confirms, without re-deciding, that pgvector's Postgres Row-Level Security isolation on `rag_chunks` was already delivered under ADR-0136/Story 19.1; (2) fixes `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s fail-closed missing-`withTenant()` defect — the one concretely buildable "pgvector RLS" gap this ADR still owns; and (3) documents, at an architecture level with no connector code authorized, Pinecone namespace-per-tenant and Weaviate dedicated-shard-per-tenant physical isolation mechanics, for a future provider-adding story to build against.

*(Note: this ADR's original one-line stub read "...and explicit Postgres Row-Level Security policies on `rag_chunks` pgvector tables" as if that decision were still pending. It was not — Story 19.1/ADR-0136 (Accepted 2026-08-28, built `social-listening-core@8962e1d`) already delivered pgvector's RLS-based isolation before this ADR's own Decision text existed. This rewrite confirms that delivery rather than re-deciding it, and narrows this ADR's own remaining buildable scope to the one real, verified gap still open in the same area: `RAGReconciliationService`'s fail-closed missing-`withTenant()` bug — the same corrected-stub pattern ADR-0137 already applied to itself.)*

**Source:** Story 19.3 (`docs/user-stories/epic-19-adr-0136-to-0140.md`); ADR-0136 (Accepted 2026-08-28, Story 19.1 built `social-listening-core@8962e1d`) — pgvector RLS confirmed here, not redecided; ADR-0137 (Accepted 2026-08-28, Story 19.2 built `social-listening-core@a12b947`) — same batch, same resolution pattern, written immediately prior to this ADR; ADR-0083 (Accepted 2026-08-27, the ADR this one refines); the same External Deep Research Brief ADR-0136 cites (`raw/28-semantic-search-rag-deep-research.md`, generated 2026-08-28, external second-brain vault, not part of this repository) — finding §2 (Pinecone multi-tenancy implementation guide, https://docs.pinecone.io/guides/index-data/implement-multitenancy) and finding §3 (Weaviate native multi-tenancy architecture, https://weaviate.io/blog/weaviate-multi-tenancy-architecture-explained); direct inspection of `social-listening-core/src/rag/ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `ragConnectorRegistry.ts`, `social-listening-core/src/db/withTenant.ts`, `adminPool.ts`, and migrations `0046`, `0047`, `0082`, `0083` (all read 2026-09-14); a codebase-wide search confirming no caller of `RAGReconciliationService`/`reconcileOrphanedRAGChunks` exists anywhere (2026-09-14).

---

## Context

### 1. ADR-0136 named this ADR as the owner of the detailed per-provider physical-isolation mapping, but this ADR was a stub until now
ADR-0136 Context §4: "ADR-0138 (successor to ADR-0083) owns the detailed, per-provider physical-isolation mapping and the vector-metadata schema." ADR-0136 Decision §2 goes further, forward-referencing this ADR twice by name for "the full per-provider mapping (pgvector RLS policy shape, Pinecone namespace mechanics, the Azure AI Search open case)." Until this rewrite, ADR-0138 was a one-line stub — no Context, Decision, Consequences, or Alternatives — so none of that mapping had actually been decided, despite ADR-0136 already citing it as this ADR's job. This is the same "Accepted but never actually decided" gap this project has now resolved four times this session: ADR-0131 (Story 17.3), ADR-0136's own BRD/FDD (Story 19.1), ADR-0137 in full (Story 19.2), and now this ADR.

### 2. Direct inspection confirms pgvector's own RLS mapping was already delivered — by Story 19.1, under ADR-0136, not this ADR
Reading `social-listening-core/src/rag/pgvectorConnector.ts` directly: every tenant-scoped query in `upsert()`, `search()`, `deletePost()`, `deleteTenant()`, and `status(tenantId)` executes via `withTenant(tenantId, ...)` (`social-listening-core/src/db/withTenant.ts`), never `getAdminPool()`, and `status()` reports `isolationModel: 'row-level-rls'` with an inline comment stating it is "honest because every tenant-scoped query above now runs via `withTenant()`/`app_user`, subject to `rag_chunks`' RLS policy." `rag_chunks` itself received `ALTER TABLE rag_chunks FORCE ROW LEVEL SECURITY` in migration `0082_force_rls_rag_chunks.sql`, and its `rag_chunks_tenant_isolation` policy (migration `0047_fix_rag_chunks_permissions_and_rls.sql`) matches on `app.tenant_id`, the exact session variable `withTenant()` sets. This is a complete, already-shipped answer to the "pgvector RLS" third of this ADR's Authorizes line — this ADR confirms and cites it (Decision §1 below), it does not re-derive or re-decide it.

### 3. `RAGReconciliationService.reconcileOrphanedRAGChunks()` has a real, verified, fail-closed defect that belongs to this ADR
This method's real-DB branch — reading `social-listening-core/src/rag/ragReconciliationService.ts` directly — calls `getPool().query(...)` for its orphan-detection `SELECT` and its cleanup `DELETE FROM rag_chunks_sync` without ever calling `withTenant()`, so no `app.tenant_id` (or `app.current_tenant_id`) session variable is ever set for either query:
```ts
const pool = getPool();
const res = await pool.query(
  `SELECT DISTINCT rc.post_id FROM rag_chunks rc
   LEFT JOIN social_posts sp ON rc.tenant_id = sp.tenant_id AND rc.post_id = sp.id
   WHERE rc.tenant_id = $1 AND sp.id IS NULL`,
  [tenantId]
);
for (const row of res.rows) {
  await this.connector.deletePost(tenantId, row.post_id);
  await pool.query('DELETE FROM rag_chunks_sync WHERE tenant_id = $1 AND post_id = $2', [tenantId, row.post_id]);
  deletedCount++;
}
```
`getPool()` connects as the non-superuser `app_user` role (unlike `getAdminPool()`), which means this is *not* the admin-pool-bypass anti-pattern Story 19.1/19.2 fixed elsewhere — it is a different, arguably more severe defect shape: total absence of the RLS session-context mechanism. `rag_chunks` (migration `0082`) and `social_posts` (ADR-0015, migration `0002`) both carry `FORCE ROW LEVEL SECURITY`, and `rag_chunks_sync` now does too (migration `0083_force_rls_rag_chunks_sync.sql`, added by Story 19.2 per ADR-0137 Decision §3/Open Question Q-0137-1, resolved affirmatively). With no session variable ever set, `NULLIF(current_setting('app.tenant_id', true), '')::uuid` evaluates to `NULL` on every row, and `tenant_id = NULL` is never true — the `SELECT ... FROM rag_chunks rc LEFT JOIN social_posts sp ...` query returns **zero rows unconditionally** in production. This is a fail-closed bug (reconciliation silently never finds anything to clean up), not a data-leak risk — but it means ADR-0083 Decision §4, item 5 ("Reconciliation Background Worker," cited in the code's own docstring as "ADR-0083 §4.5") has never actually worked, despite the class and its query existing since Story 9.9. This was already flagged twice in this session's own prior work (BRD-0136 §12 R-002/Assumptions; ADR-0137 Context §4) as belonging to ADR-0138/Story 19.3 — this ADR is where it gets decided.

### 4. A second, separate defect was confirmed by direct codebase-wide search and is explicitly not this ADR's to fix
A search across `social-listening-core/src` for `RAGReconciliationService` and `reconcileOrphanedRAGChunks` returns exactly one file: `ragReconciliationService.ts` itself. No route, cron job, scheduled worker, or `bootstrapConnectors.ts`/`server.ts` wiring anywhere in the codebase ever instantiates or calls this service. A further search for scheduler-shaped code (`cron`, `setInterval`, `scheduler`) across `social-listening-core/src` finds real schedulers for ingestion polling (`pollScheduler.ts`), outbound publishing (`outboundPublishScheduler.ts`), daily digests (`dailyDigestScheduler.ts`), and analytics aggregation (`dailyAggregatesWorker.ts`) — but none reference `ragReconciliationService.ts` at all. This confirms ADR-0083 Decision §4, item 5's own promise — "a periodic background worker" — was never actually fulfilled: the class exists and is callable, but nothing calls it periodically, or at all. This is a real, separate, pre-existing gap against **ADR-0083 itself**, orthogonal to what this ADR (namespace isolation and pgvector RLS routing) authorizes. Named explicitly in Decision §6 and Open Questions below so it is not later mistaken for something this ADR silently missed or silently fixed — but not designed or built here, matching this project's own established scope discipline (ADR-0137 Alternative 1 applied the identical reasoning to a superficially similar temptation).

### 5. Pinecone and Weaviate connectors do not exist anywhere in this codebase
`social-listening-core/src/rag/ragConnectorRegistry.ts` registers only `pgvector` — confirmed directly, and already confirmed repeatedly across Stories 19.1/19.2's own drafting passes and Story 19.1's own AC7 scope guard ("`ragConnectorRegistry.ts` registers only `pgvector` at the end of this story"). ADR-0136's own Q-0136-1 leaves Azure AI Search's physical-isolation question open for "a future ADR." This ADR's own Authorizes line names only Pinecone and Weaviate, not Azure AI Search. There is, as of this writing, no provider implementation in this codebase to attach a Pinecone or Weaviate physical-isolation *decision* to today — the mapping this ADR documents is architecture-only, forward-looking documentation, decided ahead of its buildable moment, so a future provider-adding story has a real design to implement against rather than just a name-check.

### 6. This ADR is the last of the same five-ADR batch that produced ADR-0136/0137
ADR-0136, ADR-0137, ADR-0138 (this ADR), ADR-0139, and ADR-0140 are drafted together as a coherent set (ADR-0136 Context §4). ADR-0136 stated the interface-level contract change; ADR-0137 confirmed the chunking/embedding pipeline needed no change and fixed one adjacent bug; this ADR owns the detailed per-provider physical-isolation mapping and the one remaining concretely buildable pgvector-RLS-area defect.

---

## Decision

### 1. Confirmation: pgvector's RLS-based tenant isolation is already delivered — not re-decided here
`PgvectorRAGConnector`'s tenant-scoped queries already execute via `withTenant()`/the non-superuser `app_user` role, `rag_chunks` already carries `FORCE ROW LEVEL SECURITY` (migration `0082`), and `RAGConnectorStatus.isolationModel` already reports `'row-level-rls'` honestly for this connector. This was delivered by Story 19.1 under ADR-0136 Decision §2's "physical isolation primary, metadata-filter secondary" principle. **This ADR confirms and cites that delivery (Context §2); it does not re-authorize, modify, or add to it.** See Relation to ADR-0136 below for the full accounting.

### 2. `RAGReconciliationService.reconcileOrphanedRAGChunks()` shall route its real-DB branch through `withTenant()`
The method's real-DB branch (the `else` path, when `existingPostIds` is not supplied — the mocked/in-memory branch used in unit-test harnesses is untouched by this Decision, since it performs no DB query at all) shall wrap its orphan-detection `SELECT` and its cleanup `DELETE FROM rag_chunks_sync` in a single `withTenant(tenantId, async (client) => { ... })` call, exactly the mechanism already applied to every `PgvectorRAGConnector` query under Story 19.1 and to `indexPostForRAG()`'s `rag_chunks_sync` write under Story 19.2 (ADR-0137 Decision §3):

```ts
// Current (Context §3): getPool() with no withTenant() call at all — fails closed.
// Decided here: wrap both the SELECT and the loop's own DELETE in one withTenant() call.
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

**No policy text change is required** — `rag_chunks_tenant_isolation` (migration `0047`) and `social_posts`' `tenant_isolation` policy (migration `0002`) both already accept `app.tenant_id`, and `rag_chunks_sync_tenant_isolation` (migrations `0046`/`0047`) already accepts either `app.tenant_id` or `app.current_tenant_id`; only the call site changes, from no session context at all to a correctly-scoped one. **No new migration is authorized by this ADR** — `rag_chunks` and `rag_chunks_sync` already carry `FORCE ROW LEVEL SECURITY` (migrations `0082`/`0083`), so no further schema change is needed for this fix to work.

`this.connector.deletePost(tenantId, row.post_id)`, called inside the loop, is unaffected by this change and requires none — it already manages its own independent `withTenant()` call internally (Story 19.1). Calling it from inside this method's own `withTenant()` callback is not a nested transaction in the SQL sense: `withTenant()` always acquires a fresh connection from the pool (`pool.connect()`), so the outer reconciliation transaction and `deletePost()`'s own inner transaction run on two separate connections, each independently committed. This is a deliberate, documented consequence of reusing `withTenant()` as-is rather than a new concern this ADR introduces.

### 3. Pinecone namespace-per-tenant — architecture documented, no connector code authorized
A future `PineconeRAGConnector` implementing `RAGConnector` (ADR-0136 Decision §1) shall map every method onto Pinecone's own namespace primitive, per Pinecone's own multi-tenancy implementation guide (ADR-0136 finding §2):
- `upsert(tenantId, vectors)` → `index.namespace(tenantId).upsert(vectors)`. The deterministic `${tenantId}:${postId}:${chunkIndex}` vector ID (ADR-0081/ADR-0136 Decision §4, unchanged) is retained inside the namespace even though namespace scoping alone already guarantees per-tenant uniqueness — kept for id-scheme parity across all provider types, per ADR-0136 Decision §4's own reasoning.
- `search(tenantId, query, options)` → `index.namespace(tenantId).query({ vector: query, filter: <translated RAGFilter>, topK })`. Namespace scoping is the primary isolation control; the mandatory `tenant_id` metadata-equality filter (ADR-0083 Decision §2) is retained as defense-in-depth, translated via Pinecone's already-decided Mongo-style `$in`/`$eq`/`$and` operators (ADR-0083 Decision §3's existing Pinecone filter-translation row — not re-decided here).
- `deletePost(tenantId, postId)` → a namespace-scoped filtered delete or deterministic-ID-array batch delete (ADR-0083 Decision §4, item 1's already-decided mechanism, now namespace-scoped).
- `deleteTenant(tenantId)` → a namespace-delete operation (ADR-0136 Decision §3, already decided — this ADR confirms it as the mechanism a Pinecone connector would implement, not a new decision).
- `ensureTenantNamespace?(tenantId)` → **not required for Pinecone.** Pinecone namespaces are created lazily on first `upsert()` (ADR-0136 Decision §1's own parenthetical: "providers where scope creation is implicit-on-write ... may omit it"). A Pinecone `RAGConnector` implementation may omit this hook entirely.
- `status(tenantId)` → would report `isolationModel: 'namespace'`.

### 4. Weaviate dedicated-shard-per-tenant — architecture documented, no connector code authorized
A future `WeaviateRAGConnector` shall map every method onto Weaviate's native multi-tenancy model — one physical shard per tenant, enabled via a class/collection's `multiTenancyConfig` (ADR-0136 finding §3, cited for its "50,000+ active tenants per node" claim attributed specifically to physical shard separation):
- `upsert(tenantId, vectors)` → a `.withTenant(tenantId)`-scoped object/batch write.
- `search(tenantId, query, options)` → a `.withTenant(tenantId)`-scoped query. The exact `RAGFilter` → Weaviate native-filter translation is **not specified here** — the research brief findings ADR-0136 cites (§2, §3) describe Weaviate's physical multi-tenancy architecture, not its filter syntax, and ADR-0083 Decision §3's Provider Filter Translation table never included Weaviate (only Pinecone, Azure AI Search, pgvector — Weaviate was not a candidate provider when ADR-0083 was decided). Left as an explicit open item (Q-0138-2), not invented here.
- `deletePost(tenantId, postId)` → a tenant-scoped object delete by `post_id`, or the deterministic-ID equivalent.
- `deleteTenant(tenantId)` → Weaviate's own tenant-deletion API call, which drops the shard — Weaviate's own analog to Pinecone's namespace-delete.
- `ensureTenantNamespace?(tenantId)` → **required for Weaviate**, and implemented idempotently (create-if-not-exists) by the connector itself. Weaviate requires an explicit tenant-creation call before a not-yet-provisioned tenant's first write; this is the concrete case ADR-0136 Decision §1 added the hook for, and the concrete case ADR-0137 Decision §2 pre-wired a call site for (`indexPostForRAG()` already calls `connector.ensureTenantNamespace?.(tenantId)` immediately before `upsert()`, as of Story 19.2) — a Weaviate connector is the first provider that would actually make that call site do something.
- `status(tenantId)` → would report `isolationModel: 'shard'`.

### 5. `RAGChunkMetadata` schema — confirmed unchanged
ADR-0083 Decision §1's `RAGChunkMetadata` schema (`tenant_id`, `post_id`, `chunk_index`, `content`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`) is unchanged by this ADR — already confirmed unchanged by ADR-0136 Decision §1/Consequences and reconfirmed here by direct inspection of `social-listening-core/src/rag/types.ts`. No field is added, removed, or retyped by this ADR for any provider, including the Pinecone/Weaviate architecture in Decision §3/§4 above.

### 6. Explicit scope exclusions
- **The missing reconciliation scheduler (Context §4) is out of scope.** ADR-0083 Decision §4, item 5's "periodic background worker" promise remains unfulfilled after this ADR — `RAGReconciliationService` becomes *correct* when called (Decision §2), but nothing calls it. Designing or building a cron/scheduler/pg_cron wiring for it is new speculative infrastructure beyond this ADR's "namespace isolation and pgvector RLS" scope, and is explicitly deferred as a gap against ADR-0083 itself.
- **Azure AI Search is out of scope.** This ADR's own Authorizes line never named it; ADR-0136 Q-0136-1 already deferred its physical-isolation research to "a future ADR," and this ADR is not that ADR.
- **No `RAGConnector` provider implementation (Pinecone, Weaviate, or otherwise) is built by this ADR.** Decision §3/§4 are architecture documentation only.
- **No change to `RAGChunkMetadata`, the `RAGConnector` interface, the deterministic vector ID scheme, or `ensureTenantNamespace?()`'s existing call site (already wired in by Story 19.2/ADR-0137 Decision §2)** is authorized here.
- **No new database migration** — `rag_chunks` and `rag_chunks_sync` already carry `FORCE ROW LEVEL SECURITY` (migrations `0082`, `0083`); Decision §2's fix is a call-site-only change.

---

## Relation to ADR-0136

- **ADR-0136 Decision §2**'s "physical isolation primary, metadata-filter secondary" principle is confirmed, for pgvector, as already fully realized by Story 19.1's shipped code (Decision §1/Context §2) — this ADR adds no new pgvector behavior.
- **ADR-0136 Decision §1**'s optional `ensureTenantNamespace?()` hook is given its first two concrete provider cases: Pinecone, which correctly omits it (Decision §3), and Weaviate, which correctly implements it (Decision §4) — the first real evidence that the hook's "may omit it" / "before first write" framing maps onto real, differently-shaped providers rather than being speculative.
- **ADR-0136 Decision §2**'s fallback clause (no namespace/shard/RLS primitive → shared index with mandatory metadata filter as sole mechanism) is confirmed to still govern Azure AI Search, unchanged and unresearched here, consistent with ADR-0136's own Q-0136-1.
- **No part of ADR-0136's Decision is superseded, revised, or reopened by this ADR.** This ADR is additive/confirmatory with respect to ADR-0136, and refines ADR-0083 (its own stated Authorizes relationship), matching ADR-0137's identical framing of its own relationship to ADR-0136.

## Relation to ADR-0083

- **ADR-0083 Decision §2**'s closing sentence ("if the vector store supports physical namespaces ... the implementation may utilize them, but the `tenant_id` metadata filter remains mandatory") already anticipated physical isolation as an *option* — ADR-0136, not this ADR, is what formally made it the *primary* mechanism project-wide. This ADR supplies the missing per-provider mapping ADR-0083 Decision §3's own translation table and Decision §2 deferred, which ADR-0136 Decision §2 explicitly named this ADR as owning.
- **ADR-0083 Decision §4, item 5 ("Reconciliation Background Worker," cited in the shipped code's own docstring as "ADR-0083 §4.5")** is partially fulfilled by this ADR: Decision §2 fixes the fail-closed RLS-routing defect that made the worker non-functional even when called. The worker's other defect — nothing ever calls it — remains a real, open, unfixed gap against ADR-0083 itself (Decision §6, Context §4), not closed by this ADR.
- **ADR-0083 Decision §1** (the `RAGChunkMetadata` schema) is confirmed unchanged and stands exactly as originally decided (Decision §5).
- **ADR-0083's own dated "Pending supersession note" (2026-08-28)** already names this ADR as the one whose acceptance would trigger a "Supersession update" note back on ADR-0083, per `docs/adr/README.md`'s own governance convention for when a Pending supersession note "becomes real." **That update to ADR-0083 is not made in this pass** — this task's scope was limited to rewriting ADR-0138/BRD-0138/FDD-0138 only. Flagged here as a required follow-up edit to ADR-0083 itself (see Open Questions, Q-0138-4).

---

## Consequences

1. **`RAGReconciliationService.reconcileOrphanedRAGChunks()` becomes correct at the database layer** — its query will actually find and clean up orphaned `rag_chunks`/`rag_chunks_sync` rows when invoked, closing the fail-closed defect. This does **not** mean reconciliation runs in production after this ADR — see Consequence 6.
2. **pgvector's already-delivered RLS isolation is formally documented and cited, not silently left un-cross-referenced** — closing the specific gap where ADR-0136 forward-referenced this ADR for a mapping that, until now, this ADR never actually stated.
3. **A concrete, implementable design exists for Pinecone and Weaviate isolation** the next time either provider is actually added, including the first concrete justification for when `ensureTenantNamespace?()` is and isn't needed — no second architecture pass required at that point, the same "decide ahead of the buildable moment" pattern Story 19.2 already applied to the hook's call site.
4. **No change to any already-shipped, tested code path outside `ragReconciliationService.ts`.** `PgvectorRAGConnector`, the chunking/embedding pipeline, and the `RAGConnector` interface are all confirmed unchanged by direct inspection, not merely assumed.
5. **Azure AI Search's physical-isolation research remains an open, twice-flagged gap** (ADR-0136 Q-0136-1, and again here) rather than resolved — a real, named limitation, not a silent omission.
6. **The reconciliation worker still does not run in production after this ADR.** Decision §2 makes it *correct when invoked*; Decision §6 explicitly does not build a scheduler for it. A reader must not conclude reconciliation is "fixed" in the operational sense — only that the one defect this ADR authorized fixing is fixed.
7. **ADR-0083 is left carrying a now-stale "Pending supersession note"** until a separate edit adds its own "Supersession update" note — a real, if minor, documentation-integrity gap this ADR creates and immediately names (Relation to ADR-0083, Q-0138-4) rather than leaving silent.

---

## Alternatives considered

1. **Also design and wire in a scheduler for `RAGReconciliationService` in this same ADR, since the fix would otherwise still not run in production.**
   - *Rejected:* new speculative scheduling infrastructure (cron cadence, retry/backoff policy, which process owns it) is a materially different, larger decision than "namespace isolation and pgvector RLS," and is a gap against ADR-0083 itself, not this ADR's authorized scope. Matches the scope discipline ADR-0137 already applied to a structurally similar temptation (its own Alternative 1).
2. **Build a real Pinecone or Weaviate `RAGConnector` now, rather than documenting the mapping architecture-only.**
   - *Rejected:* no such connector exists anywhere in this codebase, Story 19.3's own story stub carried no acceptance criteria authorizing one, and `ragConnectorRegistry.ts` registering only `pgvector` is an explicit, already-tested scope guard from Story 19.1 (its own AC7). Building a provider implementation here would silently expand this ADR's scope well beyond "namespace isolation and pgvector RLS."
3. **Leave `reconcileOrphanedRAGChunks()`'s missing-`withTenant()` bug unfixed, on the reasoning that nothing calls the method in production anyway (Context §4), so the fix has no observable effect yet.**
   - *Rejected:* the defect is real and independently worth fixing regardless of caller status — the code being unreachable today doesn't make its logic correct, and leaving it broken would mean whoever eventually adds a scheduler (a separate, later decision) would inherit a broken reconciliation query rather than a correct one. This is the one concretely buildable piece of "pgvector RLS" this ADR still owns, per its own Authorizes line.
4. **Fold Azure AI Search's per-tenant isolation research into this ADR's Decision §3/§4, since it is adjacent to the same provider-mapping question.**
   - *Rejected:* ADR-0136 Q-0136-1 already deferred this to "a future ADR," and this ADR's own Authorizes line never named Azure AI Search. Expanding scope here would duplicate a deferral ADR-0136 already made deliberately.

---

## Resolved questions

- **Does this ADR re-decide or modify pgvector's RLS isolation?** No — confirmed already delivered under ADR-0136/Story 19.1; cited, not re-derived. (Decision §1, Context §2.)
- **Does this ADR change `RAGChunkMetadata`, the `RAGConnector` interface, or the deterministic vector ID scheme?** No — all three confirmed unchanged. (Decision §5/§6.)
- **Does this ADR build a Pinecone or Weaviate connector?** No — architecture-only documentation for a future story to implement against. (Decision §3/§4, Alternative 2.)
- **Does `ensureTenantNamespace?()` need to be implemented by every provider?** No — Pinecone correctly omits it (lazy on-write namespace creation); Weaviate correctly requires it (explicit tenant-creation call before first write). (Decision §3/§4.)

## Open Questions

- [ ] **[Q-0138-1]** **Azure AI Search per-tenant physical isolation** — not researched by this ADR or ADR-0136; still open per ADR-0136 Q-0136-1, carried forward unchanged.
- [ ] **[Q-0138-2]** **Weaviate's own `RAGFilter`-to-native-filter translation syntax** — not covered by the research brief findings ADR-0136 cites (§2, §3 describe physical shard architecture, not filter operators); left to whoever actually implements a Weaviate `RAGConnector`, not invented here.
- [ ] **[Q-0138-3]** **The reconciliation background worker's actual periodic invocation** (Context §4, Decision §6) — a real, separate, unresolved gap against ADR-0083 Decision §4, item 5. Needs its own future ADR/story to decide the scheduling mechanism (in-process interval, `pg_cron`, an external scheduled job) and its retry/failure semantics; explicitly not decided by this ADR.
- [ ] **[Q-0138-4]** **ADR-0083 itself needs a dated "Supersession update" note** now that this ADR carries real Decision text, per `docs/adr/README.md`'s own governance convention (Relation to ADR-0083 above). Not made in this pass — flagged as a required follow-up edit to ADR-0083, outside this task's file scope.
- [ ] **[Q-0138-5]** **Exact contract test filename/location proving the Decision §2 fix** — an implementation-time decision at Story 19.3 build time, following the `social-listening-core/contracts/epic-19/story-19.1...`/`story-19.2...` naming convention, per this project's contract-first convention (mirrors ADR-0137's own Q-0137-2).
- [ ] **[Q-0138-6]** **Whether Weaviate should be promoted from documented architecture to an actual candidate provider** in ADR-0081/ADR-0136's provider set — not decided here; this ADR documents the isolation mechanism ahead of that broader product decision, the same "documented alternative, not yet promoted" framing ADR-0081 §3 already used for Azure AI Search.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Refined ADR: `docs/adr/0083-rag-vector-store-rls-and-metadata.md` (Accepted 2026-08-27)
- Sibling/authorizing ADR: `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md` (Accepted 2026-08-28) — source of the `ensureTenantNamespace?` hook and the primary/secondary isolation principle this ADR extends
- Sibling ADR in the same batch: `docs/adr/0137-rag-post-chunking-and-embedding-namespace-routing.md` (Accepted 2026-08-28, Story 19.2) — same resolution pattern, immediately prior
- Sibling ADRs in the same batch (not yet resolved from stub as of this writing): ADR-0139 (search/ask endpoint, namespace resolution, Story 19.4), ADR-0140 (UI/UX refinements, Story 19.5)
- Deep research brief: `raw/28-semantic-search-rag-deep-research.md` (external second-brain vault, generated 2026-08-28) — findings §2 (Pinecone), §3 (Weaviate)
- Related ADRs: `ADR-0015`/`ADR-0032` (tenant RLS pattern), `ADR-0043` (tenant offboarding), `ADR-0071` (human-in-the-loop metadata overrides)
- Already-shipped code inspected directly for this ADR: `social-listening-core/src/rag/ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `ragConnectorRegistry.ts`, `ragIndexingPipeline.ts`, `social-listening-core/src/db/withTenant.ts`, `adminPool.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0002_enable_rls_social_posts.sql`, `0082_force_rls_rag_chunks.sql`, `0083_force_rls_rag_chunks_sync.sql`
- Precedent for this resolution pattern: Story 17.3 (ADR-0131), Story 19.1 (ADR-0136's own BRD/FDD), Story 19.2 (ADR-0137 in full) — see `docs/implementation-log.md`'s corresponding entries
