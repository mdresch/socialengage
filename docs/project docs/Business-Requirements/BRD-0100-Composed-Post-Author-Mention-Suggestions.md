# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Composed Post Author Mention Suggestions – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0100 and feature design. |

---

## 2. Executive Summary

**Problem:** Users drafting outbound social posts in the Polypost Composer currently have no guidance on which authors, journalists, influencers, or community members they should mention. Without this assistance, posts are often broadcast without tagging the people already shaping the conversation, reducing reach, engagement, and credibility.

**Who is affected:** Tenant-Users, Social-Selling-Strategists, and Brand-Reputation-Managers who compose posts in the Polypost Composer.

**Proposed solution:** An AI-assisted mention-suggestions capability that analyzes the draft post, extracts its topics, and proposes relevant authors to mention or tag. Suggestions are drawn from the tenant's existing listening corpus using `AuthorTopicSignal`, RAG semantic search, and keyword matches. The user retains full control and inserts only the suggestions they choose.

**Business value:** The feature turns passive listening data into active relationship-building, helping tenants increase engagement, build credibility, and identify collaborators or prospects.

> **Note:** The source ADR-0100 is currently **Proposed**. This BRD is therefore a draft for review and may change if the ADR is revised before acceptance.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Increase engagement and reach of composed posts | Higher click-through, reshare, and mention response rates on posts that use suggestions |
| 2 | Improve author discovery and relationship building | Users can identify relevant collaborators, advocates, journalists, and prospects without manual search |
| 3 | Strengthen context and credibility of outbound messaging | Posts cite or acknowledge authors already active in the topic |
| 4 | Reuse existing listening and AI signals | Suggestions are driven by `AuthorTopicSignal` and RAG already built for the tenant |
| 5 | Accelerate composer workflows | Fewer context switches between listening and publishing tools |

---

## 4. Scope

### 4.1 In Scope

- A backend service that accepts a draft post and returns ranked author mention suggestions.
- Three suggestion signals: `AuthorTopicSignal`, RAG semantic similarity, and keyword matching.
- Platform-aware suggestions: only authors active on the selected target platforms are returned.
- Cross-platform author deduplication with platform-specific handle rendering.
- Composer UI panel that displays suggestions with reason, platform icon, and confidence.
- One-click insertion of the correct `@handle` or platform-native mention syntax into the draft.
- Optional `watchlistId` filter to scope suggestions to a specific watchlist.
- Default and hard-capped suggestion limits (`maxSuggestions` default 5, cap 10).
- Tenant-scoped, RLS-protected responses using only public author metadata.

### 4.2 Out of Scope

- Auto-insertion of mentions without explicit user approval.
- Persistent storage of suggestion records (suggestions are computed and returned, not stored).
- Hashtag or topic suggestions beyond authors.
- Sentiment-aware filtering in v1.
- Per-brand mention policies or competitor exclusion lists.
- Author opt-out / DSR handling for being suggested.
- Inbox reply composer support in v1.

### 4.3 Assumptions

- `AuthorTopicSignal` and `RAGConnector` are populated and available in the tenant's environment.
- Polypost Composer (ADR-0072) is already built and exposes the necessary UI hooks.
- Composer deep research / key-phrase extraction (ADR-0076) provides topic extraction.
- Users understand that suggestions are optional and must approve each one.

### 4.4 Constraints

- Must remain within existing multi-tenant, RLS-protected architecture.
- Must not expose private audience or contact data.
- Must meter and guard AI and vector-search costs.
- Must be deployable without a new derived table in v1.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User (primary) | Drafts posts and adds mentions | High | Fast, accurate suggestions with one-click insertion |
| Social-Selling-Strategist (primary) | Identifies prospects and advocates for outreach | High | Relevant author discovery by topic and platform |
| Tenant-Brand-Reputation-Manager (primary) | Responds to conversations and builds credibility | High | Ability to acknowledge or cite active authors |
| Tenant-Social-Care-Agent (secondary) | May reply to inbound posts in the future | Medium | (Future) tag community members or customers in replies |
| Author-of-a-Post (secondary) | May be suggested as a mention | Medium | (Future) transparent opt-out and takedown support |

---

## 6. Current State (As-Is)

**Current process:**
1. A Tenant-User drafts a post in the Polypost Composer.
2. The user manually decides who to mention, often relying on memory or external searches.
3. The user switches between listening tools and the composer to find relevant authors.
4. Mentions are inserted by typing `@handle` directly into the draft.

**Pain points:**
- Composers broadcast into the void because they cannot quickly identify the right people to mention.
- Valuable listening data on active authors is under-utilized during publishing.
- Manual author search slows the publishing workflow.
- Missed mentions reduce engagement, reach, and relationship-building opportunities.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A Tenant-User drafts a post in the Polypost Composer.
2. As the user pauses typing, the system analyzes the draft and extracts topics/key phrases.
3. The system queries the tenant's `AuthorTopicSignal`, RAG semantic index, and keyword matches.
4. A ranked list of mention suggestions is returned, scoped to the selected target platforms.
5. Suggestions appear below the composer with the author's name, platform icon, reason, and confidence.
6. The user clicks a suggestion to insert the correct mention syntax at the cursor.

**Expected capabilities:**
- AI-assisted, real-time author mention suggestions.
- Multi-source ranking combining topic relevance, semantic similarity, and keyword signals.
- Cross-platform handle rendering and deduplication.
- Transparent explanations (`reason`) for each suggestion.
- Optional watchlist-based scoping.
- Cost-guarded response limits.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall accept a draft message and return ranked author mention suggestions. | Must | Endpoint accepts `text`, `targetPlatforms`, `watchlistId`, and `maxSuggestions`. | Product Owner |
| BR-002 | The system shall combine `AuthorTopicSignal`, RAG similarity, and keyword match signals. | Must | Each suggestion includes a `matchSource` of `topic`, `rag`, or `keyword`. | Product Owner |
| BR-003 | The system shall rank and deduplicate authors across platforms. | Must | Duplicate authors are merged into one suggestion with a `handles` array. | Product Owner |
| BR-004 | The system shall exclude authors already mentioned in the draft. | Must | Authors whose handle appears in the draft are not returned. | Product Owner |
| BR-005 | The system shall filter suggestions by the selected target platforms. | Must | Only authors active on the requested platforms are returned. | Product Owner |
| BR-006 | The composer UI shall display suggestions with author name, platform icon, and reason. | Must | Each suggestion card shows the required fields and is keyboard-navigable. | Product Owner |
| BR-007 | The composer UI shall insert the platform-appropriate mention syntax on user selection. | Must | Clicking a suggestion inserts `@handle` or the platform-native tag at the cursor. | Product Owner |
| BR-008 | The system shall default to 5 suggestions and hard-cap at 10. | Must | `maxSuggestions` defaults to 5 and is clamped to 10. | Product Owner |
| BR-009 | The system shall support an optional `watchlistId` to narrow suggestions. | Should | When `watchlistId` is provided, suggestions are constrained to that watchlist. | Product Owner |
| BR-010 | RAG suggestions shall be visually distinct (e.g., sparkle icon). | Could | RAG-derived suggestions are marked with a recognizable icon and reason text. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Suggestions must be tenant-scoped and RLS-protected. | Security | Must | Contract tests verify `tenant_id` isolation. |
| NFR-002 | Suggestions must not expose private audience or contact data. | Security | Must | Only public author metadata is returned. |
| NFR-003 | Suggestion requests must complete within interactive composer response times. | Performance | Should | 95th percentile < 2 seconds under normal load. |
| NFR-004 | Suggestions are computed on demand and not persisted. | Scalability | Must | No `mention_suggestions` table in v1. |
| NFR-005 | The UI is accessible and responsive. | Usability | Should | Focus states, keyboard navigation, and mobile collapse verified. |
| NFR-006 | AI and vector search costs must be metered. | Maintainability | Should | Per-request metering is logged and budgeted. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Suggestions must be computed only from the tenant's own listening corpus (`tenant_id` on `AuthorTopicSignal` and `authors`). |
| BRU-002 | The system never auto-mentions; the user must explicitly approve each suggestion. |
| BRU-003 | Suggestions are ephemeral and are not persisted in v1. |
| BRU-004 | Authors already mentioned in the draft must be excluded from the returned suggestions. |
| BRU-005 | Suggestions must include only public author metadata; no private audience or contact data. |
| BRU-006 | `maxSuggestions` shall default to 5 and be hard-capped at 10. |
| BRU-007 | `AuthorTopicSignal` shall receive the highest weight in the v1 ranking. |
| BRU-008 | Only authors active on the requested `targetPlatforms` shall be returned. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Draft message text | Current composed post used to derive topics | Polypost Composer | Tenant-User | Internal |
| `targetPlatforms` | Platforms the post will be published to | Composer UI | Tenant-User | None |
| `watchlistId` (optional) | Specific watchlist to scope suggestions | Composer UI | Tenant-User | None |
| `AuthorTopicSignal` | Topic relevance per author for the tenant | `author-topic-signals` table | System | Tenant-internal |
| `authors` | Author profile including name, platform, handle, public URL | `authors` table | System | Public |
| `social_posts` | Recent posts used for recency and RAG similarity | `social_posts` table | System | Public |
| Suggestion response | Ephemeral ranked list of mention candidates | Computed on demand | System | Public metadata only |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Mention suggestion request volume | Track adoption and cost | Product team / Operations | Daily |
| Suggestion source distribution (`topic`, `rag`, `keyword`) | Understand which signals are most useful | Product team | Weekly |
| Suggestion-to-insertion conversion rate | Measure UI effectiveness | Product team | Weekly |
| Average response latency | Ensure composer interactivity | Engineering | Daily |
| Suggestion acceptance by persona | Tailor ranking for different roles | Product team | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Low-quality or irrelevant suggestions reduce user trust and adoption. | Medium | High | Combine multiple signals, include transparent `reason`, and allow users to ignore suggestions. | Product Owner |
| R-002 | Suggestions leak across tenants or expose private data. | Low | High | Enforce tenant-scoped RLS and return only public author metadata. | Engineering Lead |
| R-003 | AI / vector-search costs exceed budget. | Medium | Medium | Cap `maxSuggestions`, meter per request, and default to cost-effective signals. | Engineering Lead |
| R-004 | Handle data becomes stale, leading to broken mentions. | Medium | Medium | Rely on connector refresh cycles; document handle freshness dependency. | Engineering Lead |
| R-005 | Authors or legal stakeholders object to being suggested. | Low | High | (Future) tie to `Author-Initiated Takedown` / DSR workflow and provide opt-out. | Legal / Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AuthorTopicSignal` (ADR-0007) | Internal | Engineering | Built |
| D-002 | RAG vector search (ADR-0084) | Internal | Engineering | Built |
| D-003 | Composer deep research / key-phrase extraction (ADR-0076) | Internal | Engineering | Built |
| D-004 | Polypost Composer (ADR-0072) | Internal | Engineering | Built |
| D-005 | Story 9.10 (RAG search) | Internal | Engineering | Ready |
| D-006 | Story 11.10 (composer backend work) | Internal | Engineering | Ready |
| D-007 | Story 11.11 (backend endpoint) | Internal | Engineering | Ready |
| D-008 | Story 11.12 (frontend UI) | Internal | Engineering | Ready |

---

## 14. Acceptance Criteria

- The `POST /v1/composer/mention-suggestions` endpoint accepts `text`, `targetPlatforms`, `watchlistId`, and `maxSuggestions`.
- Suggestions include `authorId`, `authorName`, `platformId`, `publicUrl`, `handle`, `reason`, `matchSource`, and `confidence`.
- The endpoint combines `AuthorTopicSignal`, RAG, and keyword signals with `AuthorTopicSignal` weighted highest.
- Authors already mentioned in the draft are excluded.
- Only authors active on the selected `targetPlatforms` are returned.
- `maxSuggestions` defaults to 5 and is hard-capped at 10.
- Suggestions are tenant-scoped and RLS-protected.
- The composer UI displays suggestions below the text area with a 300 ms debounce.
- Each suggestion card shows the platform icon, author name, and a short reason.
- Clicking a suggestion inserts the correct mention syntax at the cursor.
- Responses are ephemeral and not persisted in v1.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `AuthorTopicSignal` | A derived data signal that measures how relevant an author is to a given topic within a tenant's listening corpus. |
| RAG (Retrieval-Augmented Generation) | A vector-search approach that finds posts semantically similar to the draft and surfaces their authors. |
| Polypost Composer | The cross-platform post composition UI for drafting and previewing outbound social posts. |
| Mention suggestion | A proposed author and handle that the user may insert into a draft post. |
| `matchSource` | The signal type used to generate a suggestion: `topic`, `rag`, or `keyword`. |
| `confidence` | A high / medium / low indicator of how likely the suggestion is relevant. |
| `targetPlatforms` | The social networks on which the composed post will be published. |
| `watchlistId` | An optional identifier that restricts suggestions to a specific watchlist. |

---

## 16. Appendices

### Reference Documents

- **ADR-0100:** `docs/adr/0100-composed-post-author-mention-suggestions.md` (Proposed, 2026-08-23)
- **Feature design:** `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- **User stories:**
  - `docs/user-stories/epic-11-adr-0095-to-0100.md`
    - Story 11.11 — Composed post author mention suggestions (backend)
    - Story 11.12 — Composed post mention suggestions UI (frontend)
- **Related ADRs:**
  - ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
  - ADR-0076: Composer Deep Research Agent
  - ADR-0084: RAG search
  - ADR-0007: `AuthorTopicSignal`

### Notes

- The source ADR-0100 is currently **Proposed**; this BRD should be updated once the ADR is accepted or revised.
- A deep-research brief matching this feature was not found in `docs/product-research/reports/`.
- There is a minor endpoint-path discrepancy between the ADR (`/v1/composer/mention-suggestions`) and the feature design's technical design section (`/v1/composer/suggest-mentions`). This BRD follows the ADR and the user stories. The ADR-0100 final wording should be the authoritative contract for implementation.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
