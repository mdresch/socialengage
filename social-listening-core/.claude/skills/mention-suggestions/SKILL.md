---
name: mention-suggestions
description: Backend service and endpoint for suggesting relevant author mentions in outbound composer drafts.
---

# Composed Post Mention Suggestions Service

Governed by **ADR-0100**, **BRD-0100**, **FDD-0100**, and **Story 11.11**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.11.mention-suggestions.contract.test.ts` — Story 11.11 contract test.

## Key Architecture & Responsibilities

1. **Algorithm & Ranking**:
   - Accepts draft `text`, `targetPlatforms`, optional `watchlistId`, and `maxSuggestions` (default 5, capped at 10).
   - Combines three weighted relevance signals:
     - `AuthorTopicSignal` match (weight: 0.50)
     - `RAG` / Semantic relevance (weight: 0.30)
     - `Keyword` token match (weight: 0.20)
   - Excludes authors already mentioned in the draft (by handle or name).
   - Filters authors to only those active on the selected `targetPlatforms`.
   - Deduplicates across platforms and sorts by combined `confidence DESC`.

2. **Endpoint**:
   - `POST /v1/composer/mention-suggestions`
   - Response payload:
     ```json
     {
       "suggestions": [
         {
           "authorId": "uuid",
           "authorName": "Alice Smith",
           "platformId": "linkedin",
           "handle": "alice-smith",
           "reason": "Top contributor on #ai",
           "matchSource": "topic",
           "confidence": 0.95
         }
       ]
     }
     ```

## Relations to other components

- **`author-topic-signals` skill** — the highest-weighted signal (0.50) for mention suggestions; `author_topic_signals` rows identify authors strongly associated with topics in the draft text.
- **`rag-vector-rls` / `rag-connector` skill** — semantic RAG relevance (weight 0.30) uses the tenant-scoped vector index to surface authors whose content is semantically close to the draft.
- **`social_posts` table** — author platform activity is derived from post history; only authors with posts on the requested `targetPlatforms` are returned.
- **`composer-research` skill** — the mention suggestions endpoint is called from the Polypost Composer (Story 6.41/ADR-0076) during draft authoring to surface relevant @-mention candidates.
- **`outbound-publishing` skill** — mention suggestions inform the draft before the post is submitted through the outbound publishing pipeline.
