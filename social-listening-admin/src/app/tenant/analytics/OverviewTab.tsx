'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import {
  applyOverviewFilters,
  computeActiveChips,
  computeAuthorsBySource,
  computeCrisisAlertRadar,
  computeLanguageBreakdown,
  computePhraseFrequency,
  computeSentimentSplitFromFlat,
  computeSentimentTrajectory,
  computeSourceBreakdownFromFlat,
  computeTopAuthorsByVolume,
  computeVolumeForecast,
  computeVolumeHistory,
  computeSentimentHistory,
  serializeOverviewFiltersToSearchString,
  EMPTY_OVERVIEW_FILTERS,
  type AnalyticsSummary,
  type DateRangeFilter,
  type OverviewFilters,
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
export function OverviewTab({ summary, range, initialFilters }: OverviewTabProps) {
  const [filters, setFilters] = useState<OverviewFilters>(() => initialFilters ?? EMPTY_OVERVIEW_FILTERS);
  const [forecastOn, setForecastOn] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Deep-link share state (ADR-0062 Decision §4) — keeps the URL in sync on
  // every filter change via replaceState, never a full navigation event.
  // The `?tab=overview` param (Story 8.1) is preserved alongside it.
  useEffect(() => {
    const qs = serializeOverviewFiltersToSearchString(filters);
    const url = qs ? `?tab=overview&${qs}` : '?tab=overview';
    window.history.replaceState(null, '', url);
  }, [filters]);

  const filteredPosts = useMemo(() => applyOverviewFilters(summary.posts, filters), [summary.posts, filters]);
  const chips = useMemo(() => computeActiveChips(filters), [filters]);

  const sentimentSplit = useMemo(() => computeSentimentSplitFromFlat(filteredPosts), [filteredPosts]);
  const sourceBreakdown = useMemo(() => computeSourceBreakdownFromFlat(filteredPosts), [filteredPosts]);
  const authorsBySource = useMemo(() => computeAuthorsBySource(filteredPosts), [filteredPosts]);
  const topAuthors = useMemo(() => computeTopAuthorsByVolume(filteredPosts), [filteredPosts]);
  const phraseFrequency = useMemo(() => computePhraseFrequency(filteredPosts, 20), [filteredPosts]);
  const languages = useMemo(() => computeLanguageBreakdown(filteredPosts), [filteredPosts]);
  const volumeHistory = useMemo(() => computeVolumeHistory(filteredPosts, range), [filteredPosts, range]);
  const sentimentHistory = useMemo(() => computeSentimentHistory(filteredPosts, range), [filteredPosts, range]);
  const forecast = useMemo(() => computeVolumeForecast(volumeHistory, 7), [volumeHistory]);
  const crisisRadar = useMemo(() => computeCrisisAlertRadar(filteredPosts, range), [filteredPosts, range]);
  const trajectory = useMemo(() => computeSentimentTrajectory(sentimentHistory), [sentimentHistory]);

  const timelineData = useMemo(() => {
    const byDate = new Map<string, { date: string; actual?: number; forecast?: number }>();
    for (const point of volumeHistory) byDate.set(point.date, { date: point.date, actual: point.count });
    if (forecastOn) {
      for (const point of forecast) {
        const existing = byDate.get(point.date) ?? { date: point.date };
        existing.forecast = point.projectedVolume;
        byDate.set(point.date, existing);
      }
    }
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [volumeHistory, forecast, forecastOn]);

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
  function clearChip(type: keyof OverviewFilters) {
    setFilters((prev) => ({ ...prev, [type]: null }));
  }
  function clearAll() {
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
      <button
        type="button"
        id="widget-filtered-post-count"
        className="an-filtered-count-btn"
        onClick={() => setDrawerOpen(true)}
      >
        {filteredPosts.length.toLocaleString()} matching post{filteredPosts.length === 1 ? '' : 's'}
      </button>

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
            <SentimentGaugeSVG split={sentimentSplit} onSegmentClick={toggleSentimentFilter} activeSegment={filters.activeSentimentFilter} />
          </div>

          <div className="an-widget" id="widget-authors-by-source">
            <div className="an-widget-header">
              <span className="an-widget-title">Authors by source</span>
            </div>
            <AuthorsBySourceWidget summary={authorsBySource} activeSource={filters.activeSourceFilter} onRowClick={toggleSourceFilter} />
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

            {crisisRadar && (
              <div className={`an-crisis-radar an-crisis-radar-${crisisRadar.level}`}>
                Negative-sentiment momentum: {crisisRadar.changePct > 0 ? '+' : ''}
                {crisisRadar.changePct}% ({crisisRadar.level})
              </div>
            )}

            {trajectory.points.some((p) => p.score !== null) && (
              <div className="an-sentiment-trajectory">
                Sentiment trajectory: {trajectory.trend ?? 'flat'}
                <span className="an-trajectory-scale">(−10 to +10 per day)</span>
              </div>
            )}

            {timelineData.length === 0 ? (
              <EmptyState heading="No volume data" />
            ) : (
              <div className="an-chart-wrap" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
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
                            name: p.dataKey === 'forecast' ? 'Statistical projection — not a real measurement' : 'Posts',
                            value: p.value as number,
                            color: p.color as string,
                          })) ?? []}
                        />
                      )}
                    />
                    <Area type="monotone" dataKey="actual" name="Posts" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
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
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

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
        </div>

        {/* Right column */}
        <div className="an-overview-col an-overview-col-right">
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

      <Slideover title={`Matching posts (${filteredPosts.length})`} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {filteredPosts.length === 0 ? (
          <EmptyState heading="No matching posts" />
        ) : (
          <ul className="an-drawer-post-list">
            {filteredPosts.map((post) => (
              <li key={post.id} className="an-drawer-post-row">
                <span className="an-drawer-post-title">{post.title}</span>
                <span className="an-drawer-post-meta">
                  {post.sentiment && <span className={`an-sentiment-mini-${post.sentiment}`}>{post.sentiment}</span>}
                  {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Slideover>
    </div>
  );
}

interface SentimentGaugeSVGProps {
  split: { positive: number; neutral: number; negative: number };
  activeSegment: 'positive' | 'neutral' | 'negative' | null;
  onSegmentClick: (value: 'positive' | 'neutral' | 'negative') => void;
}

function SentimentGaugeSVG({ split, activeSegment, onSegmentClick }: SentimentGaugeSVGProps) {
  const total = split.positive + split.neutral + split.negative;
  const segments: Array<{ key: 'positive' | 'neutral' | 'negative'; value: number; color: string }> = [
    { key: 'negative', value: split.negative, color: SENTIMENT_COLORS.negative },
    { key: 'neutral', value: split.neutral, color: SENTIMENT_COLORS.neutral },
    { key: 'positive', value: split.positive, color: SENTIMENT_COLORS.positive },
  ];
  let offset = 0;

  return (
    <div className="an-gauge-wrap">
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
      <div className="an-sentiment-mini">
        <span className="an-sentiment-mini-positive">{split.positive} positive</span>
        <span className="an-sentiment-mini-neutral">{split.neutral} neutral</span>
        <span className="an-sentiment-mini-negative">{split.negative} negative</span>
      </div>
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
