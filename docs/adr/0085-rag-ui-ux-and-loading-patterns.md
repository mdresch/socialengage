# ADR-0085: RAG UI/UX and loading patterns

**Status:** Proposed (2026-08-23)

**Authorizes:** the React components, loading states, and citation UX for `POST /v1/rag/search` and `POST /v1/rag/ask` in `social-listening-admin`.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`

---

## Context

### 1. RAG search is a new interaction pattern
`docs/product-research/feature-designs/28-semantic-search-rag.md` introduces natural-language search and Q&A over posts. The UI must make results feel trustworthy and fast without overwhelming the user. `Tenant-Reader` and `Tenant-User` are the primary consumers, so legibility and transparency are more important than power-user features.

### 2. Loading patterns are already defined
`docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md` sets the loading-state conventions: no loader under 300 ms, skeleton/shimmer for 300 ms–1.5 s, and progress/detailed message for longer. `RAGSearch` and `RAGAsk` fall into the middle two categories.

### 3. Citations are required for trust
Because `RAGAsk` answers are AI-generated, the UI must show which posts the answer came from. Clicks must take the user to the original post.

---

## Decision

### 1. Component hierarchy
```
RAGSearchPage
├── RAGSearchBox
│   └── RAGFilterBar
├── RAGSearchLoading           // skeleton list for search
├── RAGResultsList
│   └── RAGResultCard
│       └── RAGResultSnippet
│           └── Link → /tenant/posts/:postId
└── RAGAskPanel
    ├── RAGAskInput
    ├── RAGAskLoading          // progress bar for ask
    ├── RAGAskAnswer
    └── RAGCitationsList
        └── RAGCitationCard
            └── Link → /tenant/posts/:postId
```

### 2. `RAGSearchBox` UX
- A single, prominent text input with placeholder: "Ask anything about your mentions..."
- Optional filter chips for `watchlist`, `platform`, `topic`, `sentiment`, `date range`.
- Submit on `Enter` or click.
- Empty and initial state shows a few example queries and the most recent topics.

### 3. `RAGResultCard` UX
- Shows the matching text snippet, highlighted where the query semantically matched.
- Displays `platform`, `publishedAt`, `watchlist`, and `sentiment`.
- Clicking the card navigates to the full post.
- Uses a skeleton card while loading.

### 4. `RAGAsk` UX
- A two-step panel: question input at the top, answer and citations below.
- The answer is shown in a distinct card with a confidence badge (`high`/`medium`/`low`).
- Citations are listed directly below the answer, each with a snippet and a link.
- `RAGAskLoading` uses a progress bar with a message like "Reading your posts..." because `ask` may take > 1.5 s.

### 5. Loading patterns
- `RAGSearch`: use a **skeleton list** (medium wait, 300 ms–1.5 s).
- `RAGAsk`: use a **progress bar** with a descriptive message (long wait, > 1.5 s).
- If `search` returns in < 300 ms, show no loader.
- Errors are shown inline, not as full-page failures.

### 6. Accessibility
- Search input has an `aria-label` and results are announced via `aria-live`.
- Citation links have clear text, not just "click here".
- The answer card is marked `aria-live="polite"` so screen readers announce generated text.

---

## Consequences

1. **Trust through provenance:** every answer is paired with the posts that support it.
2. **Performance expectations are set:** skeleton and progress patterns prevent user abandonment.
3. **Low-friction entry:** a single search box keeps `Tenant-Reader` and `Tenant-User` from learning a query language.
4. **Component reuse:** `RAGResultCard` can be embedded in the post feed, dashboards, and the composer.

---

## Alternatives considered

1. **Put `RAGSearch` and `RAGAsk` on separate pages.**
   - *Rejected:* it fragments the experience. A single panel with two modes keeps the UI compact.

2. **Show only the AI answer, with citations hidden behind an expander.**
   - *Rejected:* it hides the most important trust signal. Citations are always visible.

3. **Use a full-screen preloader for `RAGAsk`.**
   - *Rejected:* it blocks the rest of the UI unnecessarily. A panel-level progress bar is less disruptive.

---

## Open questions

- Should the search box support auto-complete for common questions?
- Should the answer be rendered as Markdown, or as plain text with linkified citations?
- How should the UI handle `low`-confidence answers — show a warning, or re-run the search with a broader query?
- Should `RAGAsk` be available from the post feed, the dashboard, or a dedicated `/tenant/ask` page?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related stakeholder profile: `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0084` (search and ask endpoint), `ADR-0081` (`RAGConnector`)
