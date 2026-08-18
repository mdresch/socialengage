# Frontend Specification (Continued): Post Analytics Overview Tab
## Sections 4 – 10

---

## 4. State Management & Data Architecture

### 4.1 Core Filter State

The component hosts a flat, co-located filter model. All active filters live as nullable string values in component-level `useState` hooks. There is no global store, Redux slice, or context mutation — all filtering is a pure, synchronised `useMemo` pipeline over the raw `posts[]` array passed in from the app context.

| State Key | Type | Default | Description |
|---|---|---|---|
| `selectedTopic` | `string` | `'all'` | Watchlist/topic selector. `'all'` disables the topic predicate. |
| `selectedDateRange` | `string` | `'week_future_decoded'` | Key into the `PRESET_DATE_RANGES` catalogue. |
| `activeDateFilter` | `string \| null` | `null` | Chart-click date drill-down (e.g. `'13 Aug'`). |
| `activeSourceFilter` | `string \| null` | `null` | Ingestion source platform ID. |
| `activeAuthorFilter` | `string \| null` | `null` | Author name exact match. |
| `activeKeywordFilter` | `string \| null` | `null` | Key-phrase substring match. |
| `activeLanguageFilter` | `string \| null` | `null` | ISO language code (`en`, `de`, `fr`…). |
| `activeRegionFilter` | `string \| null` | `null` | Geo-region display name. |
| `activeSentimentFilter` | `string \| null` | `null` | `'Positive'`, `'Neutral'`, or `'Negative'`. |
| `activeIntentionFilter` | `string \| null` | `null` | Intent category (`'complaint'`, `'purchase'`). |
| `activeTagFilter` | `string \| null` | `null` | Content tag (`'announcement'`). |

### 4.2 Derived Computations (useMemo)

All derived data is computed as memoised values; none are stored in state. The dependency arrays are the filter primitives above plus the raw `posts[]` input.

- **`filteredPosts`** — applies all active filters in sequence. Each predicate is a guard-and-return; a post that fails any predicate is excluded.
- **`sentimentStats`** — iterates `filteredPosts`, accumulates `pos/neu/neg` counts and a weighted `scoreSum`, normalises to a 0–10 scale, and returns `{ positive, neutral, negative, index, delta, posPct, neuPct, negPct }`.
- **`timelineData`** — builds a 7-day historical series from baseline volume constants scaled by `filteredPosts.length`. When `showForecast` is `true`, appends a 7-day projection series (either from the `/api/predictive-forecast` response or a statistical decay fallback).
- **`sourcesData`** — cross-references each of the 8 platform IDs against `filteredPosts`, producing `{ id, name, count, authors, percentage, trend }` rows.
- **`authorsData`** — merges a static seed list with dynamically discovered unique authors from `filteredPosts`.
- **`dateRangeMetrics`** — maps `selectedDateRange` to a formatted count string and a delta text/trend pair. When any filter is active, derives counts live from `filteredPosts.length`.
- **`dynamicTrendingTopics`** — aggregates key-phrase frequencies from `filteredPosts.enrichment.keyPhrases`, falls back to a curated static word-cloud dataset when the dynamic corpus is too small.
- **`watchlistCoverage`** — returns watchlist-match coverage slices for the donut pie widget (static for now, pending real watchlist matching API).
- **`languagesData`** — returns a static language distribution array (English 74.8%, German 7.6%, French 7.4%, Italian 4.7%, Spanish 3.5%, Japanese 1.9%).

### 4.3 Server-Side Intelligence Calls

Two async intelligence endpoints are invoked on specific trigger events:

**Spike Storyteller** (`POST /api/explain-spike`)
- Triggered when `activeDateFilter` changes to a non-null value.
- Payload includes: `date`, `source`, `topic`, `postCount`, `sentimentScore`, up to 15 representative `contextPosts`, and an optional `customPrompt` string entered by the user.
- On success the response object is stored in `spikeExplanation` state and rendered in the AI panel beside the timeline chart.
- On failure, `spikeError` is set and a descriptive error string is shown in place of the explanation.

**Predictive Forecast** (`POST /api/predictive-forecast`)
- Triggered on mount and whenever `selectedTopic` or `activeSourceFilter` changes.
- Payload includes: `topic`, `activeSource`, `sentimentStats`, and 15 representative posts.
- The response populates `forecastResponse`, which feeds the 7-day projected series in `timelineData`, the Crisis Alert Radar badge, and the Sentiment Trajectory banner.
- A statistical decay model (`baseVol × 0.85ⁿ → meanRevert`) is used as an immediate synchronous fallback so the chart never blocks.

### 4.4 Deep-Link Share State

On mount, the component reads URL search parameters (`tab`, `topic`, `source`, `author`, `keyword`, `language`, `region`, `sentiment`, `intention`, `tag`, `range`) and hydrates all corresponding filter states. The `handleShareView()` function serialises the current filter state back into a URL, writes it to the clipboard via `navigator.clipboard.writeText`, and shows a 3-second "Link Copied!" confirmation on the Share View button.

---

## 5. Widget Inventory

The overview panel renders a three-column responsive grid (`grid-cols-1 lg:grid-cols-12`) containing nine distinct widgets. Each widget carries a stable `id` attribute for deep-link anchoring, E2E testing, and analytics instrumentation.

### Left Column — `lg:col-span-3`

**Widget: Sentiment Gauge** (`id="widget-sentiment-gauge"`)

A tri-arc SVG gauge ring (radius 38, strokeWidth 8) rendered with three concentric stroked circles — a slate-200 background track, an emerald-500 positive arc, and a rose-500 negative arc. Arc lengths are controlled via `strokeDashoffset` computed from `sentimentStats.posPct` and `sentimentStats.negPct`. The centre of the ring hosts a context-aware Lucide icon: `<Smile>` (emerald) for index ≥ 6, `<Meh>` (amber) for index 4–6, `<Frown>` (rose) for index < 4. Below the ring a three-segment horizontal bar (emerald / slate / rose) repeats the split in linear form. The numeric index is displayed to the left and the delta label to the right of the ring.

**Widget: Location Insights** (`id="widget-location-insights"`)

An SVG world-map canvas (`viewBox="0 0 500 280"`) with stylised continent polygons rendered as `<path>` elements. Each continent is clickable and sets `activeRegionFilter` to the corresponding region name, with a hover fill transition from slate-200 to blue-300. Overlaid on the map are pulsing `<circle>` hotspot nodes in blue-600/blue-500 at fixed coordinates representing high-density posting regions (North America: 3 nodes; Europe: 3 nodes; Asia: 2 nodes; Latin America: 1 node). The primary node in North America carries `className="animate-pulse"` for a breathing attention cue. Below the canvas three clickable pill buttons surface regional breakdowns for North America, Europe, and Asia Pacific, each toggling the region filter.

**Widget: Authors by Source** (`id="widget-authors-by-source"`)

A 80×80px SVG donut (radius 32, strokeWidth 6, sky-blue stroke) shows aggregate author reach. To its right, a scrollable list of up to 8 platform source rows is rendered from `sourcesData`. Each row is a `<button>` that sets `activeSourceFilter`; the active row receives a `ring-1 ring-blue-500 bg-blue-50` highlight. Source icons are brand-coloured 16×16px squares (sky for X/Twitter, `#0077B5` for LinkedIn, `#FF0000` for YouTube, an Instagram gradient, `#1877F2` for Facebook, `#F26522` for Blog/RSS, emerald-600 for GNews, indigo-600 for Newswire).

### Centre Column — `lg:col-span-6`

**Widget: Volume & Projections Timeline** (`id="widget-timeline-volume"`)

A full-width 224px Recharts `<AreaChart>` rendering three data series:

- `volume` (blue-500 fill gradient, historical 7-day window)
- `projectedVolume` (indigo-500 fill gradient, 7-day forecast window, dashed appearance via `strokeDasharray`)
- `average` (slate-400 stroke, no fill, moving average reference line)

The chart is click-interactive: clicking any data point or label sets `activeDateFilter` to the `day` key, which simultaneously filters `filteredPosts` and triggers the Spike Storyteller API call. A `<Forecast ON/OFF>` toggle button above the chart shows/hides the projected series and the associated indigo fill gradient.

Two informational banners sit between the chart controls and the canvas:

- **Crisis Alert Radar** — a compact alert card (amber-50/amber-200 border when `crisisRadar.alertLevel` is WARNING or CRITICAL, emerald-50/emerald-100 otherwise) with a `<Radio>` icon that animates with `animate-pulse` at elevated alert levels.
- **Sentiment Trajectory** — an indigo-50 card showing predicted velocity (e.g. "+2.4% / day") and confidence interval derived from `forecastResponse.sentimentTrajectory`.

A `AnimatedChartTooltip` floats on hover, showing Historical Volume, Projected Volume, and Moving Avg values, with a "Filtered" badge when the hovered day matches the active date filter. Clicking the chart again on the same day deactivates the filter (toggle behaviour).

**Widget: Watchlist Coverage** (`id="widget-watchlist-coverage"`)

A `<PieChart>` donut with four colour-coded slices representing matched post distribution across watchlist categories (blue-500, emerald-500, violet-500, slate-300). The centre of the donut displays the matched count and total volume. A legend table to the right of the donut lists each watchlist name, count, and percentage. Export and filter-by-watchlist actions are available from the widget header.

**Widget: Word Cloud / Key Phrases** (`id="widget-wordcloud"`)

A weighted tag cloud rendered as flex-wrapped `<button>` elements. Font size is expressed via Tailwind weight/size classes (`text-2xl font-bold` down to `text-xs font-normal`). Each keyword is sentiment-tagged (`pos`, `neu`, `neg`), which governs the hover colour (blue for positive, slate for neutral). Clicking a keyword sets `activeKeywordFilter`. The top keyword by weight is simultaneously mirrored in the "Trending Topic" quick-insight card.

**Widget: Languages Distribution** (`id="widget-languages"`)

A sorted list of up to 6 detected languages with a horizontal proportional bar per language. Each language row is a `<button>` that sets `activeLanguageFilter`. Trend direction (up/flat/down) is indicated by a small Lucide icon beside the percentage.

### Right Column — `lg:col-span-3`

**Widget: Sources Volume Breakdown** (`id="widget-sources-volume"`)

An ordered list of all 8 ingestion sources with: platform icon badge, post count, unique author count, relative-width bar (computed from `src.percentage`), and a trend indicator. Each row is clickable to filter by source. An Export button in the widget header triggers a JSON download of the current `sourcesData` array.

**Widget: Top Authors Feed** (`id="widget-top-authors"`)

An avatar list of up to 6 authors by post volume. Each author card shows an avatar (Unsplash URL), display name, originating platform icon, post count, and trend arrow. Clicking an author card sets `activeAuthorFilter` to the author's name. A "View all posts →" link opens the Posts Drawer pre-filtered to that author.

**Widget: AI Spike Storyteller** (`id="widget-spike-storyteller"`)

Conditional render — visible only when `activeDateFilter` is non-null. Shows a loading skeleton while `loadingSpike` is true. When `spikeExplanation` is populated, renders the AI-generated narrative explanation of the spike. A `<textarea>` input allows the user to enter a `customSpikePrompt` to refine the query, submitted by pressing Enter or clicking the "Ask AI" button. The widget header carries a purple gradient accent to visually distinguish it from the data widgets.

---

## 6. Filter System & Active Filter Chips

### 6.1 Header Filter Bar

The filter bar is a full-width panel (`rounded-none border border-slate-200/90 shadow-2xs`) housing three zones:

**Left zone:** The topic selector (`<select>`) rendered in `text-2xl font-light` with no visible border, giving the appearance of a display-level heading rather than a form control. Beneath it the five sub-navigation tabs are rendered as text buttons with a 2px sky-500 bottom underline on the active tab.

**Right zone:** The `<GlobalDateRangePicker>` component, a KPI pill showing the period's total post count and delta trend with directional arrows (`<ArrowUpRight>` / `<ArrowDownRight>` / `<MoveRight>`), and the POSTS slideout trigger. An active filters count badge (`N Filters × clear`) appears conditionally when `activeFiltersCount > 0`.

### 6.2 Active Filter Chips Bar

When any filter is active, a secondary chip bar renders between the header and the quick-insight cards (`bg-slate-50 border-b border-slate-200 px-4 py-1.5`). Each active filter dimension appears as a coloured pill with a `×` dismiss control. Chip colour coding is as follows:

- Topic: blue-100 / blue-800
- Date drill-down: sky-100 / sky-800
- Source: indigo-100 / indigo-800
- Author: purple-100 / purple-800
- Phrase/keyword: amber-100 / amber-800
- Region: emerald-100 / emerald-800
- Language: teal-100 / teal-800 (uppercase text)
- Intention: rose-100 / rose-800
- Tag: cyan-100 / cyan-800

A "Clear all" text link at the end of the chip row calls `clearAllFilters()`, resetting all eleven filter states to their defaults simultaneously.

### 6.3 Add Filters Modal

The `+Add filters` button beside the sub-nav tabs opens a modal (`showAddFiltersModal` state) that presents additional filter dimensions not exposed in the main header (e.g., region, language, intention, content tag). These supplement the chart-click and chip-click interactions.

---

## 7. Posts Slideout Drawer

The "POSTS" button in the upper-right of the header toggles `showPostsDrawer`. When true, the drawer panel slides in from the right edge of the viewport. It contains a chronological feed of `filteredPosts` respecting all active filters. Each post card in the drawer is selectable; selecting a post sets `selectedPostForDetail`, which expands an inline detail view within the drawer.

The post detail panel surfaces:

- Full post text with source metadata
- Enrichment data: sentiment label + score bars, key phrases, detected language
- Translation action (`handleTranslate`) — simulates an MSE Machine Translation call with a 600ms delay and renders the translated text beneath the original
- Team assignment dropdown (`handleAssign`) with a 2.5s success confirmation
- Response compose field (`handleSendResponse`) for direct reply simulation
- Priority toggle (`isHighPriority`) rendered as a flag icon badge
- External link to the original post (`<ExternalLink>` icon)

All simulated actions reset when `selectedPostForDetail` changes or the drawer closes, via a `useEffect` cleanup.

---

## 8. AI Intelligence Panels

### 8.1 Spike Storyteller

When the user clicks a bar on the Volume & Projections chart, the AI Spike Storyteller widget becomes visible in the right column. The experience follows three phases:

1. **Loading** — a pulse skeleton replaces the widget body while the POST request to `/api/explain-spike` is in flight.
2. **Resolved** — the API response narrative is rendered in prose paragraphs. The structured response may include: `headline`, `explanation`, `keyDrivers[]`, `topContributors[]`, and `suggestedActions[]`.
3. **Custom prompt** — the user may type a follow-up question in the textarea and submit; this re-fires the API call with the `customPrompt` field set, replacing the previous explanation.

The widget dismisses and clears when the user clicks the active chart bar a second time (toggle off) or presses the `×` on the date filter chip.

### 8.2 Predictive Forecast Engine

The forecast is fetched on mount and re-fetched on every topic or source filter change. It serves three surface areas simultaneously:

- The 7-day projected volume series in the timeline chart (indigo fill gradient, `• Proj` suffix on day labels)
- The Crisis Alert Radar banner (alert level, flagged cluster, virality index)
- The Sentiment Trajectory banner (trend direction badge, velocity rate, confidence percentage)

When the server response is unavailable, the statistical fallback is applied: each projected day's volume decays as `lastVolume × 0.85ⁿ + 850 × (1 − 0.85ⁿ)`, mean-reverting toward an 850-post daily baseline. This fallback fires synchronously so the chart renders without a loading state.

---

## 9. Tab Architecture & Sub-View Delegation

The five tab buttons (`overview`, `conversations`, `sentiment`, `location`, `sources`) each render a distinct full-page sub-view component in place of the overview grid. Each sub-view receives the same shared filter state via props:

| Tab | Component | Primary focus |
|---|---|---|
| Overview | Inline grid (this spec) | Aggregate KPIs, timeline, word cloud, geo |
| Conversations | `<ConversationsDashboardTab>` | Topic clustering, intent classification, phrase drill-down |
| Sentiment | `<SentimentDashboardTab>` | Sentiment arcs, author sentiment breakdown, keyword sentiment |
| Location | `<LocationDashboardTab>` | Full geo-density map, regional breakdowns, language distribution |
| Sources | `<SourcesDashboardTab>` | Per-platform volume, reach, author counts |

Each sub-view accepts `onOpenPostsDrawer`, `onExportWidgetData`, and filter setter callbacks so that filter interactions within a sub-view propagate back to the shared header state, keeping the active filter chips bar synchronised across all tabs.

---

## 10. Migration Path: OverviewTab.tsx → AnalyticsDashboardView.tsx

The current `OverviewTab.tsx` is a lightweight, server-data-bound component that receives a pre-computed `AnalyticsSummary` prop. The target `AnalyticsDashboardView.tsx` is a full self-contained dashboard that consumes the raw `posts[]` array from the app context and derives all aggregates client-side.

The following areas require specific implementation work:

**Data contract change.** `OverviewTab` receives `summary: AnalyticsSummary` from a parent. The target pattern derives equivalent aggregates from `filteredPosts` via `useMemo`. The `AnalyticsSummary` type can be retired once all summary fields (`totalPosts`, `sentimentSplit`, `volumeHistory`, `sources`) are replaced by the memoised counterparts.

**Chart library alignment.** The current component uses Recharts throughout. The target design introduces three bespoke D3-powered components — `<D3Sparkline>`, `<D3SentimentGauge>`, and `<D3TrendingTopicsChart>` — for the quick-insight cards. These must be implemented as standalone files in `src/components/` before the cards can be assembled.

**`DeltaBadge` → header KPI pill.** The existing `DeltaBadge` inline component satisfies Story 8.4 AC4 (no badge when there is no prior data). Its equivalent in the target design is the `dateRangeMetrics` pill in the header. The `computePercentDelta` utility should be preserved and wired into the memoised `dateRangeMetrics` derivation.

**Sentiment donut upgrade.** The current 120×120px fixed `<PieChart>` donut becomes the Sentiment Gauge widget (SVG tri-arc ring with face icon) in the left column. The existing `donutData` array maps directly to the `sentimentStats` split and can be used to drive the new arc offsets.

**Volume chart upgrade.** The current `<AreaChart>` over `summary.volumeHistory` becomes the multi-series "Volume & Projections" chart. The `volumeHistory` data shape (`{ date, count }`) maps to the `timelineData` `{ day, volume }` shape. The date key should be renamed `day` and the forecast series injected before the chart is initialised.

**Empty state.** The existing `<EmptyState>` guard (`summary.totalPosts === 0`) must be preserved and extended. In the target design the empty state renders when `filteredPosts.length === 0` after all filters are applied, with body copy updated to reflect filter context.

**Routing.** The target component listens to `activeRoute` from `useApp()` and resets `selectedTopic` and `activeTab` to defaults when the analytics route is navigated to without shared URL parameters. This prevents stale filter state when the user navigates away and back.

**Deep-link hydration.** The new component must parse URL query parameters on mount (see §4.4) and apply them to the filter state before the first render, so that shared dashboard links restore the exact view that was captured.

**Accessibility IDs.** All nine widgets carry stable `id` attributes. These must be preserved verbatim in the final production component to support E2E test selectors and feature-flag instrumentation.

---

*End of specification continuation (Sections 4 – 10).*

Based on the provided specification document, here is where Data Ingestion and
Data Enrichment are sourced, structured, and processed for the Overview Tab
frontend dashboard:

1. Data Ingestion Source

Data ingestion refers to how raw data from external platform sources enters the
frontend architecture.

  - Raw Input Source (posts[] array):
      - Section 4.1 and 10 state that the dashboard consumes a raw posts[] array
        passed down directly from the app context (AnalyticsDashboardView.tsx
        consumes raw posts rather than a pre-computed backend summary).
  - Platform Source IDs (activeSourceFilter / sourcesData):
      - Section 4.1 tracks ingestion sources via activeSourceFilter (the
        ingestion source platform ID).
      - Section 4.2 (sourcesData) cross-references 8 platform IDs against
        filteredPosts to produce platform-specific rows ({ id, name, count,
        authors, percentage, trend }).
      - Section 5 (Widget: Authors by Source & Sources Volume Breakdown) lists
        the specific platform sources being ingested and displayed:
          - X / Twitter (sky-blue icon)
          - LinkedIn (#0077B5)
          - YouTube (#FF0000)
          - Instagram (gradient)
          - Facebook (#1877F2)
          - Blog / RSS (#F26522)
          - GNews (emerald-600)
          - Newswire (indigo-600)

2. Data Enrichment Source

Data enrichment refers to the metadata, linguistic analysis, sentiment metrics,
and AI intelligence appended to the raw posts either prior to frontend rendering
or via asynchronous API calls.

  - Key-Phrase Extraction (filteredPosts.enrichment.keyPhrases):
      - Section 4.2 (dynamicTrendingTopics) states that key-phrase frequencies
        are aggregated directly from filteredPosts.enrichment.keyPhrases (with a
        fallback to a static word-cloud dataset if the dynamic corpus is too
        small). This feeds the Word Cloud / Key Phrases widget (Section 5).
  - Sentiment Metrics (sentimentStats):
      - Section 4.2 (sentimentStats) processes raw posts by accumulating
        positive, neutral, and negative counts, calculating a weighted scoreSum,
        and normalizing it to a 0–10 scale ({ positive, neutral, negative,
        index, delta, posPct, neuPct, negPct }). This populates the Sentiment
        Gauge widget (Section 5).
  - Language and Geo-Data:
      - Section 4.1 & 5 track ISO language codes (activeLanguageFilter for en,
        de, fr, etc.) and geo-region display names (activeRegionFilter), which
        enrich posts with geographic and linguistic attributes.
  - Server-Side Intelligence & AI Enrichment (Section 4.3 & 8):
      - Spike Storyteller (POST /api/explain-spike): Triggered on date filter
        selection. It enriches the view with an AI-generated narrative
        (headline, explanation, keyDrivers[], topContributors[],
        suggestedActions[]) using up to 15 representative contextPosts.
      - Predictive Forecast (POST /api/predictive-forecast): Enriches the
        timeline with a 7-day projected series, a Crisis Alert Radar badge, and
        a Sentiment Trajectory confidence interval/velocity rate.
      - Post-Level Detail Enrichment (Section 7): Within the Posts Slideout
        Drawer, individual posts are enriched with MSE Machine Translation
        (handleTranslate), intent categories, team assignments, and priority
        flags (isHighPriority).
