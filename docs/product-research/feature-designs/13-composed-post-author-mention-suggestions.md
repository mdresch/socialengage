---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-23
---

# Composed post author mention suggestions

### What it is

An AI-assisted composer capability that analyzes a drafted outbound post, identifies the topics and key phrases in it, compares those topics to the authors who are already writing about them in the tenant's listening corpus, and suggests `@mention` tags to add to the post. Suggested authors can be tagged as a **collaborator**, **person of interest**, or **source reference**, with the user choosing which to include.

### End-user benefits

- **Better reach:** tagging relevant authors can increase engagement, encourage resharing, and signal that the post is part of an ongoing conversation.
- **Context and credibility:** citing or acknowledging authors who are already active on the topic makes the post more credible and context-aware.
- **Faster discovery:** the system surfaces the right people automatically instead of the author searching manually across the listening corpus.
- **Relationship building:** users can identify potential collaborators, advocates, or journalists to engage with directly.

### Core details

- Reuses the **Polypost Composer** (`ADR-0072`) and the **Composer Deep Research Agent** (`ADR-0076`) infrastructure.
- Extracts topics and key phrases from the draft using `AIProviderConnector.research?()` or a dedicated `suggestMentions?()` method.
- Queries `AuthorTopicSignal` and the `authors` / `social_posts` tables for authors whose recent content overlaps with the draft's topics.
- Returns a ranked list of suggestions: `author.handle`, `author.name`, `author.url`, `author.platform`, `overlapScore`, `samplePostUrl`, and `suggestedRole` (`collaborator`, `person_of_interest`, `source_reference`).
- User must **approve each mention** before it is inserted; the system never auto-mentions.
- Mentions are rendered as plain-text `@handle` or, where supported, as a platform-native mention tag.

### Implementation complexity

**Medium-to-high.** The capability depends on `AuthorTopicSignal` being populated, on a stable `AIProviderConnector` contract, and on a `person-of-interest` scoring model. The heavy work is the UI (suggestion panel, explanation, one-click insert) and the privacy/ToS guardrails around suggesting authors.

### Growth and reach

This feature turns the listening corpus into an active network. It helps tenants move from passive monitoring to relationship building, advocacy, and outreach — a bridge to social selling and influencer collaboration.

---

## Technical design

- **Data flow:** user types a draft in the Polypost Composer → `POST /v1/composer/suggest-mentions` sends `text` and `targetPlatforms[]` → backend calls `AIProviderConnector.research?()` to extract key phrases and topics → `suggestMentions?()` uses the tenant's `AuthorTopicSignal` data and a lightweight vector/cosine or SQL overlap query to rank authors → returns `MentionSuggestion[]`.
- **Component interactions:** `PolypostComposer` → `MentionSuggestionsPanel` → `POST /v1/composer/suggest-mentions` → `AIProviderConnector` / `AuthorTopicSignal` store → `authorStore`. `MentionSuggestionsPanel` lets the user insert selected mentions into the draft.
- **REST/Service Bus contracts:** `POST /v1/composer/suggest-mentions` returns an array of suggestions; no Service Bus events in v1. Future: `AuthorMentionedInPostEvent` if the post is published.
- **Storage:** `AuthorTopicSignal` and `authors` are the primary sources; `social_posts` provides recency. Suggestions are ephemeral and not persisted.
- **Security considerations:** Suggestions are tenant-scoped and RLS-protected. Public author data only. No private audience or contact data. The user must confirm each mention to avoid unintended tagging.

## Backend principles

- **Tenant-scoped suggestions only.** Suggestions must come from the tenant's own listening corpus (`tenant_id` on `AuthorTopicSignal` and `authors`). Never use platform-wide indexes.
- **Opt-in, not auto-tag.** The endpoint returns suggestions; the composer UI inserts only those the user selects.
- **Do not store suggestions.** Suggestions are computed and returned; no `mention_suggestions` table in v1.
- **Contract-test targets.** Verify that suggestions are scoped to the caller's `tenant_id`, that the response includes only public author metadata, that the score is deterministic for the same input, and that the endpoint degrades gracefully when no `AuthorTopicSignal` data exists.

## Frontend / UI principles

- **User flow:** user is drafting in the Polypost Composer → clicks "Suggest mentions" → sees a side panel with ranked authors, each with a reason and a sample post → clicks "+" to insert the `@handle` at the cursor or at the end of the draft.
- **Component hierarchy:** `PolypostComposer` → `MentionSuggestionsButton` → `MentionSuggestionsPanel` → `MentionSuggestionCard` (handle, name, platform, reason, score, sample) → `DraftEditor` for insertion.
- **State management:** React state for the panel and selected suggestions; server state for `POST /v1/composer/suggest-mentions`.
- **Accessibility and responsive design:** Each suggestion card has a clear label, role, and reason; insert/remove buttons have visible focus states; the panel is keyboard-navigable and collapsible on mobile.

## Open questions

- Which scoring model should drive rank — `AuthorTopicSignal` overlap only, or also engagement, follower count, and recency?
- Should the system distinguish between authors who are *advocates* and authors who are *critics* (sentiment-aware mention suggestions)?
- How do we handle platforms where `@mentions` are not supported (e.g., some RSS/news sources)?
- Should we allow the user to save a "mention policy" per brand (e.g., never mention competitors, always include journalists)?
- What is the policy if an author has requested takedown or opted out of being tagged?
- Should this feature be available from the inbox reply composer, or only from the publishing composer?

## AI enhancements

- **Topic and intent extraction:** the AI extracts the draft's topics and the user's intent (e.g., announcement, response, question).
- **Author relevance scoring:** a lightweight model ranks authors by topic overlap, engagement, and recency.
- **Sentiment-aware suggestions:** v2 can suggest only authors with positive/neutral sentiment if the user is doing outreach, or critics if the user is doing crisis response.
- **Natural-language explanation:** each suggestion includes a one-sentence reason, e.g., "@techcrunch has posted 3 times about AI safety this week."

## Persona acceptance

- **Tenant-User (primary):** can draft a post, click "Suggest mentions," and insert relevant `@handle` tags with one click.
- **Social-Selling-Strategist (primary):** can identify and tag prospects, advocates, and journalists for outreach.
- **Tenant-Brand-Reputation-Manager (primary):** can find and acknowledge authors already discussing the topic before publishing a response.
- **Tenant-Social-Care-Agent (secondary):** can tag relevant community members or customers when replying from the inbox.
- **Author-of-a-Post (secondary):** (future) can opt out of being suggested as a mention in other tenants' drafts.

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Scoring model?** | Combine `AuthorTopicSignal` overlap, recency of posts, and engagement rate. Defer follower count as a primary signal because reach does not always equal relevance. | Influencer scoring references (HypeAuditor, Favikon) combine relevance, engagement, and activity. |
| **Advocates vs. critics?** | v1: no sentiment filter. v2: add a toggle to include only positive, neutral, or negative authors. This helps both outreach and crisis response. | Brand reputation tools use sentiment to triage who to engage. |
| **Unsupported platforms?** | For platforms without native mentions, render the handle as plain text or hide the suggestion. | Platform API documentation (Meta, LinkedIn) shows mention support is not universal. |
| **Mention policy per brand?** | v2: add a `mention_policy` JSON on `tenants` with allow/deny lists and competitor exclusion. | Enterprise SMM tools (Hootsuite, Sprout) support per-brand governance. |
| **Takedown / opt-out?** | (Future) tie to the `Author-Initiated Takedown` DSR workflow; opted-out authors do not appear as suggestions. | Data-Subject and Legal-Advisor personas require opt-out and auditability. |
| **Inbox or composer?** | v1: Polypost Composer only. v2: extend to the reply composer in `Unified Social Inbox`. | Social care workflows (VOC.AI, Sift AI) need tagging in response as well as publishing. |

### Sources consulted

- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0076: Composer Deep Research Agent
- `AuthorTopicSignal` skill (`docs/project docs/Stakeholder Management/Topic-Center-Analyst-Stakeholder-Profile.md`)
- `Influencer discovery` feature design (`05-influencer-discovery.md`)
- HypeAuditor/Favikon methodology references in `05-influencer-discovery.md`
