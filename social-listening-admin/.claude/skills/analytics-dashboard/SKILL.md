---
name: analytics-dashboard
description: The /tenant/analytics screen — a tab shell, global date-range filter, and client-side post/enrichment aggregation. Read this before touching src/app/tenant/analytics/**, before adding a widget to any tab, or before adding a fifth real content connector (Sources tab's own provider roster).
---

# Analytics Dashboard

## What this is

A Tenant User/Tenant-Admin-facing screen (`/tenant/analytics`) that aggregates already-ingested posts and their AI enrichment into a tab shell (Overview, Sentiment, Conversations, Sources) with a global date-range filter. Everything is computed in `social-listening-admin` from `GET /v1/posts` (`SocialPostSummary[]`) — no `social-listening-core` endpoint, no stored aggregation table exists or is added for this.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0054 | Tenant-facing Analytics Dashboard — v1 scope (4 tabs, no Location), 100% client-side aggregation, a narrow, scoped supersession of ADR-0008's charting deferral | 8.1, 8.2, 8.3 |
| ADR-0008 | Original "no charting UI" deferral — its "no `TopicDailyCount` table" clause is still fully in force; only the charting-UI clause is superseded, narrowly | (superseded in part by ADR-0054) |

## Contracts that constrain this component

- `contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts` — tab shell (`?tab=` query param, all 4 tabs present, no Location tab), `GlobalDateRangePicker` wired to a real re-fetch/re-aggregate, the real paginate-and-aggregate loop, Overview/Sources tab content, empty states, nav item, `listPosts()`'s new `limit` param, and the "no `mockData.ts`/`types.ts` dependency" boundary.
- `contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts` — `SentimentTab.tsx`: the sentiment donut, the day-bucketed sentiment-history series (every day in range represented, zero-post days real zeros), Top Fans/Top Critics (real author+sentiment ranking, no fallback name list), positive/negative key-phrase clouds, an author/phrase click toggling a client-side filter that recomputes every widget on the tab from the filtered post set, and a posts drawer reusing the shared `Slideover` component. Also covers `analyticsData.ts`'s new pure functions (`flattenForSentiment`, `computeSentimentHistory`, `computeTopAuthorsBySentiment`, `computePhrasesBySentiment`, `computeSentimentSplitFromFlat`) directly.
- `contracts/epic-8/story-8.3.conversations-tab.contract.test.ts` — `ConversationsTab.tsx`: a real key-phrase word cloud (frequency across every post, not bucketed by sentiment), a real day-bucketed phrase-frequency-over-time chart tracking only the word cloud's own top phrases, a phrase click toggling the same client-side filter-and-recompute pattern Story 8.2 established, a posts drawer, and the explicit *absence* of any Intentions/Tags widget (no such field exists in `PostEnrichmentSummary`). Also covers `analyticsData.ts`'s `computePhraseFrequency()`/`computePhraseHistory()` directly.

## How to extend this safely

- All four tabs are now real (`OverviewTab.tsx`/`SourcesTab.tsx`/`SentimentTab.tsx`/`ConversationsTab.tsx`) — Epic 8 (Stories 8.1–8.3) is fully built. A future widget on any tab follows the same shape: a pure function in `analyticsData.ts`, wired into `computeAnalyticsSummary()`, rendered from `AnalyticsSummary`.
- **`SentimentPost` (`analyticsData.ts`) is the shared, already-extracted shape every Sentiment/Conversations-tab widget computes from** — derived once via `flattenForSentiment()` inside `computeAnalyticsSummary()`, shipped to the browser as `AnalyticsSummary.posts`, and re-filtered/re-aggregated client-side (via the same pure functions, fed a filtered slice) when a user clicks an author or phrase to drill in. Don't re-derive author/sentiment/keyPhrases from raw `SocialPostSummary` a second time inside a component — extend `SentimentPost`/`flattenForSentiment()` instead if a future widget needs one more field from it.
- **`enumerateDays()` is exported and shared** by `computeSentimentHistory()` (8.2) and `computePhraseHistory()` (8.3) — reuse it for any future day-bucketed series rather than re-deriving date enumeration a third time.
- Any new aggregation belongs in `analyticsData.ts` as a pure function (no `next/*` import) so it stays directly unit-testable — the fetch loop that supplies it real data belongs in `fetchAnalyticsSummary.ts` (server-only), never inlined into a Client Component.
- A new real content connector automatically appears in the Sources tab with no code change — `computeSourceBreakdown()` groups by whatever `providerId` values are actually present in fetched posts, not a hardcoded list. Add a friendly label to `PROVIDER_LABELS` in `analyticsData.ts` when one ships; until then it falls back to the raw `providerId` string, which is honest, not broken.
- Adding a widget's own CSV/JSON export (the old prototype's `onExportWidgetData` affordance) was explicitly scoped out of v1 (ADR-0054 Open Question 3, its own Author-rights standing check) — don't add one without first checking whether it needs to route through ADR-0039/Story 6.13's existing tenant-export mechanism or a new consent/disclosure treatment.

## Load-bearing constraints — do not change casually

- **Never send a fabricated/placeholder data array as if it were real** — this component exists specifically to replace an earlier prototype that did exactly that (ADR-0054 Context). An empty or sparse result renders `EmptyState`/an honest "not enough data" message, never a hardcoded fallback.
- **The Location tab does not exist and must not be added speculatively** (ADR-0054 Decision §4) — `SocialPostSummary` (`GET /v1/posts`'s own response shape) doesn't carry `postGeoLocation` at all, so there is nothing real to aggregate yet.
- **No new `social-listening-core` endpoint, stored column, or migration** for anything in this epic — every widget's data source is `GET /v1/posts` + its `enrichment`/`rawPayload.providerId` fields, full stop (ADR-0054 Decision §3).
- `computeAnalyticsSummary()`/`filterPostsByDateRange()` exclude posts with a null `publishedAt` from every date-ranged aggregate — never coerced into either boundary date. `computeSentimentSplit()` excludes posts with no recognized `enrichment.sentiment` value entirely, never counted as "neutral" by default.
- `fetchAnalyticsSummary()`'s pagination loop has a defensive `MAX_PAGES = 500` circuit breaker (not an approximation ceiling) — normal tenant volumes finish well under it. If a real tenant's post volume ever approaches it, that's ADR-0054 Open Question 2's named scale ceiling becoming real, not a bug to silently raise the constant past.

## Known gaps / deferred work

- Sentiment/Conversations tabs' posts drawers (`Slideover`) list matching posts (title, sentiment where applicable, relative time) from already-fetched `SentimentPost` data — neither fetches or shows a single post's fuller detail (entities, raw payload, `RunEnrichmentButton`) the way `/tenant/posts`'s own Slideover does. A deliberate scope line, not an oversight: both stories' ACs only require reusing the existing Slideover *pattern*, explicitly ruling out new post-detail UI — going further would mean either duplicating `PostsFeedClient.tsx`'s detail rendering a second time or adding a new `GET /tenant/posts/:id` proxy fetch, neither decided by either story.
- No Intentions or Tags widget (Story 8.3, ADR-0054 Decision §2) — `PostEnrichmentSummary` (`postDisplay.ts`) has no `intention`/`tag` field at all; would require a real, separate enrichment-schema decision (new AI provider prompt/field, a new ADR) before either could be built honestly.
- No topic-cluster/co-occurrence network graph — speculative brainstorm content (`docs/design/frontend-design-future-devs.md`), never decided by ADR-0054 or any of Stories 8.1–8.3.
- Location tab: not designed, not scheduled — see ADR-0054 Open Question 1 for what would need to exist first (a real geo-data-carrying connector, plus a `social-listening-core` schema/API change of its own).
- Client-side aggregation over paginated `GET /v1/posts` does not scale indefinitely (ADR-0054 Decision §3, Open Question 2) — no specific tenant post-volume threshold is decided as "too slow," left to real usage to surface.
- Per-widget CSV/JSON export: not built, not decided (ADR-0054 Open Question 3).
- `src/lib/mockData.ts`/`src/lib/types.ts` remain dead, already-committed, generically-themed demo data unrelated to this component (ADR-0054 Open Question 4) — this component's own contract explicitly asserts nothing here imports either file, but removing them entirely is a separate, still-open cleanup item.

## Relations to other components

- Calls `../posts/postDisplay.ts`'s `extractProviderBadge()`/`extractEnrichmentSummary()` directly (pure functions, no new dependency risk) — reused rather than reimplemented, since Story 6.11 already proved this exact `rawPayload`/`enrichment` extraction shape.
- `fetchAnalyticsSummary.ts` calls `@/lib/core-client`'s `listPosts()` (extended this story with an optional `limit` param) — the same function `post-feed`'s `page.tsx` already calls, now with a second real caller.
- `src/app/api/analytics/summary/route.ts` is a thin proxy, the same shape as every other route under `src/app/api/**` — it never constructs an `Authorization` header itself (`core-api-client/SKILL.md`'s sole-choke-point rule stays intact, re-verified by this story's own contract).
- `AppSidebar.tsx`'s `TENANT_NAV_ITEMS` gained one entry (`Analytics`, right after `Posts`) — claimed, not yet re-verified by a dedicated contract assertion beyond this story's own nav-link check (the existing `shell.test.ts` only asserts presence of the pre-existing items, not absence of new ones, so it doesn't regress).
