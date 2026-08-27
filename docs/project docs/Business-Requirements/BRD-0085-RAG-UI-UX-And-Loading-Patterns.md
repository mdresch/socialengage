# BRD-0085: RAG UI/UX, Streaming Patterns, and Citation Mechanics

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG UI/UX, Streaming Patterns, and Citation Mechanics — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-27 |
| Author(s) | BRD Writer / AI Architect |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved (Derived from Accepted ADR-0085) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0085, feature design 28-semantic-search-rag, and Story 9.11 |
| 1.0 | 2026-08-27 | AI Architect | Released for implementation: Incorporates 3-phase real-time SSE streaming UX, interactive markdown citation pills (`[^1]`), normalized match percentage badges, "Limited Evidence" honest refusal callouts, and `/app/discovery` hub with `Cmd+K` command palette access. |

---

## 2. Executive Summary

As SocialEngage exposes vector-backed semantic search and generative Q&A (ADR-0081–0084), non-technical business users (`Tenant-Reader` and `Tenant-User`) require a responsive, trustworthy, and intuitive user interface.

This BRD translates the accepted decisions of ADR-0085 into functional frontend requirements. It establishes the 3-phase Server-Sent Events (SSE) streaming UX, interactive Markdown citation pills, normalized relevance match badges, non-alarmist refusal handling for out-of-scope questions, accessible loading skeletons, and multi-surface entry points (dedicated `/app/discovery` page and global `Cmd+K` palette).

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | **Eliminate Perceived Waiting Friction** | 3-phase SSE streaming provides immediate visual feedback: 0–600ms shimmer $\rightarrow$ instant citations pop-in $\rightarrow$ real-time token stream. |
| 2 | **Build Trust via Verifiable Citations** | 100% of generative claims provide interactive `[^1]` citation pills that highlight and link directly to source post snippets in `/app/posts/:id`. |
| 3 | **Transparent & Honest Refusal Handling** | When context is missing (`confidence: 'unsupported'`), display an informative "Limited Evidence" callout with refinement suggestions rather than hallucinating. |
| 4 | **Ensure Visual Confidence in Search Results** | Display normalized match badges (e.g., "94% Match", "Relevant") on search cards derived from standardized `[0.00..1.00]` scores. |
| 5 | **Universal Accessibility & Ergonomics** | Support global `Cmd+K` command palette shortcut, keyboard navigation, `aria-live="polite"` streaming announcements, and responsive mobile stacking. |

---

## 4. Scope

### 4.1 In Scope
- Dedicated `/app/discovery` route and global `Cmd+K` / `Ctrl+K` modal launcher.
- `RAGUnifiedSearchBox` with mode toggles (`Semantic Search` vs `Ask AI Assistant`) and filter bar.
- `RAGResultsList` and `RAGResultCard` with normalized match badges and term highlighting.
- `RAGAskPanel` with 3-phase SSE token streaming, typing cursor, and `RAGConfidenceBadge`.
- Interactive Markdown renderer parsing `[^1]` citation tags into clickable popover pills.
- `RAGCitationsRail` displaying source post metadata, snippets, and app deep links.
- "Limited Evidence" refusal callouts with actionable suggestion chips.
- Skeleton loading adhering to 300ms–1.5s design system standards.

### 4.2 Out of Scope
- Backend vector search and SSE endpoints (covered by ADR-0084 / BRD-0084).
- Vector chunking and embedding models (covered by ADR-0082 / BRD-0082).
- Automatic typeahead auto-complete for complex queries (deferred to v2).

---

## 5. Non-Functional Requirements

- **Performance**: Time-to-first-token rendered on screen within 800ms of request dispatch.
- **Accessibility**: Strict WCAG 2.1 AA compliance, including `aria-live="polite"` on streamed text and accessible citation pill labels.
- **Responsiveness**: Dual-column layout on desktop ($\ge 768\text{px}$) smoothly collapses to stacked accordion layout on mobile.