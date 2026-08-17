# Epic 8: Analytics Dashboard

**Created 2026-08-17**, sourced entirely from a new ADR — [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) (Accepted 2026-08-17) — drafted at Menno's own direct request to bring a Tenant-facing Analytics Dashboard into formal scope for `social-listening-admin`, previously out of scope per `docs/design/frontend-design-specification.md` §10 (citing ADR-0008). Every story below was originally drafted **Blocked — pending ADR-0054's acceptance**, the same convention every other ADR-sourced story in this series follows (e.g. Story 3.8/ADR-0043, Story 1.5/ADR-0044).

**2026-08-17, same day — ADR-0054 accepted by Menno via a structured approval decision in the orchestrating session (see ADR-0054's own Acceptance note for the exact mechanism, not a freeform quote).** Accepted as drafted, no revisions. **Stories 8.1, 8.2, and 8.3 all move from Blocked to Ready** — see each story's own updated Source/Status line below. None are built yet; picking any one up follows this project's mandatory `implement-story` skill, contract-first, same as every other story in this series.

**2026-08-17, later the same day — Story 8.1 built (`social-listening-admin@5558e11`).** The tab shell, global date-range filter, Overview tab, and Sources tab are real — see `docs/implementation-log.md` and `docs/implementation-plan.md`'s own matching dated note for the full account, including a large, separate, pre-existing contract-staleness problem found and healed in the same session (`social-listening-admin@ea9d9fe`, unrelated to this story's own defect). Stories 8.2 (Sentiment tab) and 8.3 (Conversations tab) remain Ready, not yet built.

**Boundary, stated once here so every story in this epic inherits it rather than re-arguing it:** every widget in this epic is computed **client-side, in `social-listening-admin`, from data `GET /v1/posts` (`SocialPostSummary[]`) and its `enrichment`/`rawPayload.providerId` fields already return** — per ADR-0054 Decision §3. No story in this epic adds a new `social-listening-core` endpoint, a new stored column, or a new migration. No story in this epic ships fabricated, placeholder, or "sample" data presented as if real — where real data doesn't exist for a widget the reference design assumed (Intentions, Tags, Location), that widget is either scoped out entirely (ADR-0054 Decision §2) or the story renders an honest empty state, never a hardcoded fallback array.

**Relationship to prior, uncommitted prototype work:** five untracked files already exist at `social-listening-admin/src/app/tenant/analytics/` (`SentimentDashboardTab.tsx`, `ConversationsDashboardTab.tsx`, `LocationDashboardTab.tsx`, `GlobalDateRangePicker.tsx`, `AnimatedChartTooltip.tsx`) — reviewed in full during ADR-0054's drafting. `GlobalDateRangePicker.tsx` and `AnimatedChartTooltip.tsx` are confirmed reusable as-is (no fabricated data). `SentimentDashboardTab.tsx` and `ConversationsDashboardTab.tsx` have real, salvageable data-derivation logic (`topFans`/`topCritics`/`sentimentDonut`/`dynamicPhrases`, all genuinely computed from `filteredPosts`) mixed with fabricated static fallback data that must be removed, not adapted, per each story's own Acceptance Criteria below. `LocationDashboardTab.tsx` is not reused by this epic at all (ADR-0054 Decision §4 — Location does not ship in v1). None of the five files compiles today (they import a `FlatPost` type from a `./types` module that does not exist) and none of the `ad-`-prefixed CSS classes they reference exist yet in `globals.css` — every story below inherits real, non-trivial CSS-authoring work, not a rewiring exercise.

---

## Story 8.1 — Analytics dashboard shell, global date-range filter, Overview tab, Sources tab

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Ready — ADR-0054 accepted 2026-08-17, via a structured approval decision in the orchestrating session ("Approve as summarized" — see ADR-0054's own Acceptance note), accepted as drafted, no revisions.
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

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Ready — ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).
**Built:** not yet

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

**Source:** ADR-0054 (Accepted 2026-08-17) · **Status:** Ready — ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).
**Built:** not yet

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

## Not storied in this epic: Location tab

**ADR-0054 Decision §4 defers the Location tab entirely — no story exists for it in this epic, and none should be added speculatively.** Two independent, both-disqualifying findings: no connector in this project's real roster populates `social_posts.post_geo_location`, and even a populated column would not be visible to `GET /v1/posts`'s own `SocialPostSummary` response shape, which this epic's entire data-source strategy depends on (ADR-0054 Decision §3). A future story here would need, at minimum, a real geo-data-carrying connector or source, a `social-listening-core` schema/API change (its own separate contract-first story), and a demonstrated tenant need — none of which exist today. See ADR-0054 Open Question 1.
