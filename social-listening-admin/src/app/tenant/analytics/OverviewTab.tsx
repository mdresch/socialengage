'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { EmptyState, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { PostDetailPanel } from '../posts/PostDetailPanel';
import { RunEnrichmentButton } from '../posts/RunEnrichmentButton';
import { flattenPost, type FlatPost } from '../posts/postDisplay';
import type { SocialPostFull, Watchlist } from '@/lib/core-client';
import {
  applyOverviewFilters,
  computeActiveChips,
  computeAuthorsBySource,
  computeCrisisAlertRadar,
  computeLanguageBreakdown,
  computePhraseFrequency,
  computeMovingAverage,
  computeSentimentIndex,
  computeSentimentSplitFromFlat,
  computeSourceBreakdownFromFlat,
  computeTopAuthorsByVolume,
  computeVolumeForecast,
  computeVolumeHistory,
  serializeOverviewFiltersToSearchString,
  EMPTY_OVERVIEW_FILTERS,
  type AnalyticsSummary,
  type DateRangeFilter,
  type OverviewFilters,
  type WatchlistCoverageEntry,
} from './analyticsData';

interface OverviewTabProps {
  summary: AnalyticsSummary;
  previousSummary?: AnalyticsSummary | null;
  range: DateRangeFilter;
  /**
   * Parsed server-side by page.tsx from the initial URL search params (the
   * same pattern already established there for `?tab=`) — never read via a
   * client-side useSearchParams() hook inside this component, which would
   * require the Next.js router context this repo's own contract tests
   * (plain renderToStaticMarkup(), no App Router provider) don't supply.
   * Defaults to EMPTY_OVERVIEW_FILTERS when omitted.
   */
  initialFilters?: OverviewFilters;
  /** Story 8.9 (ADR-0063) — watchlists list for dropdown and coverage */
  watchlists?: Watchlist[];
  watchlistCoverage?: WatchlistCoverageEntry[];
  onWatchlistChange?: (watchlistId: string | null) => void;
  dateRangePicker?: React.ReactNode;
}

const SENTIMENT_COLORS = { positive: '#15803d', neutral: '#64748b', negative: '#dc2626' };
const SOURCE_DONUT_COLORS = ['#2563eb', '#7c3aed', '#0891b2'];
const GAUGE_RADIUS = 38;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const AUTHORS_DONUT_RADIUS = 32;
const AUTHORS_DONUT_CIRCUMFERENCE = 2 * Math.PI * AUTHORS_DONUT_RADIUS;

function phraseSizeClass(rank: number): string {
  if (rank === 0) return 'an-phrase-cloud-xl';
  if (rank <= 2) return 'an-phrase-cloud-lg';
  if (rank <= 6) return 'an-phrase-cloud-md';
  return 'an-phrase-cloud-sm';
}

function initials(author: string): string {
  const parts = author.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}

/** Same `provider-pill-*` classes /tenant/posts already established (globals.css) — reused, not reinvented, for the drawer's row-level provider badge. */
function providerPillClass(providerId: string): string {
  const slug = providerId.toLowerCase().replace(/_/g, '-');
  const known = ['gnews', 'newswire', 'tenant-owned-feed'];
  return `provider-pill provider-pill-${known.includes(slug) ? slug : 'default'}`;
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Same icon PostsFeedClient.tsx already defines for its own Slideover footer's "Open original" link — kept local here too, matching this project's existing per-file icon convention (see PostDetailPanel.tsx's own header comment). */
function IconExternalLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/**
 * Story 8.7 (ADR-0062) — Overview Tab Enhancement. Replaces the prior
 * three-KPI-card layout (Stories 8.1/8.4) with a 3-column, eight-widget
 * grid, a 7-dimension AND-composed client-side filter model with
 * click-to-filter from six widgets, an active filter chips bar, deep-link
 * share state, a statistical volume forecast, Crisis Alert Radar, and
 * Sentiment Trajectory. `id="widget-spike-storyteller"` is reserved,
 * empty — Story 8.8 fills it. `selectedTopic`/Watchlist Coverage are not
 * rendered at all — reserved for Story 8.9 (ADR-0063).
 */
export function OverviewTab({
  summary,
  range,
  initialFilters,
  watchlists = [],
  watchlistCoverage = [],
  onWatchlistChange,
  dateRangePicker,
}: OverviewTabProps) {
  const [filters, setFilters] = useState<OverviewFilters>(() => initialFilters ?? EMPTY_OVERVIEW_FILTERS);
  const [forecastOn, setForecastOn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * 2026-08-19 — the drawer's post-list rows are `SentimentPost`-shaped
   * (`filteredPosts`, from `applyOverviewFilters(summary.posts, ...)`), not
   * the richer `FlatPost` `PostDetailPanel` needs (full body, raw payload,
   * entities) — that fuller shape isn't in `AnalyticsSummary` at all (only
   * the fields Story 8.2's `flattenForSentiment()` extracted). So a row
   * click fetches the one selected post's full detail on demand via the new
   * `GET /api/posts/[id]` proxy, mirroring `PostsFeedClient.tsx`'s own
   * activePost fetch-free path is not available here since Overview never
   * had `SocialPostFull` to begin with.
   */
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<FlatPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  function openDetail(postId: string) {
    setDetailPostId(postId);
    setDetailPost(null);
    setDetailError(null);
    setDetailLoading(true);
    fetch(`/api/posts/${postId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found.');
        return res.json() as Promise<SocialPostFull>;
      })
      .then((post) => setDetailPost(flattenPost(post)))
      .catch(() => setDetailError('Could not load this post.'))
      .finally(() => setDetailLoading(false));
  }

  function closeDetail() {
    setDetailPostId(null);
    setDetailPost(null);
    setDetailError(null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    closeDetail();
  }

  /** Escape/scroll-lock parity with the shared `Slideover` component's own useEffect (this drawer can't reuse it — see PostDetailPanel.tsx's own header comment for why). Escape closes the detail panel first if it's open, matching a stacked-panel convention (innermost first). */
  useEffect(() => {
    if (!drawerOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (detailPostId) closeDetail();
      else closeDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen, detailPostId]);

  // Deep-link share state (ADR-0062 Decision §4; Story 8.9 ADR-0063) — keeps the URL in sync on
  // every filter change via replaceState, never a full navigation event.
  // The `?tab=overview` param (Story 8.1) is preserved alongside it.
  useEffect(() => {
    const qs = serializeOverviewFiltersToSearchString(filters);
    const url = qs ? `?tab=overview&${qs}` : '?tab=overview';
    window.history.replaceState(null, '', url);
  }, [filters]);

  const filteredPosts = useMemo(() => applyOverviewFilters(summary.posts, filters), [summary.posts, filters]);
  const chips = useMemo(() => computeActiveChips(filters, watchlists), [filters, watchlists]);

  const sentimentSplit = useMemo(() => computeSentimentSplitFromFlat(filteredPosts), [filteredPosts]);
  const sentimentIndex = useMemo(() => computeSentimentIndex(sentimentSplit), [sentimentSplit]);
  const sourceBreakdown = useMemo(() => computeSourceBreakdownFromFlat(filteredPosts), [filteredPosts]);
  const authorsBySource = useMemo(() => computeAuthorsBySource(filteredPosts), [filteredPosts]);
  const topAuthors = useMemo(() => computeTopAuthorsByVolume(filteredPosts), [filteredPosts]);
  const phraseFrequency = useMemo(() => computePhraseFrequency(filteredPosts, 20), [filteredPosts]);
  // 2026-08-19 follow-up: capped to the top 6 (already ranked descending by
  // computeLanguageBreakdown()) at Menno's own request — a long-tail list of
  // every language present was more clutter than signal.
  const languages = useMemo(() => computeLanguageBreakdown(filteredPosts).slice(0, 6), [filteredPosts]);
  const volumeHistory = useMemo(() => computeVolumeHistory(filteredPosts, range), [filteredPosts, range]);
  const forecast = useMemo(() => computeVolumeForecast(volumeHistory, 7), [volumeHistory]);
  const movingAverage = useMemo(() => computeMovingAverage(volumeHistory, 7), [volumeHistory]);
  const crisisRadar = useMemo(() => computeCrisisAlertRadar(filteredPosts, range), [filteredPosts, range]);

  const timelineData = useMemo(() => {
    const byDate = new Map<string, { date: string; actual?: number; forecast?: number; average?: number }>();
    for (const point of volumeHistory) byDate.set(point.date, { date: point.date, actual: point.count });
    for (const point of movingAverage) {
      const existing = byDate.get(point.date) ?? { date: point.date };
      existing.average = Math.round(point.average * 10) / 10;
      byDate.set(point.date, existing);
    }
    if (forecastOn) {
      for (const point of forecast) {
        const existing = byDate.get(point.date) ?? { date: point.date };
        existing.forecast = point.projectedVolume;
        byDate.set(point.date, existing);
      }
    }
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [volumeHistory, movingAverage, forecast, forecastOn]);

  function toggleSentimentFilter(value: NonNullable<OverviewFilters['activeSentimentFilter']>) {
    setFilters((prev) => ({ ...prev, activeSentimentFilter: prev.activeSentimentFilter === value ? null : value }));
  }
  function toggleSourceFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeSourceFilter: prev.activeSourceFilter === value ? null : value }));
  }
  function toggleAuthorFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeAuthorFilter: prev.activeAuthorFilter === value ? null : value }));
  }
  function toggleKeywordFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeKeywordFilter: prev.activeKeywordFilter === value ? null : value }));
  }
  function toggleLanguageFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeLanguageFilter: prev.activeLanguageFilter === value ? null : value }));
  }
  function toggleDateFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeDateFilter: prev.activeDateFilter === value ? null : value }));
  }
  function handleWatchlistSelect(value: string | null) {
    setFilters((prev) => ({ ...prev, activeWatchlistFilter: value }));
    onWatchlistChange?.(value);
  }
  function clearChip(type: keyof OverviewFilters) {
    if (type === 'activeWatchlistFilter') {
      onWatchlistChange?.(null);
    }
    setFilters((prev) => ({ ...prev, [type]: null }));
  }
  function clearAll() {
    if (filters.activeWatchlistFilter) {
      onWatchlistChange?.(null);
    }
    setFilters(EMPTY_OVERVIEW_FILTERS);
  }

  if (summary.totalPosts === 0) {
    return (
      <EmptyState
        heading="No posts in this range"
        body="Try a wider date range, or connect a platform to start ingesting content."
      />
    );
  }

  return (
    <div className="an-overview-header-row">
      <div className="an-overview-header-controls">
        <div className="an-overview-watchlist-select-wrap">
          <label htmlFor="overview-watchlist-selector" className="an-overview-filter-label">
            Topic / Watchlist:
          </label>
          <select
            id="overview-watchlist-selector"
            className="an-watchlist-select"
            value={filters.activeWatchlistFilter ?? ''}
            onChange={(e) => handleWatchlistSelect(e.target.value || null)}
          >
            <option value="">All Topics</option>
            {watchlists.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.matchType.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
        </div>

        <div className="an-overview-header-right">
          {dateRangePicker}

          <button
            type="button"
            id="widget-filtered-post-count"
            className="an-filtered-count-btn"
            onClick={() => setDrawerOpen(true)}
          >
            <span>{filteredPosts.length.toLocaleString()} matching post{filteredPosts.length === 1 ? '' : 's'}</span>
            <span className="an-post-drawer-tag">POSTS ›</span>
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="an-filter-banner" id="an-overview-chip-bar">
          <div className="an-overview-chips">
            {chips.map((chip) => (
              <span key={chip.type} className="an-overview-chip">
                {chip.label}: {chip.value}
                <button
                  type="button"
                  className="an-overview-chip-dismiss"
                  aria-label={`Clear ${chip.label} filter`}
                  onClick={() => clearChip(chip.type)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button type="button" className="an-filter-clear" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      <div className="an-overview-grid">
        {/* Left column */}
        <div className="an-overview-col an-overview-col-left">
          <div className="an-widget" id="widget-sentiment-gauge">
            <div className="an-widget-header">
              <span className="an-widget-title">Sentiment</span>
            </div>
            <SentimentGaugeSVG index={sentimentIndex} split={sentimentSplit} onSegmentClick={toggleSentimentFilter} activeSegment={filters.activeSentimentFilter} />
          </div>

          <div className="an-widget" id="widget-authors-by-source">
            <div className="an-widget-header">
              <span className="an-widget-title">Authors by source</span>
            </div>
            <AuthorsBySourceWidget summary={authorsBySource} activeSource={filters.activeSourceFilter} onRowClick={toggleSourceFilter} />
          </div>

          <div className="an-widget" id="widget-watchlist-coverage">
            <div className="an-widget-header">
              <span className="an-widget-title">Watchlist coverage</span>
            </div>
            <WatchlistCoverageWidget
              coverage={watchlistCoverage}
              watchlists={watchlists}
              activeWatchlistId={filters.activeWatchlistFilter}
              onWatchlistClick={handleWatchlistSelect}
            />
          </div>
        </div>

        {/* Centre column */}
        <div className="an-overview-col an-overview-col-centre">
          <div className="an-widget" id="widget-timeline-volume">
            <div className="an-widget-header an-timeline-header">
              <span className="an-widget-title">Volume &amp; projections</span>
              <label className="an-forecast-toggle">
                <input type="checkbox" checked={forecastOn} onChange={(e) => setForecastOn(e.target.checked)} />
                Forecast
              </label>
            </div>

            {/* 2026-08-19 follow-up: only a genuine alert (elevated/crisis) is worth surfacing — "stable" isn't an alert, and any decrease in negative posts (however large) always computes as "stable" under the fixed thresholds, so showing it unconditionally was just noise. */}
            {crisisRadar && crisisRadar.level !== 'stable' && (
              <div className={`an-crisis-radar an-crisis-radar-${crisisRadar.level}`}>
                Negative-sentiment momentum: {crisisRadar.changePct > 0 ? '+' : ''}
                {crisisRadar.changePct}% ({crisisRadar.level})
              </div>
            )}

            {timelineData.length === 0 ? (
              <EmptyState heading="No volume data" />
            ) : (
              <div className="an-chart-wrap" style={{ height: 420 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={timelineData}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                    onClick={(e) => {
                      const label = e && typeof e.activeLabel === 'string' ? e.activeLabel : null;
                      if (label) toggleDateFilter(label);
                    }}
                  >
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <AnimatedChartTooltip
                          active={active}
                          title={String(label)}
                          items={payload?.map((p) => ({
                            name:
                              p.dataKey === 'forecast'
                                ? 'Statistical projection — not a real measurement'
                                : p.dataKey === 'average'
                                  ? '7-day average'
                                  : 'Posts',
                            value: p.value as number,
                            color: p.color as string,
                          })) ?? []}
                        />
                      )}
                    />
                    <Area type="monotone" dataKey="actual" name="Posts" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                    <Line
                      type="monotone"
                      dataKey="average"
                      name="7-day average"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                    />
                    {forecastOn && (
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        name="Statistical projection — not a real measurement"
                        stroke="#4f46e5"
                        strokeDasharray="4 4"
                        fill="#4f46e5"
                        fillOpacity={0.08}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>

        {/* Right column */}
        <div className="an-overview-col an-overview-col-right">
          <div className="an-widget" id="widget-wordcloud">
            <div className="an-widget-header">
              <span className="an-widget-title">Key phrases</span>
            </div>
            {phraseFrequency.length === 0 ? (
              <EmptyState heading="No key phrases yet" />
            ) : (
              <div className="an-phrase-cloud">
                {phraseFrequency.map((p, i) => (
                  <button
                    key={p.phrase}
                    type="button"
                    className={`an-phrase-btn ${phraseSizeClass(i)}${filters.activeKeywordFilter === p.phrase ? ' an-phrase-btn-active' : ''}`}
                    onClick={() => toggleKeywordFilter(p.phrase)}
                  >
                    {p.phrase} <span className="an-phrase-count">{p.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="an-widget" id="widget-sources-volume">
            <div className="an-widget-header">
              <span className="an-widget-title">Sources</span>
            </div>
            {sourceBreakdown.length === 0 ? (
              <EmptyState heading="No source data yet" />
            ) : (
              <ul className="an-source-detail-list">
                {sourceBreakdown.map((source) => (
                  <li key={source.providerId} className="an-source-detail-row">
                    <button
                      type="button"
                      className={`an-author-row${filters.activeSourceFilter === source.providerId ? ' an-author-row-active' : ''}`}
                      onClick={() => toggleSourceFilter(source.providerId)}
                    >
                      <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
                      <span className="an-source-detail-count">{source.count.toLocaleString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="an-widget" id="widget-languages">
            <div className="an-widget-header">
              <span className="an-widget-title">Languages</span>
            </div>
            {languages.length === 0 ? (
              <EmptyState heading="No language data yet" />
            ) : (
              <ul className="an-source-mini-list">
                {languages.map((lang) => (
                  <li key={lang.code}>
                    <button
                      type="button"
                      className={`an-author-row${filters.activeLanguageFilter === lang.code ? ' an-author-row-active' : ''}`}
                      onClick={() => toggleLanguageFilter(lang.code)}
                    >
                      <span>{lang.label}</span>
                      <span className="an-author-count">{lang.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="an-widget" id="widget-top-authors">
            <div className="an-widget-header">
              <span className="an-widget-title">Top authors</span>
            </div>
            {topAuthors.length === 0 ? (
              <EmptyState heading="No authors yet" />
            ) : (
              <ul className="an-author-list">
                {topAuthors.map((a) => (
                  <li key={a.author}>
                    <button
                      type="button"
                      className={`an-author-row${filters.activeAuthorFilter === a.author ? ' an-author-row-active' : ''}`}
                      onClick={() => toggleAuthorFilter(a.author)}
                    >
                      <span className="an-author-initials">{initials(a.author)}</span>
                      <span>{a.author}</span>
                      <span className="an-author-count">{a.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Story 8.8's grid slot — reserved, empty until that story ships. */}
          <div className="an-widget" id="widget-spike-storyteller" />
        </div>
      </div>

      {drawerOpen && (
        <div
          className="slideover-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <div className="an-drawer-stack">
            <div className="slideover-panel" role="dialog" aria-modal="true" aria-labelledby="an-drawer-title" data-testid="slideover-panel">
              <div className="slideover-header">
                <div>
                  <h3 id="an-drawer-title">Matching posts ({filteredPosts.length})</h3>
                </div>
                <button type="button" className="slideover-close-btn" onClick={closeDrawer} aria-label="Close panel" data-testid="slideover-close-btn">
                  ✕
                </button>
              </div>
              <div className="slideover-content">
                {filteredPosts.length === 0 ? (
                  <EmptyState heading="No matching posts" />
                ) : (
                  <ul className="an-drawer-post-list">
                    {filteredPosts.map((post) => (
                      <li key={post.id}>
                        <button
                          type="button"
                          className={`an-drawer-post-row${detailPostId === post.id ? ' an-drawer-post-row-active' : ''}`}
                          onClick={() => openDetail(post.id)}
                        >
                          <span className="an-drawer-post-row-main">
                            <span className={providerPillClass(post.providerId)}>{post.providerId.replace(/_/g, ' ')}</span>
                            <span className="an-drawer-post-title">{post.title}</span>
                          </span>
                          <span className="an-drawer-post-meta">
                            {post.sentiment && <span className={`an-sentiment-mini-${post.sentiment}`}>{post.sentiment}</span>}
                            {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                            <IconChevronRight />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {detailPostId && (
              <div className="slideover-panel slideover-lg" role="dialog" aria-modal="true" aria-labelledby="an-drawer-detail-title">
                <div className="slideover-header">
                  <div>
                    {detailPost && (
                      <span className={`${providerPillClass(detailPost.provider)} an-drawer-detail-provider-pill`}>
                        {detailPost.provider.replace(/_/g, ' ')}
                      </span>
                    )}
                    <h3 id="an-drawer-detail-title">{detailPost?.title ?? 'Post detail'}</h3>
                    {detailPost?.author && <p className="slideover-subtitle">{detailPost.author}</p>}
                  </div>
                  <button type="button" className="slideover-close-btn" onClick={closeDetail} aria-label="Close post detail">
                    ✕
                  </button>
                </div>
                <div className="slideover-content">
                  {detailLoading && <p className="an-drawer-detail-status">Loading post…</p>}
                  {detailError && <p className="an-drawer-detail-status an-drawer-detail-error">{detailError}</p>}
                  {detailPost && <PostDetailPanel key={detailPost.id} post={detailPost} />}
                </div>
                {detailPost && (
                  <div className="slideover-footer">
                    <div className="pf-slideover-footer-inner">
                      {detailPost.url ? (
                        <a href={detailPost.url} target="_blank" rel="noreferrer" className="pf-footer-ext-link">
                          <IconExternalLink /> Open original
                        </a>
                      ) : (
                        <span />
                      )}
                      <RunEnrichmentButton postId={detailPost.id} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SentimentGaugeSVGProps {
  /** Real 0–10 weighted score (computeSentimentIndex()) — null when there's nothing enriched to score, never a fabricated default. */
  index: number | null;
  split: { positive: number; neutral: number; negative: number };
  activeSegment: 'positive' | 'neutral' | 'negative' | null;
  onSegmentClick: (value: 'positive' | 'neutral' | 'negative') => void;
}

/** Story 8.7 review follow-up (2026-08-19) — the resulting sentiment index is placed in front of (to the left of, per the original design spec's own §5) the donut ring, not just implied by its arc proportions. */
function SentimentGaugeSVG({ index, split, activeSegment, onSegmentClick }: SentimentGaugeSVGProps) {
  const total = split.positive + split.neutral + split.negative;
  const segments: Array<{ key: 'positive' | 'neutral' | 'negative'; value: number; color: string }> = [
    { key: 'negative', value: split.negative, color: SENTIMENT_COLORS.negative },
    { key: 'neutral', value: split.neutral, color: SENTIMENT_COLORS.neutral },
    { key: 'positive', value: split.positive, color: SENTIMENT_COLORS.positive },
  ];
  let offset = 0;

  return (
    <div className="an-gauge-wrap">
      <div className="an-gauge-top-row">
        <span className="an-gauge-index" title="Sentiment index (0–10, 10 = fully positive)">
          {index === null ? '—' : index.toFixed(1)}
        </span>
        <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Sentiment gauge">
          <circle cx="50" cy="50" r={GAUGE_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          {total === 0
            ? null
            : segments.map((seg) => {
                if (seg.value === 0) return null;
                const length = (seg.value / total) * GAUGE_CIRCUMFERENCE;
                const dashOffset = -offset;
                offset += length;
                return (
                  <circle
                    key={seg.key}
                    cx="50"
                    cy="50"
                    r={GAUGE_RADIUS}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="8"
                    strokeDasharray={`${length} ${GAUGE_CIRCUMFERENCE - length}`}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 50 50)"
                    className={`an-gauge-segment${activeSegment === seg.key ? ' an-gauge-segment-active' : ''}`}
                    onClick={() => onSegmentClick(seg.key)}
                  />
                );
              })}
        </svg>
      </div>
      {total > 0 && (
        <>
          <div className="an-sentiment-bar" role="img" aria-label="Sentiment split as a percentage of matched posts">
            {split.positive > 0 && (
              <span
                className="an-sentiment-bar-segment an-sentiment-bar-positive"
                style={{ width: `${(split.positive / total) * 100}%` }}
              />
            )}
            {split.neutral > 0 && (
              <span
                className="an-sentiment-bar-segment an-sentiment-bar-neutral"
                style={{ width: `${(split.neutral / total) * 100}%` }}
              />
            )}
            {split.negative > 0 && (
              <span
                className="an-sentiment-bar-segment an-sentiment-bar-negative"
                style={{ width: `${(split.negative / total) * 100}%` }}
              />
            )}
          </div>
          <div className="an-sentiment-bar-legend">
            <span className="an-sentiment-mini-positive">{Math.round((split.positive / total) * 100)}% positive</span>
            <span className="an-sentiment-mini-neutral">{Math.round((split.neutral / total) * 100)}% neutral</span>
            <span className="an-sentiment-mini-negative">{Math.round((split.negative / total) * 100)}% negative</span>
          </div>
        </>
      )}
    </div>
  );
}

interface AuthorsBySourceWidgetProps {
  summary: ReturnType<typeof computeAuthorsBySource>;
  activeSource: string | null;
  onRowClick: (providerId: string) => void;
}

function AuthorsBySourceWidget({ summary, activeSource, onRowClick }: AuthorsBySourceWidgetProps) {
  let offset = 0;
  return (
    <div className="an-authors-by-source-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label="Authors by source">
        <circle cx="40" cy="40" r={AUTHORS_DONUT_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {summary.totalUniqueAuthors === 0
          ? null
          : summary.bySource.map((source, i) => {
              if (source.uniqueAuthorCount === 0) return null;
              const length = (source.uniqueAuthorCount / summary.totalUniqueAuthors) * AUTHORS_DONUT_CIRCUMFERENCE;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={source.providerId}
                  cx="40"
                  cy="40"
                  r={AUTHORS_DONUT_RADIUS}
                  fill="none"
                  stroke={SOURCE_DONUT_COLORS[i % SOURCE_DONUT_COLORS.length]}
                  strokeWidth="6"
                  strokeDasharray={`${length} ${AUTHORS_DONUT_CIRCUMFERENCE - length}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 40 40)"
                />
              );
            })}
        <text x="40" y="44" textAnchor="middle" fontSize="16" fontWeight="650" fill="var(--color-text-primary)">
          {summary.totalUniqueAuthors}
        </text>
      </svg>
      <ul className="an-source-mini-list an-authors-by-source-list">
        {summary.bySource.map((source) => (
          <li key={source.providerId}>
            <button
              type="button"
              className={`an-author-row${activeSource === source.providerId ? ' an-author-row-active' : ''}`}
              onClick={() => onRowClick(source.providerId)}
            >
              <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
              <span className="an-author-count">{source.uniqueAuthorCount}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COVERAGE_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

interface WatchlistCoverageWidgetProps {
  coverage: WatchlistCoverageEntry[];
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  onWatchlistClick?: (id: string) => void;
}

/**
 * Story 8.9 (ADR-0063) — Watchlist Coverage Widget (id="widget-watchlist-coverage").
 * Renders a Recharts donut chart showing post distribution across active watchlists.
 * If zero active watchlists exist, renders EmptyState.
 * Slices are sized by post count; zero-count active watchlists appear in the legend.
 */
function WatchlistCoverageWidget({
  coverage,
  watchlists,
  activeWatchlistId,
  onWatchlistClick,
}: WatchlistCoverageWidgetProps) {
  const activeWatchlists = watchlists.filter((w) => w.isActive);
  if (activeWatchlists.length === 0) {
    return (
      <EmptyState
        heading="No active watchlists"
        body="Create and activate a watchlist in the Watchlists screen to view topic coverage."
      />
    );
  }

  const coverageMap = new Map(coverage.map((c) => [c.id, c.count]));
  const data = activeWatchlists
    .map((w) => ({
      id: w.id,
      name: w.name,
      matchType: w.matchType,
      count: coverageMap.get(w.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((item, idx) => ({
      ...item,
      color: COVERAGE_COLORS[idx % COVERAGE_COLORS.length],
    }));

  const chartData = data.filter((d) => d.count > 0);

  return (
    <div className="an-coverage-wrap">
      <div className="an-coverage-chart-container" style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.length > 0 ? chartData : [{ name: 'No matches', count: 1, color: '#e2e8f0' }]}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={56}
              paddingAngle={chartData.length > 1 ? 2 : 0}
            >
              {(chartData.length > 0 ? chartData : [{ id: 'empty', color: '#e2e8f0' }]).map((entry, i) => (
                <Cell key={entry.id ?? i} fill={entry.color} />
              ))}
            </Pie>
            {chartData.length > 0 && (
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0];
                  return (
                    <AnimatedChartTooltip
                      active={active}
                      title={String(item.name)}
                      items={[{ name: 'Posts', value: Number(item.value), color: (item.payload as { color?: string })?.color ?? '#2563eb' }]}
                    />
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="an-coverage-legend">
        {data.map((item) => (
          <li key={item.id} className="an-coverage-legend-item">
            <button
              type="button"
              className={`an-coverage-btn${activeWatchlistId === item.id ? ' an-coverage-btn-active' : ''}`}
              onClick={() => onWatchlistClick?.(item.id)}
            >
              <span className="an-coverage-indicator" style={{ backgroundColor: item.color }} />
              <span className="an-coverage-name">{item.name}</span>
              <span className="an-coverage-count">{item.count.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
