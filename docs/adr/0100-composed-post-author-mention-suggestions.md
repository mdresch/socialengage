# ADR-0100: Composed post author mention suggestions

**Status:** Accepted (2026-08-28)

**Authorizes:** a `POST /v1/composer/mention-suggestions` endpoint that suggests relevant authors to mention or tag while a user is composing a post, based on `AuthorTopicSignal`, `RAG` search, and the composed message.

**Source:** `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Composers need help finding the right people to mention
`docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md` describes a Polypost Composer feature that suggests authors to mention based on the draft message, topics, and the tenant's existing listening data.

### 2. `AuthorTopicSignal` already exists
`ADR-0007` and the `author-topic-signals` table provide expert-finding signals. The mention-suggestions feature can query this for topic-aligned authors.

### 3. RAG can find semantically similar authors and posts
`ADR-0083` and `ADR-0084` provide a vector search over post chunks. A RAG-based suggestion can find authors who have written about similar topics even if the exact keywords differ.

---

## Decision

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

## Consequences

1. **Better engagement:** users are prompted to mention relevant people instead of broadcasting into the void.
2. **Reuses existing signals:** `AuthorTopicSignal` and `RAGConnector` are the engines; this is a thin orchestration endpoint.
3. **Cross-platform mentions:** the same author can be suggested with the right handle for each target platform.
4. **Optional and transparent:** users can ignore suggestions; the `reason` explains why each author was suggested.

---

## Alternatives considered

1. **Suggest only by keyword match in the draft.**
   - *Rejected:* it misses semantically related authors. `AuthorTopicSignal` and RAG provide better discovery.

2. **Pre-compute a mention graph for every tenant.**
   - *Rejected:* it adds a large derived table. Real-time or near-real-time suggestion is simpler and more flexible.

3. **Suggest only authors from a specific watchlist.**
   - *Rejected:* it is too restrictive. `watchlistId` is optional; the default uses the whole tenant corpus.

---

## Open questions

- Should the endpoint also suggest hashtags or topics, not just authors?
- How is the author `handle` kept up to date across platforms? Does the connector refresh it?
- Should `confidence` be shown in the UI, or only used for ranking?
- How does the composer know the cursor position for inserting the mention?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0076` (composer deep research, key-phrase extraction), `ADR-0084` (RAG search), `ADR-0007` (`AuthorTopicSignal`), `ADR-0072` (Polypost Composer)
