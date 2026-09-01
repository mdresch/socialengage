# ADR-0087: Preconfigured analytics views

**Status:** Accepted (2026-08-27)

**Acceptance note (2026-08-27):** Accepted by Menno, verbatim: *"please accept hereby approval for ADR 0087."* Accepted as revised — all four in-place, pre-acceptance revisions are in effect, not just the original 2026-08-23 draft: corrected the ADR-0008 citation and added its required "Pending supersession note" (first pass); resolved the topic-ID/topic-merge open questions via ADR-0104, documented `sum_reach`'s real source and NULL semantics, flagged the ADR-0054 relationship (second pass); added Decision §8 resolving the ADR-0054 relationship as a scoped, widget-by-widget partial supersession, with a matching note added to ADR-0054 (third pass); and confirmed `sum_engagement` as Facebook-only for v1 (fourth pass) — see the Revision notes below for the full record. Story 10.3 (`docs/user-stories/epic-10-adr-0086-to-0094.md`) moves to **Ready**. `docs/adr/0008-defer-topic-time-series-and-charting.md`'s 2026-08-27 "Pending supersession note" and `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md`'s 2026-08-27 "Pending supersession note" both gain their matching "Supersession update" notes, per `docs/adr/README.md`'s own governance-table convention.

**Authorizes:** a family of tenant-scoped, precomputed daily aggregate tables (`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`) and the refresh/query-routing rules that keep dashboards and analytics fast without scanning `social_posts` at request time.

**Source:** `docs/product-research/feature-designs/27-preconfigured-analytics-views.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Dashboards and analytics need fast aggregation
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and `docs/product-research/feature-designs/25-topic-evolution-timeline.md` require time-series and grouped metrics over large post volumes. Computing these on every page load by scanning `social_posts` becomes slow and expensive as tenants accumulate data.

### 2. `ADR-0008` deferred exactly this table — this ADR is the future subsystem it anticipated
`ADR-0008` ("Defer `TopicDailyCount` aggregation and all charting to a future subsystem," Accepted 2026-07-28) explicitly declined to build a `TopicDailyCount` aggregation table, endpoint, or charting UI inside the `social-listening-core` ingestion subsystem, reserving that work for a future analytics/insights subsystem once real dashboard requirements existed. This ADR is that future subsystem's aggregation layer. See Decision §1 for how this ADR formally supersedes ADR-0008's aggregation-table clause, following the same governance pattern ADR-0054 already used for its own narrower supersession of ADR-0008's charting-UI clause.

### 3. Existing tables and events can drive the aggregates
`social_posts`, `post_watchlist_matches`, `author_topic_signals`, and the `SocialPostIngestedEvent` stream contain everything needed to refresh daily counts, **with the exception of a universal per-post engagement metric — see Open Questions.** A `pg_cron` job or a scheduled worker can maintain the views without touching the ingestion hot path.

### 4. `ADR-0054` already built a client-side alternative for the one dashboard that exists today
`ADR-0054` (Accepted 2026-08-17) authorized the Tenant Analytics Dashboard (Epic 8, Stories 8.1–8.10, already built) on a deliberately opposite architecture: zero backend aggregation, computed entirely client-side over paginated `GET /posts`. This ADR does not resolve how the two relate — see Open Questions.

---

## Decision

### 1. Relationship to ADR-0008: full supersession of the `TopicDailyCount` deferral

This ADR supersedes `ADR-0008`'s Decision clause "Do not build a `TopicDailyCount` aggregation table, endpoint... in this subsystem" — it builds exactly that table (among four siblings). ADR-0008's "...or any charting UI" clause is untouched by this ADR; that clause already carries its own separate, narrower, already-realized supersession via ADR-0054 (client-side charting only, zero backend aggregation). A dated "Pending supersession note" naming this has been added to ADR-0008 itself, per this project's own governance-table convention (`docs/adr/README.md`) and the exact precedent ADR-0054 set on the same file. On acceptance, that note gains a matching "Supersession update," the same way ADR-0054's did.

### 2. New daily aggregate tables
```sql
TopicDailyCount (
  tenant_id uuid,
  date date,
  topic_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  avg_sentiment_score numeric,
  unique_authors int
);

SourceDailyCount (
  tenant_id uuid,
  date date,
  platform_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  avg_sentiment_score numeric
);

AuthorDailyCount (
  tenant_id uuid,
  date date,
  author_id uuid,
  platform_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint
);

SentimentDailyCount (
  tenant_id uuid,
  date date,
  sentiment text,        -- 'positive' | 'negative' | 'neutral' | 'mixed'
  count int,
  sum_reach bigint
);

WatchlistDailyCount (
  tenant_id uuid,
  date date,
  watchlist_id uuid,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  unique_authors int
);
```

- **`sum_reach`'s real data source is `social_posts.author_follower_count_at_publish` (ADR-0049)** — a point-in-time follower-count snapshot, not a new field. That column is documented as NULL by design for organization-as-Author connectors with no subscriber concept (Newswire, GNews, Wikipedia — a large share of this platform's real content sources). Postgres's `SUM()` already skips NULLs, so `sum_reach` is correctly read as *"sum of known reach, over posts that report one,"* not *"total reach across all posts in `count`."* Any consumer computing an average reach per post must not divide by `count` — it would be systematically deflated for tenants with many organization-as-Author posts. If a per-bucket average-reach metric is needed later, add a `count_with_known_reach` column rather than assuming `count` is the right denominator.
- **`sum_engagement` is Facebook-only for v1** (Open Questions) — `NULL` for every other connector's posts, the same partial-coverage treatment as `sum_reach` above. Do not treat this column as populated for non-Facebook posts.
- **`topic_id` foreign-keys to `ADR-0104`'s `topics` catalog** (AI topic clustering, `TopicClusteringService`), not to `AIProviderConnector` or to `watchlists` — see Decision §7.

### 3. Composite primary keys and indexes
- Primary keys are `(tenant_id, date, ...)` for each table, with a `tenant_id` RLS policy.
- Indexes on `(tenant_id, date)` and `(tenant_id, watchlist_id, date)`.
- Tables are unlogged/batch-optimized where possible; refresh is idempotent.

### 4. Refresh pipeline
- A `RefreshAnalyticsViews` worker runs every 15 minutes via `pg_cron`.
- It computes new rows by selecting posts with `published_at` in a window and `updated_at` after the last refresh.
- Late-arriving posts trigger a re-computation for the affected `(tenant_id, date)` buckets.
- For the current partial day, the worker may compute a provisional row and overwrite it on the next run — see §5 for how this combines with query-time fallback. (This resolves what was previously an Open Question, restated here rather than left as open when the Decision already answers it.)

### 5. Query routing
- Dashboard and analytics endpoints prefer the preconfigured tables for full days.
- For the current partial day, or when a user drills down to individual posts, they fall back to `social_posts` with a small limit.
- `GET /v1/analytics/:view` exposes views: `topics`, `sources`, `authors`, `sentiments`, `watchlists`.

### 6. No raw post bodies in aggregates
Aggregate rows contain counts, sums, and identifiers only. The `watchlist_id` list may be included for `WatchlistDailyCount`, but no `post_id` list and no `rawPayload`.

### 7. Topic ID sourcing and merge semantics (per `ADR-0104`)
- `topic_id` values come from `ADR-0104`'s `topics` catalog, populated by `TopicClusteringService` — not `AIProviderConnector` and not user-defined `watchlists`, resolving what was previously an open question here with the wrong two candidate answers listed.
- Topic merges are **not backfilled** into historical `TopicDailyCount` rows — per `ADR-0104` §6, a merged topic's counts start fresh from the merge date; pre-merge rows keep their original `topic_id`. `ADR-0097` (Topic Evolution Timeline) independently lists the same question as open — it should converge on this answer rather than carry a separate unresolved copy of it.

### 8. Relationship to ADR-0054: a scoped, partial supersession of the client-side data-source strategy — not a replacement of the dashboard

`ADR-0054` (Accepted 2026-08-17) authorized the Tenant Analytics Dashboard (Epic 8) on a 100% client-side aggregation strategy — every widget computed in `social-listening-admin` from paginated `GET /v1/posts`, with its own Decision §3 stating that no new `social-listening-core` endpoint "is authorized or required." `ADR-0062` already partially superseded that clause once, narrowly, for one endpoint (`POST /v1/posts/explain-spike`, the AI Spike Storyteller). This ADR is a second, larger partial supersession of the same clause — scoped precisely, widget by widget, not a wholesale replacement of Epic 8's architecture or a reversal of ADR-0062's own supersession.

**Widgets that can move to `GET /v1/analytics/:view` (Decision §5), once this ADR is accepted and a follow-up Epic 8 story retires their client-side computation:**
- Overview: total post count, sentiment split, source breakdown (Stories 8.1/8.4) → `SentimentDailyCount` + `SourceDailyCount`.
- Sentiment tab: sentiment donut and day-bucketed sentiment-over-time chart (Story 8.2) → `SentimentDailyCount`. The highest-value move — this is the one widget that requires paging every post in the selected range today.
- Overview: period-over-period comparison (Story 8.4) → a second rollup query over the prior range, replacing a second full paginated fetch.
- Sources tab: per-source volume-over-time chart (Story 8.6) → `SourceDailyCount`.
- Overview: Sentiment Trajectory, inline Sentiment Gauge, and the Volume & Projections Timeline's "actual" series (Story 8.7) → `SentimentDailyCount`/`SourceDailyCount` rollups. (The forecast series stays client-side math either way.)
- Overview: Authors-by-Source unique-author counts and Top Authors (Story 8.7) → `AuthorDailyCount`. Ranking by `sum_engagement` inherits this ADR's own open `sum_engagement`-coverage question (Open Questions) until that's resolved.
- Watchlist Coverage widget (Story 8.9) → `WatchlistDailyCount` — the closest one-to-one match of any widget in the dashboard to any table this ADR defines.

**Widgets that stay exactly as ADR-0054 decided — 100% client-side, untouched by this ADR:**
- Sources tab per-source sentiment split, and Top Fans/Top Critics (Stories 8.1/8.2/8.6) — no table here carries a sentiment-by-author or full sentiment-split-by-source cross-tab; only a single `avg_sentiment_score` per source (§2), whose derivation this ADR does not yet define.
- The key-phrase word cloud and phrase-frequency chart, and the Languages breakdown widget (Stories 8.3/8.5/8.7) — no phrase or language dimension exists in any table this ADR defines.
- AI Spike Storyteller (Story 8.8) — needs raw post title/body text; this ADR's aggregates explicitly carry no raw content (Decision §6). Already governed by ADR-0062's own separate supersession note on ADR-0054, unaffected by this one.
- Location & Geospatial Insights (Story 8.10) — no geo/country dimension in any table this ADR defines.
- Crisis Alert Radar's 48-hour rolling window (Story 8.7) — day-bucketed tables don't serve a sliding sub-day window cleanly; this stays live/client-side for its trailing ~2 days, the same way Decision §5 already routes the current partial day to `social_posts` rather than the tables.

**Unaffected regardless of which widgets move:** every click-to-filter/drill-down interaction that opens the Slideover post list still calls `GET /v1/posts` — this ADR's tables never store a `post_id` list (Decision §6), so browsing the actual matching posts was never something these tables were meant to replace.

`docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md` gains a dated "Pending supersession note" on its own Decision §3, pointing to this ADR, following the exact convention ADR-0062 already used on the same clause — it does not edit ADR-0054's Decision/Consequences text, and only takes effect once this ADR is accepted. Actually retiring the affected widgets' client-side computation is separate follow-up Epic 8 implementation work, not authorized or performed by this ADR itself.

---

## Consequences

1. **Faster dashboards:** chart data loads from small, indexed tables instead of scanning large post tables.
2. **Predictable cost:** aggregation is done once at refresh time, not on every page view.
3. **Bounded freshness:** data may be up to 15 minutes behind real-time ingestion for the current day.
4. **Storage growth:** aggregate tables are much smaller than raw posts but still accumulate over time. Retention policy is deferred.
5. **Foundation for v2:** `25-topic-evolution-timeline`, `21-ad-hoc-query-endpoint`, and `08-dashboards-and-analytics` all consume these views. `ADR-0097` and `ADR-0104` already do, as Proposed ADRs written against this one.
6. **Full supersession of ADR-0008's aggregation-table clause** — see Decision §1 and the corresponding note now on ADR-0008 itself.
7. **`sum_reach` and `sum_engagement` are only partially covered by design, not by omission** — `sum_reach` is `NULL` for organization-as-Author connectors, `sum_engagement` is Facebook-only (Decision §2, Open Questions). Any UI or endpoint consuming these columns needs to account for that, not assume full coverage.
8. **Partial supersession of ADR-0054's client-side strategy for a named subset of Epic 8 widgets** — see Decision §8 and the corresponding note now on ADR-0054 itself. Migrating those widgets is separate follow-up implementation work this ADR does not perform.

---

## Alternatives considered

1. **Use Postgres continuous aggregates (TimescaleDB).**
   - *Rejected:* it adds a new extension and operational complexity. Plain tables with a scheduled worker are simpler for a solo project.

2. **Compute everything on demand from `social_posts` and cache the result.**
   - *Rejected:* it does not reduce cost for repeated views and requires a cache invalidation strategy. Precomputed tables are more predictable.

3. **Precompute at ingestion time per post.**
   - *Rejected:* it couples analytics to the ingestion hot path and would slow ingestion. A separate worker is decoupled and retryable.

---

## Open questions

- ~~Should the current partial-day row be real-time or excluded until the next refresh?~~ **Resolved above** (Decision §4): a provisional row is computed and overwritten on the next run, with query-time fallback to `social_posts` for the partial day (§5) — this was already answered by the Decision text, not actually open.
- ~~Should `TopicDailyCount` derive topic IDs from `AIProviderConnector` or from user-defined `watchlists`?~~ **Resolved** (Decision §7): neither — from `ADR-0104`'s `topics` catalog.
- ~~How are topic merges reflected in historical daily counts?~~ **Resolved** (Decision §7): not backfilled, per `ADR-0104` §6. `ADR-0097` should converge on this rather than carry its own separate open copy of the same question.
- How far back should daily aggregates be retained, and how does that relate to `ADR-0018` raw-payload retention? *(Still open — genuinely unresolved, no change.)*
- ~~UNRESOLVED — relationship to `ADR-0054`'s already-shipped client-side dashboard.~~ **Resolved** (Decision §8): a scoped, widget-by-widget partial supersession, not a wholesale replacement. Several Overview/Sentiment/Sources/Watchlist widgets move to these tables; several others (word cloud, languages, Top Fans/Critics, Spike Storyteller, Location) stay exactly as ADR-0054 decided, since no table here carries phrase, language, per-author-sentiment, or geo data. Drill-down into actual posts stays on `GET /v1/posts` regardless. `ADR-0054` gains a matching "Pending supersession note."
- ~~`sum_engagement`'s real data source?~~ **Resolved (2026-08-27): Facebook-only for v1.** Confirmed by Menno, verbatim: *"true accept sum_engagemetn as facebook only."* No per-post engagement metric (likes/shares/comments) exists today for the majority of real connectors (GNews, Newswire, tenant-owned-feed, Wikipedia, search-derived posts) — only Facebook Page posts carry one (Story 2.18). `sum_engagement` ships Facebook-only, reporting `NULL` for every other connector's posts — the same documented partial-coverage treatment `sum_reach` already gets for organization-as-Author connectors (Decision §2). Building a universal per-post engagement-capture mechanism across every connector remains deferred, consistent with this project's standing precedent against building ahead of demonstrated need (ADR-0020).

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs:
  - `ADR-0008` — deferred `TopicDailyCount` to a future subsystem; superseded here (`docs/adr/0008-defer-topic-time-series-and-charting.md`)
  - `ADR-0015` — tenant RLS
  - `ADR-0018` — retention (open question above)
  - `ADR-0049` — source of `author_follower_count_at_publish`, the real backing field for `sum_reach`
  - `ADR-0054` — Tenant Analytics Dashboard, client-side architecture; scoped partial supersession, see Decision §8
  - `ADR-0104` — AI topic clustering post-topics schema; source of `topic_id` and the topic-merge answer
  - `ADR-0097` — Topic Evolution Timeline; downstream consumer of these tables, carries a duplicate open question this ADR now resolves

---

*Revised 2026-08-27 (pre-acceptance), second pass, per architectural review: corrected the ADR-0008 citation (was mislabeled "SocialPost Enrichment"; it's the ADR that specifically deferred `TopicDailyCount`) and added the required "Pending supersession note" to ADR-0008 itself; resolved the topic-ID-sourcing and topic-merge open questions by citing ADR-0104's existing answers; documented `sum_reach`'s real source (ADR-0049) and its NULL semantics for organization-as-Author connectors; flagged that `sum_engagement` has no universal real data source; flagged the unresolved relationship to ADR-0054's already-shipped client-side dashboard; removed the partial-day open question since the Decision text already answers it; added ADR-0049/0054/0104/0097 to Footnotes.*

*Revised 2026-08-27 (pre-acceptance), third pass: resolved the ADR-0054 relationship — added Decision §8, a scoped, widget-by-widget partial supersession of ADR-0054's client-side data-source strategy (Overview/Sentiment/Sources/Watchlist-Coverage widgets move to these tables; word cloud, languages, per-author sentiment, Spike Storyteller, and Location stay client-side, since no table here covers phrase, language, per-author-sentiment, or geo data; post drill-down stays on `GET /v1/posts` regardless) — and added the required matching "Pending supersession note" to ADR-0054's own Decision §3, alongside ADR-0062's existing one on the same clause.*

*Revised 2026-08-27 (pre-acceptance), fourth pass: resolved the last open item — `sum_engagement` confirmed Facebook-only for v1, `NULL` elsewhere, matching `sum_reach`'s existing partial-coverage precedent. Every open question raised in review is now resolved; this ADR is awaiting formal acceptance.*

### Pending supersession note (2026-08-28)

If ADR-0135 (Proposed, 2026-08-28) is accepted, this ADR's Decision §3 would be refined by ADR-0135's own §2 — specifically clarifying that the five *DailyCount views must be implemented as ordinary Postgres tables with RLS policies, not literal Postgres MATERIALIZED VIEW objects (which do not support RLS). This is a pending note only: ADR-0135 is currently Proposed, not accepted.