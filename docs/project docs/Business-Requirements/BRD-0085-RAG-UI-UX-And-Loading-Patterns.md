# BRD-0085: RAG UI/UX and Loading Patterns

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG UI/UX and Loading Patterns – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft – based on ADR-0085, which is **Proposed** and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0085, feature design 28, Performance Review Agent profile, and Epic 9 stories |

---

## 2. Executive Summary

SocialEngage users currently discover posts through keyword and filter-based search. As the platform ingests more content, keyword search misses conceptually related posts that use different language. ADR-0085 introduces a natural-language, retrieval-augmented-generation (RAG) interface in the admin UI that lets `Tenant-Reader` and `Tenant-User` search by meaning and ask grounded questions over the tenant's posts.

The business need is to make that new capability feel trustworthy, fast, and accessible. The proposed solution is a single `RAGSearch` / `RAGAsk` experience in `social-listening-admin` built from `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, `RAGAskPanel`, and `RAGCitationsList`. It uses skeleton and progress loading patterns defined by the Performance Review Agent profile, shows citations for every AI-generated answer, and keeps errors inline so users never face a full-page failure.

Expected business value: faster insight discovery, higher confidence in AI answers, lower abandonment during medium- and long-latency calls, and a reusable card component that can later appear in the post feed, dashboards, and composer.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make semantic search feel fast and responsive | Search results render with the correct loading pattern; perceived wait for `RAGSearch` is managed without full-page spinners |
| 2 | Build trust in AI-generated answers | Every `RAGAsk` answer is accompanied by visible citations linking to the original posts |
| 3 | Lower the barrier to natural-language exploration | Users can submit a query with a single text box and optional filter chips; no query language is required |
| 4 | Support reuse of RAG result components | `RAGResultCard` is designed so it can be embedded in the post feed, dashboards, and composer |
| 5 | Maintain accessibility across the new UI | Search input and dynamic results are announced to assistive technologies; citation links are descriptive |

---

## 4. Scope

### 4.1 In Scope

- `RAGSearchPage`, `RAGSearchBox`, `RAGFilterBar`, `RAGSearchLoading`, `RAGResultsList`, `RAGResultCard`, and `RAGResultSnippet` components
- `RAGAskPanel`, `RAGAskInput`, `RAGAskLoading`, `RAGAskAnswer`, `RAGCitationsList`, and `RAGCitationCard` components
- Loading patterns: no loader under 300 ms, skeleton/shimmer for 300 ms–1.5 s, progress bar with descriptive message for >1.5 s
- Inline error display for both `RAGSearch` and `RAGAsk`
- Citation UX that links every answer back to `/tenant/posts/:postId`
- Keyboard and screen-reader accessibility for search, results, ask, and citations
- Mobile-responsive layout for filters, results, and ask panel

### 4.2 Out of Scope

- Backend vector-store implementation, chunking, embedding, and `RAGConnector` provider abstraction (covered by ADR-0081–0084)
- AI provider selection, rate limiting, and quota enforcement on the backend
- Post detail page redesign; the BRD only requires a navigation link to the existing `/tenant/posts/:postId` route
- Auto-complete, Markdown answer rendering, low-confidence re-run, and cross-surface placement of `RAGAsk` (left as open questions in ADR-0085)

### 4.3 Assumptions

- `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` are available per ADR-0084 / Story 9.10
- The admin UI is a Next.js React application (`social-listening-admin`) with an existing design system and post-detail route
- Tenant-scoped results and citations are already enforced by the backend; the UI only renders what the API returns
- The Performance Review Agent loading-pattern convention is the authoritative UX standard for loading states

### 4.4 Constraints

- UI changes are confined to `social-listening-admin`; no direct vector-store or database access from the frontend
- All AI-generated content must be paired with citations to maintain user trust
- The interface must work for `Tenant-Reader` and `Tenant-User` personas, who prioritize legibility and transparency over power-user features

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-Reader` | Primary consumer of search and ask | High | Simple, fast natural-language search that surfaces relevant posts |
| `Tenant-User` | Consumer of RAG answers and citations | High | Trustworthy, cited AI answers without learning a query language |
| `Tenant-Business-Analyst` | Primary adopter of semantic exploration | High | Discover conceptually related posts and ask data-driven questions |
| `Topic-Center-Analyst` | Uses search to explore emergent topics | High | Find related language and trends without exact keywords |
| `Tenant-Brand-Reputation-Manager` | Needs fast narrative discovery | High | Identify emerging reputation issues quickly and confidently |
| `Sole-Operator` | Cost and index-health observer | Medium | Understand when long waits are due to AI/vector work |
| Performance Review Agent | Design-time reviewer | Medium | Loading patterns match the performance convention; no full-page spinners for medium waits |
| UI Engineering | Implementer | High | Clear component hierarchy, accessibility rules, and loading thresholds |

---

## 6. Current State (As-Is)

**Current process:**

Users navigate the post feed and apply keyword filters, watchlists, platforms, and date ranges. There is no semantic search. AI-generated summaries and explanations, if available, are not directly exposed through a conversational UI in the admin client. Loading states in the feed and dashboards follow existing `loading.tsx` and `Suspense` patterns, but there is no dedicated guidance for medium- and long-latency RAG calls.

**Pain points:**

- Keyword search misses posts that express the same idea with different words
- There is no natural-language Q&A surface, so users must translate questions into filters
- Users have no visible provenance for any AI-generated content, which hurts trust
- Long AI calls risk user abandonment if not given a progress or skeleton treatment
- Errors in search/ask could currently present as full-page failures rather than inline recoverable messages

---

## 7. Future State (To-Be)

**New or improved process:**

A tenant user opens the RAG search/ask page, sees a single prominent search box with optional filter chips, and either runs a semantic search or switches to the `RAGAsk` panel. `RAGSearch` returns ranked post cards with highlighted snippets, platform, date, watchlist, and sentiment; each card links to the original post. `RAGAsk` returns a generated answer with a confidence badge and a list of citations that also link to the original posts. Loading states adapt to call duration, and errors appear inline. The same `RAGResultCard` can later be dropped into the post feed, dashboards, or composer.

**Expected capabilities:**

- Natural-language semantic search and Q&A in one compact panel
- Skeleton results for medium-latency search and a progress bar for long `RAGAsk` calls
- Always-visible, clickable citations on every AI answer
- Keyboard- and screen-reader-accessible search, results, and ask flow
- Mobile-responsive layout that stacks filters above results

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The UI shall provide a single `RAGSearchBox` with a prominent text input and placeholder text "Ask anything about your mentions..." | Must | Input is visible on the RAG page and supports typing and focus | Product Owner |
| BR-002 | The UI shall submit a search on `Enter` or click and support optional filter chips for `watchlist`, `platform`, `topic`, `sentiment`, and `date range` | Must | `Enter` and click submit; selected filters are passed to `POST /v1/rag/search` | Product Owner |
| BR-003 | The UI shall display `RAGSearch` results as `RAGResultCard` components showing a highlighted snippet, `platform`, `publishedAt`, `watchlist`, and `sentiment` | Must | Each card renders snippet and metadata; clicking navigates to `/tenant/posts/:postId` | Product Owner |
| BR-004 | The UI shall provide a `RAGAskPanel` with a question input, an answer card, and a `RAGCitationsList` | Must | User can submit a question; the panel renders answer and citations | Product Owner |
| BR-005 | The UI shall show a confidence badge (`high` / `medium` / `low`) on every `RAGAsk` answer | Must | Badge is visible and reflects the API's `confidence` value | Product Owner |
| BR-006 | The UI shall render citations as `RAGCitationCard` components with a snippet and a link to the original post | Must | Each citation links to `/tenant/posts/:postId` and has descriptive link text | Product Owner |
| BR-007 | The UI shall handle `RAGSearch` and `RAGAsk` errors inline, not as full-page failures | Must | Error messages appear inside the panel or list; the rest of the page remains usable | Product Owner |
| BR-008 | The UI shall support keyboard search submission and screen-reader announcements of loading and result changes | Must | `aria-label` on the search input and `aria-live` on results and answer | Product Owner |
| BR-009 | The UI shall be responsive, stacking the filter bar and results on narrow viewports | Should | Filters and results adapt layout on mobile widths | Product Owner |
| BR-010 | The empty/initial state of `RAGSearchBox` shall show example queries and recent topics | Should | Examples and recent topics are visible before first query | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `RAGSearch` shall show no loader for calls under 300 ms, a skeleton list for 300 ms–1.5 s, and a progress bar with a descriptive message for calls over 1.5 s | Performance / Usability | Must | Loading treatment matches the Performance Review Agent convention and is verified against the target latencies |
| NFR-002 | `RAGAsk` shall use a progress bar with a descriptive message such as "Reading your posts..." because it is expected to exceed 1.5 s | Performance / Usability | Must | Progress bar is visible during the ask call and updates or completes when the answer arrives |
| NFR-003 | Search input, results, and answer cards shall be accessible to screen readers and keyboard users | Accessibility | Must | Passes `aria-label`, `aria-live`, and keyboard-navigation checks |
| NFR-004 | Citation links shall use clear, descriptive link text (not "click here") | Accessibility | Must | Link text describes the destination post or source |
| NFR-005 | `RAGResultCard` shall be implemented as a reusable component that can be embedded in the post feed, dashboards, and composer | Maintainability | Should | Component API is documented and free of page-specific coupling |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A user does not need to learn a query language; `RAGSearchBox` accepts plain natural language |
| BRU-002 | Every AI-generated `RAGAsk` answer must be accompanied by visible citations linking to the original posts |
| BRU-003 | Loading states must follow the Performance Review Agent thresholds: no loader (< 300 ms), skeleton/shimmer (300 ms–1.5 s), or progress bar (> 1.5 s) |
| BRU-004 | Errors in `RAGSearch` and `RAGAsk` must be displayed inline and must not cause a full-page failure |
| BRU-005 | Citation links must be keyboard-focusable and must have descriptive, non-generic link text |
| BRU-006 | The `low` confidence badge on an answer must be shown to the user; the BRD intentionally leaves the follow-up action (warning, re-run, or broader query) as an open question to be resolved before implementation |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `query` | Natural-language search or ask string | User input | Product | Low (tenant-scoped) |
| `platformId` / `sentiment` / `watchlistIds` / `topics` / `dateRange` | Optional filters (canonical `RAGFilter` per ADR-0081) passed to the search endpoint | User selection | Product | Low |
| `RAGSearch` result snippet | Highlighted excerpt from the matched chunk | `POST /v1/rag/search` | Backend | Public post content |
| `platform`, `publishedAt`, `watchlist`, `sentiment` | Metadata shown on each `RAGResultCard` | `POST /v1/rag/search` | Backend | Public post content |
| `postId` | Original post identifier used for navigation links | `POST /v1/rag/search` / `POST /v1/rag/ask` | Backend | Internal reference |
| `answer` | AI-generated response to an ask query | `POST /v1/rag/ask` | Backend | Public post content |
| `confidence` | `high` / `medium` / `low` confidence grade for the answer | `POST /v1/rag/ask` | Backend | Low |
| `citations` | List of source chunks with snippet and `postId` | `POST /v1/rag/ask` | Backend | Public post content |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| `RAGSearch` query latency | Track perceived performance and loading-pattern correctness | Performance Review Agent / Engineering | Per release / ongoing |
| `RAGAsk` call duration and completion rate | Identify abandonment or timeout issues | Product / Engineering | Weekly during rollout |
| Citation click-through rate | Measure whether users trust and follow AI answer sources | Product | Monthly |
| Low-confidence answer rate | Detect when the AI is frequently uncertain | Product / Data | Weekly |
| `RAGSearch` / `RAGAsk` error rate | Spot inline error trends before they become support issues | Engineering | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `RAGAsk` latency is unpredictable and may exceed 1.5 s, leading to user abandonment | Medium | High | Implement a progress bar with descriptive message and disable repeated submit while a call is in flight | UI Engineering |
| R-002 | Users may not trust AI-generated answers without clear provenance | Medium | High | Always display citations; require `RAGAsk` to render answer and citations together | Product Owner |
| R-003 | Loading-state inconsistency across the admin app if developers deviate from the Performance Review Agent convention | Medium | Medium | Document thresholds in the BRD and reference the stakeholder profile in component README | UI Engineering |
| R-004 | Mobile filter bar becomes unwieldy with many chips | Low | Medium | Stack filters above results and use collapsible sections on narrow viewports | UI Engineering |
| R-005 | ADR-0085 is still Proposed; scope or decisions may change before implementation | High | Medium | Mark the BRD as a draft and re-issue when ADR-0085 is Accepted | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` per ADR-0084 | Backend / Contract | Backend Engineering | Story 9.10 completion |
| D-002 | `RAGConnector`, chunking, embedding, and tenant-scoped vector metadata per ADR-0081–0083 | Backend | Backend Engineering | Stories 9.7–9.9 completion |
| D-003 | Existing `social-listening-admin` design system and `/tenant/posts/:postId` route | Internal | Frontend Engineering | Already available |
| D-004 | Performance Review Agent loading-pattern convention | Internal / Process | Performance Review Agent | Documented in stakeholder profile |
| D-005 | Story 9.11 — RAG UI/UX and loading patterns (frontend) | Implementation | Frontend Engineering | Ready after Story 9.10 |

---

## 14. Acceptance Criteria

- `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, and `RAGAsk` components are implemented in `social-listening-admin`
- `RAGSearch` uses the correct loading pattern: no loader under 300 ms, skeleton list for 300 ms–1.5 s
- `RAGAsk` uses a progress bar with a descriptive message because it is expected to take longer than 1.5 s
- Each search result shows an excerpt, platform, date, watchlist, sentiment, and a link to the original post
- `RAGAsk` shows the generated answer with a confidence badge and a list of always-visible citations
- Citation links navigate to the original post and use clear, descriptive link text
- Keyboard accessibility and mobile layout are supported
- Errors are shown inline and do not break the page

---

## 15. Glossary

| Term | Definition |
|---|---|
| **RAG** | Retrieval-Augmented Generation: an AI technique that grounds generated answers in retrieved source documents |
| **Chunk** | A small, overlapping segment of a post's `body_markdown` used for vector indexing and retrieval |
| **Embedding** | A numerical vector representation of text used to compare semantic similarity |
| **Citation** | A UI element that links an AI-generated answer back to the source post(s) used to produce it |
| **Skeleton / shimmer** | A placeholder UI that mirrors the layout of upcoming content while data is loading |
| **Progress bar** | A loading indicator that shows an indeterminate or determinate completion status for longer waits |
| **Tenant-Reader** | A persona who primarily reads posts and insights with a low tolerance for complexity |
| **Tenant-User** | A broader consumer of the admin UI who needs transparency and legibility over power features |

---

## 16. Appendices

- **ADR-0085:** `docs/adr/0085-rag-ui-ux-and-loading-patterns.md`
- **Feature design:** `docs/product-research/feature-designs/28-semantic-search-rag.md`
- **Performance Review Agent stakeholder profile:** `docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md`
- **Related ADRs:** `docs/adr/0084-rag-search-and-ask-endpoint.md`, `docs/adr/0081-rag-connector-provider-abstraction.md`, `docs/adr/0082-rag-post-chunking-and-embedding.md`, `docs/adr/0083-rag-vector-store-rls-and-metadata.md`
- **Related user stories:** `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.11 (RAG UI/UX and loading patterns, frontend)
- **Related scoping document:** `docs/product-research/feature-adr-scoping.md`
- **Missing source:** No `docs/product-research/reports/*rag*-deep-research.md` file was found; the BRD therefore does not include a deep-research brief. This should be noted if a research report is produced later.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
