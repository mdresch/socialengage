# BRD-0084: RAG Search and Ask Endpoints

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG Search and Ask Endpoints — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-27 |
| Author(s) | BRD Writer / AI Architect |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved (Derived from Accepted ADR-0084) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0084, feature design 28-semantic-search-rag, and Story 9.10 |
| 1.0 | 2026-08-27 | AI Architect | Released for implementation: Incorporates dual-mode SSE streaming for `/ask`, deterministic internal URL resolution, normalized score range [0.00..1.00], XML prompt-injection defense, explicit honest refusals (`confidence: 'unsupported'`), and `searchMode?: 'semantic' | 'hybrid'`. |

---

## 2. Executive Summary

As SocialEngage collects multi-platform social data, users require more than keyword filtering; they need semantic discovery (finding posts by underlying meaning) and generative synthesis (asking natural-language questions and receiving grounded answers with verifiable citations).

This BRD defines the business and functional requirements for the three core RAG REST endpoints:
1. `POST /v1/rag/search`: Fast semantic and hybrid discovery returning ranked chunks with normalized similarity scores and app permalinks.
2. `POST /v1/rag/ask`: Grounded generative Q&A with dual-mode support (blocking JSON and token-by-token Server-Sent Events streaming) and strict prompt-injection defenses.
3. `GET /v1/rag/status`: Real-time indexing health and lag telemetry.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | **Enable Intuitive Meaning-Based Discovery** | Users can search posts by concept (e.g. "complaints about delivery delays") without knowing exact keyword matches. |
| 2 | **Deliver Fast, Low-Latency Generative Q&A** | Dual-mode SSE streaming provides instant time-to-first-token (< 800ms) for Q&A synthesis. |
| 3 | **Eliminate Hallucinations & Ensure Provenance** | 100% of generated claims link to verifiable inline citations (`[^1]`); the system honestly refuses out-of-scope questions (`confidence: 'unsupported'`). |
| 4 | **Defend Against Prompt Injection Attacks** | Untrusted social post text is strictly sandboxed in XML tags (`<context><chunk id="...">`), preventing user-generated content from overriding system instructions. |
| 5 | **Protect Platform Quotas & Prevent Runaway Costs** | Tenant-level query and token rate limits prevent unbounded LLM consumption. |

---

## 4. Scope

### 4.1 In Scope
- `POST /v1/rag/search` endpoint supporting natural-language query, `searchMode?: 'semantic' | 'hybrid'`, canonical `RAGFilter`, and normalized `[0.00..1.00]` scoring.
- `POST /v1/rag/ask` endpoint supporting blocking JSON and Server-Sent Events (`text/event-stream`) streaming mode (`citations`, `delta`, `done` events).
- Deterministic app permalinks (`internalUrl: /app/posts/${postId}`).
- Grounding verification, inline citation markers (`[^1]`), and honest refusals (`isGrounded: false`).
- `GET /v1/rag/status` telemetry endpoint.
- Per-tenant rate limiting and 429 quota enforcement.

### 4.2 Out of Scope
- Direct vector store adapter implementations (covered by ADR-0081 / ADR-0083).
- Frontend UI components and loading skeletons (covered by ADR-0085).
- Background scheduled digest generation.

---

## 5. Non-Functional Requirements

- **Security & RLS**: All queries enforce strict tenant isolation (`tenant_id == caller.tenantId`).
- **Resilience**: Short timeouts (30s) and graceful fallback from hybrid to semantic search if a provider lacks sparse vector indexing.
- **Traceability**: Generated citations link back to verified post IDs and chunk indexes.