# Functional Design Document — FDD-0085: RAG UI/UX, Streaming Patterns, and Citation Mechanics

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0085 RAG UI/UX, Streaming Patterns, and Citation Mechanics — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-27 |
| Author(s) | FDD Architect Agent |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Approved (Derived from Accepted ADR-0085 & Approved BRD-0085) |
| Related Documents | ADR-0085, ADR-0084, ADR-0083, ADR-0081, BRD-0085, Story 9.11 |

---

## 2. Component Architecture & UI State Flow

```mermaid
graph TD
    Page[RAGDiscoveryPage /app/discovery] --> SearchBox[RAGUnifiedSearchBox]
    SearchBox --> ModeTabs[ModeSelectorTabs: Search | Ask]
    SearchBox --> FilterBar[RAGFilterBar: Platform, Watchlist, Date, Topic, Sentiment]
    
    Page --> ContentArea[Content Area]
    
    ContentArea -->|Search Mode| SearchArea[Semantic Search Results]
    SearchArea -->|300ms-1.5s| Skeletons[RAGSearchLoading: Skeleton Cards]
    SearchArea -->|Loaded| ResultsList[RAGSearchResultsList]
    ResultsList --> ResultCard[RAGResultCard: Match Badge + Highlighted Snippet]
    
    ContentArea -->|Ask Mode| AskArea[Generative Q&A Area]
    AskArea -->|0-600ms| Shimmer[Retrieval Shimmer]
    AskArea -->|event: citations| CitationsRail[RAGCitationsRail: Citation Cards]
    AskArea -->|event: delta| StreamView[RAGAskStreamingView: Token Typewriter]
    AskArea -->|event: done| FinalView[RAGAskMarkdownAnswer: Interactive Citation Pills]
    AskArea -->|isGrounded: false| Refusal[RAGRefusalCallout: Limited Evidence]
```

---

## 3. Detailed Component Specifications

### 3.1 `RAGUnifiedSearchBox`
- **Location**: `/app/discovery` top bar and global `Cmd+K` / `Ctrl+K` modal.
- **Controls**:
  - `ModeSelectorTabs`: Toggles between `Semantic Search` (`POST /v1/rag/search`) and `Ask AI Assistant` (`POST /v1/rag/ask`).
  - `SearchInputField`: Text input with auto-focus and clear button.
  - `RAGFilterBar`: Filter chips for Platform, Watchlist, Sentiment, Topic, and Date Range.

---

### 3.2 3-Phase SSE Streaming Controller (`useRAGAskStream`)
- **Phase 1 (Retrieval)**: Displays pulse shimmer on citation rail and answer card.
- **Phase 2 (Immediate Citations + Token Stream)**:
  - Consumes `event: citations` payload $\rightarrow$ instantly mounts `RAGCitationCard` components in `RAGCitationsRail`.
  - Consumes `event: delta` payload $\rightarrow$ appends token text into stream state with blinking cursor.
- **Phase 3 (Final Lock & Grounding)**:
  - Consumes `event: done` payload $\rightarrow$ locks answer text, transforms `[^1]` tags into interactive `<CitationPill />` buttons, and renders `RAGConfidenceBadge` (`High` | `Medium` | `Low` | `Unsupported`).

---

### 3.3 Interactive Markdown & Citation Mechanics
- **Renderer**: Uses `react-markdown` with `rehype-sanitize`.
- **Custom Components**:
  - `citation`: Custom tag parser replacing `[^(\d+)]` with `<CitationPill index={1} />`.
  - **Hover Interaction**: Hovering a citation pill adds a ring highlight to the matching citation card in `RAGCitationsRail`.
  - **Click Interaction**: Clicking opens a popover card showing the exact snippet, source platform, author link, and link to `/app/posts/:id`.

---

### 3.4 Match Badges & Refusal Callouts

| Component | State / Threshold | Rendered Visual |
| :--- | :--- | :--- |
| **`RelevanceMatchBadge`** | `score >= 0.85` | Green badge: `94% Strong Match` |
| **`RelevanceMatchBadge`** | `0.70 <= score < 0.85` | Blue badge: `78% Relevant` |
| **`RelevanceMatchBadge`** | `score < 0.70` | Neutral badge: `Partial Match` |
| **`RAGRefusalCallout`** | `isGrounded === false` | Amber callout: *"Limited Context in Indexed Posts"* with suggestion buttons (*Broaden date range*, *Clear filters*). |

---

## 4. Accessibility & Responsive Layout

- **`aria-live="polite"`**: Bound to the answer text container during token streaming.
- **Keyboard Navigation**: Full tab index traversal across search box, filters, citation pills, and citation cards.
- **Mobile Breakpoint (< 768px)**: `RAGCitationsRail` moves from right sidebar to stacked collapsible accordion below the generated answer.