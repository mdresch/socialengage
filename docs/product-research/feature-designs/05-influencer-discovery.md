---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Influencer discovery

### What it is
Identifying accounts and authors who drive conversations, scored by reach, engagement, topical relevance, and audience fit.

### End-user benefits
- **Better outreach lists:** find advocates and detractors with real authority on a topic.
- **Campaign planning:** know who matters before launching a partnership.
- **Crisis context:** distinguish a single angry user from a high-reach account escalating a complaint.

### Core details
- The `Author` table already normalizes authors per platform (`author.name`, `author.url`, `author.follower_count` on `SocialPost`).
- Influencer scoring needs a new derived model: `AuthorTopicSignal` already captures raw signals; a computed `influence_score` could be layered on top.
- Scoring inputs: follower count, mention volume, engagement, watchlist relevance, and network amplification.

### Implementation complexity
**Medium-to-high.** The data is there; the harder part is defining a defensible, explainable scoring algorithm and adding the UI for discovery, lists, and export. There are also platform-terms considerations for storing public author metadata.

### Growth and reach
Influencer discovery opens a second buyer: PR, partnerships, and advocacy teams. It also justifies higher seat pricing.

---

## Technical design

- **Data flow:** `social_posts` and `author_topic_signals` provide raw inputs (follower count, mention volume, engagement, topical overlap) → scheduled refresh or materialized view computes `influence_score` per `Author`/`topic` → `GET /v1/topics/:topic/authors` returns ranked authors.
- **Component interactions:** `AuthorTopicSignal` refresh is already a scheduled `pg_cron` job (Story 4.x/derived-data-caching-and-refresh). Influencer scoring can extend that job or become a separate `pg_cron`-backed derived-data task.
- **REST/Service Bus contracts:** `GET /v1/authors` and `GET /v1/topics/:topic/authors` endpoints; optional `AuthorInfluenceChangedEvent` if real-time ranking is needed.
- **Storage:** `authors` table (RLS by tenant) with `follower_count`; `author_topic_signals` for raw signals; a new `author_influence_scores` materialized/derived table or JSONB within `author_topic_signals`.
- **Security considerations:** only public author metadata; do not store private audience data (emails, DMs). Respect platform ToS for author scraping; `tenant_id` RLS on all derived tables.

## Backend principles

- **Derived data, not live queries.** Influence scores are expensive and should be pre-computed during the existing `AuthorTopicSignal` refresh rather than computed on every `GET`.
- **Explainable scoring.** The algorithm must be documented and testable: each score is a function of measurable, tenant-scoped signals, not a black-box model.
- **Postgres + RLS.** Any new `author_influence_scores` table must be `tenant_id`-scoped and RLS-protected, using the same pattern as `author_topic_signals`.
- **Contract-test targets.** Verify scoring is deterministic for the same input, does not leak across tenants, and that `GET /v1/topics/:topic/authors` respects the `tenant_id` filter.

## Frontend / UI principles

- **User flow:** user selects a watchlist/topic → sees ranked authors → filters by platform, reach, engagement → saves authors to lists → exports lists.
- **Component hierarchy:** `InfluencerExplorer` → `AuthorRankList` → `AuthorCard` (reach, engagement, relevance) → `InfluencerListManager` (save/rename/export).
- **State management:** Server-side ranking and pagination; client-side filters and saved lists.
- **Accessibility and responsive design:** Rank list uses semantic table/list, sort headers are keyboard-focusable, cards have clear labels and avoid color-only cues.

## Open questions

- Which public author metadata can we store without violating platform ToS?
- Is the scoring model fully deterministic, or do we allow tenant-specific weights?
- Do we need real-time updates, or is a daily/weekly refresh acceptable?
- Should influencer lists be shareable within a tenant or private to the user?
- How do we handle "author as a brand page" vs. "author as an individual" disambiguation?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Author metadata and ToS?** | Store only **public profile and public-post data**: handle, display name, bio, follower count, engagement rate, public content, and public audience-interest categories. Do **not** store DMs, emails, private audience data, or raw creator contact info. Platform APIs generally limit access to public accounts above a follower threshold. | Meta Content Library exposes public creator/business accounts and public posts; Influencers Club licenses "Creator Data" only for legitimate business purposes and prohibits resale/redistribution; SocialCrawl permits dashboards/derived views but restricts raw passthrough. |
| **Deterministic vs. tenant-specific weights?** | Start with a **transparent, deterministic weighted score** (e.g., engagement 30%, authenticity 25%, relevance 20%, consistency 15%, growth 10%) and document it. Allow tenants to override weights up to ±50% in `tenant_settings` after v1. | HypeAuditor and Favikon combine weighted signals; the Apify influencer-discovery reference uses a weighted 5-factor model; a related patent describes deterministic scoring with authority/influence components. |
| **Real-time or daily/weekly refresh?** | **Daily refresh** is sufficient for v1. Influencer authority does not change minute-by-minute. Offer an on-demand "refresh" button; move to more frequent refresh only when customers pay for it. | SocialCrawl and HypeAuditor use cached/periodically refreshed data; Favikon scores are derived from aggregated public signals, not live streams. |
| **Shareable influencer lists?** | **Tenant-shared by default**, with a `private` flag. Influencer discovery is a team use case (PR, partnerships, advocacy). Keep RLS on the list and the underlying author data. | Creator databases and outreach tools are typically team resources; sharing lists is a core value for PR and agency teams. |
| **Brand page vs. individual?** | Store `author_type` (personal, creator, business, news, unknown) on `Author` and use it in scoring. Do not merge a brand page and an individual unless a high-confidence link exists (handle, URL, verified cross-link). | Meta Content Library returns `account_types` (`creator`, `business`, `personal`); Google for Creators distinguishes verified creators from brands. |

### Sources consulted

- Meta Content Library: Instagram accounts — https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/ig-accounts/
- Meta Content Library overview — https://developers.facebook.com/docs/content-library-and-api/content-library-api/overview/
- Influencers Club terms — https://influencers.club/terms-of-service/
- Influencers Club Discovery API — https://docs.influencers.club/openapi/discovery-api
- SocialCrawl influencer discovery API — https://www.socialcrawl.dev/solutions/influencer-discovery-api
- HypeAuditor methodology — https://hypeauditor.com/how-calculate-influencer-rankings/
- Favikon methodology — https://www.favikon.com/rankings/favikon-methodology-influence-scores
- Apify influencer-discovery reference — https://github.com/casper-studios/casper-marketplace/blob/main/plugins/bizdev/research/skills/apify-scrapers/references/workflows/influencer-discovery.md
- Google for Creators — https://creators.google/profile
- Influencer scoring patent — https://patents.google.com/patent/US20220164406A1

## Persona acceptance

- **Social-Selling-Strategist (primary):** can build a prospecting list of relevant authors, score by engagement/authenticity/relevance, and export to CSV for outreach or CRM.
- **Topic-Center-Analyst (primary):** can see the most influential authors around a topic, investigate their recent content, and track how their influence changes.
- **Tenant-Brand-Reputation-Manager (primary):** can identify high-reach authors who are amplifying or attacking the brand and receive alerts on sudden influence spikes.
- **Tenant-Business-Analyst (secondary):** can export author signal data and correlate it with other business dimensions.

## AI enhancements

- **AI scoring model:** learn from historical engagement and relevance to rank authors.
- **Bot/fake-follower detection:** the AI flags inauthentic engagement.
- **Lookalike author recommendations:** given one high-value author, the AI suggests similar ones.
- **Topical relevance matching:** score an author’s recent content against a watchlist or campaign theme.
