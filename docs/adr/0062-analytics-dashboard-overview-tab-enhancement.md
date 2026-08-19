# ADR-0062: Analytics Dashboard — Overview Tab Enhancement: multi-dimensional filter model, AI Spike Storyteller, statistical volume forecast, and widget scope

**Status:** Proposed (2026-08-19)

**Source:** Frontend Specification (Sections 4–10) provided by Menno, 2026-08-19. The specification describes a target `AnalyticsDashboardView` / Overview Tab with a 3-column responsive grid, an 11-dimension client-side filter model, a Volume & Projections Timeline with statistical forecast, an AI Spike Storyteller widget, and a nine-widget layout — materially richer than the Overview tab Stories 8.1 and 8.4 shipped. This ADR evaluates each specification recommendation against the real codebase, the existing ADR corpus, and this project's established discipline (no fabricated data, no undemonstrated scope, real backend endpoints before real consumers).

## Context

### What Stories 8.1–8.6 built, and where the current Overview tab stands

As of 2026-08-17, `social-listening-admin`'s `/tenant/analytics` route has:

- **Tab shell + `GlobalDateRangePicker`** (Story 8.1): four tabs (Overview, Sentiment, Conversations, Sources); date-range-driven paginated fetch loop against `GET /v1/posts`.
- **Overview tab** (Stories 8.1/8.4): three KPI cards (total posts, sentiment split, source breakdown); a real volume-over-time chart; period-over-period comparison via a second `computeAnalyticsSummary()` fetch when `DateRangeValue.compareWithPrevious` is true.
- **Sentiment tab** (Story 8.2): sentiment donut, day-bucketed sentiment history, Top Fans/Critics, positive/negative key-phrase clouds.
- **Conversations tab** (Story 8.3): key-phrase word cloud, phrase-frequency-over-time chart.
- **Sources tab** (Stories 8.1/8.6): per-`providerId` post-volume, per-source sentiment index, per-source volume-over-time.
- **Languages widget** (Story 8.5): ISO-639-1 language breakdown from real `enrichment.detectedLanguage`, placed on an existing tab.

All widgets are computed entirely client-side from `SocialPostSummary[]` per ADR-0054 Decision §3. No `social-listening-core` change was introduced by any of Stories 8.1–8.6.

### What the specification introduces — verified against the codebase and existing ADRs

The specification (§4–§10) describes an Overview Tab with:

1. **A 3-column responsive grid** (`grid-cols-1 lg:grid-cols-12`), nine named widget slots with stable `id` attributes.
2. **An 11-dimension client-side filter model** (§4.1): `selectedTopic` / `selectedDateRange` / `activeDateFilter` / `activeSourceFilter` / `activeAuthorFilter` / `activeKeywordFilter` / `activeLanguageFilter` / `activeRegionFilter` / `activeSentimentFilter` / `activeIntentionFilter` / `activeTagFilter`.
3. **Two server-side intelligence endpoints** (§4.3): `POST /api/explain-spike` (Spike Storyteller) and `POST /api/predictive-forecast` (Predictive Forecast).
4. **D3-powered bespoke chart components** (§10): `<D3Sparkline>`, `<D3SentimentGauge>`, `<D3TrendingTopicsChart>`.
5. **Nine distinct widgets** (§5): Sentiment Gauge (SVG tri-arc ring), Location Insights (SVG world map), Authors by Source, Volume & Projections Timeline (multi-series AreaChart), Watchlist Coverage (PieChart donut), Word Cloud / Key Phrases, Languages Distribution, Sources Volume Breakdown, Top Authors Feed, AI Spike Storyteller.
6. **Active filter chips bar** (§6) and a `+Add filters` modal.
7. **Deep-link share state** (§4.4): URL parameter hydration on mount; `navigator.clipboard.writeText` share URL.
8. **Enhanced Posts Slideout Drawer** (§7): translation simulation, team assignment dropdown simulation, response compose field, priority toggle.
9. **A client-side statistical volume forecast** (§8.2): `lastVolume × 0.85ⁿ + 850 × (1 − 0.85ⁿ)` decay model.
10. **Crisis Alert Radar and Sentiment Trajectory banners** (§5, §8.2), driven by forecast output.

### Verification: which filter dimensions are backed by real data

| Filter dimension | Real data? | Backing field |
|---|---|---|
| `activeDateFilter` (chart-bar drill-down) | Yes | `publishedAt` bucketed by day; already used by Stories 8.2–8.4 |
| `activeSourceFilter` | Yes | `rawPayload.providerId`: `gnews`, `newswire`, `tenant-owned-feed` |
| `activeAuthorFilter` | Yes | `extractAuthor()` / `postDisplay.ts` |
| `activeKeywordFilter` | Yes | `enrichment.keyPhrases` (array of strings) |
| `activeLanguageFilter` | Yes | `enrichment.detectedLanguage` (ADR-0055, Story 8.5) |
| `activeSentimentFilter` | Yes | `enrichment.sentiment` |
| `selectedDateRange` | Yes | Already wired via `GlobalDateRangePicker` (Story 8.1) |
| `activeWatchlistFilter` (watchlist selector) | Partial — client-side approximation | `GET /v1/watchlists` returns `Watchlist[]` with `id`, `name`, `matchType`, `terms[]`; for `keyword`/`hashtag` watchlists, client-side match of `terms[]` against `bodyMarkdown` (ADR-0053/Story 3.10) is feasible without any new backend surface; `boolean_query` watchlists excluded at v1; no `post_watchlist_matches` junction table exists to enable true server-side filtering |
| `activeRegionFilter` | No | No geo data; `post_geo_location` unpopulated and absent from `SocialPostSummary` (ADR-0054 §4, ADR-0055 §2) |
| `activeIntentionFilter` | No | No `intention` field in real `PostEnrichmentSummary` (ADR-0054 §2) |
| `activeTagFilter` | No | No `tag` field in real `PostEnrichmentSummary` (ADR-0054 §2) |

### Verification: which widgets are backed by real data

| Widget | Feasible? | Reason |
|---|---|---|
| Sentiment Gauge (SVG tri-arc ring) | Yes | `sentimentStats` from existing `enrichment.sentiment` aggregation |
| Volume & Projections Timeline | Yes (historical); statistical-only for forecast | Real `publishedAt` volume by day; statistical decay for projection |
| Word Cloud / Key Phrases | Yes | Real `enrichment.keyPhrases`; already built on Conversations tab |
| Languages Distribution | Yes | Real `enrichment.detectedLanguage`; built in Story 8.5 |
| Sources Volume Breakdown | Yes | Real `providerId` breakdown; built in Stories 8.1/8.6 |
| Top Authors Feed | Yes (real data); avatars are initials | Real `author` + post count; Unsplash URLs introduce an uncontracted external CDN dependency |
| Authors by Source | Yes (3 real connectors only) | `gnews`, `newswire`, `tenant-owned-feed` — not the 8-platform roster the spec assumes |
| AI Spike Storyteller | Yes (requires one new backend endpoint) | Existing `azureOpenAiConnector.ts` + new `POST /v1/posts/explain-spike` |
| Location Insights (SVG world map) | No | ADR-0054 Decision §4: no geo data; `postGeoLocation` not in `SocialPostSummary` |
| Watchlist Coverage (PieChart donut) | No | Spec itself: "static for now, pending real watchlist matching API" — same "no fabricated placeholder data" discipline |

### ADR-0054's five explicit exclusions, re-examined against this specification

ADR-0054 Decision §2 excluded five features as "speculative brainstorm content from `docs/design/frontend-design-future-devs.md`." The source of those exclusions was an untracked, undecided brainstorm file. The specification provided 2026-08-19 is a more concrete, explicitly-requested engineering specification for the Overview tab — a different document. Re-examined:

1. AI "Explain the Spike" storytelling panels — **this ADR partially supersedes this exclusion; see Decision §6.**
2. Live predictive forecasting/early-warning indicators — **this ADR accepts the statistical client-side fallback only; AI-backed endpoint deferred; see Decision §5.**
3. Interactive D3 topic-cluster/co-occurrence graph — **stands; not in this ADR's scope.**
4. Real-time pulse-map/heatmap upgrade to Location — **stands; Location still deferred.**
5. 1-click PDF/slide export or automated action workflows — **stands; not in this ADR's scope.**

### Author-rights standing check

All three real connectors use organization-as-Author (ADR-0004/ADR-0024/ADR-0026/ADR-0050). The Top Authors Feed aggregates post volume by Author — the same read-and-display operation the Sentiment tab's Top Fans/Critics already performs. The AI Spike Storyteller sends up to 15 representative context posts to Azure OpenAI — consistent with the existing `azureOpenAiConnector.ts` enrichment pattern (ADR-0038), which already processes post body text via the same provider on every enrichment call. No new redistribution path or authorship claim is introduced. The simulation stubs (translation, team assignment, response compose) are excluded on different grounds (Decision §7); no author-rights concern attaches to excluding them.

---

## Decision

### 1. Partial supersession of ADR-0054 Decision §2 and §3

Two of ADR-0054's five explicit exclusions are narrowed by this ADR:

**Exclusion (a) — AI Spike Storyteller:** Brought into scope. The specification provides a concrete, well-defined payload and structured response shape. The existing `azureOpenAiConnector.ts` is the right mechanism; the backend pattern is one new on-demand REST endpoint, not a stored aggregation. See Decision §6.

**Exclusion (b) — Predictive forecasting:** Partially brought into scope, but only the statistical client-side fallback. The AI-backed `POST /api/predictive-forecast` endpoint is deferred (Open Questions). The Crisis Alert Radar and Sentiment Trajectory banners are built, driven by the statistical fallback — see Decision §5.

ADR-0054 Decision §3's "no new `social-listening-core` endpoint" clause is superseded **narrowly and only for the Spike Storyteller endpoint**: `POST /v1/posts/explain-spike` is authorized (Decision §6). The broader rationale — avoiding stored aggregation, not pre-building scope before a demonstrated need — is fully intact. An on-demand, user-triggered AI explanation call is a categorically different kind of endpoint from a pre-computed aggregation endpoint.

ADR-0054 Decision §2's other three exclusions (D3 topic-cluster graph, Location pulse-map, PDF export/action workflows) remain in full force, unchanged by this ADR.

A dated "Pending supersession note" is added to ADR-0054's own Decision §2 and Decision §3, per `docs/adr/README.md`'s governance-table Row 5 — taking effect only if and when this ADR is accepted.

### 2. Overview tab grid layout

The Overview tab is restructured from its current three-KPI-card layout (Stories 8.1/8.4) to the specification's three-column responsive grid (`grid-cols-1 lg:grid-cols-12`):

- **Left column** (`lg:col-span-3`): Sentiment Gauge, Authors by Source
- **Centre column** (`lg:col-span-6`): Volume & Projections Timeline, Word Cloud / Key Phrases, Languages Distribution
- **Right column** (`lg:col-span-3`): Sources Volume Breakdown, Top Authors Feed, AI Spike Storyteller (conditional)

Each widget carries the stable `id` attribute the specification names in §5 (`id="widget-sentiment-gauge"`, `id="widget-timeline-volume"`, `id="widget-wordcloud"`, `id="widget-languages"`, `id="widget-sources-volume"`, `id="widget-top-authors"`, `id="widget-spike-storyteller"`, `id="widget-authors-by-source"`) — these must be preserved verbatim in the final component for E2E selector and analytics instrumentation purposes.

`id="widget-location-insights"` and `id="widget-watchlist-coverage"` are not rendered — see Decision §8.

### 3. Filter state model

The specification's 11-dimension flat filter model (§4.1) is adopted for the dimensions backed by real data:

**Adopted (real data exists):**
- `activeDateFilter` — chart-bar date drill-down; triggers AI Spike Storyteller (Decision §6)
- `activeSourceFilter` — real `providerId`: `gnews`, `newswire`, `tenant-owned-feed`
- `activeAuthorFilter` — real `author` from `extractAuthor()`
- `activeKeywordFilter` — key-phrase substring match against real `enrichment.keyPhrases`
- `activeLanguageFilter` — ISO 639-1 code from real `enrichment.detectedLanguage` (ADR-0055)
- `activeSentimentFilter` — `'Positive'`, `'Neutral'`, `'Negative'`
- `selectedDateRange` — preset date-range key (already wired via `GlobalDateRangePicker`, Story 8.1)
- `activeWatchlistFilter` — Watchlist-based topic filter: fetches the user's active watchlists from the existing `GET /v1/watchlists` endpoint (`{ watchlists: Watchlist[] }`, scoped to the caller via RLS); presents them as a dropdown defaulting to `'all'`. For `keyword` and `hashtag` `matchType` watchlists only: each `terms[]` entry is matched case-insensitively against the post's `bodyMarkdown` field (already present in `SocialPostSummary` per ADR-0053/Story 3.10). `boolean_query` watchlists are excluded from the dropdown at v1 — re-implementing the full boolean AST client-side (AND/OR/NOT/TERM/HASHTAG/ACCOUNT) carries a fidelity risk against the server's own `matchesAst()` path (ADR-0021 consistency mandate). The approximation is disclosed in the widget's tooltip: "Approximate match — based on keyword terms in post text; advanced boolean watchlists are not included." No new `social-listening-core` endpoint is introduced; `GET /v1/watchlists` already exists and serves this purpose.

**Not adopted (no real data backing):**
- `activeRegionFilter` — no geo data (ADR-0054 §4 still intact)
- `activeIntentionFilter` — no `intention` field (ADR-0054 §2 still intact)
- `activeTagFilter` — no `tag` field (ADR-0054 §2 still intact)

All adopted filter dimensions are applied as `useMemo` predicates over the raw `posts[]` array per the specification's §4.2 pipeline, consistent with ADR-0054 Decision §3 (client-side aggregation only).

**Pending supersession note (2026-08-19):** ADR-0063 (Proposed 2026-08-19) — if and when accepted — adds a `post_watchlist_matches` junction table and a `GET /v1/posts?watchlistId=<id>` filter parameter, enabling `activeWatchlistFilter` to be upgraded (Story 8.9) from the client-side approximation above to a proper server-side query covering all `matchType` values including `boolean_query` watchlists. The tooltip disclosure ("Approximate match — based on keyword terms in post text; advanced boolean watchlists are not included") would be retired at Story 8.9's build time. Takes effect only if and when ADR-0063 is accepted by Menno.

### 4. Active filter chips bar and deep-link share state

**Active filter chips bar:** A chip bar renders between the header and the widget grid whenever any real-data-backed filter is active. Each chip is colour-coded per §6.2 and carries a `×` dismiss control. A "Clear all" text link resets all active filters simultaneously. The chip bar covers only the adopted filter dimensions (Decision §3) — no chip for region, intention, or tag.

**Deep-link share state:** On mount, the component reads URL search parameters (`tab`, `source`, `author`, `keyword`, `language`, `sentiment`, `range`, `watchlist`) and hydrates the corresponding filter states. The `handleShareView()` function serialises current filter state into a URL, writes it to the clipboard via `navigator.clipboard.writeText`, and shows a 3-second "Link Copied!" confirmation on the Share View button. The `watchlist` param carries the selected watchlist's `id` (`'all'` for the default state). Pure client-side, no backend change.

### 5. Statistical volume forecast, Crisis Alert Radar, and Sentiment Trajectory

**Statistical forecast — client-side, synchronous, no backend:**

The specification's statistical decay model is adopted as the sole forecast mechanism for v1:

`projectedVolume[n] = lastHistoricalVolume × 0.85ⁿ + 850 × (1 − 0.85ⁿ)`

where `n` is the number of projected days (1–7) and `850` is the mean-reversion baseline. Computed synchronously from the filtered posts' volume history, producing an immediate 7-day projection with no server round-trip. The `Forecast ON/OFF` toggle shows/hides this projected series and its associated indigo fill gradient.

**Crisis Alert Radar:** A compact banner (`id` is part of the `widget-timeline-volume` compound widget, not a separate widget slot) derived client-side from the statistical projection. Alert level (`OK` / `WARNING` / `CRITICAL`) is determined by comparing the projected 7-day peak against the current period's mean. Specific threshold ratios are left to Story 8.7's implementation-time judgment (Open Question 3) rather than fixed here as a durable architectural decision.

**Sentiment Trajectory:** A banner derived client-side from the direction and rate of change in `sentimentStats` over the selected date range — a linear trend over the day-bucketed sentiment history `computeSentimentHistory()` already computes. Velocity is expressed as "+N% / day" or "−N% / day". **No confidence interval is rendered** — without a real probabilistic model, a synthetic confidence percentage would be fabricated, the same category of defect this project has consistently rejected.

**`POST /api/predictive-forecast` (AI-backed) — deferred:** The specification describes this endpoint replacing the statistical fallback with AI-generated values feeding the same three surfaces. Deferred: a tenant demonstrating real forecast accuracy improvement over the statistical model has not been established — per the same "don't build ahead of a demonstrated need" discipline (ADR-0020 precedent). Named as Open Question 2.

### 6. AI Spike Storyteller

**Decided: in scope.** The AI Spike Storyteller ships as widget `id="widget-spike-storyteller"` in the right column, conditional on `activeDateFilter` being non-null — visible only when the user has clicked a specific chart bar on the Volume & Projections Timeline.

**Backend — one new endpoint in `social-listening-core`:**

`POST /v1/posts/explain-spike` — an on-demand, user-triggered call. One request per user action; no background polling, no stored result.

- **Authorization:** `requireTenantUser()` (both `tenant_admin` and `tenant_user` are allowed — this is a read-and-explain operation, not a write or admin action).
- **Request body:** `{ date: string, source?: string, topic?: string, postCount: number, sentimentScore: number, contextPosts: SocialPostSummary[], customPrompt?: string }`. The `contextPosts` array is capped server-side at 15 items.
- **AI provider:** the existing `azureOpenAiConnector.ts` (ADR-0038 §2) — no new AI provider. Credentials are resolved from Key Vault via the tenant's existing Tier-2 `platform_credentials` row for Azure OpenAI (ADR-0028), the same path enrichment calls already use. No new credential mechanism is introduced.
- **Response:** `{ headline: string, explanation: string, keyDrivers: string[], topContributors: string[], suggestedActions: string[] }`.
- **On Azure OpenAI failure:** structured error response; the frontend renders a descriptive error string in the widget. Never a silent empty state.

**Frontend — three-phase UX per §8.1:**

1. Loading skeleton while the POST is in flight (`loadingSpike` true).
2. Resolved narrative rendered in prose once `spikeExplanation` is populated.
3. Custom prompt: a `<textarea>` allows the user to enter `customSpikePrompt` and re-fire the API call, replacing the previous explanation.

Clicking the active chart bar a second time toggles `activeDateFilter` back to null, dismissing the widget. Pressing the `×` on the date drill-down chip has the same effect.

**Credential availability degradation:** The Spike Storyteller widget does not appear if no Azure OpenAI credential is active for the tenant (same graceful degradation pattern as AI-dependent Sentiment/Key-Phrase widgets on other tabs — silence rather than error for an uncredentialed tenant).

**Relationship to ADR-0054 §3:** `POST /v1/posts/explain-spike` is a new `social-listening-core` endpoint — a narrow supersession of ADR-0054 Decision §3's "no new endpoint" clause for this one, on-demand AI call. The clause's actual intent — avoiding stored aggregation and not pre-building backend scope before a real consumer exists — is fully intact: this endpoint has a real, concrete consumer (the Spike Storyteller widget) and produces no stored output.

### 7. Posts Slideout Drawer and simulation stubs

The existing Posts Slideout Drawer (Story 6.11/6.16 `Slideover` pattern, extended in Stories 8.2/8.3 for widget click-through) is extended to surface: full post text with source metadata; enrichment detail (sentiment label + score bars, key phrases, detected language — the new `PostEnrichmentSummary.language` field from Story 8.5). External link to the original post URL (`<ExternalLink>` icon). Priority toggle (`isHighPriority`) as a stateless client-side flag.

**Simulation stubs are not built.** The specification describes:
- MSE Machine Translation (`handleTranslate` — "simulates an MSE Machine Translation call with a 600ms delay")
- Team assignment dropdown (`handleAssign` — "2.5s success confirmation")
- Response compose field (`handleSendResponse` — "direct reply simulation")

All three are explicit simulations of non-existent services. Per this project's established discipline (ADR-0054 Decision §2: no fabricated data presented as real), these are excluded. The specification's own framing — "simulates" — confirms this is the same category of defect this project rejected when removing the Sentiment tab's `TOP_FANS`/`TOP_CRITICS` hardcoded fallback (Story 8.2 AC2) and the Conversations tab's `MAIN_PHRASES` static array (Story 8.3 AC1). A stub that looks like a feature but calls nothing misleads a tenant user about actual platform capability.

### 8. Widget-by-widget scope decisions

| Widget | Decision | Reasoning |
|---|---|---|
| Sentiment Gauge (SVG tri-arc ring) | **Build** | Real `sentimentStats`; implemented as inline SVG with `strokeDashoffset` — no new library needed (the specification itself describes the arithmetic: §5) |
| Volume & Projections Timeline | **Build** | Real volume history + statistical forecast (Decision §5); Recharts `<AreaChart>` with dashed `strokeDasharray` projected series |
| Word Cloud / Key Phrases | **Build** | Real `enrichment.keyPhrases`; reuse Conversations tab computation |
| Languages Distribution | **Build** | Real `enrichment.detectedLanguage`; reuse Story 8.5 widget |
| Sources Volume Breakdown | **Build** | Real `providerId` breakdown; reuse Stories 8.1/8.6 |
| Authors by Source | **Build** (3 real connectors only) | `gnews` / `newswire` / `tenant-owned-feed` source icons only — the specification's 8-platform roster (X/Twitter, LinkedIn, YouTube, Instagram, Facebook, Blog/RSS, GNews, Newswire) is not adopted; those platforms are not this project's real connectors |
| Top Authors Feed | **Build** (initials avatars) | Real `author` + post count aggregation; **Unsplash URLs are rejected** (external CDN, no content-hosting contract in scope) — deterministic initial-letter avatars are always available and never fail |
| AI Spike Storyteller | **Build** (conditional on `activeDateFilter`) | Decision §6 |
| Location Insights (SVG world map) | **Not built** | ADR-0054 Decision §4 unchanged: no connector populates `post_geo_location`; `SocialPostSummary` excludes it |
| Watchlist Coverage (PieChart donut) | **Not built** | Spec's own framing ("static for now, pending real watchlist matching API") confirms there is no real data to back it — this is the fabricated-placeholder pattern this project consistently rejects. **Pending supersession note (2026-08-19):** ADR-0063 (Proposed 2026-08-19), if accepted, adds the `post_watchlist_matches` junction table that would make real per-watchlist post counts available; Story 8.9 would then build this widget. Takes effect only if and when ADR-0063 is accepted by Menno. |

### 9. Chart library — no D3

The specification §10 names three bespoke D3 components (`<D3Sparkline>`, `<D3SentimentGauge>`, `<D3TrendingTopicsChart>`). D3 is not a current dependency of `social-listening-admin`; adding it for three chart types achievable without it is disproportionate:

- **Sentiment Gauge:** implemented as inline SVG with `strokeDashoffset` arithmetic — as the specification itself describes the mechanism in §5. No library.
- **Sparklines:** implemented with Recharts `<LineChart>` (no axes, no labels — the minimal shape Recharts already supports). No new library.
- **Trending Topics chart:** the existing word cloud (flex-wrapped `<button>` elements, font-size scaled by weight class) is the target; no separate D3 chart is specified for it in §5 beyond this presentation.

Recharts remains the sole charting library, consistent with ADR-0054 Decision §5.

---

## Consequences

**Positive**

- The Overview tab becomes a genuine at-a-glance command centre with real multi-dimensional filtering, replacing the current three-card summary. Every widget slot is filled with either a real-data widget or an explicit, documented exclusion — no silent gaps.
- The AI Spike Storyteller adds genuinely new analytical value: a user who notices an unusual volume spike can get an AI-generated narrative in-context, reusing the existing Azure OpenAI infrastructure at no new provider-onboarding cost.
- The statistical forecast is available immediately and honestly labelled — a real user benefit with no server round-trip required.
- Deep-link share state allows capturing and sharing an exact filter configuration — a real collaboration feature at very low implementation cost.
- The filter model covers all real, enrichment-backed dimensions (source, author, keyword, language, sentiment, date drill-down) plus a Watchlist-based topic filter (`activeWatchlistFilter`) using the already-built `GET /v1/watchlists` endpoint — the full set the data actually supports today, with no new backend surface required for the watchlist dimension.

**Negative**

- **One new `social-listening-core` endpoint** (`POST /v1/posts/explain-spike`) — a partial supersession of ADR-0054 Decision §3's intent. Story 8.8 inherits a real cross-repo implementation dependency.
- **Location Insights widget: still absent.** A visible gap in the left column; with Location absent, the left column has two widgets (Sentiment Gauge, Authors by Source) rather than three.
- **Watchlist Coverage: not built.** The centre column has one fewer widget than the specification's layout assumes.
- **No simulation stubs** (translation, team assignment, response compose). The Posts Drawer is less demo-complete than the specification envisions — the correct trade-off for a real product, but a divergence from the spec.
- **Author avatars: initials only.** No photo-realistic thumbnails in the Top Authors Feed.
- **Three filter dimensions unbuilt** (`activeRegionFilter`, `activeIntentionFilter`, `activeTagFilter`). The `+Add filters` modal, if built, has limited non-redundant content until those fields gain real backing data.
- **`activeWatchlistFilter` is a client-side approximation.** Only `keyword`/`hashtag` watchlists produce a real filter predicate; `boolean_query` watchlists are excluded at v1 — that gap is disclosed in the widget tooltip. The match runs against `bodyMarkdown` post-fetch (client-side), not the server-side ingestion match that originally classified each post — results may differ from what the platform stored at ingestion time (same approximation caveat ADR-0006 already names for connector-side vs. fallback semantics). A `post_watchlist_matches` junction table (Open Question 1) would enable a true server-side filter on `GET /v1/posts`.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Include Location Insights with the SVG world map but no real data, labeled "coming soon"** | Rejected. ADR-0054's own Alternatives Considered table already rejected this exact pattern for a different Location widget — a placeholder in a production tenant-facing screen is the same category of defect as a fabricated number. |
| **Include Watchlist Coverage with static slices, labeled as illustrative** | Rejected. The specification itself acknowledges "static for now" — that phrasing is this project's own "no fabricated placeholder data" rule applied by the specification's own author. No override warranted. |
| **Add D3 for the three named bespoke components** | Rejected. The SVG gauge, sparklines, and word cloud are each achievable with inline SVG or Recharts. D3 is best reserved for genuinely complex graph-shaped visualisations; none of the three cases qualifies, and adding a heavy dependency for them is disproportionate. |
| **Build `POST /api/predictive-forecast` (AI-backed) alongside `POST /v1/posts/explain-spike`** | Rejected for v1. The statistical fallback provides an immediate, real forecast line. An AI-backed model has no demonstrated accuracy advantage over it at this project's current tenant scale. Named as Open Question 2. |
| **Use Unsplash URLs for author avatars in Top Authors Feed** | Rejected. Unsplash is an external CDN with its own Terms of Service; serving profile images from a third-party CDN in a tenant-facing screen introduces a content-hosting dependency that has never been evaluated or contracted. Initials/placeholder avatars are always available and never fail. |
| **Build `activeWatchlistFilter` as a real watchlist-based filter now** | Adopted — partial. `GET /v1/watchlists` already exists and returns `keyword`/`hashtag` watchlists with `terms[]`; client-side matching against `bodyMarkdown` is feasible without any new `social-listening-core` surface. `boolean_query` watchlists are excluded at v1. A `post_watchlist_matches` junction table (Open Question 1) remains the proper long-term path for a fully accurate server-side filter on `GET /v1/posts`. |
| **Include MSE translation / team assignment / response compose simulation stubs** | Rejected. All three are explicit stubs of non-existent services. The specification's own "simulates" framing confirms this is the same category of defect this project rejected in the Sentiment tab's `TOP_FANS`/`TOP_CRITICS` hardcoded fallback and the Conversations tab's `MAIN_PHRASES` static array. A stub that looks like a feature but calls nothing misleads a real tenant user. |
| **Keep the current three-KPI Overview layout and add widgets to the other tabs instead** | Rejected. The user's direct request is to enhance the Overview tab specifically, and the current layout is too sparse compared to the real data available. |

---

## Open Questions

1. **`post_watchlist_matches` junction table — proper server-side watchlist filtering.** The `activeWatchlistFilter` adopted in Decision §3 is a client-side approximation: `keyword`/`hashtag` watchlist `terms[]` matched against `bodyMarkdown` post-fetch. The accurate, server-side path would require a persisted junction table (e.g. `post_watchlist_matches`) linking each `social_post` to every watchlist it matched at ingestion time — enabling `GET /v1/posts?watchlistId=<id>` as a true server-side filter. This is a `social-listening-core` schema addition (new migration, junction table, new `postsRouter.ts` filter parameter) requiring its own ADR and story. It would also enable the Watchlist Coverage widget (currently not built per Decision §8) to use real per-watchlist post counts. Not authorized here; named so the next architect finds the gap rather than re-deriving it from scratch.

2. **`POST /api/predictive-forecast` (AI-backed)** — named, not built. Revisit if a tenant demonstrates a real need for accuracy beyond the statistical fallback, or if the `explain-spike` endpoint is later extended to return forecast data as part of its already-authorized response.

3. **Crisis Alert Radar thresholds** (`WARNING` / `CRITICAL` trigger ratios) — left to Story 8.7's implementation-time judgment rather than fixed as a durable architectural decision here. Revisit only if a tenant-facing alert threshold becomes a product commitment needing contractual stability.

4. **`+Add filters` modal scope** — the specification (§6.3) describes a modal surfacing additional dimensions "not exposed in the main header (e.g. region, language, intention, content tag)." For v1, since region/intention/tag are not built and language/sentiment are already in the main filter chips, the modal's non-redundant contribution is limited. Whether to build it as a full filter panel or defer it until more dimensions are real is left to Story 8.7's implementation-time judgment.

5. **Left-column layout with Location Insights absent** — the specification's left column has three widgets; with Location absent, the column has two. Whether to stretch the remaining two, introduce a different third real-data widget, or accept the two-widget layout is left to Story 8.7's implementation-time judgment.

6. **Per-widget CSV/JSON export (`onExportWidgetData`)** — ADR-0054 Open Question 3, still undecided, inherited unchanged by this ADR. The specification includes export buttons on several widgets; this ADR does not authorize them.

7. **Sentiment Trajectory confidence interval** — the specification describes a "confidence percentage" derived from `forecastResponse.sentimentTrajectory`. Without a real probabilistic model, a synthetic confidence value would be fabricated. Decision §5 omits it; named here so the implementation does not substitute a made-up number.

---

*Drafted 2026-08-19 by the orchestrating session, at Menno's direct request ("I would like a new ADR to enhance the Tenant Analytics Overview page with the recommendations written in the attached"). Verified directly before drafting, not assumed from the request: `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md` (read in full — confirmed the five explicit exclusions and their source document); `docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md` (read in full); `docs/user-stories/epic-8-analytics-dashboard.md` (read in full — confirmed Stories 8.1–8.6 built status and the "Boundary" paragraph); `docs/adr/README.md` (read, governance conventions and ADR-0054/0055 footnotes). The specification document (Frontend Specification Sections 4–10, provided by Menno 2026-08-19) was read in full before drafting. Left **Proposed**, per this project's ADR-acceptance authority convention — Menno (Sponsor) reviews and accepts separately. Per this series' own "no story until acceptance" precedent (ADR-0024/0026), **Story 8.7** (enhanced Overview tab grid, filter model, widget layout, statistical forecast, filter chips, deep-link share) and **Story 8.8** (AI Spike Storyteller — `POST /v1/posts/explain-spike` backend endpoint + frontend widget) are drafted alongside this ADR in `docs/user-stories/epic-8-analytics-dashboard.md`, both **Blocked — pending ADR-0062 acceptance**.*
