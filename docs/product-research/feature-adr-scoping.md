# Feature-to-ADR Scoping Plan

**Purpose:** break the 28 high-level feature designs in `docs/product-research/feature-designs/` into small, atomic, buildable ADRs. Each ADR owns one architectural decision — not the whole feature — so stories can be picked up one at a time without locking a multi-month scope.

**Principles used to chunk a feature:**

1. **One ADR per architectural boundary.** A data model, a REST contract, a provider interface, or a security rule gets its own ADR.
2. **No feature-sized ADRs.** An ADR should fit a single commit and a single story; if it needs more, split it.
3. **Decisions, not descriptions.** Each ADR answers one concrete question, e.g., "what is the `RAGConnector` interface?" not "what is RAG?"
4. **Dependencies explicit.** Every ADR lists the ADRs it depends on and the ADRs it unblocks.
5. **Deferrable by default.** An ADR can be accepted or rejected without killing the parent feature.

---

## 1. New features and their ADR chunks

| Feature | Proposed ADRs (one per architectural chunk) | Priority / Status |
|---|---|---|
| `26-watchlist-volume-preview` | **ADR A:** `SocialConnector.count?()` optional interface and preview sample contract. <br> **ADR B:** `POST /v1/watchlists/preview-volume` endpoint and warning thresholds. | Build now — small, protective |
| `27-preconfigured-analytics-views` | **ADR A:** Analytics aggregate table schema (`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`). <br> **ADR B:** Refresh scheduler, backfill, and late-arriving post reconciliation. <br> **ADR C:** Dashboard/analytics query routing (precomputed view vs. raw table fallback). | Needs ADR |
| `28-semantic-search-rag` | **ADR A:** `RAGConnector` provider abstraction (Pinecone, Azure AI Search, pgvector). <br> **ADR B:** Post chunking and embedding pipeline (chunk size, overlap, model, async indexing). <br> **ADR C:** Vector-store RLS, metadata schema, and deletion sync. <br> **ADR D:** `POST /v1/rag/search` and `POST /v1/rag/ask` contract. <br> **ADR E:** RAG UI/UX, citations, and loading patterns. | Park / investigate |
| `22-metric-explainability` | **ADR A:** `POST /v1/explain` contract (metric key, context, response shape, confidence). <br> **ADR B:** Prompt and caching strategy for deterministic explanations. | Build now |
| `20-crisis-threshold-wizard` | **ADR A:** Crisis template bundle schema (`watchlist` + `alert_rule` + `playbook` preset). <br> **ADR B:** Template activation and customization flow. | Build now |
| `19-self-service-onboarding-checklist` | **ADR A:** Onboarding checklist state model and completion validation. <br> **ADR B:** `GET/PATCH /v1/tenants/:id/onboarding-checklist` contract. | Build now |
| `18-prospecting-list` | **ADR A:** `prospecting_lists` and `prospecting_list_entries` schema + sharing model. <br> **ADR B:** Export and CRM push contract. | Build now |
| `21-ad-hoc-query-endpoint` | **ADR A:** Ad-hoc query allowlist (dimensions, metrics, filters). <br> **ADR B:** Query-to-SQL builder, RLS, and resource guards. | Needs ADR |
| `14-author-initiated-takedown` | **ADR A:** Public DSR/takedown request data model and `data_subject_requests` table. <br> **ADR B:** Redaction flow and `social_posts` soft-deletion policy. <br> **ADR C:** Public, unauthenticated form and rate-limiting. | Needs ADR |
| `15-dsr-self-service-portal` | **ADR A:** DSR self-service request types and SLA tracking. <br> **ADR B:** Cross-table export/erasure worker and `me/data-requests` endpoints. | Needs ADR |
| `16-compliance-audit-pack` | **ADR A:** `compliance_audit_packs` data model and report generation. <br> **ADR B:** Tamper-evident export format (PDF/JSON checksum). | Defer v2 |
| `23-case-handoff-to-crm` | **ADR A:** `CRMConnector` abstraction and credential model. <br> **ADR B:** `POST /v1/inbox/:itemId/case` contract and CRM payload mapping. | Needs ADR |
| `24-daily-digest-email` | **ADR A:** `user_digest_preferences` model and timezone-aware scheduling. <br> **ADR B:** Email template and AI summary contract. | Defer v2 |
| `25-topic-evolution-timeline` | **ADR A:** Time-series aggregation contract and `TopicDailyCount` usage. <br> **ADR B:** Semantic-drift detection and UI timeline contract. | Defer v2 |
| `17-platform-operations-dashboard` | **ADR A:** `platform_metrics` table / Azure Metrics integration. <br> **ADR B:** Platform dashboard read API and tenant-content-free boundary. | Build now |
| `08-dashboards-and-analytics` (depth) | **ADR A:** `selectedTopic` filter and Watchlist Coverage widget (unblocks ADR-0063). <br> **ADR B:** Per-widget data contract and client-side aggregation rules. | Build now / ongoing |
| `13-composed-post-author-mention-suggestions` | **ADR A:** `AuthorTopicSignal` lookup for mention candidates. <br> **ADR B:** Composer mention-suggestion API and UI. | Defer v2 |
| `05-influencer-discovery` | **ADR A:** `influence_score` computation and `Author` scoring. <br> **ADR B:** Discovery endpoint and list UI. | v1.5 / hardening |

---

## 1.2 Remaining features: ADR chunks for existing and foundation capabilities

The first 12 feature designs are already largely built or have active ADRs. The following ADRs capture their remaining depth, v2, or refinement decisions.

| Feature | Proposed ADRs (one per architectural chunk) | Priority / Status |
|---|---|---|
| `01-multi-source-ingestion` | **ADR A:** `SocialConnector` capability matrix extension (`count?()`, `publish?()`, `reply?()`, `backfill?()`). <br> **ADR B:** Connector health auto-disable and recovery rules. | Foundation / v1.5 |
| `02-boolean-query-builder` | **ADR A:** Visual query composer AST contract and validation. <br> **ADR B:** Per-connector capability allowlist and query translation. | Build now |
| `03-ai-sentiment-analysis` | **ADR A:** Aspect-based and per-language sentiment schema. <br> **ADR B:** Sentiment confidence, override, and explainability. | Build now |
| `04-ai-topic-clustering` | **ADR A:** `post_topics`/`topic` enrichment schema and refresh contract. <br> **ADR B:** Topic merge, rename, and `selectedTopic` filter UI. | Build now |
| `06-unified-social-inbox` | **ADR A:** Inbox item state model (assignment, priority, resolution). <br> **ADR B:** `SocialConnector.reply?()` interface and reply audit. | Defer v2 |
| `07-publishing-and-scheduling` | **ADR A:** `SocialConnector.publish?()` and `scheduled_for` on `outbound_activities`. <br> **ADR B:** Media upload, multi-asset targeting, and scheduled dispatch. | Defer v2 |
| `09-real-time-alerts` | **ADR A:** Alert-rule data model and threshold evaluation. <br> **ADR B:** Delivery channels and templates (in-app, email, webhook). | Build now |
| `10-data-export` | **ADR A:** On-demand workspace JSON and posts CSV export contracts. <br> **ADR B:** Export bounding, streaming, and size caps. | Build now |
| `11-api-and-integrations` | **ADR A:** Public API versioning, rate-limiting, and auth documentation. <br> **ADR B:** Webhook delivery from Service Bus events. | Build now |
| `12-multi-user-workspaces-and-rbac` | **ADR A:** Per-connector and per-watchlist permissions. <br> **ADR B:** Feature-gating and seat-limit enforcement. | Build now |

---

## 2. Worked example: `28-semantic-search-rag` ADR chunks in detail

`28-semantic-search-rag.md` is too large for one story. The following five ADRs make it buildable in order.

### ADR-0081 — `RAGConnector` provider abstraction

**Decision:** define a `RAGConnector` interface so the vector store can be swapped.

- Interface: `upsert()`, `search()`, `deleteTenant()`, `deletePost()`, `status()`.
- Configuration per tenant: store type, credentials, index/namespace.
- Initial providers: Pinecone, Azure AI Search, pgvector (one is enough for v1).
- Unblocks: chunking, indexing, search UI.

### ADR-0082 — Post chunking and embedding pipeline

**Decision:** how posts are split and embedded before upsert.

- Chunk size, overlap, and boundary rules for `body_markdown`.
- Embedding model source (dedicated model or `AIProviderConnector.embed()`).
- Async indexing trigger (`SocialPostIngestedEvent` or `RAGIndexRequestedEvent`).
- Failure and retry behavior.
- Unblocks: the vector store having data; `RAGSearchService`.

### ADR-0083 — Vector-store RLS and metadata schema

**Decision:** how tenant isolation and metadata are represented in the vector store.

- Metadata fields: `tenant_id`, `post_id`, `chunk_index`, `provider_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`.
- Query-time tenant filter (required on every `search()`).
- Deletion sync: post deletion, tenant offboarding, raw-payload retention.
- Unblocks: secure multi-tenant semantic search.

### ADR-0084 — RAG search and ask endpoint contract

**Decision:** the REST surface for semantic search and Q&A.

- `POST /v1/rag/search` request/response shape with filters.
- `POST /v1/rag/ask` request/response shape with citations.
- `GET /v1/rag/status` for index health.
- Pagination, top-k, and cost caps.
- Unblocks: frontend components and downstream AI features.

### ADR-0085 — RAG UI/UX and loading patterns

**Decision:** how users interact with search results.

- `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, `RAGAsk` components.
- Citation format and click-through to original post.
- Loading pattern: skeleton for search, progress bar for `ask`.
- Unblocks: user-facing RAG capability.

---

## 3. Suggested first ADRs to draft

If the goal is fast, protected progress, start with the smallest decisions that unblock the most value:

1. **`SocialConnector.count?()` (for `26-watchlist-volume-preview`)** — tiny interface change, huge operational win.
2. **`POST /v1/explain` (for `22-metric-explainability`)** — mostly prompt and contract design.
3. **Crisis template bundle schema (for `20-crisis-threshold-wizard`)** — composition of existing `watchlists` + `alert_rules`.
4. **Onboarding checklist state model (for `19-self-service-onboarding-checklist`)** — pure UI/backend state.
5. **`RAGConnector` provider abstraction (for `28-semantic-search-rag`)** — only if a RAG spike is green-lit; otherwise park.

---

## 4. Traceability note

Each ADR in this plan should, when drafted, link back to:

- its parent feature design file in `docs/product-research/feature-designs/`
- the related ADRs it depends on
- the story or stories it authorizes in `docs/user-stories/`

When an ADR is accepted, the parent feature file should be updated to name the accepted ADR and remove the open question it closed.
