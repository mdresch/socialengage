---
name: semantic-drift
description: Semantic drift detection for topic meaning shifts over time (Story 13.11, ADR-0116) — `SemanticDriftService`, `GET /v1/topics/:id/drift`, and the `semantic_drift_cache`. Read this before touching `src/rag/semanticDriftService.ts` or the drift route in `src/http/versions/v1/topicsRouter.ts`.
---

# Semantic Drift Detection

## What this is

A v2, tenant-scoped backend service that compares vector embeddings of RAG chunks across two time windows for a single topic, producing a drift score, top semantic clusters per window, and sample posts. Results are cached for 24 hours because centroid and clustering operations are expensive.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0116 | Semantic drift detection — `SemanticDriftService`, centroid cosine drift, and `GET /v1/topics/:id/drift` | 13.11 |
| ADR-0081 | RAGConnector provider abstraction and pgvector default provider | 9.7 |
| ADR-0082 | Post chunking (256 tokens) and embedding pipeline | 9.8 |
| ADR-0083 | Vector store RLS and tenant metadata | 9.9 |
| ADR-0097 | Topic evolution timeline | 11.5 |
| ADR-0084 | RAG search and ask endpoints | 9.10 |

## Key Invariants

1. **Tenant scoping through topics:** Drift is computed only for chunks whose posts are linked to the requested topic via `post_topics`. The route checks the topic belongs to the caller's tenant before doing any work.
2. **No stored vectors:** This implementation derives embeddings on demand from `rag_chunks.content` using the same deterministic `generateMockEmbedding()` function the chunking pipeline uses.
3. **Deterministic clustering:** Cluster labels are derived from the most frequent non-stopword in each chunk. Clusters are ordered by size, then alphabetically, so the same inputs always produce the same labels.
4. **24-hour cache:** `semantic_drift_cache` stores the full JSON result, keyed by SHA-256 of `(tenantId, topicId, start, end)`. Cache hits bump `cache_hit_count` and return `cacheHit: true`.
5. **Read-only:** Drift computation never writes to `social_posts`, `topics`, or `post_topics`.
6. **Warning thresholds:** `none` for `driftScore < 0.2`, `mild` for `0.2 <= driftScore < 0.5`, `significant` for `driftScore >= 0.5`.

## Contracts that constrain this component

- `contracts/epic-13/story-13.11.semantic-drift-detection.contract.test.ts` — drift score range, warning thresholds, top cluster labels, sample posts, 24-hour caching, TTL, cross-tenant isolation, and missing/invalid input handling.

## How to extend this safely

- To swap in real embedding model vectors, change how `DriftChunk.vector` is produced in `semanticDriftService.ts`; the rest of the centroid/cluster/sample code is independent of the embedding source.
- To add a heavier clustering algorithm (k-means, HDBSCAN), replace the `clusterChunks()` implementation but keep the same `Cluster[]` shape and deterministic ordering so the contract stays green.
- UI integration with the Topic Evolution Timeline (warning icon, `DriftExplanationCard`) belongs to Story 13.12 / `topic-evolution-ui` in `social-listening-admin` and `RAGAsk` (ADR-0084).

## Load-bearing constraints — do not change casually

- The window split is the midpoint of `[start, end]`. Changing this changes the meaning of the `start`/`end` query parameters and the contract's fixture dates.
- `generateMockEmbedding()` must stay the same function used by `RAGChunkingService`, or stored content and freshly-generated vectors will diverge.
- The cache key must include `tenantId` and `topicId`; omitting either would leak drift results across tenants or topics.

## Known gaps / deferred work

- Real HDBSCAN/k-means clustering is intentionally deferred; the current "simple clustering" satisfies the contract and the ADR's "k-means or HDBSCAN" allowance as a first pass.
- `DriftExplanationCard` and `RAGAsk` plain-language drift summaries are out of scope for the backend story (Story 13.12).
- The endpoint does not support sub-topic drift or pre-computed daily drift jobs.

## Relations to other components

- Calls into `topicStore.getTopicById()` to enforce tenant scoping.
- Calls into `ragChunkingService.generateMockEmbedding()` to derive vectors from chunk content.
- Reads from `rag_chunks` and `post_topics` (joined) to select the relevant chunks per window.
- Mounted in `src/http/versions/v1/topicsRouter.ts` alongside the existing `GET /v1/topics/evolution` endpoint.
