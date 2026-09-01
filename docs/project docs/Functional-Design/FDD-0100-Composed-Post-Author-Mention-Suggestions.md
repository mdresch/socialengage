# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0100 Composed Post Author Mention Suggestions — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0100, BRD-0100, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

**Problem:** Users drafting outbound social posts in the Polypost Composer currently have no guidance on which authors, journalists, influencers, or community members they should mention. Without this assistance, posts are often broadcast without tagging the people already shaping the conversation, reducing reach, engagement, and credibility.

This FDD translates the accepted architecture and business requirements from ADR-0100 and BRD-0100 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A backend service that accepts a draft post and returns ranked author mention suggestions.
- Three suggestion signals: `AuthorTopicSignal`, RAG semantic similarity, and keyword matching.
- Platform-aware suggestions: only authors active on the selected target platforms are returned.
- Cross-platform author deduplication with platform-specific handle rendering.
- Composer UI panel that displays suggestions with reason, platform icon, and confidence.
- One-click insertion of the correct `@handle` or platform-native mention syntax into the draft.
- Optional `watchlistId` filter to scope suggestions to a specific watchlist.
- Default and hard-capped suggestion limits (`maxSuggestions` default 5, cap 10).
- Tenant-scoped, RLS-protected responses using only public author metadata.
- **Out of scope:** - Auto-insertion of mentions without explicit user approval.
- Persistent storage of suggestion records (suggestions are computed and returned, not stored).
- Hashtag or topic suggestions beyond authors.
- Sentiment-aware filtering in v1.
- Per-brand mention policies or competitor exclusion lists.
- Author opt-out / DSR handling for being suggested.
- Inbox reply composer support in v1.
- **Assumptions and constraints:** - `AuthorTopicSignal` and `RAGConnector` are populated and available in the tenant's environment.
- Polypost Composer (ADR-0072) is already built and exposes the necessary UI hooks.
- Composer deep research / key-phrase extraction (ADR-0076) provides topic extraction.
- Users understand that suggestions are optional and must approve each one.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Composers need help finding the right people to mention
`docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md` describes a Polypost Composer feature that suggests authors to mention based on the draft message, topics, and the tenant's existing listening data.

### 2. `AuthorTopicSignal` already exists
`ADR-0007` and the `author-topic-signals` table provide expert-finding signals. The mention-suggestions feature can query this for topic-aligned authors.

### 3. RAG can find semantically similar authors and posts
`ADR-0083` and `ADR-0084` provide a vector search over post chunks. A RAG-based suggestion can find authors who have written about similar topics even if the exact keywords differ.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Increase engagement and reach of composed posts | Higher click-through, reshare, and mention response rates on posts that use suggestions |
| 2 | Improve author discovery and relationship building | Users can identify relevant collaborators, advocates, journalists, and prospects without manual search |
| 3 | Strengthen context and credibility of outbound messaging | Posts cite or acknowledge authors already active in the topic |
| 4 | Reuse existing listening and AI signals | Suggestions are driven by `AuthorTopicSignal` and RAG already built for the tenant |
| 5 | Accelerate composer workflows | Fewer context switches between listening and publishing tools |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User (primary) | Drafts posts and adds mentions | High | Fast, accurate suggestions with one-click insertion |
| Social-Selling-Strategist (primary) | Identifies prospects and advocates for outreach | High | Relevant author discovery by topic and platform |
| Tenant-Brand-Reputation-Manager (primary) | Responds to conversations and builds credibility | High | Ability to acknowledge or cite active authors |
| Tenant-Social-Care-Agent (secondary) | May reply to inbound posts in the future | Medium | (Future) tag community members or customers in replies |
| Author-of-a-Post (secondary) | May be suggested as a mention | Medium | (Future) transparent opt-out and takedown support |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 11.11 | backend engineer | `POST /v1/composer/mention-suggestions` to combine `AuthorTopicSignal`, `RAG` search, and keyword signals, | the composer can suggest relevant authors to mention. | Endpoint accepts `text`, `targetPlatforms`, `watchlistId`, and `maxSuggestions`.; Suggestions include `authorId`, `authorName`, `platformId`, `handle`, `reason`, `matchSource`, and `confidence`.; `AuthorTopicSignal`, `RAG` search, and keyword match are combined with weights. |
| 11.12 | `Tenant-User` | mention suggestions to appear as I type in the composer, | I can tag relevant people without searching manually. | Suggestions appear below the composer with a 300 ms debounce.; Each suggestion shows the platform icon, author name, and a short reason.; Clicking a suggestion inserts the correct mention syntax at the cursor. |

### 6.3 Workflow Diagrams / Steps

### 1. `POST /v1/composer/mention-suggestions` endpoint
```ts
// Request
{
  text: string;                     // current draft message
  targetPlatforms: string[];        // e.g. ['linkedin', 'x']
  watchlistId?: string;             // optional, restrict to a watchlist
  maxSuggestions?: number;          // default 5, hard cap 10
}

// Response (HTTP 200)
{
  suggestions: Array<{
    authorId: string;
    authorName: string;
    platformId: string;
    publicUrl?: string;
    handle?: string;                 // platform-specific handle, if known
    reason: string;                  // one-line why this author fits
    matchSource: 'topic' | 'rag' | 'keyword';
    confidence: 'high' | 'medium' | 'low';
  }>;
}
```

### 2. Suggestion sources
The endpoint combines up to three signals, with a configurable priority:

1. **Topic signal (`AuthorTopicSignal`)** — authors with high relevance to the topics in the draft message. Topics are extracted by the same key-phrase extraction as `ADR-0076`.
2. **RAG similarity (`ADR-0084`)** — vector search for posts semantically similar to the draft, then surface the most frequent authors of those posts.
3. **Keyword match** — direct mentions of an author's name or handle in the draft, or authors from a watchlist.

### 3. Ranking and deduplication
- Each candidate gets a score from each source.
- Final rank is a weighted combination, with `AuthorTopicSignal` weighted highest in v1.
- Duplicate authors across platforms are merged into one suggestion with a `handles` array if the author is known on multiple platforms.
- Authors already mentioned in the draft are excluded.

### 4. Target-platform filtering
- Only suggest authors who are active on the selected `targetPlatforms`.
- If the author has a known handle on a platform, `handle` is provided; otherwise the suggestion falls back to `authorName`.

### 5. UI behavior
- Suggestions appear below the composer text area as the user pauses typing (debounce 300 ms).
- Each suggestion shows the author's name, platform icon, and a short `reason`.
- Clicking a suggestion inserts the platform-appropriate mention syntax (e.g. `@handle`) into the cursor position.
- `RAG` suggestions are marked with a sparkle icon and a short `reason` like "wrote about similar topics".

### 6. Cost guards
- `maxSuggestions` defaults to 5 and is hard-capped at 10.
- RAG vector search and topic extraction are metered per request.
- A `POST` is used even though it is conceptually a read, because the request body contains the draft message.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. `POST /v1/composer/mention-suggestions` endpoint
```ts
// Request
{
  text: string;                     // current draft message
  targetPlatforms: string[];        // e.g. ['linkedin', 'x']
  watchlistId?: string;             // optional, restrict to a watchlist
  maxSuggestions?: number;          // default 5, hard cap 10
}

// Response (HTTP 200)
{
  suggestions: Array<{
    authorId: string;
    authorName: string;
    platformId: string;
    publicUrl?: string;
    handle?: string;                 // platform-specific handle, if known
    reason: string;                  // one-line why this author fits
    matchSource: 'topic' | 'rag' | 'keyword';
    confidence: 'high' | 'medium' | 'low';
  }>;
}
```

### 2. Suggestion sources
The endpoint combines up to three signals, with a configurable priority:

1. **Topic signal (`AuthorTopicSignal`)** — authors with high relevance to the topics in the draft message. Topics are extracted by the same key-phrase extraction as `ADR-0076`.
2. **RAG similarity (`ADR-0084`)** — vector search for posts semantically similar to the draft, then surface the most frequent authors of those posts.
3. **Keyword match** — direct mentions of an author's name or handle in the draft, or authors from a watchlist.

### 3. Ranking and deduplication
- Each candidate gets a score from each source.
- Final rank is a weighted combination, with `AuthorTopicSignal` weighted highest in v1.
- Duplicate authors across platforms are merged into one suggestion with a `handles` array if the author is known on multiple platforms.
- Authors already mentioned in the draft are excluded.

### 4. Target-platform filtering
- Only suggest authors who are active on the selected `targetPlatforms`.
- If the author has a known handle on a platform, `handle` is provided; otherwise the suggestion falls back to `authorName`.

### 5. UI behavior
- Suggestions appear below the composer text area as the user pauses typing (debounce 300 ms).
- Each suggestion shows the author's name, platform icon, and a short `reason`.
- Clicking a suggestion inserts the platform-appropriate mention syntax (e.g. `@handle`) into the cursor position.
- `RAG` suggestions are marked with a sparkle icon and a short `reason` like "wrote about similar topics".

### 6. Cost guards
- `maxSuggestions` defaults to 5 and is hard-capped at 10.
- RAG vector search and topic extraction are metered per request.
- A `POST` is used even though it is conceptually a read, because the request body contains the draft message.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Suggestions must be tenant-scoped and RLS-protected. | Security | Must | Contract tests verify `tenant_id` isolation. |
| NFR-002 | Suggestions must not expose private audience or contact data. | Security | Must | Only public author metadata is returned. |
| NFR-003 | Suggestion requests must complete within interactive composer response times. | Performance | Should | 95th percentile < 2 seconds under normal load. |
| NFR-004 | Suggestions are computed on demand and not persisted. | Scalability | Must | No `mention_suggestions` table in v1. |
| NFR-005 | The UI is accessible and responsive. | Usability | Should | Focus states, keyboard navigation, and mobile collapse verified. |
| NFR-006 | AI and vector search costs must be metered. | Maintainability | Should | Per-request metering is logged and budgeted. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Low-quality or irrelevant suggestions reduce user trust and adoption. | Medium | High | Combine multiple signals, include transparent `reason`, and allow users to ignore suggestions. | Product Owner |
| R-002 | Suggestions leak across tenants or expose private data. | Low | High | Enforce tenant-scoped RLS and return only public author metadata. | Engineering Lead |
| R-003 | AI / vector-search costs exceed budget. | Medium | Medium | Cap `maxSuggestions`, meter per request, and default to cost-effective signals. | Engineering Lead |
| R-004 | Handle data becomes stale, leading to broken mentions. | Medium | Medium | Rely on connector refresh cycles; document handle freshness dependency. | Engineering Lead |
| R-005 | Authors or legal stakeholders object to being suggested. | Low | High | (Future) tie to `Author-Initiated Takedown` / DSR workflow and provide opt-out. | Legal / Product Owner |

---

---

## 12. Assumptions and Dependencies

- `AuthorTopicSignal` and `RAGConnector` are populated and available in the tenant's environment.
- Polypost Composer (ADR-0072) is already built and exposes the necessary UI hooks.
- Composer deep research / key-phrase extraction (ADR-0076) provides topic extraction.
- Users understand that suggestions are optional and must approve each one.

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

---

## 13. Open Questions

- Should the endpoint also suggest hashtags or topics, not just authors?
- How is the author `handle` kept up to date across platforms? Does the connector refresh it?
- Should `confidence` be shown in the UI, or only used for ranking?
- How does the composer know the cursor position for inserting the mention?

---

---

## 14. Appendix

### Reference Documents

- ADR-0100: `docs/adr/0100-composed-post-author-mention-suggestions.md`
- BRD-0100: `docs/project docs/Business-Requirements/BRD-0100-Composed-Post-Author-Mention-Suggestions.md`
- Feature design: `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- User stories: `docs/user-stories/epic-11-adr-0095-to-0100.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0100 and BRD-0100. |