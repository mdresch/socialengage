# Technical Design Specification (TDS) — RAG UI/UX & Loading Patterns

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0085: RAG UI/UX, Streaming Patterns & Citation Mechanics — Discovery Interface Architecture |
| **Document ID** | `TDS-0085` |
| **Feature Name** | Semantic Discovery UI, SSE Streaming Typewriter & Interactive Grounded Citations |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)` | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-admin/.claude/skills/admin-ui/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0085` | [ADR-0085: RAG UI/UX and Loading Patterns](../../adr/0085-rag-ui-ux-and-loading-patterns.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0085` | [BRD-0085: RAG UI/UX And Loading Patterns](../Business-Requirements/BRD-0085-RAG-UI-UX-And-Loading-Patterns.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0085` | [FDD-0085: RAG UI/UX And Loading Patterns](../Functional-Design/FDD-0085-RAG-UI-UX-And-Loading-Patterns.md) | Fully Aligned |
| **Governing User Story** | `Story 9.11` | [Epic 9: ADRs 0077–0085](../../user-stories/epic-9-adr-0077-to-0085.md#story-911--rag-uiux-and-loading-patterns-frontend) | Acceptance Target |
| **Related User Stories** | `Story 9.10`, `Story 19.5` | RAG Endpoints, RAG UI Refinements & Streaming Popovers | Component Family |
| **Related Architecture Decisions** | `ADR-0081`, `ADR-0084`, `ADR-0140` | Vector Abstraction, Search/Ask Endpoints, UI Streaming Refinements | System Architecture |
| **Executable Contract Tests** | `Story 9.11 Contract` | `social-listening-admin/contracts/epic-9/story-9.11.rag-discovery-ui.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Component Tree Architecture
```text
RAGDiscoveryPage (/app/discovery)
├── RAGHeader (Title, Index Health Indicator via /v1/rag/status)
├── RAGUnifiedSearchBox
│   ├── ModeSelectorTabs ( [ Semantic Search ] | [ Ask AI Assistant ] )
│   ├── SearchInputField (with Cmd+K shortcut badge)
│   └── RAGFilterBar (Platform, Watchlist, DateRange, Topic, Sentiment)
├── RAGEmptyState (Trending topics & quick-start queries)
├── RAGSearchLoading (Card skeleton list for 300ms–1.5s)
├── RAGSearchResultsList
│   └── RAGResultCard
│       ├── RelevanceMatchBadge (e.g. "94% Match")
│       ├── RAGResultSnippet (Highlighted search terms)
│       └── PostMetadataBar (PlatformIcon, PublishedAt, SentimentPill, Link -> /app/posts/:id)
└── RAGAskPanel
    ├── RAGAskStreamingView (Token delta typewriter effect + typing cursor)
    ├── RAGAskMarkdownAnswer (Sanitized markdown renderer with interactive [^1] citation pills)
    ├── RAGConfidenceBadge (High / Medium / Low / Unsupported)
    ├── RAGRefusalCallout (Displayed when isGrounded: false)
    └── RAGCitationsRail
        └── RAGCitationCard (1-based badge, snippet, platform icon, Link -> /app/posts/:id)
```

### 2.2 Architectural Boundaries & Invariants
- **Design System Loading Invariant:**
  - Latency $< 300\text{ms}$: No spinner or visual loading state rendered.
  - Latency $300\text{ms} - 1.5\text{s}$: Shimmer/skeleton placeholders rendered.
  - Generative Q&A ($> 1.5\text{s}$): Phased SSE streaming with instant citation rail mounting and incremental typewriter token rendering.
- **Immediate Citations Mounting:** Citations from `event: citations` mount in the sidebar rail immediately, allowing authors to inspect source documents while the answer generates.
- **Interactive Citation Linking:** Inline markers (`[^1]`, `[^2]`) render as interactive pill buttons:
  - Hovering highlights and scrolls to the source card in `RAGCitationsRail`.
  - Clicking opens an inline popover displaying the exact excerpt snippet, platform icon, and deep-link to `/app/posts/:id`.
- **Honest Refusal Handling:** When `isGrounded: false` or `confidence: 'unsupported'`, the UI replaces the generative response box with an accessible `RAGRefusalCallout` explaining that the indexed corpus contains insufficient context to answer the inquiry.

---

## 3. Data Architecture & UI State Design

### 3.1 React State Model
`social-listening-admin/src/features/discovery/types.ts`:
```typescript
export type DiscoveryMode = 'search' | 'ask';

export interface DiscoveryState {
  mode: DiscoveryMode;
  query: string;
  filters: RAGFilter;
  isStreaming: boolean;
  searchLoading: boolean;
  searchResults: RAGSearchResultItem[];
  citations: RAGCitation[];
  streamingText: string;
  finalConfidence: 'high' | 'medium' | 'low' | 'unsupported' | null;
  isGrounded: boolean;
  activeCitationHover: number | null;
}
```

---

## 4. Application Logic & Workflows

### 4.1 SSE Streaming Lifecycle Hook (`useRAGStream.ts`)
```typescript
export function useRAGStream() {
  const [citations, setCitations] = useState<RAGCitation[]>([]);
  const [text, setText] = useState<string>('');
  const [isDone, setIsDone] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<string | null>(null);

  const startStream = (question: string, filter?: RAGFilter) => {
    setText('');
    setCitations([]);
    setIsDone(false);

    const eventSource = new EventSource(
      `/api/rag/ask?stream=true&question=${encodeURIComponent(question)}`
    );

    eventSource.addEventListener('citations', (e: MessageEvent) => {
      setCitations(JSON.parse(e.data));
    });

    eventSource.addEventListener('delta', (e: MessageEvent) => {
      const { text: chunk } = JSON.parse(e.data);
      setText(prev => prev + chunk);
    });

    eventSource.addEventListener('done', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setConfidence(data.confidence);
      setIsDone(true);
      eventSource.close();
    });

    eventSource.onerror = () => {
      eventSource.close();
      setIsDone(true);
    };
  };

  return { citations, text, isDone, confidence, startStream };
}
```

---

## 5. Interface & API Contracts

### 5.1 Same-Origin Admin Proxy Routes
| Route | Forward Target | Purpose |
|---|---|---|
| `POST /api/rag/search` | `core: POST /v1/rag/search` | Attaches session token and forwards search |
| `GET /api/rag/ask?stream=true` | `core: POST /v1/rag/ask` | EventSource proxy pipe for SSE stream |
| `GET /api/rag/status` | `core: GET /v1/rag/status` | Retrieves index lag and health |

---

## 6. Security, Tenancy & Isolation Model
- **HTML Sanitization:** Markdown rendering uses `rehype-sanitize` with a strict schema to prevent XSS injection from untrusted social post body text.
- **Client Session Isolation:** All API requests route through the Next.js BFF proxy which extracts the tenant identity from the encrypted session cookie.

---

## 7. Performance, Scalability & Resource Caps
- **Render Throttling:** Token stream deltas are batched using `requestAnimationFrame` to ensure smooth 60fps rendering without DOM thrashing.
- **Virtualization:** `RAGSearchResultsList` virtualizes result items when rendering lists greater than 20 items.

---

## 8. Resilience, Recovery & Failure Semantics
- **Stream Auto-Abort:** Navigating away from the page or switching tabs immediately invokes `eventSource.close()` to prevent memory leaks.

---

## 9. Observability, Telemetry & Auditability
- **Client Telemetry:**
  - `rag_ui_search_submitted{mode: 'search' | 'ask'}`
  - `rag_ui_citation_clicked{citation_index}`
  - `rag_ui_stream_abandoned_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Feature Flagging:** Feature gated under `feature_gates.rag_search` (ADR-0112). Gated tenants have the `/app/discovery` navigation link hidden.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-admin/contracts/epic-9/story-9.11.rag-discovery-ui.contract.test.ts`:
  - (1) Verifies `RAGDiscoveryPage` mounts and toggles between Search and Ask modes.
  - (2) Confirms `RAGCitationsRail` mounts on `event: citations` before stream completion.
  - (3) Proves `[^1]` inline citations render as clickable pills.
  - (4) Asserts `RAGRefusalCallout` displays when `isGrounded: false`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0085-1]** **Copy Citation Snippets:** Adding a "Copy Citation" button to `RAGCitationCard` popovers.
- [ ] **[Q-0085-2]** **Streaming Popover Interaction Refinement:** Locking popover position when scrolling citation cards (addressed in ADR-0140).
