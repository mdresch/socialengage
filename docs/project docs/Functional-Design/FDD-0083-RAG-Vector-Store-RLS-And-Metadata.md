# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0083 RAG Vector-Store RLS and Metadata — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-25 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Draft |
| Related Documents | ADR-0083 (RAG vector-store RLS and metadata), ADR-0081 (`RAGConnector` provider abstraction), ADR-0082 (chunking and embedding pipeline), ADR-0015 (tenant RLS), ADR-0043 (tenant deletion), BRD-0083, `docs/product-research/feature-designs/28-semantic-search-rag.md`, Story 9.9 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0083's decision — the mandatory metadata schema for RAG vector records and the tenant-isolation rule every `RAGConnector.search()` call must enforce — into a functional design: the capabilities the vector-store metadata layer must provide, the data it holds, the workflow that keeps it consistent with `social_posts`, and the rules that keep it from ever leaking data across tenants.

**Note:** ADR-0083's Status is **Proposed** (revised 2026-08-25 to align with ADR-0081's architectural-review revision — chunk text is now stored as `RAGChunkMetadata.content`, the `RAGFilter` shape is aligned to ADR-0081's canonical form, and the deterministic vector ID scheme is referenced). This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:**
  - The mandatory metadata envelope (`RAGChunkMetadata`, including the `content` chunk-text payload) attached to every vector record.
  - The tenant-equality filter that every `RAGConnector.search()` call must apply (`tenant_id` from the mandatory `tenantId` parameter, never from `RAGFilter`).
  - The `RAGFilter` query contract (canonical, provider-agnostic shape per ADR-0081: `platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange` `from`/`to`) and how each is resolved (native metadata filter vs. `RAGSearchService` post-filter).
  - The deterministic vector ID convention `${tenantId}:${postId}:${chunkIndex}` (ADR-0081) as it applies to deletes and idempotent re-indexing.
  - Deletion and offboarding hooks: `RAGConnector.deletePost(tenantId, postId)` and `RAGConnector.deleteTenant(tenantId)`.
  - The periodic reconciliation job that removes orphan vector records.
  - The PII exclusion rule (no `author` or other PII beyond public post content; chunk text is stored as a derived `content` copy, rebuildable from `social_posts`).
  - The `rag_chunks_sync` tracking table.

- **Out of scope:**
  - The `RAGConnector` interface's own method signatures and provider selection (ADR-0081).
  - Post chunking strategy and embedding model selection (ADR-0082).
  - The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` endpoint contracts (ADR-0084).
  - Admin UI search/ask components and loading states (ADR-0085).
  - Choice of vector-store product (Pinecone, Azure AI Search, or pgvector).

### 2.3 Target Audience

Backend engineers implementing `RAGConnector` and the indexing pipeline, QA authoring contract tests for tenant isolation, the Product Owner, and Security/Compliance reviewers concerned with cross-tenant data leakage.

---

## 3. Context and Background

Vector databases are typically flat, single-namespace indexes; unlike `social_posts`, they have no native concept of Postgres RLS. The project already enforces tenant isolation at the database layer (ADR-0015, ADR-0032) as a from-day-one property, not a retrofit. As the RAG (semantic search) feature (`docs/product-research/feature-designs/28-semantic-search-rag.md`) introduces a derived, vector-backed index of post content, that same isolation guarantee must be reproduced in a store that does not enforce it natively — otherwise a single flat index shared by all tenants could return another tenant's posts in a search result.

Search also needs to filter by watchlist, platform, topic, sentiment, and date without a database round trip per candidate (which would defeat the point of a vector index), so each vector record must carry enough metadata to answer those filters directly.

Source requirements: ADR-0083, BRD-0083, Story 9.9 (`docs/user-stories/epic-9-adr-0077-to-0085.md`). Dependencies: ADR-0081 (`RAGConnector` abstraction, Story 9.7), ADR-0082 (chunking/embedding pipeline, Story 9.8), ADR-0043 (tenant offboarding).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enforce tenant isolation in the vector index at parity with database RLS | Every `search()` call returns only the caller's `tenant_id`; contract tests prove zero cross-tenant leakage |
| G2 | Enable rich, metadata-driven query-time filtering | `platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange` filters narrow results without a `social_posts` join at query time |
| G3 | Keep PII surface minimal | No `author` or other PII persists in the vector store; chunk text is stored as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth) |
| G4 | Keep the vector index consistent with the source-of-truth lifecycle | Post deletion, tenant offboarding, and orphan reconciliation each remove the correct vector records |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Metadata Envelope on Vector Upsert

- **Description:** Every chunk written to the vector store carries a fixed metadata envelope (`RAGChunkMetadata`) alongside its embedding, sufficient to enforce isolation and answer query filters without a database join.
- **Triggers:** A chunk is produced by the chunking/embedding pipeline (ADR-0082) and upserted into the vector store.
- **Inputs:** `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload, from `RAGChunkingService`), `platform_id`, `published_at` (from `social_posts`); `watchlist_ids` (from watchlist match results at indexing time); `sentiment`, `topics` (from AI enrichment, when available).
- **Processing:**
  - `tenant_id`, `post_id`, `chunk_index`, `content`, `platform_id`, and `published_at` are required on every record; upsert fails validation if any is missing.
  - `watchlist_ids` defaults to an empty array when the post matched no watchlist.
  - `sentiment` and `topics` are optional and are omitted (not written as null) when not yet available at index time.
  - The embedding vector, the `content` chunk text, and this metadata are stored; `content` is a derived copy of the chunk text (rebuildable from `social_posts`, which remains the source of truth) — per ADR-0081/0083 revision, chunk text **is** stored to enable direct RAG generation without a secondary SQL lookup.
  - `rag_chunks_sync` is updated with `post_id`, `tenant_id`, `chunk_count`, `embedding_model`, `status`, `last_indexed_at`, and `error_message` for the tenant (schema defined in ADR-0082 Decision §5).
- **Outputs:** A vector-store record keyed by the deterministic vector ID `${tenantId}:${postId}:${chunkIndex}` (ADR-0081) carrying the embedding, the `content` chunk text, and the metadata envelope; an updated `rag_chunks_sync` row.
- **Error handling:** Missing a required field rejects the upsert before it reaches the store; the chunking/embedding pipeline retries per ADR-0082 and does not block the main ingestion pipeline.
- **Edge cases:** A post with zero enrichment (no sentiment/topics yet) still indexes with the required fields only. A post that matches multiple watchlists carries all matching IDs in `watchlist_ids`. Metadata payload size approaching the store's documented per-record limit is a known constraint (NFR-002) — `content` is the largest field (bounded by the chunk size, ADR-0082 default 256 tokens) and very large `watchlist_ids`/`topics` arrays may also need trimming.

### 5.2 Feature / Capability: Mandatory Tenant-Isolation Filter on Search

- **Description:** Every call to `RAGConnector.search()` enforces a `tenant_id == caller.tenant_id` metadata equality filter, with no code path able to omit or override it.
- **Triggers:** Any consumer (e.g., the RAG search/ask endpoints in ADR-0084) invokes `RAGConnector.search()`.
- **Inputs:** `caller.tenant_id` (resolved server-side from the authenticated session, never from a client-supplied parameter), plus an optional `RAGFilter`.
- **Processing:**
  - The connector implementation injects the `tenant_id` equality filter into the underlying vector-store query before any other filter is applied.
  - There is no "search across all tenants" mode or parameter; `tenant_id` is not a caller-settable filter field and is never part of `RAGFilter` (it comes from the mandatory `tenantId` parameter on `search()`, per ADR-0081).
  - If the vector store supports namespaces or per-tenant indices, the implementation may use them, but the metadata filter is still applied as defense in depth — namespaces alone are never sufficient.
- **Outputs:** A result set containing only vectors whose `tenant_id` metadata matches the caller's tenant.
- **Error handling:** If the caller's `tenant_id` cannot be resolved (e.g., unauthenticated context), `search()` must fail closed (return no results / raise an error) rather than search unfiltered.
- **Edge cases:** A tenant with zero indexed posts returns an empty result set, not an error. A malformed or absent `RAGFilter` still applies the mandatory tenant filter.

### 5.3 Feature / Capability: `RAGFilter` Query-Time Filtering

- **Description:** Callers may narrow a search using the canonical, provider-agnostic `RAGFilter` (ADR-0081) — `platformId`, `sentiment`, `watchlistIds`, `topics`, and `dateRange` — applied on top of the mandatory tenant filter.
- **Triggers:** A `RAGFilter` object is supplied on a `search()` call.
- **Inputs:** `RAGFilter { platformId?: string | string[]; sentiment?: string | string[]; watchlistIds?: string[]; topics?: string[]; dateRange?: { from?: string; to?: string } }`.
- **Processing:**
  - `watchlistIds` matches any record whose `watchlist_ids` array contains any of the requested values (array-membership filter where the store supports it).
  - `platformId` and `sentiment` are exact-match metadata filters (single value or any-of when supplied as an array).
  - `topics` matches any record whose `topics` array contains any of the requested values.
  - `dateRange` is applied as a range filter on `published_at` (ISO 8601, `from`/`to` bounds) where the store supports range filtering.
  - The connector implementation translates `RAGFilter` to vendor-native filter syntax (Pinecone Mongo-style operators, Azure AI Search OData `$filter`, pgvector SQL `WHERE`); provider-specific syntax stays inside the connector.
  - For any filter the underlying vector store cannot express natively, `RAGSearchService` retrieves the tenant-filtered candidate set and post-filters in application code rather than omitting the filter.
- **Outputs:** A result set narrowed by all supplied filter fields (AND semantics across fields).
- **Error handling:** An unrecognized or malformed filter value is rejected with a validation error rather than silently ignored.
- **Edge cases:** A `dateRange` with `from` after `to` is invalid and rejected. Combining a filter the store supports natively with one it does not (e.g., `platformId` native, `topics` post-filtered) must still return the correct intersection.

### 5.4 Feature / Capability: Post-Deletion Propagation

- **Description:** Deleting a post removes its vector records from the index so it can no longer surface in search.
- **Triggers:** `DELETE /v1/posts/:id` completes successfully against `social_posts`.
- **Inputs:** `tenantId`, `postId`.
- **Processing:** The deletion handler calls `RAGConnector.deletePost(tenantId, postId)`, which removes every vector record (all `chunk_index` values) for that `post_id` within that tenant's scope. Because vector ids follow `${tenantId}:${postId}:${chunkIndex}` (ADR-0081), this is a predictable id-range delete where the provider supports it, and a metadata-filter delete (`post_id == postId` AND `tenant_id == tenantId`) otherwise.
- **Outputs:** No vector records for the deleted post remain queryable.
- **Error handling:** If vector deletion fails after the relational delete succeeds, the failure is retried/logged and surfaced to the periodic reconciliation job as a safety net (Section 5.6) rather than silently leaving orphans indefinitely.
- **Edge cases:** Deleting a post that was never indexed (e.g., indexing failed or is still pending) is a no-op, not an error.

### 5.5 Feature / Capability: Tenant Offboarding Propagation

- **Description:** Offboarding/deleting a tenant removes all of that tenant's vector records.
- **Triggers:** The tenant deletion/offboarding flow (ADR-0043) executes.
- **Inputs:** `tenantId`.
- **Processing:** The offboarding flow calls `RAGConnector.deleteTenant(tenantId)`, which removes every vector record whose `tenant_id` metadata matches, regardless of `post_id`.
- **Outputs:** Zero remaining vector records for the offboarded tenant.
- **Error handling:** Offboarding must not be considered complete until vector deletion is confirmed or a reconciled follow-up guarantees it; this is bound by the tenant data-erasure SLA (NFR-004).
- **Edge cases:** A tenant with a very large indexed corpus may require batched/paginated deletion against the vector store's API limits.

### 5.6 Feature / Capability: Orphan Reconciliation Job

- **Description:** A periodic job detects and removes vector records that have become orphaned (their `post_id` no longer exists in `social_posts`) but were not cleaned up by the direct deletion hooks — e.g., due to a transient failure in Section 5.4.
- **Triggers:** Runs on a scheduled interval (operational cadence, not user-triggered).
- **Inputs:** `rag_chunks_sync` entries (`post_id`, `tenant_id`, `chunk_count`, `embedding_model`, `status`, `last_indexed_at`, `error_message`, per tenant).
- **Processing:** For each tracked `post_id`, the job checks whether the row still exists in `social_posts`. If not, it calls the equivalent of `deletePost` for that `post_id`/`tenant_id` and removes the corresponding `rag_chunks_sync` entry.
- **Outputs:** Vector store and `rag_chunks_sync` converge to contain only posts that currently exist.
- **Error handling:** A reconciliation pass that fails partway logs the failure and resumes cleanly on the next scheduled run rather than requiring a full rescan.
- **Edge cases:** A post deleted and re-created with the same ID (if ever possible) must not be misclassified as orphaned; reconciliation keys on the current existence check, not on cached state.

### 5.7 Feature / Capability: PII Exclusion and Stored Chunk Text

- **Description:** The vector store never holds `author` or other PII fields; chunk text is stored as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth) alongside the embedding and metadata, per ADR-0081/0083 revision.
- **Triggers:** Applies continuously to every write path (upsert in 5.1).
- **Inputs:** N/A (a constraint on what is written, not a separate trigger).
- **Processing:** The indexing pipeline passes only the fields defined in `RAGChunkMetadata` (including `content`, the derived chunk text) to the vector store; `author` and other PII are deliberately excluded from the write payload. `content` is a derived copy of already-public post text, stored so `search()` results can be used directly for RAG generation (Q&A answers, daily-digest summaries) without a secondary SQL lookup. Display of a cited chunk may use the stored `content` directly; `social_posts` remains the source of truth and the index is rebuildable from it.
- **Outputs:** A vector record containing `content` (derived public post text), identifiers, dates, labels, and arrays — no `author`, no other PII.
- **Error handling:** A schema/contract check on the upsert payload rejects any write that includes disallowed fields (defense in depth against a future accidental regression).
- **Edge cases:** If `social_posts` has been modified (e.g., body edited) after indexing, the stored `content` may be stale until the post is re-indexed; reconciliation/re-indexing converges it back to the current `social_posts` content. This is a deliberate trade-off of the "stored chunk text" design — the latency benefit of avoiding a per-result SQL lookup is judged to outweigh the staleness risk, given the index is rebuildable.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Backend Engineer | Implements `RAGConnector`, the metadata envelope, and the reconciliation job |
| Tenant-Business-Analyst | End user of semantic search; relies on correct tenant scoping and filters |
| Topic-Center-Analyst | End user relying on topic/date filters over the vector index |
| Tenant-Brand-Reputation-Manager | End user relying on the index never leaking another tenant's posts |
| Platform Administrator | Operates offboarding and monitors reconciliation/orphan metrics |
| Consuming service (RAG search/ask endpoints, ADR-0084) | Calls `RAGConnector.search()` on the user's behalf |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 9.9) | Backend engineer | Have vector records carry tenant-scoped metadata and a mandatory `tenant_id` filter on every search | A multi-tenant vector index cannot leak data across tenants | Every record has all mandatory metadata fields (including `content`); `search()` always applies the `tenant_id` filter (from `tenantId` param, never `RAGFilter`); `RAGFilter` fields work; `deletePost`/`deleteTenant` hooks fire; chunk text is stored as derived `content`; reconciliation removes orphans; no `author`/PII beyond public post content |

### 6.3 Workflow Diagrams / Steps

**Indexing workflow (write path):**
1. A post is enriched (sentiment/topics available where applicable) and chunked/embedded per ADR-0082.
2. For each chunk, the indexing pipeline assembles the `RAGChunkMetadata` envelope (`tenant_id`, `post_id`, `chunk_index`, `content` (chunk text), `platform_id`, `published_at`, `watchlist_ids`, optional `sentiment`/`topics`).
3. The pipeline validates required fields are present; if not, the chunk is not upserted and the failure is retried without blocking main ingestion.
4. The embedding, `content` chunk text, and metadata are upserted into the vector store under the deterministic id `${tenantId}:${postId}:${chunkIndex}`.
5. `rag_chunks_sync` is updated for the post/tenant.

**Search workflow (read path):**
1. A consumer (e.g., the search endpoint, ADR-0084) calls `RAGConnector.search()` with the authenticated caller's `tenant_id` (mandatory parameter) and an optional `RAGFilter`.
2. The connector applies the mandatory `tenant_id` equality filter first (never from `RAGFilter`).
3. The connector translates `RAGFilter` to vendor-native syntax and applies each field natively where the store supports it.
4. `RAGSearchService` post-filters any field the store cannot express natively, over the tenant-scoped candidate set only.
5. Results are returned with `post_id`/`chunk_index` references and the stored `content` chunk text, so the caller can cite/display text directly without a secondary `social_posts` lookup.

**Deletion / offboarding workflow:**
1. `DELETE /v1/posts/:id` succeeds → `RAGConnector.deletePost(tenantId, postId)` removes that post's chunks.
2. Tenant offboarding (ADR-0043) executes → `RAGConnector.deleteTenant(tenantId)` removes all of the tenant's chunks.
3. On its schedule, the reconciliation job cross-checks `rag_chunks_sync` against `social_posts` and deletes any orphaned vector records the direct hooks missed.

---

## 7. Data Requirements

### 7.1 Data Inputs

`social_posts` (post identity, `platform_id`, `published_at`); watchlist match results at indexing time (`watchlist_ids`); AI enrichment output (`sentiment`, `topics`); the authenticated caller's `tenant_id` (session context, not a request parameter); caller-supplied `RAGFilter`.

### 7.2 Data Outputs

Vector-store records (embedding + `content` chunk text + metadata); `rag_chunks_sync` rows; search results (vector IDs / `post_id` + `chunk_index` references + stored `content` chunk text) returned to the calling service for direct citation and RAG generation without a secondary SQL lookup.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `RAGChunkMetadata` (vector-store record) | `tenant_id` (required), `post_id` (required), `chunk_index` (required, 0..N), `content` (required, chunk text payload — derived copy rebuildable from `social_posts`), `platform_id` (required), `published_at` (required, ISO 8601), `watchlist_ids` (array, default empty), `sentiment` (optional string), `topics` (optional array) | Many records per `post_id` (one per chunk); belongs to one `tenant_id`; keyed by deterministic id `${tenantId}:${postId}:${chunkIndex}`; `content` is a derived copy, `social_posts` remains source of truth |
| `RAGFilter` (query input, not persisted; canonical shape per ADR-0081) | `platformId?` (string \| string[]), `sentiment?` (string \| string[]), `watchlistIds?` (string[]), `topics?` (string[]), `dateRange?: { from?: string; to?: string }` | Applied against `RAGChunkMetadata` fields on a `search()` call; `tenant_id` is never a `RAGFilter` field |
| `rag_chunks_sync` (relational tracking table) | `tenant_id`, `post_id`, `chunk_count`, `embedding_model`, `status` (`synced`/`pending`/`failed`), `last_indexed_at`, `error_message` | One row per (`tenant_id`, `post_id`); schema defined in ADR-0082 Decision §5; used by the reconciliation job to detect orphans against `social_posts` and by `GET /v1/rag/status` for health/lag reporting |
| `social_posts` (source of truth, external to this ADR) | `id` (= `post_id`), `tenant_id`, `platform_id`, `published_at`, body text, `author` | Source of truth; `content` in vector records is a derived copy rebuildable from here; `author`/PII stays here only |

### 7.4 Validation Rules

- `tenant_id`, `post_id`, `chunk_index`, `content`, `platform_id`, `published_at` are required on every vector record; upsert without them is rejected.
- `chunk_index` is a non-negative integer, unique per `post_id`.
- `content` is the chunk text payload (derived from `social_posts.body_markdown`); it is bounded by the chunk size (ADR-0082 default 256 tokens).
- `watchlist_ids` and `topics` are arrays (possibly empty); `sentiment` is a single optional string.
- `published_at` must be a valid ISO 8601 timestamp.
- No field other than those in `RAGChunkMetadata` may be written to a vector record (in particular: no `author` or other PII; `content` is allowed as it is derived public post text).
- `RAGFilter.dateRange.from` must not be after `dateRange.to`.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | There is no "search across all tenants" mode; every `search()` is scoped to exactly one `tenant_id`, resolved server-side. | `RAGConnector.search()` |
| BR2 | `watchlist_ids` is an array; the `watchlistIds` filter matches any record containing a requested value. | `RAGFilter` |
| BR3 | `published_at` is stored as ISO 8601 and used for `dateRange` (`from`/`to`) filtering. | Metadata envelope |
| BR4 | Namespaces/separate indices may be used in addition to, but never instead of, the mandatory `tenant_id` metadata filter. | `RAGConnector` implementation |
| BR5 | `social_posts` is the source of truth; the vector store holds the embedding, metadata, and a derived `content` copy of the chunk text (rebuildable from `social_posts`). | Indexing and citation reconstruction |
| BR6 | `author` and other PII beyond public post content are never written to the vector store; `content` is allowed as it is derived public post text. | Metadata envelope |
| BR7 | A filter unsupported natively by the vector store is post-filtered by `RAGSearchService` over the tenant-scoped candidate set, never skipped. | `RAGFilter` resolution |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Chunking/embedding pipeline (ADR-0082) | Inbound | Supplies chunks and embeddings to be upserted with metadata | Internal service call |
| `social_posts` table | Bidirectional (read for metadata + `content` derivation; deletion trigger inbound) | Source of `post_id`, `platform_id`, `published_at`; source of truth from which `content` is derived (rebuildable) | SQL (Postgres, RLS-scoped) |
| Watchlist matching | Inbound | Supplies `watchlist_ids` at index time | Internal service call |
| AI enrichment (topics/sentiment, ADR-0071 context) | Inbound | Supplies optional `sentiment`/`topics` | Internal service call |
| `DELETE /v1/posts/:id` handler | Inbound (trigger) | Triggers `RAGConnector.deletePost()` | Internal call following REST delete |
| Tenant offboarding flow (ADR-0043) | Inbound (trigger) | Triggers `RAGConnector.deleteTenant()` | Internal call |
| RAG search/ask endpoints (ADR-0084) | Outbound (consumer) | Calls `RAGConnector.search()` with caller `tenant_id` + `RAGFilter` | Internal service call |
| Vector-store provider (Pinecone / Azure AI Search / pgvector — selection out of scope) | Outbound | Persists embeddings + metadata; executes filtered similarity search; executes deletions | Provider-native API, abstracted by `RAGConnector` |
| `rag_chunks_sync` table | Bidirectional | Tracks indexed state per post/tenant for reconciliation | SQL (Postgres) |
| Reconciliation job | Outbound (scheduled) | Deletes orphaned vector records | Internal scheduled process |

---

## 10. Non-Functional Considerations

- **Performance:** The mandatory `tenant_id` filter should not add more than ~20% latency versus an unfiltered search on the same corpus (NFR-001).
- **Security / access control:** Tenant isolation is enforced inside `RAGConnector.search()` itself and must be impossible to bypass through any public API path — `tenant_id` is never a caller-settable parameter (NFR-003), consistent with the project's existing RLS-first posture (ADR-0015).
- **Scalability:** Metadata payload per record must fit within the chosen vector store's documented metadata size limit (NFR-002); large `watchlist_ids`/`topics` arrays are a known risk requiring size budgeting.
- **Reliability / availability:** Deletion/offboarding hooks are backstopped by the periodic reconciliation job so a transient failure does not leave a permanent orphan.
- **Audit and logging:** Deletion, offboarding, and reconciliation actions should be logged sufficiently to demonstrate compliance with the tenant data-erasure SLA (NFR-004).
- **Compliance:** Deletion/offboarding must complete within the tenant data-erasure SLA end-to-end, not just at the relational layer.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Upsert missing a required metadata field | N/A (internal pipeline error, surfaced to engineering) | Upsert rejected; pipeline retries per ADR-0082 without blocking main ingestion |
| `search()` called without a resolvable `tenant_id` | Generic "unable to search" error to caller | Fails closed — no unfiltered search is ever executed |
| Vector-store metadata payload exceeds provider size limit | N/A (internal validation error) | Upsert rejected before reaching the store; flagged for array trimming (R-001) |
| `deletePost`/`deleteTenant` call fails after relational delete succeeds | N/A (background failure) | Logged and retried; reconciliation job catches any remaining orphan on its next run |
| `RAGFilter.dateRange` invalid (`from` after `to`) | Validation error returned to caller | Request rejected before reaching the vector store |
| Reconciliation pass fails partway through | N/A (operational alert) | Logged; resumes cleanly on next scheduled run, no full rescan required |

---

## 12. Assumptions and Dependencies

- The chosen vector store supports metadata on each record and at least equality filtering on metadata fields.
- `social_posts` remains the source of truth and the vector store is a derived, rebuildable index.
- Watchlist, topic, and sentiment enrichment values are available at chunking/indexing time (may be absent for not-yet-enriched posts).
- `published_at` is available in ISO 8601 form for every indexed post.
- Depends on ADR-0081 (`RAGConnector` abstraction, Story 9.7) and ADR-0082 (chunking/embedding pipeline, Story 9.8) being accepted and implemented first.
- Depends on ADR-0043 (tenant offboarding) for the `deleteTenant` trigger point.
- Vector-store provider selection and provisioning (external/infrastructure) must occur before implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `watchlist_ids` be updated when a new watchlist later matches an already-indexed post, or is the watchlist filter applied at search time against `post_watchlist_matches` instead? | Technical Lead | Before implementation |
| Q2 | How is metadata updated when `sentiment` or `topics` are corrected by a human-in-the-loop override (ADR-0071)? | Technical Lead | Before implementation |
| Q3 | What is the maximum metadata payload the chosen vector store accepts per record? | Technical Lead | Before provider selection is finalized |
| Q4 | Should `platform_id` be an indexed free-text string or a constrained `provider_id`/`platformId` enum? | Technical Lead | Before implementation |

---

## 14. Appendix

- **ADR:** `docs/adr/0083-rag-vector-store-rls-and-metadata.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0083-RAG-Vector-Store-RLS-And-Metadata.md`
- **Feature design:** `docs/product-research/feature-designs/28-semantic-search-rag.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0081 (`RAGConnector`), ADR-0082 (chunking/embedding), ADR-0015 (tenant RLS), ADR-0032 (users table RLS), ADR-0043 (tenant deletion)
- **User stories:** Story 9.9 (`docs/user-stories/epic-9-adr-0077-to-0085.md`) — Blocked, pending ADR acceptance and Story 9.7
- **Glossary:**
  - *RAG* — Retrieval-Augmented Generation; a vector-backed retrieval step grounding generative answers in tenant posts.
  - *Vector store* — a database optimized for storing/querying high-dimensional embeddings.
  - *`RAGConnector`* — the provider-agnostic interface abstracting upsert/search/delete/status across vector stores (ADR-0081).
  - *`RAGChunkMetadata`* — the fixed metadata envelope attached to every vector record.
  - *`RAGFilter`* — the caller-supplied filter narrowing search by watchlist, platform, topic, sentiment, or date range.
  - *`rag_chunks_sync`* — the relational tracking table recording indexed state per post/tenant.
- **Revision history:**
  - v0.1, 2026-08-23 — initial regenerated functional design from ADR-0083/BRD-0083.
  - v0.2, 2026-08-25 — aligned with ADR-0081/0083 architectural-review revision: chunk text now stored as `RAGChunkMetadata.content` (derived copy, `social_posts` remains source of truth); `RAGFilter` shape aligned to ADR-0081 canonical form (`platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange.from/to`); vector ID scheme `${tenantId}:${postId}:${chunkIndex}` referenced; updated §2.2, §4, §5.1–§5.7, §6.2–§6.3, §7.2–§7.4, §8, §9, §11.
