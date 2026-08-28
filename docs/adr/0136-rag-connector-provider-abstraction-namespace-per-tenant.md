# ADR-0136: RAGConnector provider abstraction — namespace-per-tenant isolation

**Status:** Proposed (2026-08-28)

**Authorizes:** a revised `RAGConnector` interface that supersedes ADR-0081, changing the *primary* tenant-isolation mechanism each provider implementation must offer from a shared-index metadata filter to **physical per-tenant isolation (namespace, shard, or database-enforced row-level security), where the provider supports it**, with the mandatory `tenant_id` metadata filter retained as defense-in-depth. All other parts of ADR-0081's Decision (interface shape, deterministic vector IDs, chunk batching, hybrid search, vector dimension configuration, dedicated registry) are carried forward unchanged.

**Source:** External Deep Research Brief — *Semantic Search with RAG* (`raw/28-semantic-search-rag-deep-research.md`, generated 2026-08-28, second-brain vault, not part of this repository), specifically finding §2 (Pinecone multi-tenancy implementation guide, https://docs.pinecone.io/guides/index-data/implement-multitenancy) and finding §3 (Weaviate native multi-tenancy architecture, https://weaviate.io/blog/weaviate-multi-tenancy-architecture-explained), and Implication #1/#2; `docs/product-research/feature-designs/28-semantic-search-rag.md`; ADR-0081 (Accepted 2026-08-25, superseded in part by this ADR).

---

## Context

### 1. ADR-0081's Context and Decision §§1, 2, 4–10, 12, 13 are unaffected and carried forward
The need for a provider-agnostic `RAGConnector`, the precedent of `AIProviderConnector`/`SocialConnector`, the requirement that vector records are derived (not primary), configuration-lives-with-credentials, async status/health, the deterministic vector ID scheme, connector-owned chunk batching, chunk text stored in metadata, hybrid search/score threshold, vector dimension as configuration, and the dedicated `ragConnectorRegistry.ts` are all still correct and are not re-decided here. See ADR-0081 Decision §§1, 4–10, 12, 13, reproduced in this ADR's Decision below for a self-contained record.

### 2. New finding: metadata-filter-only isolation is a documented anti-pattern at scale
ADR-0081 Decision §11 ("Isolation model: shared index with mandatory metadata filtering") treated per-tenant metadata filtering as the primary tenant-isolation mechanism, with namespace-per-tenant as an optional connector-internal optimization. The research brief's finding §2 is a direct, load-bearing correction to that framing: **Pinecone's own multi-tenancy implementation guide explicitly recommends one namespace per tenant, not metadata filtering, and calls large-scale metadata filtering an anti-pattern** — namespace queries cost 1 RU/GB versus a proportionally higher cost for a same-size cross-tenant metadata-filtered query, and namespace-delete gives near-instant tenant offboarding. Finding §3 corroborates the same pattern independently: **Weaviate implements multi-tenancy as one physical shard per tenant**, not a shared index scanned with filters, claiming 50,000+ active tenants per node specifically because of that physical separation. Every mature vector-database vendor researched treats physical per-tenant isolation, not shared-index filtering, as the production-grade answer (Implication #1).

### 3. pgvector already has a stronger mechanism available and unused
Finding §1 and Implication #2 note that pgvector is the only researched `RAGStore` candidate that inherits SocialEngage's *existing* native Postgres Row-Level Security (ADR-0015) "for free." ADR-0081/ADR-0083 never actually specified an RLS policy on the pgvector implementation's own storage table — Decision text described only an application-level `SQL WHERE tenant_id = $1` clause (see old ADR-0083 Decision §3's `pgvector` filter-translation row). That is a real, correctable gap relative to this project's own established pattern (ADR-0015, ADR-0032): every other tenant-scoped table in this codebase is RLS-enforced at the database layer, not solely filtered in application code.

### 4. This ADR is the first of five, coupled by the same finding
ADR-0136 (this ADR), ADR-0137, ADR-0138, ADR-0139, and ADR-0140 are drafted together as a coherent set. This ADR (successor to ADR-0081) states the interface-level contract change; ADR-0138 (successor to ADR-0083) owns the detailed, per-provider physical-isolation mapping and the vector-metadata schema; ADR-0137 (successor to ADR-0082) and ADR-0139 (successor to ADR-0084) confirm what does and does not need to change in the chunking/embedding pipeline and the search/ask REST contracts as a consequence.

---

## Decision

### 1. `RAGConnector` interface — carried forward, with one addition
```ts
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
  // NEW — optional lifecycle hook. Providers that require explicit provisioning of a
  // physical per-tenant scope (a namespace, shard, or RLS-backed table) before first
  // write implement this; providers where scope creation is implicit-on-write (e.g.
  // Pinecone, whose namespaces are created lazily on first upsert) may omit it.
  ensureTenantNamespace?(tenantId: string): Promise<void>;
}

interface ConnectorStatus {
  indexingLag: number;
  chunkCount: number;
  storeErrors?: string[];
  // NEW — reports which physical-isolation mechanism this connector instance is
  // actually running under, for the given tenant/provider. See ADR-0138 Decision §2
  // for the full per-provider mapping this value is drawn from.
  isolationModel: 'namespace' | 'shard' | 'row-level-rls' | 'metadata-filter-only';
}
```
`RAGChunkMetadata`, `RAGFilter`, `RAGSearchOptions`, and `RAGSearchResult` are unchanged from ADR-0081 Decision §1 — see that ADR for their full shape, still current.

`RAGFilter` remains the canonical, provider-agnostic filter shape; each connector implementation is still responsible for translating it into the vendor's native filter syntax. `tenant_id` is still never a field the caller supplies via `RAGFilter` — it comes from the mandatory `tenantId` parameter, exactly as ADR-0081 decided.

### 2. Tenant isolation via physical per-tenant scope, primary; metadata filter, mandatory defense-in-depth (supersedes ADR-0081 Decision §11)
Every `RAGConnector` implementation must provide the **strongest physical isolation mechanism its provider supports**, used as the primary isolation control:
- Where the provider supports namespaces or shards (Pinecone: namespace; a future Weaviate-style provider: shard), `upsert()`/`search()`/`deletePost()`/`deleteTenant()` must route through the tenant's own namespace/shard, not a shared index scanned with a filter.
- Where the provider is pgvector, isolation is enforced by a Postgres Row-Level Security policy on the connector's own storage table, scoped by `tenant_id`, following the exact RLS pattern already established project-wide (ADR-0015, ADR-0032) — not solely an application-level `WHERE tenant_id = $1` clause.
- Where a provider offers neither a namespace/shard primitive nor RLS (e.g. Azure AI Search, per the current state of this research — see ADR-0138 Decision §2 for the explicit, sourced statement that this case is not yet resolved by primary research), the provider falls back to the original ADR-0081 model: a shared index with a mandatory `tenant_id` metadata filter as the *sole* isolation mechanism, flagged as a known fallback, not a decided-against option.

**In every case, including providers with physical isolation, the mandatory `tenant_id` metadata equality filter from ADR-0081 Decision §2/§11 is retained as defense-in-depth** — it is no longer the primary mechanism where physical isolation is available, but it is never removed. This reverses ADR-0081 Decision §11's framing, where namespace-per-tenant was described as an optional connector-internal optimization "on top of" a mandatory filter; here, physical isolation is the mandatory primary control and the filter is the mandatory secondary one.

The full per-provider mapping (pgvector RLS policy shape, Pinecone namespace mechanics, the Azure AI Search open case) is owned by ADR-0138, not re-derived here, matching the same ownership split ADR-0081/ADR-0083 already used (interface contract here, detailed metadata/isolation mapping there).

### 3. `deleteTenant()` must use the physical-scope delete where one exists
For a provider with a namespace or shard primitive, `deleteTenant(tenantId)` must be implemented as a namespace/shard-delete operation, not a metadata-filtered bulk delete — Pinecone's own documentation describes namespace delete as "a lightweight and almost instant operation" (research finding §2), materially cheaper and faster than a filtered bulk delete across a shared index. For pgvector, `deleteTenant()` remains a `DELETE ... WHERE tenant_id = $1` under the RLS-scoped table (RLS does not change the deletion mechanics, only who/what can see the rows being deleted). This is a genuine operational improvement for ADR-0043's tenant-offboarding flow, not merely a compliance restatement.

### 4. Deterministic vector ID scheme — unchanged
ADR-0081 Decision §7's `${tenantId}:${postId}:${chunkIndex}` convention is **not changed**. Namespace/shard isolation already guarantees uniqueness within a tenant's own scope, so the `tenantId` prefix becomes redundant for uniqueness inside a namespace-capable provider — but keeping it costs nothing, keeps the id scheme identical across all three provider types (including the Azure AI Search fallback case, where the prefix is still load-bearing for uniqueness in a shared index), and avoids an unnecessary breaking change to already-shipped Story 9.7/9.8 code paths whenever those stories are eventually re-implemented against this ADR.

### 5. Everything else in ADR-0081's Decision is carried forward unchanged
Provider set and v1 default (pgvector default, Pinecone Serverless and Azure AI Search as alternatives — ADR-0081 §3), vector records as derived data (§4), configuration living with credentials (§5), async status/health (§6, now also reporting `isolationModel` per Decision §1 above), chunk batching as the connector's responsibility (§8), chunk text stored in metadata (§9), hybrid search and score threshold (§10), vector dimension as connector configuration (§12), and the dedicated `ragConnectorRegistry.ts` (§13) are unchanged and remain the live Decision text on those points.

---

## Relation to ADR-0081

This ADR is a **new, superseding ADR**, not an in-place revision, per the project's convention that an in-place revision is only used before a decision is Accepted (as ADR-0081 itself did on 2026-08-25) — ADR-0081 is already Accepted, so its historical Decision text stays put (`docs/adr/README.md`'s governance table, row 1) and this ADR carries the corrected decision forward under a new number. If this ADR is accepted:

- ADR-0081 Decision §11 ("Isolation model: shared index with mandatory metadata filtering") is superseded in full by this ADR's Decision §2.
- ADR-0081 Decision §3 ("Namespace or index separation is provider-specific but the contract requires a metadata filter") in its Context is superseded by this ADR's Decision §2's primary/secondary framing.
- ADR-0081 Decision §§1, 4–10, 12, 13 remain the live contract, reproduced above for a self-contained record and cross-referenced rather than re-decided.
- ADR-0081 itself receives a dated "Pending supersession note" (per `docs/adr/README.md`'s governance table, row 5) pointing here, added as part of this same batch.

---

## Consequences

1. **Correct alignment with vendor guidance:** the platform no longer treats shared-index metadata filtering as the primary tenant boundary for providers that offer something stronger — closing the exact gap the research brief identifies as a direct correction to the prior design.
2. **pgvector gains a real, database-enforced isolation guarantee** it did not have explicitly under ADR-0081/0083 (an RLS policy, not just an app-level filter), consistent with every other tenant table in this project.
3. **Cheaper, faster tenant offboarding** for namespace-capable providers (Pinecone): `deleteTenant()` becomes a single near-instant namespace delete instead of a filtered bulk delete across a shared index.
4. **No breaking change to callers:** `RAGChunkingService`/`RAGIndexingWorker` (ADR-0137) and `RAGSearchService` (ADR-0139) still call `upsert(tenantId, ...)`/`search(tenantId, ...)` exactly as before — namespace/shard/RLS routing is fully encapsulated inside the connector implementation. This is confirmed explicitly in ADR-0137 and ADR-0139's own "Relation to ADR-0136" sections.
5. **Azure AI Search remains an open case:** this research did not surface an Azure AI Search-specific per-tenant physical-isolation primitive, so that provider explicitly keeps the original ADR-0081 metadata-filter-only model until a future ADR researches it directly (see ADR-0138 Decision §2). This is a named, flagged gap, not a silent omission.
6. **One new optional interface method** (`ensureTenantNamespace?`) — a backward-compatible addition; providers that do not need explicit provisioning simply do not implement it.

---

## Alternatives considered

1. **Revise ADR-0081 in place.**
   - *Rejected:* ADR-0081 is Accepted. Per this project's convention (`docs/adr/README.md`'s governance table, row 1 vs. row 5), an Accepted ADR whose Decision changes gets a new superseding ADR, not an in-place edit; a Pending supersession note is added to the original instead.
2. **Keep metadata filtering as the sole mandatory mechanism and treat namespace-per-tenant as purely a documented recommendation, not a contract requirement.**
   - *Rejected:* this would leave the interface silently non-compliant with the research's core finding — Pinecone's own documentation calls the metadata-filter-only pattern an anti-pattern at the scale this platform aims to reach, not merely a suboptimal default.
3. **Require every provider to expose an explicit namespace primitive, rejecting providers that cannot (e.g. drop Azure AI Search from the candidate list).**
   - *Rejected:* premature — this research did not investigate Azure AI Search's own multi-tenancy options, and Azure AI Search is currently only a documented alternative, not the v1 default. Narrowing the provider set on unresearched grounds is a bigger, unjustified decision than this ADR's scope.

---

## Resolved questions

- **Does the interface signature change?** No — `upsert`, `search`, `deletePost`, `deleteTenant`, `status` keep their exact ADR-0081 signatures; only `status()`'s return shape gains `isolationModel`, and one new optional method is added. (Decision §1.)
- **Does the vector ID scheme change?** No — `${tenantId}:${postId}:${chunkIndex}` is unchanged. (Decision §4.)
- **Is metadata filtering removed?** No — retained everywhere as mandatory defense-in-depth, and remains the sole mechanism for providers without physical isolation. (Decision §2.)

## Open questions for a future ADR

- **Azure AI Search per-tenant physical isolation:** not researched here; a future ADR should investigate whether Azure AI Search offers an equivalent to namespace-per-tenant (e.g. one index per tenant) before Azure AI Search is promoted from "documented alternative" to an actively-deployed provider.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research brief: `raw/28-semantic-search-rag-deep-research.md` (external second-brain vault, generated 2026-08-28)
- Superseded ADR: `docs/adr/0081-rag-connector-provider-abstraction.md` (Accepted 2026-08-25)
- Sibling ADRs in this batch: ADR-0137 (chunking/embedding, namespace routing), ADR-0138 (vector-store RLS and metadata, namespace-per-tenant isolation — owns the detailed provider mapping), ADR-0139 (search/ask endpoint, namespace resolution), ADR-0140 (UI/UX refinements)
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0028` (credential ownership tiers), `ADR-0015` (tenant RLS), `ADR-0043` (tenant offboarding)
