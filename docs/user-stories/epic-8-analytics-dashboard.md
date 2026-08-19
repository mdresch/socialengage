# Epic 8: Analytics Dashboard

**Created 2026-08-17**, sourced entirely from a new ADR — [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) (Accepted 2026-08-17) — drafted at Menno's own direct request to bring a Tenant-facing Analytics Dashboard into formal scope for `social-listening-admin`, previously out of scope per `docs/design/frontend-design-specification.md` §10 (citing ADR-0008). Every story below was originally drafted **Blocked — pending ADR-0054's acceptance**, the same convention every other ADR-sourced story in this series follows (e.g. Story 3.8/ADR-0043, Story 1.5/ADR-0044).

**2026-08-17, same day — ADR-0054 accepted by Menno via a structured approval decision in the orchestrating session (see ADR-0054's own Acceptance note for the exact mechanism, not a freeform quote).** Accepted as drafted, no revisions. **Stories 8.1, 8.2, and 8.3 all move from Blocked to Ready** — see each story's own updated Source/Status line below. None are built yet; picking any one up follows this project's mandatory `implement-story` skill, contract-first, same as every other story in this series.

**2026-08-17, later the same day — Story 8.1 built (`social-listening-admin@5558e11`).** The tab shell, global date-range filter, Overview tab, and Sources tab are real — see `docs/implementation-log.md` and `docs/implementation-plan.md`'s own matching dated note for the full account, including a large, separate, pre-existing contract-staleness problem found and healed in the same session (`social-listening-admin@ea9d9fe`, unrelated to this story's own defect). Stories 8.2 (Sentiment tab) and 8.3 (Conversations tab) remain Ready, not yet built.

**2026-08-17, later still the same day — Story 8.2 built (`social-listening-admin@a54bf05`).** The sentiment donut, day-bucketed sentiment history, Top Fans/Top Critics, and positive/negative key-phrase clouds are real, with a client-side author/phrase filter and a posts-drawer `Slideover` — see `docs/implementation-log.md` and `docs/implementation-plan.md`'s own matching dated note for the full account, including a same-epic cross-component fix to Story 8.1's own contract (its "Sentiment not built yet" assertion, correctly superseded, not a regression). Story 8.3 (Conversations tab) remains Ready, not yet built.

**2026-08-17, later still the same day — Story 8.3 built (`social-listening-admin@5fed9dd`), closing out Epic 8.** The key-phrase word cloud and phrase-frequency-over-time chart are real, reusing Story 8.2's own `SentimentPost` shape and click-to-filter interaction; no Intentions/Tags widget ships (ADR-0054 Decision §2, no such field exists in the real enrichment schema) — see `docs/implementation-log.md` and `docs/implementation-plan.md`'s own matching dated note for the full account, including the same anticipated in-epic cross-component narrowing to Story 8.1's own contract, this time retiring its now-purposeless stub-check test outright. **All three Epic 8 stories are now built** — the Analytics Dashboard (ADR-0054) is complete, save the Location tab, which ADR-0054 Decision §4 deliberately does not design.

**2026-08-17, later still the same day — Story 8.4 added, at Menno's direct request, after reviewing the shipped dashboard against the Google AI Studio design reference again.** A structured comparison (real gaps vs. visual polish vs. fabricated-in-the-reference) found Overview was the crudest of the four tabs — three plain KPI cards with no chart, unlike Sources/Sentiment/Conversations — and that the date picker's "Compare to previous period" checkbox has been wired into `DateRangeValue.compareWithPrevious` since Story 8.1 while `AnalyticsClient` silently ignored it. Both are real, closeable gaps inside ADR-0054's already-Accepted scope, needing no new ADR. See Story 8.4 below. Separately, Menno asked about formalizing backend `language`/location enrichment as a new ADR — tracked independently, not part of this epic (see `docs/adr/README.md`'s Candidate future ADRs list once drafted).

**2026-08-17, later still the same day — ADR-0055 drafted, closing the `language`/location question named directly above.** Investigated both fields independently: Language turned out to already be computed and persisted by both real `AIProviderConnector`s (`azureAiLanguageConnector.ts`, `azureOpenAiConnector.ts`) on every `enrichment` write, reaching `GET /v1/posts` unfiltered today — the only gap is `postDisplay.ts`'s own `PostEnrichmentSummary` never reading it, a `social-listening-admin`-only fix requiring zero `social-listening-core` change. Location was re-investigated independently rather than assumed still correct, reaching the same non-buildable verdict ADR-0054 already reached the same day, with one new finding (GNews's own `source.country` field, already wire-visible via `rawPayload`) named and explicitly declined as a substitute — see ADR-0054's own new Clarification note on Open Question 1. **Story 8.5** is added below, **Blocked — pending ADR-0055 acceptance**. No story is added for Location — see the "Not storied in this epic" section further down, updated with a matching dated note.

**2026-08-17, later still the same day — ADR-0055 accepted, Story 8.5 moves to Ready.** Menno approved the Language half directly ("yes please extend the language field") and, separately, asked a new feasibility question about Location — not "revisit the same structural approach," but whether the AI *provider itself* could infer a likely origin location from Newswire posts' own body text (a wire-service dateline), rather than relying on connector-provided geo-metadata. Verified live, not assumed: PRNewswire's real RSS feed reliably opens its body content with a clean dateline (`"PROVIDENCE, R.I., Aug. 17, 2026 /PRNewswire/ -- ..."`); GlobeNewswire's real RSS feed, sampled the same way, carries no `<content:encoded>` and its `<description>` is a short headline restatement with no dateline at all — so this only reliably applies to the PRNewswire-sourced half of Newswire posts, not all of them. Tracked as a new, separate candidate ADR (see ADR-0055's own Amendment Log) — not folded into ADR-0055's already-Accepted Decision text, and not yet drafted.

**2026-08-17, later still the same day — Story 8.6 added, at Menno's own request to keep closing real, already-named gaps against the design reference ("hope you are able to turn the available data points into real value adding dashboard views").** The largest remaining named-but-unbuilt gap was the Sources tab's own — `SourceBreakdownEntry.sentiment` and `computeSourceBreakdown()`'s per-`providerId` grouping already had everything a per-source sentiment score and a source-volume-over-time chart would need; neither had been built. Stays inside ADR-0054's already-Accepted Decision §2 Sources scope, no new ADR needed, same reasoning as Story 8.4.

**Boundary, stated once here so every story in this epic inherits it rather than re-arguing it:** every widget in this epic is computed **client-side, in `social-listening-admin`, from data `GET /v1/posts` (`SocialPostSummary[]`) and its `enrichment`/`rawPayload.providerId` fields already return** — per ADR-0054 Decision §3. No story in this epic adds a new `social-listening-core` endpoint, a new stored column, or a new migration. No story in this epic ships fabricated, placeholder, or "sample" data presented as if real — where real data doesn't exist for a widget the reference design assumed (Intentions, Tags, Location), that widget is either scoped out entirely (ADR-0054 Decision §2) or the story renders an honest empty state, never a hardcoded fallback array.

**Relationship to prior, uncommitted prototype work:** five untracked files already exist at `social-listening-admin/src/app/tenant/analytics/` (`SentimentDashboardTab.tsx`, `ConversationsDashboardTab.tsx`, `LocationDashboardTab.tsx`, `GlobalDateRangePicker.tsx`, `AnimatedChartTooltip.tsx`) — reviewed in full during ADR-0054's drafting. `GlobalDateRangePicker.tsx` and `AnimatedChartTooltip.tsx` are confirmed reusable as-is (no fabricated data). `SentimentDashboardTab.tsx` and `ConversationsDashboardTab.tsx` have real, salvageable data-derivation logic (`topFans`/`topCritics`/`sentimentDonut`/`dynamicPhrases`, all genuinely computed from `filteredPosts`) mixed with fabricated static fallback data that must be removed, not adapted, per each story's own Acceptance Criteria below. `LocationDashboardTab.tsx` is not reused by this epic at all (ADR-0054 Decision §4 — Location does not ship in v1). None of the five files compiles today (they import a `FlatPost` type from a `./types` module that does not exist) and none of the `ad-`-prefixed CSS classes they reference exist yet in `globals.css` — every story below inherits real, non-trivial CSS-authoring work, not a rewiring exercise.

---

## Story 8.1 — Analytics dashboard shell, global date-range filter, Overview tab, Sources tab

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Built 2026-08-17 — ADR-0054 accepted 2026-08-17, via a structured approval decision in the orchestrating session ("Approve as summarized" — see ADR-0054's own Acceptance note), accepted as drafted, no revisions.
**Built:** 2026-08-17 — social-listening-admin@5558e11

**As a** Tenant User or Tenant-Admin,
**I want** a new Analytics section with a date-range filter and an at-a-glance summary of post volume, sentiment, and source breakdown,
**so that** I can see how my tenant's monitored content is trending without reading through the raw post feed one page at a time.

**Acceptance Criteria**
- New route `/tenant/analytics` (Tenant User, Tenant-Admin — same role scope as `/tenant/posts`, Story 6.11), added to the left nav (`Analytics`, per `frontend-design-specification.md` §4.3's existing nav-item shape) and to the Route Table once `frontend-design-specification.md` is updated (ADR-0054 Open Question 6 — not this story's own scope to edit that file).
- A tab shell renders four tabs: **Overview**, **Sentiment**, **Conversations**, **Sources** — no **Location** tab (ADR-0054 Decision §4). Tab state is reflected in a `?tab=` query-string parameter, matching this project's existing deep-linkable-state convention (`?post=<id>` on the post feed, Story 6.11).
- `GlobalDateRangePicker.tsx` (already drafted, reviewed and confirmed real/non-fabricated) is wired to actually filter the underlying `GET /v1/posts` query by `publishedAt` — selecting a preset or custom range re-fetches and re-aggregates every widget on the currently active tab; no preset or custom range is decorative.
- A page-load fetch pages through `GET /v1/posts` for the current tenant and selected date range (via `listPosts()`, extended if needed to accept a date-range parameter — a `social-listening-admin`-side change only, no `social-listening-core` change) and computes, client-side, the aggregates this story's own Overview/Sources tabs need. The exact number of pages fetched per load is left to implementation, but must be a real fetch loop against real paginated results — never a single-page approximation presented as a total.
- **Overview tab** renders: total matched post count for the selected range; a compact sentiment split (reusing the same real `enrichment.sentiment` aggregation Story 8.2's donut computes); a compact source breakdown (reusing this story's own Sources tab aggregation). No widget on this tab introduces a new aggregation of its own beyond what Sources/Sentiment already define — this tab is a summary view, not a fourth independent computation.
- **Sources tab** renders per-`providerId` post-volume and sentiment-split breakdown for exactly this project's real three content connectors — `gnews`, `newswire`, `tenant-owned-feed` (`extractProviderBadge()`, `postDisplay.ts`) — reading `rawPayload.providerId` per fetched post. A tenant with posts from only one or two connectors sees only those represented; no placeholder row for an unused connector, and no generic social-platform names (`Twitter/X`, `LinkedIn`, etc.) anywhere in this tab's copy or data.
- Zero matched posts for the selected range renders an honest empty state (`EmptyState` component, per `frontend-design-specification.md` §6.7) on every tab — never a fabricated sample dataset.
- No fetch, component, or aggregation in this story imports from or depends on `social-listening-admin/src/lib/mockData.ts` or `src/lib/types.ts` (ADR-0054 Open Question 4 — those files are dead, already-committed, unrelated demo data, not a dependency of this epic).

**Explicitly out of scope:** Sentiment tab and Conversations tab content (Stories 8.2/8.3); the Location tab (ADR-0054 Decision §4, no story in this epic); per-widget export (ADR-0054 Open Question 3); any change to `social-listening-core`.

---

## Story 8.2 — Sentiment tab

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Built 2026-08-17 — ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).
**Built:** 2026-08-17 — social-listening-admin@a54bf05

**As a** Tenant User or Tenant-Admin,
**I want** to see how sentiment breaks down and trends over the selected date range, and who's driving the most positive and negative conversation,
**so that** I can spot a real shift in how my monitored content is being received, not just read individual posts one at a time.

**Acceptance Criteria**
- Sentiment donut (positive/neutral/negative), computed from real `enrichment.sentiment` across the fetched, date-filtered post set for the current tenant — the real computation already drafted in the uncommitted `SentimentDashboardTab.tsx` (`sentimentDonut`), with its hardcoded `68/22/10` fallback values removed entirely; an empty result set renders the empty state, never the fallback numbers.
- Sentiment-over-time chart, real and computed — bucketed by day (ADR-0054 Open Question 7) from each post's real `publishedAt` + `enrichment.sentiment`, replacing the uncommitted prototype's fully-static `SENTIMENT_HISTORY` array (which is not derived from `filteredPosts` at all today) with a genuine time-series aggregation. A date range with zero posts in a given bucket shows zero for that bucket, not an interpolated or omitted point.
- Top Fans / Top Critics widgets — real `author` (`extractAuthor()`, `postDisplay.ts`) grouped by `enrichment.sentiment === 'positive'` / `'negative'` post count, ranked descending. **No fallback to a hardcoded name list when the real result set is small or empty (closing the exact defect found in the uncommitted `SentimentDashboardTab.tsx`, where `dynamic.length > 0 ? dynamic : TOP_FANS` silently substitutes fabricated names)** — fewer than 5 real fans/critics renders fewer than 5 rows; zero renders the empty state.
- Positive/negative key-phrase clouds — real `enrichment.keyPhrases`, bucketed by the sentiment of the post(s) each phrase appears on, replacing the prototype's static `POSITIVE_PHRASES`/`NEGATIVE_PHRASES` arrays.
- Selecting an author (Top Fans/Critics) or a key phrase filters the currently displayed post set the same way selecting a source/topic filter is expected to behave elsewhere in this epic (consistent interaction pattern across Stories 8.1–8.3, exact filter-composition mechanics left to implementation).
- Clicking through from any widget to the underlying posts opens the existing Post Detail `Slideover` pattern (Story 6.11/6.16) — no new post-detail UI is introduced by this story.

**Explicitly out of scope:** the "Explain the Spike" AI narrative panel, predictive sentiment forecasting, and any topic-cluster network graph — all three are speculative brainstorm content (`docs/design/frontend-design-future-devs.md`), not decided or designed by ADR-0054 or this story.

---

## Story 8.3 — Conversations tab

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Built 2026-08-17 — ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).
**Built:** 2026-08-17 — social-listening-admin@5fed9dd

**As a** Tenant User or Tenant-Admin,
**I want** to see which phrases and topics are actually showing up most often in my monitored content, and how that's trending,
**so that** I can tell what's actually being talked about without reading every post individually.

**Acceptance Criteria**
- Key-phrase word cloud, sized by real frequency of `enrichment.keyPhrases` across the fetched, date-filtered post set — reusing and cleaning up the real derivation already drafted in the uncommitted `ConversationsDashboardTab.tsx` (`dynamicPhrases`), with its `MAIN_PHRASES` static fallback removed entirely; zero real key phrases in the selected range renders the empty state, never the fallback word list.
- Phrase-frequency-over-time chart, real and computed — bucketed by day (ADR-0054 Open Question 7) from each post's real `publishedAt` + which of that day's top key phrases it contributed, replacing the prototype's fully-static, sine-wave-generated `PHRASES_HISTORY`.
- Clicking a phrase in the word cloud filters the currently displayed post set to only posts whose `enrichment.keyPhrases` contains it, consistent with Story 8.2's own phrase-filter interaction.
- **No Intentions widget and no Tags widget ship in this story** (ADR-0054 Decision §2) — neither `intention` nor `tag` exists anywhere in this project's real `enrichment` schema (`PostEnrichmentSummary`, `postDisplay.ts`), and the uncommitted `ConversationsDashboardTab.tsx`'s `INTENTIONS`/`TAGS` widgets (entirely static, no real derivation of any kind) are not ported, adapted, or replaced with a placeholder — they are dropped.
- Clicking through from the word cloud to the underlying posts opens the existing Post Detail `Slideover` pattern (Story 6.11/6.16) — no new post-detail UI is introduced by this story.

**Explicitly out of scope:** Intentions, Tags (see above — no real data field, not built as placeholders); any interactive force-directed/D3 topic-co-occurrence graph (speculative brainstorm content, `docs/design/frontend-design-future-devs.md`, not decided by ADR-0054).

---

## Story 8.4 — Overview enrichment: volume chart, sentiment donut, period-over-period comparison

**Source:** ADR-0054 (Accepted 2026-08-17) — no new ADR needed; both pieces below stay inside Decision §2's already-accepted Overview scope ("reusing the same computed aggregates... not a novel widget of its own") and Decision §3's data-source strategy (100% client-side, zero new backend surface) · **Status:** Built 2026-08-17
**Built:** 2026-08-17 — social-listening-admin@ae015e0

**As a** Tenant User or Tenant-Admin,
**I want** the Overview tab to show a real volume trend and sentiment split at a glance, and to see whether either is up or down versus the previous period,
**so that** I don't have to switch to the Sentiment tab or do the comparison math myself just to tell whether things are improving.

**Context found while scoping this story:** `GlobalDateRangePicker.tsx`'s "Compare to previous period" checkbox (`comparePrev`, defaulting to checked) already sets `DateRangeValue.compareWithPrevious` on every `onChange` call — but `AnalyticsClient.handleRangeChange` never reads that field. The control has been live and checked by default since Story 8.1 while doing nothing. This story is what makes it real, not a new UI addition.

**Acceptance Criteria**
- A new pure function in `analyticsData.ts` (day-bucketed, reusing the exact `enumerateDays()` rule `computeSentimentHistory`/`computePhraseHistory` already establish) computes real post-volume-per-day across the date-filtered set; `AnalyticsSummary` gains a `volumeHistory` field populated by `computeAnalyticsSummary()`, the same single aggregation point every tab already reads from (no parallel computation path).
- Overview tab renders a real volume-over-time chart from `summary.volumeHistory` and a real sentiment donut from the already-computed `summary.sentimentSplit` (the same numbers Sentiment tab's own donut reads — not a second, independently-computed sentiment split). Zero matched posts keeps rendering the existing `EmptyState`, not an empty chart.
- `handleRangeChange` reads `DateRangeValue.compareWithPrevious` for the first time. When true, it fetches a **second, real** `AnalyticsSummary` for the immediately preceding period of equal length (e.g. a 14-day range compares against the 14 days immediately before it) — via the same `/api/analytics/summary` route and the same `computeAnalyticsSummary()` path, never an estimate, interpolation, or client-side guess. When false, no second fetch happens at all.
- Overview's total-posts KPI and sentiment split each show a real percentage delta against the prior-period summary when comparison is on. A prior period with zero posts (division by zero) renders an honest "no prior data to compare" indicator — **never a fabricated delta string**, closing the exact defect the Google AI Studio reference committed (hardcoded `'+18%'`/`'+1,331%'`/`'∞'` strings not derived from any real prior-period fetch at all).
- The prior-period fetch failing (network error, non-200) degrades Overview to showing the current period only, with comparison silently unavailable — it must never block or error out the primary summary that already loaded successfully.
- Initial server-side page load (`page.tsx`) may render without a comparison (single-range fetch, matching Story 8.1's existing pattern) — the comparison fetch is required only once `AnalyticsClient` is interactive and the picker's toggle is read. Exact SSR-vs-client split is left to implementation, not fixed here.

**Explicitly out of scope:** per-widget CSV/JSON export (ADR-0054 Open Question 3, still not decided); rippling the period-comparison delta into the Sentiment/Sources/Conversations tabs beyond Overview (a reasonable future story, not this one); any Sources-tab enhancement (per-source sentiment score, per-source volume-over-time — real, buildable gaps named during this epic's own retrospective review, but a separate story); the "AI Spike Storyteller" / predictive forecast panels (already excluded, ADR-0054 Decision §2).

---

## Story 8.5 — Languages breakdown widget

**Source:** ADR-0055 (Accepted 2026-08-17) · **Status:** Built 2026-08-17 — ADR-0055 accepted 2026-08-17, via a structured approval decision in the orchestrating session (Menno: "yes please extend the language field" — see ADR-0055's own Acceptance note), accepted as drafted, no revisions.
**Built:** 2026-08-17 — social-listening-admin@8b8bb14

**As a** Tenant User or Tenant-Admin,
**I want** to see which languages my monitored content is actually written in,
**so that** I understand the linguistic makeup of what's being tracked without opening individual posts to check.

**Acceptance Criteria**
- `PostEnrichmentSummary` (`postDisplay.ts`) gains a `language: string | null` field, read from `enrichment.detectedLanguage` — the same field both real `AIProviderConnector`s (`azureAiLanguageConnector.ts`, `azureOpenAiConnector.ts`) already compute and persist on every successful enrichment, confirmed already flowing through `GET /v1/posts` unfiltered (ADR-0055 Context). No `social-listening-core` change of any kind is in scope for this story.
- A Languages breakdown widget renders on the Sources tab or the Conversations tab (implementation's own choice, ADR-0055 Open Question 1), aggregating the fetched, date-filtered post set's `language` values with a real ISO 639-1-code-to-display-name mapping (e.g. `"en"` → `"English"`) for at least the languages this project's real enrichment output can plausibly produce.
- Posts with no `enrichment` at all (never enriched) are excluded from the aggregation — not shown as an "unknown language" bucket, not fabricated, consistent with how Sentiment/Sources widgets already treat un-enriched posts.
- Zero enriched posts in the selected range renders the existing `EmptyState` component for this widget, never a fabricated sample breakdown.
- Clicking a language in the breakdown filters the currently displayed post set to only posts with that `enrichment.detectedLanguage`, consistent with Story 8.2/8.3's own filter-by-attribute interaction pattern.

**Explicitly out of scope:** GNews's own `rawPayload.lang`/`rawPayload.source.country` fields (ADR-0055 Context/Decision §2 — named, not built, and not a Location substitute); any change to `social-listening-core`; surfacing `language` on the existing post feed/detail view (Story 6.11/6.16) — a reasonable follow-up, not this story (ADR-0055 Open Question 4).

---

## Story 8.6 — Sources tab enrichment: per-source sentiment score, per-source volume-over-time

**Source:** ADR-0054 (Accepted 2026-08-17) — no new ADR needed; stays inside Decision §2's already-accepted Sources scope ("post-volume and sentiment breakdown per real `providerId`") and Decision §3's data-source strategy (100% client-side, zero new backend surface) · **Status:** Built 2026-08-17
**Built:** 2026-08-17 — social-listening-admin@a17af3f

**As a** Tenant User or Tenant-Admin,
**I want** to see, at a glance, which of my connected sources is trending positive or negative and how each source's volume is moving day to day,
**so that** I can tell which platform is worth paying attention to without doing the sentiment-percentage math myself or switching to the Sentiment tab and mentally cross-referencing by source.

**Context found while scoping this story:** named explicitly as a real, buildable gap during the same retrospective design-reference comparison that produced Story 8.4 — `SourceBreakdownEntry.sentiment` already carries everything needed for a per-source score, and `computeSourceBreakdown()` already groups posts by real `providerId`; neither had ever been reduced to a single comparable number or plotted over time.

**Acceptance Criteria**
- `SentimentPost` (`analyticsData.ts`) gains a `providerId: string` field (`extractProviderBadge(post.rawPayload)`, already imported) — the one piece missing from the already-flattened shape needed to bucket by source and day simultaneously.
- A new pure function `computeSentimentIndex(split: SentimentSplit): number | null` computes a real, transparent 0–10 weighted score (`positive` weighted 10, `neutral` weighted 5, `negative` weighted 0, averaged over the enriched total) — **`null`, never a fabricated default, when there are zero enriched posts to score** (closing the same category of defect Story 8.4 already closed for the Overview delta: the Google AI Studio reference's sentiment gauge fell back to a hardcoded `7.6`/`68%` when real data was sparse). `SourceBreakdownEntry` gains `sentimentIndex`, computed once inside `computeSourceBreakdown()`.
- A new pure function `computeSourceVolumeHistory(posts, range, providerIds)` buckets real post counts per day *and* per source simultaneously (the same multi-key-per-day shape `computePhraseHistory()` already established for its own top-phrases) — a source/day combination with zero posts is a real zero, never omitted. `AnalyticsSummary` gains `sourceVolumeHistory`.
- Sources tab renders each source's real `sentimentIndex` alongside its existing pos/neu/neg counts (not replacing them — the index is a comparable summary, the counts are the detail), and a new multi-line "Source volume over time" chart, one line per real, currently-present `providerId` — never a placeholder line for an unconnected platform.
- Zero matched posts keeps rendering the existing `EmptyState` (Story 8.1 behavior, unchanged).

**Explicitly out of scope:** click-to-filter-by-source interaction (Sources tab remains presentational, as it already is today — a reasonable future story, not this one); "Volume Change by Source" (a delta vs. a prior period, per source) — a real extension of Story 8.4's own period-comparison mechanism, ripples beyond what that story's own "Overview-only" scope line already named as future work; per-widget CSV/JSON export (ADR-0054 Open Question 3, still not decided); any change to `social-listening-core`.

**Explicitly out of scope:** GNews's own `rawPayload.lang`/`rawPayload.source.country` fields (ADR-0055 Context/Decision §2 — named, not built, and not a Location substitute); any change to `social-listening-core`; surfacing `language` on the existing post feed/detail view (Story 6.11/6.16) — a reasonable follow-up, not this story (ADR-0055 Open Question 4).

---

## Not storied in this epic: Location tab

**ADR-0054 Decision §4 defers the Location tab entirely — no story exists for it in this epic, and none should be added speculatively.** Two independent, both-disqualifying findings: no connector in this project's real roster populates `social_posts.post_geo_location`, and even a populated column would not be visible to `GET /v1/posts`'s own `SocialPostSummary` response shape, which this epic's entire data-source strategy depends on (ADR-0054 Decision §3). A future story here would need, at minimum, a real geo-data-carrying connector or source, a `social-listening-core` schema/API change (its own separate contract-first story), and a demonstrated tenant need — none of which exist today. See ADR-0054 Open Question 1.

**2026-08-17, later the same day — reconfirmed, not reopened, by ADR-0055.** ADR-0055 investigated Location independently at Menno's own direct request, rather than assuming this conclusion still held. Both disqualifying findings above were re-verified directly and remain unchanged. One new, real detail was found and named — `GNewsArticle.source.country` is already captured in `rawPayload`, technically free to surface — but explicitly declined as a Location substitute: it covers only one of three real connectors, and reports the publisher's own declared country, not per-post or per-conversation geography. No story is added here as a result. See ADR-0054's own new Clarification note on Open Question 1 and ADR-0055's own Decision §2/Context.

**Documentation Steward correction, 2026-08-19.** Stories 8.1–8.6 above each already carried a correct, real `**Built:** 2026-08-17 — social-listening-admin@<hash>` field (each hash confirmed directly against `docs/implementation-log.md`'s own matching 2026-08-17 entries) and this epic file's own narrative notes above (lines 7/9/11/13/17/19) already stated in plain prose that every one of the six stories was built — but each story's own `**Status:**` line still read "Ready," giving no hint of that from the fixed-shape header alone. This is exactly the gap `docs/user-stories/README.md`'s "Built convention" (added 2026-08-13, closing an identical drift found in Stories 5.18/6.7) exists to catch. All six Status lines now read "Built 2026-08-17," matching the `**Built:**` field and the Log; no Acceptance Criteria text changed.
