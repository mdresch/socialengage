# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0081 RAG Connector Provider Abstraction — Functional Design Document |
| Version | 0.3 |
| Date | 2026-08-25 |
| Author(s) | FDD Writer Agent |
| Reviewer(s) | Menno (Business Sponsor, Product Owner, Technical Lead) |
| Status | Approved (source ADR-0081 Accepted 2026-08-25) |
| Related Documents | ADR-0081 (RAGConnector provider abstraction), BRD-0081 (RAG Connector Provider Abstraction), `docs/product-research/feature-designs/28-semantic-search-rag.md`, Story 9.7, ADR-0002 (`AIProviderConnector`), ADR-0028 (credential ownership tiers), ADR-0015 (tenant RLS) |

**Note on source status:** ADR-0081 was **Accepted** on 2026-08-25 (revised the same day per architectural review, all open questions resolved). This FDD is aligned with the accepted ADR.

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0081 and BRD-0081 into a functional design for a **`RAGConnector` provider abstraction**: a vendor-agnostic interface for vector-store operations (upsert, search, delete, status) that keeps the ingestion, search, and UI layers free of provider-specific code, and enforces tenant isolation as a structural property of every operation. ADR-0081 was Accepted on 2026-08-25; this FDD is aligned with the accepted ADR.

### 2.2 Scope

- **In scope:**
  - The `RAGConnector` interface itself: `upsert`, `search`, `deletePost`, `deleteTenant`, `status`.
  - The `RAGChunkMetadata` shape carried on every vector record, including a `content` field (chunk text payload).
  - The canonical, provider-agnostic `RAGFilter` shape and `RAGSearchOptions` (`topK`, `filter`, `textQuery`, `minScore`).
  - Mandatory `tenant_id` metadata filtering on every `search()` call, using a shared-index-with-metadata-filter isolation model.
  - A deterministic vector ID convention (`${tenantId}:${postId}:${chunkIndex}`).
  - Chunk batching as the connector implementation's responsibility (callers pass the full per-post chunk set).
  - Selection and configuration of exactly one vector-store provider at platform deployment time, with **pgvector as the v1 default** (Pinecone Serverless and Azure AI Search as supported alternatives).
  - Credential/configuration storage via the existing `platform_credentials` envelope with `credential_type = 'rag'`.
  - Embedding vector dimension specified in connector configuration, matched to the chosen embedding model at index-creation time.
  - A dedicated `ragConnectorRegistry.ts` for instantiating the active `RAGConnector` implementation.
  - `status()` reporting (indexing lag, chunk count, store-level errors) as consumed by `RAGSearchService` and, in v2, a Platform Operations Dashboard.
  - The principle that vector records are a derived, rebuildable index over `social_posts`, never the source of truth (stored `content` is a derived copy for retrieval convenience).
- **Out of scope (owned by sibling ADRs, not conflated here):**
  - The post-chunking and embedding pipeline itself, including `RAGChunkingService`, `RAGIndexRequestedEvent`, and `rag_chunks_sync` (ADR-0082 / Story 9.8 — covered by FDD-0082, not this document).
  - Vector-store RLS enforcement detail and metadata-sync/reconciliation rules beyond the `tenant_id` filter contract stated here (ADR-0083 / Story 9.9).
  - The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` public REST contracts (ADR-0084 / Story 9.10).
  - The admin UI search box, results list, and "Ask" panel (ADR-0085 / Story 9.11).
  - Multi-provider runtime selection (v1 supports exactly one active provider, chosen at deployment).

### 2.3 Target Audience

Backend engineers implementing `RAGConnector` and its first concrete provider, engineers building downstream RAG features (chunking, search, UI) who consume this interface, QA writing contract tests for tenant isolation and provider swap-ability, and platform operations staff who configure and monitor the vector-store credential/connection.

---

## 3. Context and Background

- **Problem:** Feature design `28-semantic-search-rag.md` requires a tenant-scoped, vector-backed semantic search layer. Without an agreed storage abstraction, provider-specific code (Pinecone, Azure AI Search, pgvector) would leak into chunking, search, and UI layers, making the vendor choice a one-way decision (BRD-0081 §6).
- **Business/user value:** Vendor portability (swap providers without touching `RAGChunkingService`/`RAGSearchService`), strict tenant isolation enforced by contract, and reuse of the existing credential/connector patterns already proven by `AIProviderConnector` and `SocialConnector` (BRD-0081 §3).
- **Source requirements:** ADR-0081, BRD-0081, feature design `28-semantic-search-rag.md`, Story 9.7 (`docs/user-stories/epic-9-adr-0077-to-0085.md`).
- **Constraints/dependencies:**
  - Follows the established connector pattern from `ADR-0002` (`AIProviderConnector`) — interface, registry, per-provider implementation.
  - Credential storage reuses `platform_credentials` (ADR-0028) with a new `credential_type = 'rag'`.
  - Tenant isolation must build on and be consistent with the platform's existing RLS approach (ADR-0015), even though vector stores are not relational databases and cannot use RLS directly — isolation here is enforced by mandatory metadata filtering in the interface contract.
  - ADR-0081 was Accepted 2026-08-25; this design is aligned with the accepted ADR.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Avoid vendor lock-in for vector storage | The active vector-store provider can be swapped with no changes to `RAGChunkingService` or `RAGSearchService` |
| G2 | Preserve strict tenant isolation in vector indexes | Every `search()` call enforces a `tenant_id` equality filter; no unfiltered, cross-tenant query path exists |
| G3 | Reuse existing credential and connector patterns | `RAGConnector` credentials use `platform_credentials` with `credential_type = 'rag'`, matching `SocialConnector`/`AIProviderConnector` ownership-tier rules |
| G4 | Keep the vector index a derived, rebuildable artifact | The vector store can be reconstructed from `social_posts` (and, once built, `rag_chunks_sync`) if lost |
| G5 | Enable downstream RAG features without re-deciding storage | ADR-0082 through ADR-0085 (and features like metric explainability, daily digest, topic drift) can build on this interface unchanged |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `RAGConnector.upsert()`

- **Description:** Writes one or more chunk vectors with metadata into the configured vector store for a given tenant.
- **Triggers:** Called by the (out-of-scope, ADR-0082-owned) chunking/embedding pipeline after a post is chunked and embedded; not invoked directly by ingestion or UI code.
- **Inputs:** `tenantId: string`; `vectors: Array<{ id: string; values: number[]; metadata: RAGChunkMetadata }>`, where `RAGChunkMetadata` carries `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload), `platform_id`, `published_at`, and optional `watchlist_ids`, `sentiment`, `topics`. Vector ids follow the deterministic convention `${tenantId}:${postId}:${chunkIndex}`.
- **Processing:**
  1. Validate that every vector's `metadata.tenant_id` matches the `tenantId` parameter — a mismatch is a programming error, not a valid state, and must be rejected rather than silently written.
  2. Split the `vectors` array into provider-safe batches internally (batching is the connector implementation's responsibility — callers pass the full per-post chunk set and do not need to know provider batch limits such as Pinecone's 2 MB/batch or Azure AI Search batch-size limits).
  3. Write/upsert each vector record into the provider's index/namespace using the provider-specific implementation behind the interface. Re-upserting the same vector `id` overwrites the prior record (idempotent by id, enabled by the deterministic id scheme).
  4. The vector store never becomes the source of truth — the operation is understood as (re)building a derived index, not recording a fact. Stored `content` is a derived copy of the chunk text for retrieval convenience.
- **Outputs:** `Promise<void>` resolving once the write is durable in the vector store (or provider-defined equivalent of durable).
- **Error handling:** A provider-level failure (timeout, quota, outage) propagates as a rejected promise; callers (the chunking/embedding pipeline) are responsible for retry/best-effort handling — `upsert()` itself does not silently swallow errors.
- **Edge cases:** An empty `vectors` array is a valid no-op call; re-upserting the same vector `id` overwrites the prior record (idempotent by id).

### 5.2 Feature / Capability: `RAGConnector.search()`

- **Description:** Performs a tenant-scoped approximate-nearest-neighbor (ANN) similarity search against the vector store and returns the top-K matching chunk records.
- **Triggers:** Called by `RAGSearchService` (owned by ADR-0084, out of scope here) on behalf of a user-facing search or "ask" request.
- **Inputs:** `tenantId: string`; `query: number[]` (a query embedding vector); `options: RAGSearchOptions` where `RAGSearchOptions = { topK: number; filter?: RAGFilter; textQuery?: string; minScore?: number }`. `RAGFilter` is a canonical, provider-agnostic shape: `{ platformId?: string | string[]; sentiment?: string | string[]; watchlistIds?: string[]; topics?: string[]; dateRange?: { from?: string; to?: string } }`.
- **Processing:**
  1. The implementation **must** apply a `tenant_id` equality filter derived from `tenantId` to every query, in addition to any caller-supplied `RAGFilter`. This is not optional and cannot be bypassed by a caller — the interface contract makes it a required parameter, not an optional filter field. `tenant_id` is never a field the caller supplies via `RAGFilter`.
  2. Translate the caller-supplied `RAGFilter` into the provider's native filter syntax (e.g. Pinecone Mongo-style operators, Azure AI Search OData `$filter`, pgvector SQL `WHERE`) and apply it as an AND condition alongside the tenant filter.
  3. If `textQuery` is supplied and the provider supports hybrid search (dense vector + sparse/lexical BM25), combine `query` (dense) and `textQuery` (sparse) per the provider's hybrid-search API. Providers without hybrid support ignore `textQuery` and perform dense-only search.
  4. Run the provider's ANN/hybrid search, returning up to `topK` results ranked by similarity score. If `minScore` is supplied, drop results whose score falls below the threshold before returning.
- **Outputs:** `Promise<RAGSearchResult[]>` where `RAGSearchResult = { id: string; score: number; metadata: RAGChunkMetadata }` — every returned record's `metadata.tenant_id` is guaranteed to equal the requested `tenantId`, and `metadata.content` carries the chunk text for direct RAG generation without a secondary SQL lookup.
- **Error handling:** Provider-level failures propagate as rejected promises; an empty result set (no matches above threshold, or empty index) is a valid, non-error response.
- **Edge cases:** `topK` larger than the number of available tenant records returns all available records, not an error; a `filter` that matches nothing returns an empty array, not an error.

### 5.3 Feature / Capability: `RAGConnector.deletePost()` and `RAGConnector.deleteTenant()`

- **Description:** Removes vector records for a single post, or for an entire tenant, from the vector store — keeping the derived index consistent with deletions/offboarding in the source-of-truth relational data.
- **Triggers:** `deletePost()` — a post is deleted or retracted from `social_posts`. `deleteTenant()` — a tenant is offboarded.
- **Inputs:** `deletePost(tenantId: string, postId: string)`; `deleteTenant(tenantId: string)`.
- **Processing:**
  1. `deletePost()` removes every vector record whose metadata matches the given `tenant_id` and `post_id` (there may be multiple chunks per post). Because vector ids follow `${tenantId}:${postId}:${chunkIndex}`, this is a predictable id-range delete (`${tenantId}:${postId}:0` through `${tenantId}:${postId}:N`) where the provider supports it, and a metadata-filter delete (`post_id == postId` AND `tenant_id == tenantId`) otherwise.
  2. `deleteTenant()` removes every vector record whose metadata matches the given `tenant_id`, regardless of post — a metadata-filter delete on `tenant_id`.
  3. Both operations are scoped by `tenant_id` as a structural safety property — a `deletePost`/`deleteTenant` call can never affect another tenant's records even if `postId` collides across tenants (post ids are not assumed globally unique across tenants).
- **Outputs:** `Promise<void>` resolving once the deletion is durable.
- **Error handling:** Deleting a post/tenant with no matching vector records is a valid no-op, not an error (e.g., a post that was never successfully indexed).
- **Edge cases:** `deleteTenant()` must fully clear a tenant's vector footprint even if `deletePost()` was never called for some of that tenant's posts — it is not merely a loop over known post ids.

### 5.4 Feature / Capability: `RAGConnector.status()`

- **Description:** Reports the health and state of the vector-store connector, either globally or for a specific tenant.
- **Triggers:** Called by `RAGSearchService` and, in v2, a Platform Operations Dashboard; may also be polled by monitoring.
- **Inputs:** `status(tenantId?: string)` — an optional tenant scope; omitted means platform-wide status.
- **Processing:** Reads provider-level health/metrics (indexing lag, chunk count, store-level errors) and normalizes them into a `ConnectorStatus` shape consistent with how other connectors (`SocialConnector`, `AIProviderConnector`) report status.
- **Outputs:** `Promise<ConnectorStatus>` containing indexing lag, chunk count, and any store-level errors.
- **Error handling:** If the provider itself is unreachable, `status()` should reflect that as an unhealthy/error status rather than throwing where avoidable, so monitoring can display "provider down" rather than crash.
- **Edge cases:** A tenant with zero indexed chunks returns a valid, healthy status with `chunk_count: 0`, not an error.

### 5.5 Feature / Capability: Provider selection and credential configuration

- **Description:** Exactly one vector-store provider is selected and configured at platform deployment time, with **pgvector as the v1 default** (reusing the existing Azure Postgres instance); Pinecone Serverless and Azure AI Search are supported alternatives via the same interface. Its credentials and endpoint/index identifiers are stored using the existing credential envelope, and the embedding vector dimension is specified in connector configuration.
- **Triggers:** Platform deployment/configuration time, and credential rotation events thereafter.
- **Inputs:** Provider choice (deployment configuration, default pgvector); vector-store credentials and index/endpoint names; embedding vector dimension matched to the chosen embedding model (e.g. 1536 for OpenAI `text-embedding-3-small`).
- **Processing:**
  1. Store credentials and index/endpoint configuration in `platform_credentials` with `credential_type = 'rag'`, following the same ownership-tier model already used for `SocialConnector`/`AIProviderConnector` credentials (ADR-0028).
  2. Instantiate the concrete `RAGConnector` implementation corresponding to the configured provider via a **dedicated `ragConnectorRegistry.ts`** (separate from the existing `ProviderConnector` registry — vector stores have fundamentally different lifecycles, configuration fields, and connection semantics).
  3. Create the vector index using the configured embedding dimension; swapping embedding models requires re-creating the index at the configured dimension, not an interface change.
  4. All downstream code (`RAGChunkingService`, `RAGSearchService`, and this interface's own callers) depends only on the `RAGConnector` interface, never on the concrete provider type.
- **Outputs:** A configured, usable `RAGConnector` instance for the platform.
- **Error handling:** Missing or invalid `rag`-type credentials at startup/first-use should surface as a clear configuration error, not a silent no-op connector.
- **Edge cases:** Only one provider may be active at a time in v1 — there is no runtime multi-provider selection or per-tenant provider choice (BRU-004 in BRD-0081).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Backend Engineer | Builds and maintains `RAGConnector` and its concrete provider implementation(s); primary consumer of this interface |
| `RAGChunkingService` (ADR-0082, system actor) | Calls `upsert()` after chunking/embedding a post |
| `RAGSearchService` (ADR-0084, system actor) | Calls `search()` and `status()` on behalf of user-facing search/ask requests |
| Platform Admin | Configures the chosen provider's credentials and monitors connector health via `status()` |
| Tenant offboarding / post-deletion workflows (system actors) | Trigger `deleteTenant()` / `deletePost()` to keep the vector index consistent |
| Downstream RAG-powered features (Tenant-Business-Analyst, Topic-Center-Analyst, Tenant-Brand-Reputation-Manager, etc.) | Indirect beneficiaries — this FDD's capability is infrastructure they depend on but do not interact with directly |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (abridged) |
|---|---|---|---|---|
| Story 9.7 | backend engineer | build a `RAGConnector` interface and at least one concrete provider (e.g. Pinecone or pgvector) for upsert/search/delete | the semantic-search layer is not locked to a single vector store | `RAGConnector` defines `upsert()`, `search()`, `deletePost()`, `deleteTenant()`, `status()`; configuration is stored per tenant in `platform_credentials` (or a dedicated `rag_store_config`); tenant isolation is enforced by `tenant_id` metadata on every query; source of truth remains `social_posts` and the vector store can be rebuilt; credentials use `credential_type = 'rag'` in the existing envelope; contract tests verify upsert/search/delete for one provider |

Story 9.7 is listed as **Blocked — pending ADR acceptance** as of this writing and is not Built. It is the direct dependency for Story 9.8 (chunking/embedding, ADR-0082) and Story 9.9 (vector-store RLS/metadata, ADR-0083).

### 6.3 Workflow Diagrams / Steps

**Primary workflow — a downstream service uses `RAGConnector` (illustrative; the pipeline steps themselves belong to ADR-0082/ADR-0084):**

1. Platform is deployed with one vector-store provider configured; its credentials are stored in `platform_credentials` under `credential_type = 'rag'` (5.5).
2. (Owned by ADR-0082) After a post is enriched, the chunking/embedding pipeline produces chunk vectors with `RAGChunkMetadata`.
3. The pipeline calls `RAGConnector.upsert(tenantId, vectors)` (5.1); the connector validates tenant consistency and writes to the configured provider.
4. (Owned by ADR-0084) A user issues a search/ask request; `RAGSearchService` embeds the query and calls `RAGConnector.search(tenantId, queryVector, { topK, filter })` (5.2).
5. The connector enforces the `tenant_id` filter unconditionally, applies any additional filter, and returns ranked matches scoped strictly to that tenant.
6. `RAGSearchService` resolves the original post content via `post_id` for display (posts remain the source of truth).
7. When a post is deleted or a tenant is offboarded, the relevant workflow calls `deletePost()` or `deleteTenant()` (5.3) to keep the vector index consistent with `social_posts`.
8. Platform Admin or automated monitoring periodically calls `status()` (5.4) to observe indexing lag, chunk count, and store health.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Chunk vectors and metadata produced by the (out-of-scope) chunking/embedding pipeline: `id`, `values` (embedding), `RAGChunkMetadata`.
- Query embeddings and search options (`topK`, `filter`) from `RAGSearchService`.
- Provider credentials and index/endpoint configuration from `platform_credentials`.

### 7.2 Data Outputs

- Vector records written to the configured provider's index (upsert).
- Ranked search results (`id`, `score`, `metadata`) returned to `RAGSearchService`.
- `ConnectorStatus` (indexing lag, chunk count, store-level errors) returned to callers and, in v2, a Platform Operations Dashboard.
- No new relational tables are introduced by this interface itself; `rag_chunks_sync` (mentioned in ADR-0081 §4 as a rebuild aid) is owned by ADR-0082.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `RAGConnector` (interface, not a persisted entity) | `id: string` (connector identifier); methods `upsert`, `search`, `deletePost`, `deleteTenant`, `status` | Implemented by exactly one active concrete provider (pgvector default, Pinecone Serverless, or Azure AI Search) per deployment; instantiated by `ragConnectorRegistry.ts` |
| `RAGChunkMetadata` (attached to every vector record) | `tenant_id` (string, required), `post_id` (string, required), `chunk_index` (number, required), `content` (string, required — chunk text payload), `platform_id` (string, required), `published_at` (string/ISO, required), `watchlist_ids` (string[], optional), `sentiment` (string, optional), `topics` (string[], optional) | `tenant_id` references the owning tenant; `post_id` references a `social_posts` row (the source of truth); `watchlist_ids` reference `watchlists`; `content` is a derived copy of the chunk text |
| `RAGFilter` (provider-agnostic query filter) | `platformId?` (string \| string[]), `sentiment?` (string \| string[]), `watchlistIds?` (string[]), `topics?` (string[]), `dateRange?` ({ from?: string; to?: string }) | Translated to vendor-native filter syntax inside the connector; `tenant_id` is never a field here (it comes from the mandatory `tenantId` parameter) |
| `RAGSearchOptions` (search call options) | `topK` (number, required), `filter?` (`RAGFilter`), `textQuery?` (string — hybrid search), `minScore?` (number — score threshold) | Passed to `search()`; `textQuery`/`minScore` are optional and ignored gracefully by providers that do not support them |
| `RAGSearchResult` (search return element) | `id` (string), `score` (number), `metadata` (`RAGChunkMetadata`, including `content`) | One per matched chunk; `metadata.content` enables direct RAG generation without a secondary SQL lookup |
| Vector record (provider-internal) | `id` (string, deterministic `${tenantId}:${postId}:${chunkIndex}`), `values` (number[], the embedding), `metadata` (`RAGChunkMetadata`) | One or more per `post_id`/tenant, depending on chunking (owned by ADR-0082); derived and rebuildable from `social_posts`; idempotent re-index by id |
| `platform_credentials` row (`credential_type = 'rag'`) | Endpoint, index/namespace name, API key/secret reference, ownership tier, embedding dimension | Reused existing entity (ADR-0028); configures exactly one active `RAGConnector` implementation |
| `ConnectorStatus` | Indexing lag, chunk count, store-level error state | Returned by `status()`; scoped platform-wide or per-tenant depending on the call |

### 7.4 Validation Rules

- Every vector record's `metadata.tenant_id` must equal the `tenantId` parameter passed to `upsert()` — validated before the write, not assumed.
- `search()` must always resolve to a query that includes a `tenant_id` equality condition; there is no code path that performs an unfiltered, all-tenant search. `tenant_id` is never supplied via `RAGFilter` — it comes from the mandatory `tenantId` parameter.
- `RAGChunkMetadata.tenant_id`, `post_id`, `chunk_index`, `content`, `platform_id`, and `published_at` are required on every vector record; `watchlist_ids`, `sentiment`, `topics` are optional.
- Vector record ids must follow `${tenantId}:${postId}:${chunkIndex}`; re-upserting the same post overwrites the same ids (idempotent re-indexing).
- The connector implementation must split the `vectors` array into provider-safe batches internally; callers pass the full per-post chunk set.
- `RAGFilter` translation to vendor-native syntax is the connector implementation's responsibility; provider-specific filter syntax must not leak into callers.
- No field beyond public post content and its derived metadata may be written to vector-record metadata — no PII beyond what is already present in ingested public post content (BRU-005 in BRD-0081). `content` is a derived copy of already-public post text.
- Exactly one `rag`-type credential configuration may be active per platform deployment in v1.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A `tenant_id` metadata filter is mandatory on every `RAGConnector.search()` call and cannot be bypassed. | `search()` |
| BR2 | Vector records (including stored chunk text) are derived from `social_posts`; the source of truth remains the relational database. | Overall data lifecycle |
| BR3 | Vector-store credentials shall use `credential_type = 'rag'` inside the existing `platform_credentials` envelope. | Credential configuration |
| BR4 | Only one vector-store provider shall be active in v1 (pgvector default), selected at platform deployment time. | Provider selection |
| BR5 | No PII beyond public post content may be written to the vector index. | `upsert()` / metadata content |
| BR6 | `RAGConnector.deleteTenant()` and `deletePost()` must remove all vector records for the given tenant or post. | Deletion operations |
| BR7 | New providers must be addable by implementing the `RAGConnector` interface, without changing `RAGChunkingService` or `RAGSearchService`. | Extensibility |
| BR8 | Vector record ids shall follow `${tenantId}:${postId}:${chunkIndex}`; re-upserting the same post overwrites the same ids (idempotent re-indexing). | `upsert()` / deletion |
| BR9 | Chunk batching into provider-safe batches is the connector implementation's responsibility; callers pass the full per-post chunk set. | `upsert()` |
| BR10 | `RAGFilter` is provider-agnostic; vendor-native filter syntax translation stays inside the connector implementation. | `search()` |
| BR11 | The v1 isolation model is a shared index with mandatory `tenant_id` metadata filtering; namespace-per-tenant is an optional internal optimization only. | `search()` / provider selection |
| BR12 | `RAGChunkMetadata.content` carries the chunk text payload so `search()` results support direct RAG generation without a secondary SQL lookup. | `upsert()` / `search()` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `RAGChunkingService` (ADR-0082, downstream) | Outbound caller of this interface | Writes chunk vectors after chunking/embedding a post | In-process interface call: `RAGConnector.upsert()` |
| `RAGSearchService` (ADR-0084, downstream) | Outbound caller of this interface | Performs tenant-scoped semantic search and reads connector health | In-process interface call: `RAGConnector.search()`, `status()` |
| Vector-store provider (Pinecone / Azure AI Search / pgvector) | Outbound from the connector implementation | Actual storage and ANN search backend | Provider-specific SDK/API, wrapped behind the `RAGConnector` interface |
| `platform_credentials` (ADR-0028) | Internal, read at connector instantiation | Supplies provider credentials and index/endpoint configuration | Existing internal credential-envelope access |
| Tenant offboarding / post-deletion workflows (existing) | Outbound caller of this interface | Keeps the vector index consistent with deletions | In-process interface call: `RAGConnector.deletePost()`, `deleteTenant()` |
| Platform Operations Dashboard (v2, future) | Inbound consumer of `status()` | Surfaces indexing lag, chunk count, and errors to operators | Future internal API, not built in v1 |

---

## 10. Non-Functional Considerations

- **Performance:** Vector-store operations must be best-effort and must not block the ingestion pipeline (NFR-004 in BRD-0081); latency targets for search itself are owned by ADR-0084/downstream UI (feature design notes 300 ms–1.5 s as a typical medium-latency bracket for semantic search).
- **Security / access control:** Vector records are isolated per tenant using metadata filters on every query (NFR-001); this must hold under contract tests for cross-tenant leakage. Credentials follow the same ownership-tier rules as other connectors (NFR-002 equivalent to `SocialConnector`/`AIProviderConnector`).
- **Reliability / availability:** The vector index must be rebuildable from `social_posts` (and, once ADR-0082 ships, `rag_chunks_sync`) — it is explicitly a derived, not authoritative, store (NFR-003).
- **Maintainability:** The `RAGConnector` pattern must match the existing `AIProviderConnector`/`SocialConnector` abstractions in interface shape, registry mechanism, and credential handling (NFR-002).
- **Scalability/cost:** Only one active provider is required in v1, bounding operational complexity; embedding/vector costs and quota are a downstream (ADR-0082/status-reporting) concern but this interface's `status()` is the hook operations relies on to observe them.
- **Auditability:** Credential rotation for the `rag` credential type reuses existing `platform_credentials` tooling (ADR-0028), so no new audit surface is needed for credential handling itself.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `upsert()` called with a vector whose `metadata.tenant_id` does not match the `tenantId` parameter | N/A (internal/programming-level error, not user-facing) | Rejected before any write; treated as a defect in the calling code, not a runtime condition to tolerate |
| Vector-store provider outage during `upsert()` | N/A (surfaces to the async chunking/embedding pipeline, not directly to an end user) | Promise rejects; caller (ADR-0082 pipeline) is responsible for retry without blocking ingestion |
| Vector-store provider outage during `search()` | Generic "search unavailable" handling at the UI layer (owned by ADR-0084/0085) | Promise rejects or `status()` reflects an unhealthy state; `RAGSearchService` decides fallback behavior |
| `deletePost()`/`deleteTenant()` called for a post/tenant with no indexed vectors | N/A | Treated as a successful no-op, not an error |
| Missing or invalid `rag`-type credential configuration at startup | Platform configuration error surfaced to Platform Admin (not an end-tenant-facing message) | Connector instantiation fails clearly rather than silently returning a non-functional connector |
| `search()` called with a `filter` that yields zero matches | Empty results state (owned by downstream UI, ADR-0085) | Returns an empty array; not treated as an error |

---

## 12. Assumptions and Dependencies

- pgvector is the v1 default provider, reusing the existing Azure Postgres instance; multi-provider runtime selection is explicitly deferred to a v2 consideration (BRD-0081 §4.3).
- `social_posts` remains the system of record; the vector index (including stored chunk text) is always a rebuildable, derived view.
- The platform already has `platform_credentials` (ADR-0028) and tenant RLS conventions (ADR-0015) available to build on.
- The connector pattern established by `AIProviderConnector` (ADR-0002) is the organizational standard this interface follows.
- **Accepted:** ADR-0081 was Accepted 2026-08-25 (revised the same day per architectural review, all open questions resolved); the interface shape described here is aligned with the accepted ADR, and the four previously-open questions are resolved (see §13).
- **External dependency:** the platform needs a real account with the chosen vector-store provider — for the pgvector default this is the existing Azure Postgres instance (no new external account); for Pinecone Serverless or Azure AI Search a new provider account is required.
- **Downstream dependency:** ADR-0082 (chunking/embedding), ADR-0083 (vector-store RLS/metadata detail), ADR-0084 (search/ask endpoint), and ADR-0085 (RAG UI/UX) all build directly on this interface and are explicitly out of scope here.

---

## 13. Resolved Questions (previously open, resolved per architectural review 2026-08-25)

| ID | Question | Resolution |
|---|---|---|
| Q1 | Which provider should be the v1 default? | **pgvector** — reuses the existing Azure Postgres instance with zero external infrastructure; best fit for a solo, self-funded, low-scale deployment. Pinecone Serverless is the documented managed-cloud alternative. (ADR-0081 Decision §3.) |
| Q2 | Per-tenant, per-tenant-namespace, or shared index with tenant metadata? | **Shared index with mandatory `tenant_id` metadata filtering**; namespace-per-tenant may be used as an internal optimization where supported. (ADR-0081 Decision §11.) |
| Q3 | Vector dimension / embedding model constraint? | **Dimension specified in connector configuration**, matched to the chosen embedding model at index-creation time (e.g. 1536 for `text-embedding-3-small`); not hardcoded in the interface. (ADR-0081 Decision §12.) |
| Q4 | Registry mechanism? | **Dedicated `ragConnectorRegistry.ts`**, separate from the `ProviderConnector` registry. (ADR-0081 Decision §13.) |

---

## 14. Appendix

### Glossary

See BRD-0081 §15 for the shared glossary (RAG, Vector store, Embedding, Chunk, Connector, Tenant isolation).

### Reference links

- ADR: `docs/adr/0081-rag-connector-provider-abstraction.md` (Status: Accepted 2026-08-25)
- BRD: `docs/project docs/Business-Requirements/BRD-0081-RAG-Connector-Provider-Abstraction.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0028` (credential ownership tiers), `ADR-0015` (tenant RLS); downstream ADR-0082 (chunking/embedding), ADR-0083 (vector-store RLS/metadata), ADR-0084 (search/ask endpoint), ADR-0085 (RAG UI/UX) — all out of scope for this document.
- Related user story: Story 9.7 (`docs/user-stories/epic-9-adr-0077-to-0085.md`)
- No `docs/product-research/reports/28-semantic-search-rag-deep-research.md` (or equivalent) was found for this feature (consistent with BRD-0081 §16 "Deep-research brief: Not found"); no competitive/market deep-research brief is linked.

### Diagrams

None provided; see §6.3 for the textual step-by-step workflow in place of a diagram.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | (prior batch run) | Initial defective draft (wrong H1 / flat BRD-style Section 5) |
| 0.2 | 2026-08-23 | FDD Writer Agent | Full regeneration: correct H1, per-capability Section 5 scoped to the connector abstraction only, real Section 7.3 data model, workflow steps, sourced stories |
| 0.3 | 2026-08-25 | FDD Writer Agent | Applied architectural-review revisions: added `content` to `RAGChunkMetadata`, defined `RAGFilter`/`RAGSearchOptions`/`RAGSearchResult`, vector ID scheme, batching responsibility, hybrid-search/score-threshold options, resolved all four open questions (pgvector default, shared-index isolation, dimension-in-config, dedicated registry); updated §2.2, §5.1–§5.5, §7.3, §7.4, §8, §12, §13 |
