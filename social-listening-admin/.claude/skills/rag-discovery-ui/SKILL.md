---
name: rag-discovery-ui
description: RAG semantic discovery and generative Q&A UI component (Story 9.11, ADR-0085, BRD-0085, FDD-0085) in social-listening-admin. Read this before touching src/app/tenant/discovery/.
---

# RAG Semantic Discovery & AI Assistant UI

## What this is

Frontend discovery interface at `/tenant/discovery` in `social-listening-admin` that provides semantic search over indexed social mentions and grounded generative Q&A with interactive citations.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0085 | RAG UI/UX, streaming patterns, and citation mechanics | 9.11 |
| ADR-0084 | RAG search and ask HTTP endpoints | 9.10 |

## Key Invariants

1. **Normalized Match Badges:** Visual indicators (`score >= 0.85`: "Strong Match", `0.70–0.84`: "Relevant").
2. **Interactive Citation Mechanics:** Inline tags `[^1]` link interactively to `RAGCitationsRail` cards with hover synchronization.
3. **Honest Refusal Handling:** Renders `RAGRefusalCallout` when `isGrounded: false` or `confidence: 'unsupported'`.
4. **Accessible Standards:** Keyboard shortcut `Cmd+K` / `Ctrl+K`, `aria-live="polite"` for answer rendering, and accessible form labels.
