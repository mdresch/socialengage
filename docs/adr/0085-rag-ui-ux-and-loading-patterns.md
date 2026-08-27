# ADR-0085: RAG UI/UX, Streaming Patterns, and Citation Mechanics

**Status:** Accepted (2026-08-27)

**Drafted 2026-08-23 · Revised 2026-08-27 per architectural review.** Authorizes the React component architecture, Server-Sent Events (SSE) streaming UX, interactive Markdown citation mechanics, normalized match badging, and accessible loading patterns for `POST /v1/rag/search` and `POST /v1/rag/ask` in `social-listening-admin`.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md`, ADR-0081/0082/0083/0084, and `Performance-Review-Agent-Stakeholder-Profile.md`.

---

## Context

### 1. Unified Search and Generative Synthesis Interface
`docs/product-research/feature-designs/28-semantic-search-rag.md` introduces natural-language semantic discovery and Q&A over social mentions. The UI must serve both `Tenant-Reader` (seeking quick high-level answers) and `Tenant-User` (performing deep discovery) with maximum transparency and trust.

### 2. Alignment with Streaming & Citation Contracts (ADR-0084)
Per ADR-0084, `POST /v1/rag/ask` supports real-time SSE streaming (`event: citations`, `event: delta`, `event: done`), inline citation markers `[^1]`, normalized `[0.00..1.00]` scoring, and explicit honest refusals (`confidence: 'unsupported'`). The UI must provide real-time token rendering and interactive citation linking rather than static progress bars.

### 3. Design System Loading Standards
Per stakeholder loading conventions: no loader under 300 ms, shimmer/skeleton for 300 ms–1.5 s, and phased progress/streaming for conversational generation.

---

## Decision

### 1. Component Hierarchy
```text
RAGDiscoveryPage (/app/discovery)
├── RAGHeader (Title, Status indicator via /v1/rag/status)
├── RAGUnifiedSearchBox
│   ├── ModeSelectorTabs ( [ Semantic Search ] | [ Ask AI Assistant ] )
│   ├── SearchInputField (with Cmd+K shortcut badge)
│   └── RAGFilterBar (Platform, Watchlist, DateRange, Topic, Sentiment)
├── RAGEmptyState (Quick-start query suggestions & trending topics)
├── RAGSearchLoading (Card skeleton list, 300ms–1.5s)
├── RAGSearchResultsList
│   └── RAGResultCard
│       ├── RelevanceMatchBadge (e.g. "94% Match")
│       ├── RAGResultSnippet (Text with highlighted match terms)
│       └── PostMetadataBar (PlatformIcon, PublishedAt, SentimentPill, Link -> /app/posts/:id)
└── RAGAskPanel
    ├── RAGAskStreamingView (Token delta typewriter effect + typing cursor)
    ├── RAGAskMarkdownAnswer (Sanitized markdown renderer with interactive [^1] citation pills)
    ├── RAGConfidenceBadge (High / Medium / Low / Unsupported)
    ├── RAGRefusalCallout (Displayed when isGrounded: false / unsupported)
    └── RAGCitationsRail
        └── RAGCitationCard (1-based index badge, snippet, platform icon, Link -> /app/posts/:id)
```

---

### 2. Search & Ask Interaction Modes

#### 1. Semantic Search Mode (`POST /v1/rag/search`)
- Executes search on Enter or filter change.
- Results render in `RAGSearchResultsList`.
- Each `RAGResultCard` displays a normalized match badge (`score >= 0.85`: "Strong Match", `0.70–0.84`: "Relevant").
- Clicking a card navigates directly to `/app/posts/${postId}`.

#### 2. Generative Q&A Mode (`POST /v1/rag/ask`) via Server-Sent Events
- **Phase 1 (0–600ms)**: Renders a brief shimmer skeleton on the citations rail and answer box.
- **Phase 2 (Immediate Citations + Stream)**:
  - On `event: citations`: Instantly mounts citation cards in `RAGCitationsRail`.
  - On `event: delta`: Streams markdown text into `RAGAskStreamingView` with an active typing cursor.
- **Phase 3 (Completion & Grounding)**:
  - On `event: done`: Locks the response, parses inline `[^1]` markers into interactive citation pill buttons, and displays `RAGConfidenceBadge`.

---

### 3. Citation Mechanics & Grounding UI

#### 1. Interactive Inline Citation Pills
- Inline tags `[^1]`, `[^2]` render as subtle clickable pills: `[1]`.
- **Hover**: Temporarily highlights and scrolls to the corresponding card in `RAGCitationsRail`.
- **Click**: Opens an inline preview popover displaying the exact chunk snippet and post metadata.

#### 2. Honest Refusals & Unsupported Context
- If `confidence: 'unsupported'` or `isGrounded: false`, the UI renders a non-alarmist `RAGRefusalCallout`:
  > **Limited Context in Indexed Posts**  
  > The indexed posts do not contain sufficient evidence to answer this question reliably.
- Suggestion chips are displayed below the callout: *"Broaden date filter"*, *"Switch to semantic search"*, *"Verify watchlist scope"*.

---

### 4. Loading & Accessibility Standards

- **Perceived Latency Thresholds**:
  - `< 300ms`: Instant render without loading indicators.
  - `300ms – 1.5s`: Mount `RAGSearchLoading` skeleton cards.
  - `> 1.5s` (Ask Mode): Immediate citation pop-in followed by token streaming.
- **Accessibility**:
  - `RAGUnifiedSearchBox` includes explicit `aria-label="Semantic search and Q&A input"`.
  - Streamed answers use `aria-live="polite"` so screen readers announce generated text without interrupting existing user actions.
  - Citation pills have accessible labels: `aria-label="Citation 1: Post on LinkedIn from 2026-08-25"`.

---

## Consequences

### Positive
- **Instant Perceived Speed**: Streaming tokens and immediate citation delivery eliminate static wait times.
- **High Trust & Traceability**: Interactive `[^1]` pills and citation side-rails make source verification effortless.
- **Resilient Fallback UX**: Clear guidance on unsupported questions eliminates user confusion and AI hallucination risk.
- **Consistent Design Language**: Adheres strictly to the established 300ms/1.5s loading guidelines and normalized score badges.

### Trade-offs & Mitigations
- **Markdown Parsing Complexity**: Requires secure client-side markdown parsing. *Mitigated by using lightweight, strict GFM parsers with HTML sanitization.*
- **Mobile Layout Constraints**: Dual-column (Answer + Citations Rail) layout is wide. *Mitigated by stacking Citations accordion-style below the answer on mobile breakpoints (< 768px).*

---

## Related Notes
- `docs/product-research/feature-designs/28-semantic-search-rag.md`
- `docs/adr/0081-rag-connector-provider-abstraction.md`
- `docs/adr/0082-rag-post-chunking-and-embedding.md`
- `docs/adr/0083-rag-vector-store-rls-and-metadata.md`
- `docs/adr/0084-rag-search-and-ask-endpoint.md`
- `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`