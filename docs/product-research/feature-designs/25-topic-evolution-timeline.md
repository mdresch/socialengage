---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Topic evolution timeline

### What it is

A dedicated analytics view that shows how a topic's meaning, volume, sources, and related authors have changed over time. It helps Topic-Center-Analysts and Tenant-Brand-Reputation-Managers distinguish sustained trends from short-lived noise and detect semantic drift.

### End-user benefits

- **Trend validation:** see whether a topic is growing, shrinking, or shifting in meaning.
- **Strategic insight:** understand which sources and authors are driving a topic's evolution.
- **Crisis early warning:** detect when a topic's sentiment or participant mix changes suddenly.
- **Research support:** explore the lifecycle of a conversation for reports and presentations.

### Core details

- Select a topic and a time range; the view shows a timeline of volume, sentiment, source mix, and top authors.
- "Semantic drift" highlights when the keywords or language around the topic changed.
- Users can compare two time periods side by side.
- Related posts and authors are shown for each time segment.
- The timeline is built from `social_posts`, `post_watchlist_matches`, `author_topic_signals`, and `ai_topic_clusters`.

### Implementation complexity

**Medium-to-high.** Requires time-series aggregation, topic labeling, and semantic-drift detection. The heavy part is the data pipeline and the UI for interactive timelines.

### Growth and reach

A research and strategic feature. It supports thought leadership, competitive analysis, and long-term brand tracking. High value for analyst personas.

---

## Technical design

- **Data flow:** user selects a topic and time range → `GET /v1/topics/:id/timeline` returns pre-aggregated or on-the-fly aggregations by day/week/month → backend joins `social_posts`, `post_watchlist_matches`, `author_topic_signals`, and `sentiment` data → `TopicEvolutionService` also computes semantic-drift markers → UI renders a multi-series timeline and a side panel.
- **Component interactions:** `TopicEvolutionTimeline` → `TopicTimelineService` → `social_posts` / `author_topic_signals` / `ai_topic_clusters`.
- **REST/Service Bus contracts:** `GET /v1/topics/:id/timeline?start=...&end=...&granularity=...`.
- **Storage:** v1 computes on demand from existing tables. v2 can use `TopicDailyCount` or a continuous aggregate for performance.
- **Security considerations:** Tenant-scoped; users can only see posts in their own tenant. Public author metadata is shown.

## Backend principles

- **Time-series first.** Volume, sentiment, and source mix are computed over time buckets.
- **Pre-aggregated in v2.** Continuous aggregates or `TopicDailyCount` roll-ups should be added once the feature is used heavily.
- **Semantic-drift markers.** Compute keyword or centroid shifts between adjacent time buckets to flag when the topic meaning changes.
- **Read-only and scoped.** No mutations; all data is RLS-filtered.

## Frontend / UI principles

- **User flow:** user opens a topic → selects "Evolution" tab → picks time range and granularity → sees the timeline → clicks a spike or drift marker to see representative posts.
- **Component hierarchy:** `TopicEvolutionTimeline` → `TimeRangeSelector` → `TimelineChart` → `DriftMarker` → `RelatedPostsPanel`.
- **State management:** Server state for timeline data; local state for selected time range and markers.
- **Accessibility and responsive design:** Charts have screen-reader tables; time range controls are keyboard-friendly; mobile view supports horizontal scroll for long timelines.

## Open questions

- What is the right time granularity (hour, day, week, month) and can the user change it?
- How do we define and display "semantic drift" without confusing the user?
- Should the view support comparing multiple topics simultaneously?
- Should it be a standalone screen or a tab within the dashboard/topic center?
- How far back should the timeline go, and how does retention policy affect it?

## AI enhancements

- **Drift explanation:** the AI describes in plain language how a topic's meaning has shifted, e.g., "The term 'AI' shifted from 'artificial intelligence' to 'Alberto Inc.' this week."
- **Trend summary:** the AI writes a narrative about the topic's lifecycle over the selected period.
- **Predictive warning:** the AI flags topics that are likely to spike based on velocity and acceleration.

## Persona acceptance

- **Topic-Center-Analyst (primary):** can explore a topic's volume, source mix, sentiment, and author evolution over time.
- **Tenant-Brand-Reputation-Manager (primary):** can detect when a reputation-related topic starts to drift or spike.
- **Tenant-Business-Analyst (secondary):** can export the timeline data and include it in reports.
- **Tenant-Reader (secondary):** can see a simplified explanation of the topic trend without technical details.
