# Frontend Specification (Continued): Post Analytics Tab — Conversations
## Sections 4 – 9

---

## 4. State Management & Props Interface

### 4.1 Component Contract

`ConversationsDashboardTab` is a pure presentation component — it owns no server-fetch logic and holds no copies of raw post data. All filter state is managed by the parent (`AnalyticsDashboardView`) and passed down via props. This makes the component stateless with respect to analytics data, while retaining local UI state for widget-level interactions only.

```ts
interface ConversationsDashboardTabProps {
  filteredPosts: Post[];              // Pre-filtered post array from parent
  selectedTopic: string;              // Active watchlist/topic key
  onSelectTopic: (topic: string) => void;
  activeIntentionFilter: string | null;
  onSelectIntention: (intention: string | null) => void;
  activeTagFilter: string | null;
  onSelectTag: (tag: string | null) => void;
  activePhraseFilter: string | null;
  onSelectPhrase: (phrase: string | null) => void;
  activeSourceFilter: string | null;
  onSelectSource: (source: string | null) => void;
  activeLanguageFilter: string | null;
  onSelectLanguage: (lang: string | null) => void;
  onOpenPostsDrawer: () => void;
  onExportWidgetData: (widgetName: string, data: any) => void;
}
```

All `onSelect*` callbacks follow a toggle convention: if the caller passes the value that is already active, the parent clears the filter (sets it to `null`). This enables the click-to-toggle behaviour visible on every list row and donut chart slice.

### 4.2 Local UI State

The component holds exactly one piece of local state:

| State | Type | Default | Purpose |
|---|---|---|---|
| `expandedWidget` | `string \| null` | `null` | Tracks which widget (by ID slug) is currently expanded to full-screen modal. The Tags and Sources widgets expose this via their `<Maximize2>` action button. |

### 4.3 Memoised Datasets

All seven analytical datasets are computed in `useMemo` hooks with empty dependency arrays (`[]`), meaning they are fixed at mount time. They represent the static reference data sourced from the Microsoft Social Engagement design reference:

- `intentionsData` — 4 intention classes, 53,398 total, with donut slices and trend labels
- `tagsData` — 3 tag categories, 757 total, with donut slices and trend labels
- `mainPhrases` — 40 keyword entries with pre-assigned Tailwind size/colour classes
- `twitterPhrases` — 14 Twitter-specific hashtag and mention entries
- `sourcesData` — 5 platform sources with formatted count strings, percentage values, and SVG brand icons
- `phrasesHistoryData` — 28-day time series for 3 phrase lines (artificialIntelligence, microsoft, newPhrase)
- `trendingPhrases` — 15 trend-aware phrase entries with pre-assigned size/colour classes
- `languagesData` — 5 language rows with monochromatic bar widths

The `renderTrendIcon(trend)` helper resolves `'up'` → `<ArrowUpRight>`, `'down'` → `<ArrowDownRight>`, `'flat'` → `<MoveRight>`, all in slate-700.

---

## 5. Widget Inventory

The component renders a `grid-cols-1 lg:grid-cols-12 gap-4` three-column layout. All widget cards share the base container class `bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs`. The `rounded-none` is deliberate — it matches the flat-panel enterprise aesthetic of the Microsoft Social Engagement reference design and distinguishes these cards from the `rounded-lg` cards in the Overview tab.

Widget headers use `text-[11px] font-bold tracking-widest text-slate-500 uppercase` for all titles. Every widget header exposes at minimum a `<Download>` action button; Tags and Sources additionally expose a `<Maximize2>` expand button. Both buttons are sized at `w-3.5 h-3.5` and styled `text-slate-400 hover:text-slate-700`.

---

### Left Column — `lg:col-span-3`

**Widget: Sentiment** (`id="widget-sentiment"`)

A standalone sentiment index display — not re-derived from `filteredPosts` in the Conversations tab context, but shown here as a persistent brand-health anchor visible alongside the intention/tag classifications.

- **Numeric index:** `text-3xl font-extralight text-slate-900` — the value `7.6` displayed to the left of the gauge ring.
- **Delta:** `text-2xl font-extralight text-slate-900` — the value `0.0` displayed to the right, accompanied by a `<MoveRight>` icon and the label "change".
- **SVG gauge ring:** Three concentric stroked circles on a 96×96 canvas, all at radius 34 and strokeWidth 7, rotated `-90deg`:
  - Background track: `stroke="#64748B"` (slate-500), full circumference
  - Negative arc: `stroke="#DC2626"`, `strokeDasharray="213" strokeDashoffset="180"` (small red segment, top-left)
  - Positive arc: `stroke="#15803D"`, `strokeDasharray="213" strokeDashoffset="110"`, `strokeLinecap="butt"` (large green segment, right half)
- **Centre icon:** `<Smile>` at `w-7 h-7 text-slate-700 stroke-1.5`
- **Index bar:** A horizontal 3-segment bar (slate-100 background) showing the -10 to +10 scale. The positive half is rendered as an emerald-700/80 block at 38% width, visualising the position on the scale.
- **Export:** `<Download>` triggers `onExportWidgetData('Sentiment', { index: 7.6, change: 0.0 })`.

---

**Widget: Intentions** (`id="widget-intentions"`)

Surfaces AI-extracted customer intent classifications across the full ingestion corpus. The sub-label `"{total} posts with intentions"` is rendered in `text-[11px] text-slate-800` beneath a small dot-ring indicator.

- **Layout:** A horizontal flexbox with a 96×96 Recharts `<PieChart>` donut on the left and a scrollable intention list on the right.
- **Donut geometry:** `innerRadius={26} outerRadius={40} paddingAngle={2}`, monochromatic dark fills:
  - Information request: `#111827` (near-black)
  - Purchase: `#374151` (dark slate)
  - Support request: `#4B5563` (medium-dark slate)
  - Complaint: `#9CA3AF` (mid-grey)
- **Active selection stroke:** When a slice's corresponding intention is active (`activeIntentionFilter === item.id`), that `<Cell>` receives `stroke="#3B82F6" strokeWidth={2}`, providing a blue selection ring without changing the fill.
- **Donut click handler:** `onClick` resolves the clicked entry back to an `intentionsData.items` record by matching `entry.name` against `item.fullLabel` or `item.label`, then calls `onSelectIntention` with the toggle pattern.
- **Intention list rows:** Each row is a full-width `<button>` with a 10px square `bg-slate-900` colour swatch, truncated label (max `truncate`), a monospaced count, and a trend arrow. Active row: `bg-slate-100 font-semibold`. Hover: `bg-slate-50`. Label truncation uses the `title={item.fullLabel}` attribute so the full text appears on native browser tooltip hover.

Intention classes and reference volumes:

| ID | Label (truncated) | Full Label | Count | Trend |
|---|---|---|---|---|
| `information_request` | Information r... | Information request | 50,996 | down |
| `purchase` | Purchase | Purchase Intention | 1,522 | up |
| `support_request` | Support requ... | Support request | 1,486 | flat |
| `complaint` | Complaint | Customer Complaint | 144 | down |

---

**Widget: Tags** (`id="widget-tags"`)

Mirrors the Intentions widget structure exactly, but operates on user-defined taxonomy rather than AI-extracted intent. The sub-label uses a `<Tag>` icon in place of the dot-ring.

- **Donut fills** (identical monochromatic scale):
  - Announcement: `#111827`
  - Advocate: `#4B5563`
  - MSE today: `#9CA3AF`
- **Active selection stroke:** Same `stroke="#3B82F6" strokeWidth={2}` pattern as Intentions.
- **Donut click handler:** Resolves `entry.name` against `tagsData.items` by `item.label.toLowerCase()`, calls `onSelectTag` with toggle.
- **Header actions:** Exposes both `<Download>` and `<Maximize2>`. The expand button sets `expandedWidget` to `'tags'`; clicking it again clears to `null`.

Tag classes and reference volumes:

| ID | Label | Count | Trend |
|---|---|---|---|
| `announcement` | Announcement | 701 | up |
| `advocate` | Advocate | 64 | down |
| `mse_today` | MSE today | 1 | flat |

---

### Centre Column — `lg:col-span-6`

**Widget: Main Phrases Word Cloud** (`id="widget-main-phrases"`)

The dominant visual element of the Conversations tab. A curated 40-keyword word cloud organised into seven horizontal flex-wrapped rows, each row centred (`justify-center items-center`). Row spacing is managed through `mb-*` and `mt-*` margins to preserve the "gravitational centre" layout of the reference design.

Typography tiers used in the cloud:

| Tier | Tailwind classes | Approximate frequency range |
|---|---|---|
| Hero | `text-3xl md:text-[38px] font-normal tracking-tight` | 142,500+ (only "artificial intelligence") |
| Large | `text-xl font-normal` | 88,000+ ("microsoft") |
| Medium | `text-base font-normal` | 34,000+ ("new") |
| Small | `text-sm font-normal` | 26,000–32,000 |
| Extra-small | `text-xs font-normal` | Under 26,000 |

Colour assignments progress from `text-slate-800` (highest frequency) down through `text-slate-700`, `text-slate-600`, `text-slate-500`, to `text-slate-400` (lowest). All terms are clickable `<span>` elements with `hover:text-slate-900 cursor-pointer` and call `onSelectPhrase(term)`.

**Hero phrase behaviour:** "artificial intelligence" is the only term rendered as a `<button>` (rather than `<span>`) to support keyboard accessibility and the full active-state class swap. When `activePhraseFilter === 'artificial intelligence'`, it switches to `text-blue-600 underline font-medium`; otherwise `text-slate-800 hover:text-blue-600`. All other terms use plain `<span>` with `onClick`.

The minimum canvas height is `min-h-[290px]` with `select-none` to prevent accidental text selection during rapid clicking.

---

**Widget: Sources** (`id="widget-sources"`) — centre column, bottom-left

Ranks the five ingestion channels by post volume with inline progress bars. Sits in the left half of a two-column sub-grid (`grid-cols-1 md:grid-cols-2 gap-4`) beneath the word cloud.

- **Row layout:** Each row is a full-width `<button>` with three zones: a left zone (brand icon + monospaced count, `w-20 shrink-0`), a centre zone (proportional `h-3` fill bar), and a right zone (trend arrow).
- **Bar width:** `Math.min(100, Math.max(8, src.percentage * 1.15))%` — the 1.15 multiplier slightly exaggerates the visual difference between the dominant Twitter share (75.1%) and the others to improve scannability at small sizes. Minimum bar width is 8%.
- **Platform colours:**
  - Twitter/X: `bg-sky-400` bar, `fill-sky-500` icon
  - RSS/Feeds: `bg-amber-500` bar, `fill-amber-600` icon
  - Facebook: `bg-blue-800` bar, `fill-blue-700` icon
  - YouTube: `bg-rose-900` bar, `fill-rose-600` icon
  - Reddit/Blogs: `bg-orange-600` bar, `fill-orange-600` icon
- **Active state:** `bg-slate-100 font-semibold` on the selected row.
- **Header actions:** `<Download>` + `<Maximize2>`.

Source reference volumes:

| Platform | Display count | Numeric | % share | Trend |
|---|---|---|---|---|
| Twitter | 453.1k | 453,100 | 75.1% | down |
| RSS / Feeds | 77,684 | 77,684 | 12.9% | flat |
| Facebook | 52,391 | 52,391 | 8.7% | up |
| YouTube | 8,966 | 8,966 | 1.5% | flat |
| Reddit / Blogs | 3,681 | 3,681 | 0.6% | flat |

---

**Widget: Phrases on Twitter** (`id="widget-twitter-phrases"`) — centre column, bottom-right

A Twitter-specific phrase cloud rendered in sky-blue tones (`text-sky-600` through `text-sky-900`). The widget title includes an inline X/Twitter logo SVG (`fill-sky-500`) immediately after the "PHRASES ON TWITTER" text. All 14 entries are `<span>` elements with `hover:underline cursor-pointer`, calling `onSelectPhrase(term)`. The cloud is organised into five horizontal rows with progressively larger terms approaching the centre, peaking at `text-sm font-semibold text-sky-900` for "#ai".

Twitter phrase entries include:
- Hashtags: `#bigdata`, `#machinelearning`, `#cloud`, `#ai`, `#azure`, `#artificialintelligence`, `#ml`, `#tech`, `#artificialintelligence #ai`
- Mentions: `@xboxsupport`, `@azure`
- Natural language: `artificial`, `artificial intelligence`, `intelligence`

---

### Right Column — `lg:col-span-3`

**Widget: Phrases History** (`id="widget-phrases-history"`)

A 160px Recharts `<LineChart>` plotting 28-day frequency trajectories for three key phrases over a date axis (`'05'` through `'02'`, representing a cross-month window).

- **Series and colours:**
  - `artificialIntelligence` → stroke `#1E3A8A` (dark navy), peaks ~14,000
  - `microsoft` → stroke `#0D9488` (teal), peaks ~4,500
  - `newPhrase` → stroke `#16A34A` (green), peaks ~3,200
- **Active phrase emphasis:** When `activePhraseFilter` matches a phrase, that series' `strokeWidth` increases from `1.75` to `3`. The corresponding legend button receives `font-bold` and a tinted pill background (`bg-blue-50`/`bg-teal-50`/`bg-emerald-50`).
- **Legend:** Three small text buttons above the chart, each with a `w-3 h-0.5` coloured dash swatch. Clicking a legend button calls `onSelectPhrase` with the toggle pattern.
- **Chart click:** `onClick` on the `<LineChart>` reads `e.activePayload[0].dataKey`, maps it back to the phrase name string, and calls `onSelectPhrase` with toggle.
- **Axes:** `XAxis` at `interval={6}` (shows 4 of the 28 day labels), Y domain 0–20,000 with ticks at 0 / 10,000 / 20,000. Left margin of `-25` compensates for the label width. Stroke colour `#94A3B8` on both axes, axis lines `#CBD5E1`.
- **Tooltip:** `AnimatedChartTooltip` with three items including "Active" badge strings when the phrase is currently selected.

---

**Widget: Trending Phrases** (`id="widget-trending-phrases"`)

A secondary word cloud of 15 contextually-rising phrases that complement the main Phrases cloud. Rendered in five horizontal rows with `min-h-[140px]` and `select-none`. All entries are `text-slate-400` through `text-slate-800` spans with `hover:text-slate-900 cursor-pointer`. The standout entry — "using artificial intelligence" (`text-sm font-medium text-slate-800`) — renders slightly larger to indicate it is the fastest-rising compound phrase. All terms call `onSelectPhrase(term)`.

---

**Widget: Languages** (`id="widget-conversations-languages"`)

An ordered list of five languages with full-width bar visualisations. Row layout mirrors the Sources widget: left name label (`w-20 text-[11px]`), centre monospaced count (`w-14 text-right font-mono text-[11px]`), centre proportional bar (`flex-1 h-3`), right `<MoveRight>` arrow.

- **Bar colours:** English uses `bg-slate-700` (dominant bar); Spanish, German, French, and Portuguese each use `bg-slate-400` (lighter bars).
- **Bar width:** `Math.min(100, Math.max(5, lang.percentage))%` — minimum 5% to keep minority languages visible.
- **Active state:** `bg-slate-100 font-semibold` on the selected language row.
- **Filter callback:** `onSelectLanguage(isSelected ? null : lang.id)` with ISO codes.

Language reference distribution:

| Code | Language | Display count | % |
|---|---|---|---|
| `en` | English | 575.3k | 95.3% |
| `es` | Spanish | 8,732 | 1.4% |
| `de` | German | 7,039 | 1.2% |
| `fr` | French | 6,705 | 1.1% |
| `pt` | Portuguese | 2,272 | 0.4% |

---

## 6. Footer Attribution Strip

A single-line footer renders beneath the three-column grid:

```
© 2017 Microsoft • Translation Guide • High-Throughput Tenant Telemetry Ingestion Active
```

Styled `text-center pt-3 pb-2 text-[10px] text-slate-400 font-normal`. This strip is a deliberate MSE design reference retained for visual fidelity; it should be replaced with a production-appropriate tenant status line during implementation.

---

## 7. Cross-Widget Filter Propagation

Every interactive element in this tab calls one of the parent-provided `onSelect*` callbacks, not local state setters. This means:

1. Clicking a donut slice in Intentions → calls `onSelectIntention` → parent updates `activeIntentionFilter` → parent's `filteredPosts` useMemo re-runs → all tabs receive the filtered post set → the active filter chip bar in the header updates simultaneously.
2. Clicking a word in the Phrases cloud → calls `onSelectPhrase` → parent updates `activePhraseFilter` → the global filter chip bar shows "Phrase: ..." with a dismiss control.
3. Clicking a source row → calls `onSelectSource` → propagates to the Overview tab's Sources Volume chart and the Conversations Sources widget simultaneously.
4. Clicking a language row → calls `onSelectLanguage` → propagates to the Location tab's language filter panel.

All interactions are therefore cross-tab — a phrase selected in Conversations remains active when the user navigates to the Sentiment tab, and vice versa. The shared filter chip bar in the global header is the single authoritative view of what is active.

**Toggle convention:** Every `onSelect*` callback should be invoked as `onSelectX(isCurrentlyActive ? null : newValue)`, where `isCurrentlyActive` is evaluated against the corresponding `active*Filter` prop. This ensures single-click activation and second-click deactivation without a separate "clear" gesture.

---

## 8. Widget Export Actions

`onExportWidgetData(widgetName: string, data: any)` is called with the widget's display name and its current dataset. The parent (`AnalyticsDashboardView`) serialises the data to JSON, creates a temporary `<a>` element with a `data:text/json` href, and triggers a download named `MSE_{widgetName}_Export.json`. A 3-second toast notification confirms the export in the bottom-right corner.

Per-widget export payloads:

| Widget | `widgetName` | `data` |
|---|---|---|
| Sentiment | `'Sentiment'` | `{ index: 7.6, change: 0.0 }` |
| Intentions | `'Intentions'` | `intentionsData` object |
| Tags | `'Tags'` | `tagsData` object |
| Phrases | `'Phrases'` | `mainPhrases` array |
| Sources | `'Sources'` | `sourcesData` array |
| Twitter Phrases | `'TwitterPhrases'` | `twitterPhrases` array |
| Phrases History | `'PhrasesHistory'` | `phrasesHistoryData` array |
| Trending Phrases | `'TrendingPhrases'` | `trendingPhrases` array |
| Languages | `'Languages'` | `languagesData` array |

---

## 9. Migration Path: ConversationsTab.tsx → ConversationsDashboardTab.tsx

The current `ConversationsTab.tsx` is a server-data-bound component that receives pre-aggregated data via the `AnalyticsSummary` prop and manages its own `activeFilter` union type locally. The target `ConversationsDashboardTab.tsx` is a presentation component that receives `filteredPosts: Post[]` and external filter callbacks from the parent orchestrator.

The following work items are required for the migration:

**Props contract replacement.** Remove `summary: AnalyticsSummary` and `range: DateRangeFilter`. Replace with the full 12-prop interface defined in §4.1. The parent (`AnalyticsDashboardView`) must thread all active filter state values and their setters down to this component on each render.

**Local filter state removal.** The current `activeFilter: { type: 'phrase' | 'language', value } | null` state and the `filteredPosts` derivation inside this component are no longer needed. The parent now handles post filtering, and `filteredPosts` arrives pre-filtered.

**Phrase/language filter unification.** The current component uses a single `activeFilter` union to represent either a phrase or language filter. The target separates these into `activePhraseFilter` and `activeLanguageFilter` as independent props. Both can be active simultaneously — the parent's `filteredPosts` already satisfies both constraints.

**View posts trigger.** The current `<button>` labelled "View {filteredPosts.length} matching posts" opens a local `<Slideover>` rendered inside this component. In the target design this is replaced by `onOpenPostsDrawer()` — a callback that opens the global Posts Drawer managed by the parent. The local `Slideover`, `drawerOpen` state, and the drawer post list rendering are all removed.

**Static dataset introduction.** The target component introduces seven `useMemo`-computed static datasets (see §4.3) replacing the dynamic `computePhraseFrequency`, `computePhraseHistory`, and `computeLanguageBreakdown` function calls. These pure-function imports from `analyticsData` are no longer needed in this component — they may still be needed by other tabs.

**Word cloud layout.** The current component's word cloud renders items as a flat flex-wrap using `sizeTier()` CSS class assignment. The target layout uses a manually layered set of horizontal row divs (seven explicit rows) to reproduce the gravitational-centre typographic layout of the MSE reference. The `sizeTier` utility is replaced by hard-coded Tailwind classes per word entry.

**Three-column grid.** The current component uses a single-column layout (`an-conversations`, `an-widget` class blocks). The target introduces the `grid-cols-1 lg:grid-cols-12` three-column grid with left (col-span-3), centre (col-span-6), and right (col-span-3) sub-columns. The Sentiment, Intentions, and Tags widgets are new additions to the left column — they have no equivalent in the current component.

**`rounded-none` card style.** All widget cards in the target use `rounded-none` to match the flat MSE panel aesthetic, in contrast to the `rounded-lg` used in the Overview tab. This is intentional and must be preserved.

**Widget ID attributes.** All nine widgets carry stable `id` attributes. These must be preserved verbatim in the production component for E2E test selectors and analytics instrumentation. The IDs are: `widget-sentiment`, `widget-intentions`, `widget-tags`, `widget-main-phrases`, `widget-sources`, `widget-twitter-phrases`, `widget-phrases-history`, `widget-trending-phrases`, `widget-conversations-languages`.

**Accessibility.** The hero "artificial intelligence" term is the only cloud word rendered as a `<button>` (keyboard-accessible). All other clickable cloud terms are `<span>` elements with `onClick`. For production accessibility compliance, all clickable spans should be promoted to `<button>` elements or given `role="button"` and `tabIndex={0}` with keydown handlers.

---

*End of specification continuation (Sections 4 – 9).*


Based on the provided frontend specification for the Conversations Tab, here is
how Data Ingestion and Data Enrichment are sourced, structured, and processed
for this specific dashboard view:

1. Data Ingestion Source

Data ingestion refers to the raw external platform channels and volume feeds
that flow into the dashboard architecture.

  - Pre-filtered Post Array (filteredPosts: Post[]):
      - Section 4.1 notes that ConversationsDashboardTab is a pure presentation
        component. It does not fetch data directly; instead, it receives a
        pre-filtered filteredPosts array passed down from its parent component
        (AnalyticsDashboardView), which itself ingests raw posts from the
        application context.
  - Platform Sources (sourcesData / Active Source Filter):
      - Section 4.3 and 5 detail the ingestion platforms represented in the
        Sources widget:
          - Twitter / X (453.1k posts / 75.1% share)
          - RSS / Feeds (77.6k posts / 12.9% share)
          - Facebook (52.3k posts / 8.7% share)
          - YouTube (8.9k posts / 1.5% share)
          - Reddit / Blogs (3.6k posts / 0.6% share)
      - These sources track volume share and are interactive via
        activeSourceFilter, allowing users to isolate conversations originating
        from specific channels.

2. Data Enrichment Source

Data enrichment encompasses the metadata, categorization, linguistic features,
and metrics (such as intent, sentiment, tags, and phrase tracking) appended to
or derived from the ingestion corpus.

  - AI-Extracted Customer Intent Classifications (intentionsData):
      - Section 5 (Widget: Intentions) surfaces AI-extracted customer intents
        across the full ingestion corpus.
      - Structured into four specific enriched intention classes:
          - Information request (50,996 posts)
          - Purchase Intention (1,522 posts)
          - Support request (1,486 posts)
          - Customer Complaint (144 posts)
  - User-Defined Taxonomy & Tags (tagsData):
      - Section 5 (Widget: Tags) processes user-applied taxonomy layers distinct
        from AI intent:
          - Announcement (701 posts)
          - Advocate (64 posts)
          - MSE today (1 post)
  - Linguistic & Phrase Extraction (mainPhrases, twitterPhrases,
    trendingPhrases):
      - Section 4.3 & 5 highlight heavily structured phrase corpuses:
          - Main Phrases Word Cloud: 40 curated keyword entries mapped to
            frequency-based typographic tiers (e.g., hero term "artificial
            intelligence" down to extra-small elements).
          - Phrases on Twitter: 14 platform-specific hashtags and mentions
            (#bigdata, #machinelearning, @azure, etc.) styled in sky-blue.
          - Trending Phrases: 15 contextually rising compound phrases (such as
            "using artificial intelligence").
  - Time-Series Frequency Trajectories (phrasesHistoryData):
      - Section 4.3 outlines a 28-day historical time-series dataset mapping
        frequency changes for specific enriched phrases (artificialIntelligence,
        microsoft, newPhrase), rendered via a line chart.
  - Persistent Health & Sentiment Metrics (Widget: Sentiment):
      - Section 5 notes a standalone sentiment index display (7.6 index with a
        0.0 delta and a visual -10 to +10 scale bar) functioning as a persistent
        brand-health anchor alongside the intention/tag classifications.
  - Language Detection (languagesData):
      - Section 4.3 & 5 structure language distributions detected across posts,
        tracking volumes and percentages for English (en - 95.3%), Spanish (es),
        German (de), French (fr), and Portuguese (pt).
