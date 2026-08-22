---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Dashboards and analytics

### What it is
Visual, interactive views of listening data: volume, sentiment, sources, topics, authors, and engagement over time.

### End-user benefits
- **At-a-glance brand health:** no need to export data to build charts.
- **Stakeholder reporting:** shareable dashboards for executives and clients.
- **Decision support:** spot trends and compare performance.

### Core details
- Epic 8 (Analytics Dashboard) is already built: Overview, Sentiment, Conversations, Sources, Language, Location.
- Widgets are client-side aggregated from `GET /v1/posts` and `enrichment`, keeping backend changes minimal per ADR-0054.
- Future depth: watchlist-coverage, topic breakdowns, and per-asset performance.

### Implementation complexity
**Low-to-medium for v1; medium for depth.** The dashboard scaffold exists. New widgets mostly consume existing endpoints. Heavy aggregation or time-series tables would require revisiting ADR-0008's "no `TopicDailyCount`" deferral.

### Growth and reach
Dashboards are a retention and sales tool. They make the value of ingestion visible immediately, especially for non-analyst buyers.

---

## Technical design

- **Data flow:** user opens dashboard → frontend fetches `GET /v1/posts` with filter params (watchlist, provider, date, language, location) → client-side aggregation (Epic 8, ADR-0054) computes widget data → widgets render with recharts/d3. Future heavy aggregation can be backed by server-side endpoints or materialized views.
- **Component interactions:** `GET /v1/posts` already supports filtering and cursor pagination; Epic 8 widgets (Overview, Sentiment, Conversations, Sources, Language, Location) are React components reading from the same endpoint.
- **REST/Service Bus contracts:** `GET /v1/posts` with query params, `GET /v1/watchlists` for filter lists; optional `DashboardSnapshot` export endpoint.
- **Storage:** `social_posts` and `enrichment` JSONB are the primary sources; `ingestion_runs` for health; no time-series aggregation table in v1 (ADR-0008 defers `TopicDailyCount`).
- **Security considerations:** RLS on `social_posts`; dashboard filters are user-visible only if the user has access to the watchlist/provider; export/download must respect RLS.

## Backend principles

- **Client-side aggregation for v1.** ADR-0054 intentionally keeps backend changes minimal: new widgets are frontend data transformations over existing `GET /v1/posts` responses. This avoids speculative aggregation tables.
- **Server-side boundaries.** If widgets require pre-aggregation in the future, add new `GET /v1/analytics/*` endpoints that still return tenant-scoped, paginated data and do not bypass RLS.
- **Postgres + RLS.** All dashboard data originates from RLS-protected `social_posts`. Caching layers (e.g., `ConnectorHealth` read cache) must re-apply RLS or store no PII.
- **Contract-test targets.** Verify dashboard widgets render correctly with filtered `GET /v1/posts`, that date/locale filters work, and that exporting a widget does not expose cross-tenant data.

## Frontend / UI principles

- **User flow:** user lands on Analytics → selects a watchlist and date range → sees Overview → drills into Sentiment/Sources/Conversations tabs.
- **Component hierarchy:** `DashboardPage` → `DashboardFilters` → `WidgetGrid` → `OverviewWidget`, `SentimentWidget`, `SourcesWidget`, `ConversationsWidget`, `LanguageWidget`.
- **State management:** URL-driven filter state; React Query/cached `GET /v1/posts`; widget state derives from filtered posts.
- **Accessibility and responsive design:** Charts have alt text/labels, color-blind palettes, keyboard-focusable data points, and responsive stacking on mobile.

## Open questions

- Which widgets beyond Epic 8 are needed for v2 (Topic, Influencer, Engagement, Share of Voice)?
- When do we move from client-side to server-side aggregation for performance?
- Should dashboards be shareable as public links or only in-app for tenant users?
- How do we handle time zones and date grouping consistently?
- Do we pre-compute `TopicDailyCount` or other roll-up tables, and if so, when?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **v2 widgets?** | Add **Share of Voice**, **Topic breakdown**, **Top Influencers**, and **Engagement rate** widgets. These are the next four expected by enterprise buyers. Defer share-of-voice comparison until multi-watchlist is stable. | Brand24's dashboard has share of voice, topic analysis, reach, and influencer widgets; Keyhole offers post volume, reach, engagement, sentiment, and influential users; Hootsuite Lumen/CisionOne include topic, influencer, and share-of-voice views. |
| **Client-side vs. server-side aggregation?** | Stay **client-side while `GET /v1/posts` returns < ~5,000 posts per dashboard view**. Move to **pre-aggregated rollups/materialized views** when (a) p99 latency exceeds 500 ms, (b) users frequently request 30+ day ranges, or (c) concurrent users exceed ~50. Use continuous aggregates (e.g., `TopicDailyCount`) at that point. | DEV article on dashboards says push heavy/repeatable summaries to the backend; Stream feeds show fan-out-on-read vs. materialized feed tradeoffs; Twitter's TSAR paper describes the value of pre-aggregated time series for dashboards. |
| **Public shareable links?** | **In-app only for v2**. Public links are a future feature. They require signed URLs, tenant branding, and careful RLS enforcement. Building public sharing before RBAC is solid is risky. | Brand24 offers shareable links but with explicit sharing controls; most enterprise tools keep dashboards tenant-internal until public sharing is a paid feature. |
| **Time zones and grouping?** | Store `published_at` as **UTC** in `social_posts`. Allow a per-tenant or per-user `display_timezone` setting. Date grouping is computed in the user's TZ at query time for v1; move to pre-bucketed aggregates in v2. | Standard time-series practice; Azure OpenAI/Postgres both support AT TIME ZONE. |
| **Pre-compute `TopicDailyCount`?** | **Defer**. ADR-0008 already defers topic-time-series tables. Build `TopicDailyCount` or `SourceDailyCount` only after dashboard widgets demand 30+ day time-series and client-side aggregation becomes a bottleneck. | ADR-0008 "no `TopicDailyCount`" deferral; DEV article recommends materialized views only when queries are repeatable; Twitter TSAR built time-series aggregation at scale. |

### Sources consulted

- Brand24: social listening dashboard — https://brand24.com/social-listening-dashboard/
- Keyhole: social listening dashboard — https://help.keyhole.co/en/articles/11681386-social-listening-dashboard
- Hootsuite Lumen — https://www.hootsuite.com/lumen
- Hootsuite result widgets — https://help.hootsuite.com/s/article/result-widgets
- CisionOne Social Analyze — https://cision.atlassian.net/wiki/spaces/CSM/pages/25747588008/CisionOne+Social+-+Analyze
- DEV: optimizing dashboard performance — https://dev.to/beefedai/optimizing-dashboard-performance-for-millions-of-data-points-2793
- Stream: activity feed architecture — https://getstream.io/blog/scalable-activity-feed-architecture/
- Twitter TSAR paper — https://cs.uwaterloo.ca/~jimmylin/publications/Yang_etal_SIGMOD2018.pdf
- AAAI: hybrid browser/server social data collection — https://ojs.aaai.org/index.php/ICWSM/article/view/14353

## Persona acceptance

- **Tenant-Reader (primary):** can understand every widget at a glance; all numbers include plain-language labels and short explanations.
- **Tenant-Business-Analyst (primary):** can filter the dashboard by watchlist, date, source, and language, and export the underlying data for deeper analysis.
- **Topic-Center-Analyst (primary):** can add topic, influencer, and share-of-voice widgets to investigate trends.
- **Platform-Admin (primary):** can see platform-wide usage, cost, and connector-health widgets without exposing tenant content.
- **Tenant-Brand-Reputation-Manager (secondary):** can see crisis KPIs (negative sentiment, reach, source breakdown) on a dedicated tab.
- **Tenant-User (secondary):** can customize their default dashboard view and share it within the tenant.

## AI enhancements

- **AI Spike Storyteller:** automatically explain why a metric changed (ADR-0062).
- **Natural-language analytics:** ask “what was the most negative topic last week?” and get a chart + summary.
- **Anomaly and forecast:** time-series detection of unusual patterns and forward-looking projections.
- **Automated insight cards:** the AI surfaces the top 3 takeaways from a dashboard view.
