---
name: rag-discovery-ui
description: RAG semantic discovery and generative Q&A UI component (Story 9.11, ADR-0085, BRD-0085, FDD-0085) in social-listening-admin. Also used by `DriftExplanationCard` for plain-language drift summaries (Story 13.12, ADR-0116). Read this before touching `src/app/tenant/discovery/` or `DriftExplanationCard.tsx`.
---

# RAG Semantic Discovery & AI Assistant UI

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-9/story-9.11.rag-discovery-ui.contract.test.ts` — Story 9.11 contract test.
- `social-listening-admin/contracts/epic-13/story-13.12.semantic-drift-ui.contract.test.ts` — Story 13.12 contract test asserting `DriftExplanationCard` calls `/api/rag/ask` with a drift-focused question built from `topClustersNow/Then` and `samplePostsNow/Then`.

## What this is

Frontend discovery interface at `/tenant/discovery` in `social-listening-admin` that provides semantic search over indexed social mentions and grounded generative Q&A with interactive citations.

The `RAGAsk` capability (via `/api/rag/ask`) is also reused by `DriftExplanationCard` (Story 13.12, ADR-0116) to generate a plain-language summary of a topic's semantic drift between two time windows.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0085 | RAG UI/UX, streaming patterns, and citation mechanics | 9.11 |
| ADR-0084 | RAG search and ask HTTP endpoints | 9.10 |
| ADR-0116 | Semantic drift detection and the `DriftExplanationCard` | 13.12 |

## Key Invariants

1. **Normalized Match Badges:** Visual indicators (`score >= 0.85`: "Strong Match", `0.70–0.84`: "Relevant").
2. **Interactive Citation Mechanics:** Inline tags `[^1]` link interactively to `RAGCitationsRail` cards with hover synchronization.
3. **Honest Refusal Handling:** Renders `RAGRefusalCallout` when `isGrounded: false` or `confidence: 'unsupported'`.
4. **Accessible Standards:** Keyboard shortcut `Cmd+K` / `Ctrl+K`, `aria-live="polite"` for answer rendering, and accessible form labels.
5. **Reused Q&A surface for drift summaries:** `DriftExplanationCard` calls the same `/api/rag/ask` BFF route used by the discovery UI. It sends a drift-specific `question` string that references the topic, `driftScore`, `topClustersNow`, `topClustersThen`, `samplePostsNow`, and `samplePostsThen`, and renders the returned `answer` as a plain-language drift explanation.
