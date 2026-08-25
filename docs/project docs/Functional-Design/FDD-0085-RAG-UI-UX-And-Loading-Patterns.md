# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0085 RAG UI/UX and Loading Patterns — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Draft |
| Related Documents | ADR-0085 (RAG UI/UX and loading patterns), ADR-0084 (search and ask endpoint), ADR-0081 (`RAGConnector`), BRD-0085, `docs/product-research/feature-designs/28-semantic-search-rag.md`, `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`, Story 9.11 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0085's decision — the React component hierarchy, UX behavior, loading-state thresholds, and citation/accessibility rules for `RAGSearch` and `RAGAsk` in `social-listening-admin` — into a functional design covering component behavior, workflows, data flow to/from the backend RAG endpoints, and error/edge-case handling.

**Note:** ADR-0085's Status is **Proposed**, not Accepted. This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:** `RAGSearchPage`, `RAGSearchBox`, `RAGFilterBar`, `RAGSearchLoading`, `RAGResultsList`, `RAGResultCard`, `RAGResultSnippet`, `RAGAskPanel`, `RAGAskInput`, `RAGAskLoading`, `RAGAskAnswer`, `RAGCitationsList`, `RAGCitationCard`; loading-state thresholds (no loader <300ms, skeleton 300ms–1.5s, progress bar >1.5s); inline error handling; citation UX and navigation to `/tenant/posts/:postId`; keyboard/screen-reader accessibility; mobile-responsive layout.
- **Out of scope:** backend vector-store implementation, chunking, embedding, `RAGConnector` abstraction (ADR-0081/0082/0083); the `POST /v1/rag/search`/`POST /v1/rag/ask`/`GET /v1/rag/status` contracts themselves (ADR-0084); AI provider selection, rate limiting, and quota enforcement (backend, ADR-0084); post-detail page redesign (only a navigation link to the existing route is in scope); auto-complete, Markdown answer rendering, low-confidence re-run behavior, and cross-surface placement of `RAGAsk` beyond the dedicated page (left as open questions).

### 2.3 Target Audience

Frontend/UI engineers in `social-listening-admin`, UX/accessibility reviewers, QA authoring component and interaction tests, and the Product Owner.

---

## 3. Context and Background

RAG search is a new interaction pattern for this admin UI: unlike keyword/filter-based post discovery (existing `GET /v1/posts` UI), a natural-language query or question can take longer to resolve and its output (an AI-generated answer) needs explicit provenance to be trusted. `Tenant-Reader` and `Tenant-User` are the primary personas for this surface and prioritize legibility and transparency over power-user features, so the design favors a single prominent input over a query language.

The project already has a documented loading-pattern convention from the Performance Review Agent stakeholder profile (`docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`): no loader under 300ms, skeleton/shimmer for 300ms–1.5s, and a progress/detailed message beyond that. `RAGSearch` (expected medium latency) and `RAGAsk` (expected long latency, since it includes a generation call) map onto this convention directly rather than inventing new loading UX.

Source requirements: ADR-0085, BRD-0085, Story 9.11 (`docs/user-stories/epic-9-adr-0077-to-0085.md`). Depends on ADR-0084 (Story 9.10) being implemented first, since this UI is a pure consumer of those endpoints.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make semantic search feel fast and responsive | Loading treatment matches the Performance Review Agent thresholds; no full-page spinners |
| G2 | Build trust in AI-generated answers through provenance | Every `RAGAsk` answer always shows its citations, never hidden behind an expander |
| G3 | Keep the entry point low-friction | A single natural-language text box with optional filter chips; no query language required |
| G4 | Enable component reuse beyond this page | `RAGResultCard` is implemented with a page-agnostic API suitable for the post feed, dashboards, and composer |
| G5 | Maintain accessibility parity with the rest of the admin UI | Search, results, and answer are keyboard- and screen-reader-accessible |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `RAGSearchBox` and Filter Entry

- **Description:** The single natural-language entry point for semantic search, with optional filter chips.
- **Triggers:** User focuses/types into the search input, optionally selects filter chips, and submits.
- **Inputs:** Free-text query string; optional filter chip selections for `watchlist`, `platform`, `topic`, `sentiment`, `date range`.
- **Processing:**
  - Displays placeholder text "Ask anything about your mentions..." when empty.
  - Submits on `Enter` keypress or explicit click of a submit control.
  - Selected filter chips are translated into the `filter` object sent to `POST /v1/rag/search` (per ADR-0084's `RAGFilter` contract).
  - The initial/empty state (before any query has been submitted) shows a few example queries and the most recently active topics, rather than a blank box.
- **Outputs:** A `POST /v1/rag/search` request; the initial-state example content when idle.
- **Error handling:** Submitting an empty query is prevented client-side (submit is a no-op or disabled) rather than sent to the backend.
- **Edge cases:** Rapid repeated submissions (e.g., double-`Enter`) must not fire duplicate concurrent requests. Clearing all filter chips returns to an unfiltered tenant-wide search.

### 5.2 Feature / Capability: `RAGSearch` Results Display

- **Description:** Renders ranked semantic search results as a list of cards.
- **Triggers:** A `POST /v1/rag/search` response is received (success or error).
- **Inputs:** The `results` array from `POST /v1/rag/search` (`postId`, `chunkIndex`, `score`, `platformId`, `publishedAt`, `snippet`).
- **Processing:**
  - Each result renders as a `RAGResultCard` containing a `RAGResultSnippet` (with the semantically-matched portion visually highlighted where the API/UI can determine it), plus `platform`, `publishedAt`, `watchlist`, and `sentiment` metadata.
  - Cards are clickable and navigate to `/tenant/posts/:postId` (the existing post detail route).
  - Applies the loading pattern from Section 5.5 while the request is in flight.
- **Outputs:** A rendered `RAGResultsList`, or an empty-results message when `results` is `[]`.
- **Error handling:** A failed request (network error, 5xx, `429 RAG_QUOTA_EXCEEDED`) renders an inline error message within the results area — never a full-page failure — and leaves the search box usable for retry.
- **Edge cases:** Zero results is a distinct, friendly empty state (not treated as an error). A `429` quota response should surface a message distinguishable from a generic failure (e.g., indicating the tenant's usage limit was reached) so the user understands why no results came back.

### 5.3 Feature / Capability: `RAGAskPanel` and Answer Display

- **Description:** A two-step panel — question input at top, generated answer and citations below — for grounded natural-language Q&A.
- **Triggers:** User types a question into `RAGAskInput` and submits.
- **Inputs:** Free-text question; optional filter (same dimensions as search, reused from `RAGFilterBar` if shared).
- **Processing:**
  - Submits `POST /v1/rag/ask` with `question` and optional `filter`.
  - While in flight, applies the `RAGAskLoading` progress-bar treatment (Section 5.5) since `ask` is expected to exceed 1.5s, with a descriptive message such as "Reading your posts...".
  - On success, renders `RAGAskAnswer` — the generated `answer` text in a visually distinct card — with a confidence badge showing `high`/`medium`/`low` per the API's `confidence` value.
  - Renders `RAGCitationsList` directly below the answer, always visible (never collapsed behind an expander), with one `RAGCitationCard` per citation.
- **Outputs:** A rendered answer card with confidence badge and a citations list.
- **Error handling:** A failed `ask` call (network/5xx/`429 RAG_QUOTA_EXCEEDED`) shows an inline error within the panel; the question input remains editable for retry. If the API indicates the question could not be answered from retrieved context (per ADR-0084 Q2), the UI must render that limitation explicitly rather than presenting a confident-looking empty or generic answer.
- **Edge cases:** A `low`-confidence answer still displays normally with its badge — the BRD leaves the follow-up UX (warning banner, prompt to re-run, or broader query) as an explicit open question (see Section 13, Q3) rather than a hidden/suppressed answer. An answer with zero citations (should not normally occur per BR-5 in ADR-0084) must not be rendered as if grounded — this is a defect condition the UI should treat defensively (e.g., flag rather than silently display).

### 5.4 Feature / Capability: `RAGCitationCard` and Navigation

- **Description:** Renders one citation with a snippet and a link back to the source post.
- **Triggers:** Rendered as part of `RAGCitationsList` whenever an `ask` answer includes citations.
- **Inputs:** A single citation object (`postId`, `chunkIndex`, `url?`, `snippet`).
- **Processing:** Displays the citation's `snippet`; the link text is descriptive of the destination (not "click here"), and clicking/activating it navigates to `/tenant/posts/:postId`.
- **Outputs:** A keyboard-focusable, screen-reader-friendly citation entry.
- **Error handling:** A citation whose `postId` no longer resolves to a live post (e.g., deleted since indexing) should degrade gracefully (e.g., a disabled/muted link or inline note) rather than navigating to a broken page.
- **Edge cases:** Multiple citations referencing different chunks of the same post are each shown as distinct entries (not deduplicated to one card), since each represents a distinct supporting excerpt.

### 5.5 Feature / Capability: Loading-State Pattern Application

- **Description:** Applies the Performance Review Agent's loading-pattern convention consistently across `RAGSearch` and `RAGAsk`.
- **Triggers:** Any `POST /v1/rag/search` or `POST /v1/rag/ask` request in flight.
- **Inputs:** Elapsed time since request start; response arrival event.
- **Processing:**
  - **<300ms:** no loading indicator is shown at all (avoids flicker for fast responses).
  - **300ms–1.5s:** `RAGSearch` shows `RAGSearchLoading`, a skeleton/shimmer list matching the shape of `RAGResultCard`.
  - **>1.5s:** `RAGAsk` shows `RAGAskLoading`, a progress bar with a descriptive message (e.g., "Reading your posts...").
  - The same duration thresholds apply to whichever call is in flight; `RAGSearch` is expected to typically resolve in the skeleton range, `RAGAsk` in the progress-bar range, but the UI reacts to actual elapsed time, not a hardcoded assumption per endpoint.
- **Outputs:** The appropriate loading UI shown/hidden as elapsed time crosses each threshold.
- **Error handling:** If a request errors before any loading UI would have appeared (<300ms), the error still renders normally without a loading flash.
- **Edge cases:** A request that resolves exactly at a threshold boundary should not flicker between states.

### 5.6 Feature / Capability: Accessibility

- **Description:** Search, results, and answer surfaces are usable via keyboard and screen readers.
- **Triggers:** Applies continuously across all RAG UI interactions.
- **Inputs:** N/A — a cross-cutting behavioral requirement.
- **Processing:**
  - The search input carries an `aria-label`.
  - Result list updates and answer arrival are announced via `aria-live` (the answer card specifically uses `aria-live="polite"` so screen readers announce generated text without interrupting).
  - All citation links and result cards are keyboard-focusable and activatable (not mouse-only).
  - Citation link text is descriptive of its destination, never generic ("click here").
- **Outputs:** N/A — a quality attribute verified via accessibility testing, not a data output.
- **Error handling:** Inline error messages are also announced to assistive technology (implied by consistent `aria-live` usage across the panel), not silently rendered.
- **Edge cases:** Rapid consecutive `aria-live` updates (e.g., loading state flipping quickly) should not spam screen-reader announcements.

### 5.7 Feature / Capability: Responsive / Mobile Layout

- **Description:** The search/filter/results/ask layout adapts to narrow viewports.
- **Triggers:** Viewport width below the admin UI's existing mobile breakpoint.
- **Inputs:** Viewport dimensions.
- **Processing:** The filter bar and results stack vertically rather than side-by-side; filter chips may collapse into a compact/expandable control on narrow widths.
- **Outputs:** A usable single-column layout on mobile.
- **Error handling:** N/A.
- **Edge cases:** A large number of active filter chips on a narrow viewport must remain usable rather than overflowing unreadably (R-004 in BRD-0085).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| `Tenant-Reader` | Primary consumer; low tolerance for complexity, needs simple natural-language search |
| `Tenant-User` | Broader consumer needing transparent, cited AI answers |
| `Tenant-Business-Analyst` / `Topic-Center-Analyst` / `Tenant-Brand-Reputation-Manager` | Primary adopters using search/ask for their respective discovery needs |
| `Sole-Operator` | Observes when long waits are attributable to AI/vector work |
| UI Engineering | Implements the component hierarchy and accessibility rules |
| Performance Review Agent | Design-time reviewer of loading-pattern conformance |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 9.11) | `Tenant-Reader` | Have a semantic search box and an "Ask" panel with clear loading states and citations | Find and understand posts by meaning, not just keyword | `RAGSearchBox`/`RAGResultsList`/`RAGResultCard`/`RAGAsk` implemented; search uses a skeleton list, ask uses a progress bar; each result shows excerpt/platform/date/link; ask shows answer + citations + confidence badge, citations always visible; filter chips for watchlist/platform/topic/sentiment/date range; loading thresholds (300ms/1.5s) respected; keyboard accessibility and mobile layout supported |

### 6.3 Workflow Diagrams / Steps

**`RAGSearch` interaction flow:**
1. User lands on the RAG page; sees `RAGSearchBox` with placeholder text and, if no query yet submitted, example queries/recent topics.
2. User types a query and optionally selects filter chips.
3. User presses `Enter` or clicks submit → `POST /v1/rag/search` fires.
4. UI tracks elapsed time: shows nothing under 300ms, `RAGSearchLoading` skeleton from 300ms–1.5s.
5. On success, `RAGResultsList` renders one `RAGResultCard` per result; on error, an inline error message appears in place of the list.
6. User clicks a card → navigates to `/tenant/posts/:postId`.

**`RAGAsk` interaction flow:**
1. User switches to (or opens) `RAGAskPanel` and types a question into `RAGAskInput`.
2. User submits → `POST /v1/rag/ask` fires.
3. UI shows `RAGAskLoading` (progress bar, descriptive message) once elapsed time passes the relevant threshold.
4. On success, `RAGAskAnswer` renders the answer with a confidence badge; `RAGCitationsList` renders directly below, always visible.
5. User clicks a citation → navigates to `/tenant/posts/:postId`.
6. On error (including quota exceeded), an inline error replaces/accompanies the panel content; the question input remains editable for retry.

---

## 7. Data Requirements

### 7.1 Data Inputs

User-typed query/question text; filter chip selections; API responses from `POST /v1/rag/search`, `POST /v1/rag/ask`, and (for index-health context, if surfaced) `GET /v1/rag/status`; elapsed-time measurements for loading-state thresholds.

### 7.2 Data Outputs

Rendered result cards, answer card, citation cards; navigation events to `/tenant/posts/:postId`; no data is persisted by the UI itself beyond ephemeral component/request state.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `RAGSearchBox` (component state) | `queryText`, `selectedFilters` (`platformId?`, `sentiment?`, `watchlistIds?`, `topics?`, `dateRange?`) | Produces the request body for `POST /v1/rag/search` |
| `RAGResultCard` (view model) | `postId`, `chunkIndex`, `score`, `platformId`, `publishedAt`, `snippet`, derived `watchlist`/`sentiment` display fields | One per entry in the API's `results` array; links to a `social_posts` detail route by `postId` |
| `RAGAskPanel` (component state) | `questionText`, `selectedFilters`, `answer`, `confidence`, `citations[]`, `loadingState` | Produces the request body for `POST /v1/rag/ask`; renders its response |
| `RAGCitationCard` (view model) | `postId`, `chunkIndex`, `url?`, `snippet` | One per entry in the API's `citations` array; links to a `social_posts` detail route |
| Loading-state machine | `idle` / `no-loader` (<300ms) / `skeleton` (300ms–1.5s, search) / `progress` (>1.5s, ask) | Driven by elapsed time since request start and response arrival |

### 7.4 Validation Rules

- The search/ask submit action is disabled (or a no-op) when the input text is empty.
- Filter chip values passed to the API must match the canonical `RAGFilter` shape defined in ADR-0081 (`platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange.from`/`to`).
- Citation link `href` values must resolve to a valid `/tenant/posts/:postId` path; a `postId` that cannot resolve is handled per Section 5.4's error handling, not passed through as a broken link.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A user does not need to learn a query language; `RAGSearchBox` accepts plain natural language only. | `RAGSearchBox` |
| BR2 | Every AI-generated `RAGAsk` answer must be accompanied by visible citations linking to the original posts. | `RAGAskPanel` |
| BR3 | Loading states follow the Performance Review Agent thresholds: no loader (<300ms), skeleton/shimmer (300ms–1.5s), or progress bar (>1.5s). | `RAGSearch`, `RAGAsk` |
| BR4 | Errors in `RAGSearch` and `RAGAsk` are displayed inline and never cause a full-page failure. | Both flows |
| BR5 | Citation links must be keyboard-focusable and carry descriptive, non-generic link text. | `RAGCitationCard` |
| BR6 | The `low`-confidence badge is always shown to the user when returned by the API; the follow-up UX action is an explicit open question, not silently suppressed. | `RAGAskAnswer` |
| BR7 | `RAGResultCard` is implemented with a page-agnostic component API so it can later be embedded in the post feed, dashboards, and composer. | `RAGResultCard` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `POST /v1/rag/search` (ADR-0084) | Outbound | Fetches semantic search results | REST / JSON over HTTPS |
| `POST /v1/rag/ask` (ADR-0084) | Outbound | Fetches a grounded answer with citations | REST / JSON over HTTPS |
| `GET /v1/rag/status` (ADR-0084) | Outbound (optional, for health-aware UX) | Index health/lag context | REST / JSON over HTTPS |
| `/tenant/posts/:postId` (existing route) | Outbound (navigation) | Destination for result-card and citation-link clicks | Client-side routing |
| Existing `social-listening-admin` design system | Inbound (reused) | Base styling, layout primitives, existing loading/`Suspense` conventions | Internal component library |
| Performance Review Agent stakeholder profile | Inbound (convention) | Authoritative loading-state thresholds | Internal documentation |

---

## 10. Non-Functional Considerations

- **Performance / usability:** `RAGSearch` shows no loader under 300ms, a skeleton list for 300ms–1.5s (NFR-001); `RAGAsk` shows a progress bar with a descriptive message because it is expected to exceed 1.5s (NFR-002).
- **Accessibility:** Search input, results, and answer cards must be accessible to screen readers and keyboard users (NFR-003); citation links must use clear, descriptive text (NFR-004).
- **Maintainability:** `RAGResultCard` is built as a reusable, page-agnostic component so it can be embedded elsewhere without rework (NFR-005).
- **Responsiveness:** Filters and results must adapt layout on mobile widths (BR-009 in BRD-0085).
- **Security / access control:** The UI performs no direct vector-store or database access; it only renders what the already tenant-scoped, RLS-enforced API returns.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Empty query/question submitted | Submit prevented; no error text needed | Submit control disabled or ignored client-side |
| `POST /v1/rag/search` or `/ask` network/5xx failure | Inline error message within the results/answer area | Rest of the page remains usable; search/ask inputs remain editable for retry |
| `429 RAG_QUOTA_EXCEEDED` | Inline message distinguishing "usage limit reached" from a generic failure | No results/answer rendered; retry guidance may be shown |
| Zero search results | Friendly empty state, not an error | `RAGResultsList` renders an empty-state message instead of cards |
| `ask` question outside scope of retrieved chunks | Explicit inline note that the answer is limited/uncertain | Answer is not presented as fully confident when the backend signals this limitation |
| Citation `postId` no longer resolves to a live post | Muted/disabled link or inline note, not a dead navigation | Citation card degrades gracefully rather than routing to a broken page |

---

## 12. Assumptions and Dependencies

- `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` are available per ADR-0084 / Story 9.10 before this UI is implemented.
- `social-listening-admin` is a Next.js React application with an existing design system and post-detail route (`/tenant/posts/:postId`).
- Tenant-scoped results and citations are already enforced by the backend; the UI only renders what the API returns and performs no additional filtering for isolation purposes.
- The Performance Review Agent loading-pattern convention is the authoritative UX standard for loading states across the admin app.
- Depends on Story 9.10 (backend endpoints) being complete before Story 9.11 (this UI) can be implemented.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the search box support auto-complete for common questions? | Product Owner | Before implementation |
| Q2 | Should the answer be rendered as Markdown, or as plain text with linkified citations? | UI Engineering | Before implementation |
| Q3 | How should the UI handle `low`-confidence answers — show a warning, or offer to re-run with a broader query? | Product Owner | Before implementation |
| Q4 | Should `RAGAsk` be available from the post feed, the dashboard, or only a dedicated `/tenant/ask` page? | Product Owner | Before implementation |

---

## 14. Appendix

- **ADR:** `docs/adr/0085-rag-ui-ux-and-loading-patterns.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0085-RAG-UI-UX-And-Loading-Patterns.md`
- **Feature design:** `docs/product-research/feature-designs/28-semantic-search-rag.md`
- **Stakeholder profile:** `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0084 (search and ask endpoint), ADR-0081 (`RAGConnector`), ADR-0082 (chunking/embedding), ADR-0083 (RLS and metadata)
- **User stories:** Story 9.11 (`docs/user-stories/epic-9-adr-0077-to-0085.md`) — Blocked, pending ADR acceptance and Story 9.10
- **Glossary:**
  - *RAG* — Retrieval-Augmented Generation.
  - *Skeleton / shimmer* — placeholder UI mirroring upcoming content layout while data loads.
  - *Progress bar* — a loading indicator for longer waits, shown with a descriptive message.
  - *Citation* — a UI element linking an AI-generated answer back to its source post(s).
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0085/BRD-0085.
