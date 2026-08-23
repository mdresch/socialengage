# BRD-0085: RAG UI/UX and Loading Patterns

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0085: RAG UI/UX and Loading Patterns |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0085-rag-ui-ux-and-loading-patterns.md, ../Business-Requirements/BRD-0085-RAG-UI-UX-And-Loading-Patterns.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0085-rag-ui-ux-and-loading-patterns.md and the business requirements in BRD-0085-RAG-UI-UX-And-Loading-Patterns.md into functional design for **RAG UI UX And Loading Patterns**.
SocialEngage users currently discover posts through keyword and filter-based search. As the platform ingests more content, keyword search misses conceptually related posts that use different language. ADR-0085 introduces a natural-language, retrieval-augmented-generation (RAG) interface in the admin UI that lets `Tenant-Reader` and `Tenant-User` search by meaning and ask grounded questions over the tenant's posts.

The business need is to make that new capability feel trustworthy, fast, and accessible. The proposed solution is a single `RAGSearch` / `RAGAsk` experience in `social-listening-admin` built from `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, `RAGAskPanel`, and `RAGCitationsList`. It uses skeleton and progress loading patterns defined by the Performance Review Agent profile, shows citations for every AI-generated answer, and keeps errors inline so users never face a full-page failure.

Expected business value: faster insight discovery, higher confidence in AI answers, lower abandonment during medium- and long-latency calls, and a reusable card component that can later appear in the post feed, dashboards, and composer.

---

### 2.2 Scope
**In scope:**
- `RAGSearchPage`, `RAGSearchBox`, `RAGFilterBar`, `RAGSearchLoading`, `RAGResultsList`, `RAGResultCard`, and `RAGResultSnippet` components
- `RAGAskPanel`, `RAGAskInput`, `RAGAskLoading`, `RAGAskAnswer`, `RAGCitationsList`, and `RAGCitationCard` components
- Loading patterns: no loader under 300 ms, skeleton/shimmer for 300 ms–1.5 s, progress bar with descriptive message for >1.5 s
- Inline error display for both `RAGSearch` and `RAGAsk`
- Citation UX that links every answer back to `/tenant/posts/:postId`
- Keyboard and screen-reader accessibility for search, results, ask, and citations
- Mobile-responsive layout for filters, results, and ask panel

**Out of scope:**
- Backend vector-store implementation, chunking, embedding, and `RAGConnector` provider abstraction (covered by ADR-0081–0084)
- AI provider selection, rate limiting, and quota enforcement on the backend
- Post detail page redesign; the BRD only requires a navigation link to the existing `/tenant/posts/:postId` route
- Auto-complete, Markdown answer rendering, low-confidence re-run, and cross-surface placement of `RAGAsk` (left as open questions in ADR-0085)

## 3. Context and Background
See ADR Context.
SocialEngage users currently discover posts through keyword and filter-based search. As the platform ingests more content, keyword search misses conceptually related posts that use different language. ADR-0085 introduces a natural-language, retrieval-augmented-generation (RAG) interface in the admin UI that lets `Tenant-Reader` and `Tenant-User` search by meaning and ask grounded questions over the tenant's posts.

The business need is to make that new capability feel trustworthy, fast, and accessible. The proposed solution is a single `RAGSearch` / `RAGAsk` experience in `social-listening-admin` built from `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, `RAGAskPanel`, and `RAGCitationsList`. It uses skeleton and progress loading patterns defined by the Performance Review Agent profile, shows citations for every AI-generated answer, and keeps errors inline so users never face a full-page failure.

Expected business value: faster insight discovery, higher confidence in AI answers, lower abandonment during medium- and long-latency calls, and a reusable card component that can later appear in the post feed, dashboards, and composer.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Make semantic search feel fast and responsive | Search results render with the correct loading pattern; perceived wait for `RAGSearch` is managed without full-page spinners |
| 2 | Build trust in AI-generated answers | Every `RAGAsk` answer is accompanied by visible citations linking to the original posts |
| 3 | Lower the barrier to natural-language exploration | Users can submit a query with a single text box and optional filter chips; no query language is required |
| 4 | Support reuse of RAG result components | `RAGResultCard` is designed so it can be embedded in the post feed, dashboards, and composer |
| 5 | Maintain accessibility across the new UI | Search input and dynamic results are announced to assistive technologies; citation links are descriptive |

---

**Positive consequences (from ADR):**
1. **Trust through provenance:** every answer is paired with the posts that support it.
2. **Performance expectations are set:** skeleton and progress patterns prevent user abandonment.
3. **Low-friction entry:** a single search box keeps `Tenant-Reader` and `Tenant-User` from learning a query language.
4. **Component reuse:** `RAGResultCard` can be embedded in the post feed, dashboards, and the composer.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
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

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.11 | epic-9-adr-0077-to-0085.md | As `Tenant-Reader`, I want a semantic search box and an "Ask" panel in the admin UI with clear loading states and citations, so that I can find and understan... | `RAGSearchBox`, `RAGResultsList`, `RAGResultCard`, and `RAGAsk` components are implemented.; Search uses a skeleton list; `Ask` uses a progress bar.; Each re... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `query` | Natural-language search or ask string | User input | Product | Low (tenant-scoped) |
| `watchlistId` / `platform` / `topic` / `sentiment` / `dateRange` | Optional filters passed to the search endpoint | User selection | Product | Low |
| `RAGSearch` result snippet | Highlighted excerpt from the matched chunk | `POST /v1/rag/search` | Backend | Public post content |
| `platform`, `publishedAt`, `watchlist`, `sentiment` | Metadata shown on each `RAGResultCard` | `POST /v1/rag/search` | Backend | Public post content |
| `postId` | Original post identifier used for navigation links | `POST /v1/rag/search` / `POST /v1/rag/ask` | Backend | Internal reference |
| `answer` | AI-generated response to an ask query | `POST /v1/rag/ask` | Backend | Public post content |
| `confidence` | `high` / `medium` / `low` confidence grade for the answer | `POST /v1/rag/ask` | Backend | Low |
| `citations` | List of source chunks with snippet and `postId` | `POST /v1/rag/ask` | Backend | Public post content |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A user does not need to learn a query language; `RAGSearchBox` accepts plain natural language |
| BRU-002 | Every AI-generated `RAGAsk` answer must be accompanied by visible citations linking to the original posts |
| BRU-003 | Loading states must follow the Performance Review Agent thresholds: no loader (< 300 ms), skeleton/shimmer (300 ms–1.5 s), or progress bar (> 1.5 s) |
| BRU-004 | Errors in `RAGSearch` and `RAGAsk` must be displayed inline and must not cause a full-page failure |
| BRU-005 | Citation links must be keyboard-focusable and must have descriptive, non-generic link text |
| BRU-006 | The `low` confidence badge on an answer must be shown to the user; the BRD intentionally leaves the follow-up action (warning, re-run, or broader query) as an open question to be resolved before implementation |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` per ADR-0084 | Backend / Contract | Backend Engineering | Story 9.10 completion |
| D-002 | `RAGConnector`, chunking, embedding, and tenant-scoped vector metadata per ADR-0081–0083 | Backend | Backend Engineering | Stories 9.7–9.9 completion |
| D-003 | Existing `social-listening-admin` design system and `/tenant/posts/:postId` route | Internal | Frontend Engineering | Already available |
| D-004 | Performance Review Agent loading-pattern convention | Internal / Process | Performance Review Agent | Documented in stakeholder profile |
| D-005 | Story 9.11 — RAG UI/UX and loading patterns (frontend) | Implementation | Frontend Engineering | Ready after Story 9.10 |

---

- `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` are available per ADR-0084 / Story 9.10
- The admin UI is a Next.js React application (`social-listening-admin`) with an existing design system and post-detail route
- Tenant-scoped results and citations are already enforced by the backend; the UI only renders what the API returns
- The Performance Review Agent loading-pattern convention is the authoritative UX standard for loading states

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `RAGSearch` shall show no loader for calls under 300 ms, a skeleton list for 300 ms–1.5 s, and a progress bar with a descriptive message for calls over 1.5 s | Performance / Usability | Must | Loading treatment matches the Performance Review Agent convention and is verified against the target latencies |
| NFR-002 | `RAGAsk` shall use a progress bar with a descriptive message such as "Reading your posts..." because it is expected to exceed 1.5 s | Performance / Usability | Must | Progress bar is visible during the ask call and updates or completes when the answer arrives |
| NFR-003 | Search input, results, and answer cards shall be accessible to screen readers and keyboard users | Accessibility | Must | Passes `aria-label`, `aria-live`, and keyboard-navigation checks |
| NFR-004 | Citation links shall use clear, descriptive link text (not "click here") | Accessibility | Must | Link text describes the destination post or source |
| NFR-005 | `RAGResultCard` shall be implemented as a reusable component that can be embedded in the post feed, dashboards, and composer | Maintainability | Should | Component API is documented and free of page-specific coupling |

---

## 11. Error Handling and Exceptions
1. **Trust through provenance:** every answer is paired with the posts that support it.
2. **Performance expectations are set:** skeleton and progress patterns prevent user abandonment.
3. **Low-friction entry:** a single search box keeps `Tenant-Reader` and `Tenant-User` from learning a query language.
4. **Component reuse:** `RAGResultCard` can be embedded in the post feed, dashboards, and the composer.

---

## 12. Assumptions and Dependencies
- `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` are available per ADR-0084 / Story 9.10
- The admin UI is a Next.js React application (`social-listening-admin`) with an existing design system and post-detail route
- Tenant-scoped results and citations are already enforced by the backend; the UI only renders what the API returns
- The Performance Review Agent loading-pattern convention is the authoritative UX standard for loading states

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `RAGAsk` latency is unpredictable and may exceed 1.5 s, leading to user abandonment | Medium | High | Implement a progress bar with descriptive message and disable repeated submit while a call is in flight | UI Engineering |
| R-002 | Users may not trust AI-generated answers without clear provenance | Medium | High | Always display citations; require `RAGAsk` to render answer and citations together | Product Owner |
| R-003 | Loading-state inconsistency across the admin app if developers deviate from the Performance Review Agent convention | Medium | Medium | Document thresholds in the BRD and reference the stakeholder profile in component README | UI Engineering |
| R-004 | Mobile filter bar becomes unwieldy with many chips | Low | Medium | Stack filters above results and use collapsible sections on narrow viewports | UI Engineering |
| R-005 | ADR-0085 is still Proposed; scope or decisions may change before implementation | High | Medium | Mark the BRD as a draft and re-issue when ADR-0085 is Accepted | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0085-rag-ui-ux-and-loading-patterns.md`
- BRD: `../Business-Requirements/BRD-0085-RAG-UI-UX-And-Loading-Patterns.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md``
- Deep research: `docs/product-research/reports/*rag*-deep-research.md``
- User stories: see extracted stories above