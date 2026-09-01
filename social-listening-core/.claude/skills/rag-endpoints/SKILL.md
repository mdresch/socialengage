---
name: rag-endpoints
description: RAG search, Q&A, and status HTTP endpoints (Story 9.10, ADR-0084, BRD-0084, FDD-0084) — POST /v1/rag/search, POST /v1/rag/ask with SSE streaming and citations, and GET /v1/rag/status in social-listening-core. Read this before touching src/http/versions/v1/ragRouter.ts.
---

# RAG HTTP Endpoints (`src/http/versions/v1/ragRouter.ts`)

## What this is

REST endpoints for semantic discovery and grounded natural-language Q&A synthesis over social post vector chunks.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0084 | RAG search, ask (SSE streaming), and status endpoints | 9.10 |
| ADR-0081 | RAGConnector provider abstraction | 9.7 |
| ADR-0082 | Post chunking & embedding pipeline | 9.8 |
| ADR-0083 | Vector store RLS & metadata | 9.9 |

## Key Invariants

1. **Normalized Scores:** All search results return scores mapped to `[0.00 .. 1.00]`.
2. **Dual-Mode `/ask`:** Supports blocking JSON and Server-Sent Events (SSE) token streaming via `stream: true` or `Accept: text/event-stream`.
3. **Structured Citations:** Each grounded claim references `[^1]` markers with post metadata and deep links.
4. **Honest Refusals:** Low relevance or insufficient context returns `confidence: 'unsupported'` and `isGrounded: false`.
5. **No Secondary SQL Lookups:** Snippets and citations are sourced directly from stored vector metadata `content`.
