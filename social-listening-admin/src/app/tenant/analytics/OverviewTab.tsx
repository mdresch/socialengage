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
import { IngestionAlertBanner, type IngestionAlertIssue } from '@/components/IngestionAlertBanner';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { PostDetailPanel } from '../posts/PostDetailPanel';
import { RunEnrichmentButton } from '../posts/RunEnrichmentButton';
import { flattenPost, type FlatPost } from '../posts/postDisplay';
import type { SocialPostFull, Watchlist } from '@/lib/core-client';
import { CountryWorldMap } from './CountryWorldMap';
import { SpikeStorytellerWidget } from './SpikeStorytellerWidget';
import {
  applyOverviewFilters,
  computeActiveChips,
  computeAuthorsBySource,
  computeCountryBreakdown,
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
  filters?: OverviewFilters;
  onFiltersChange?: (filters: OverviewFilters) => void;
  /** Story 8.9 (ADR-0063) — watchlists list for dropdown and coverage */
  watchlists?: Watchlist[];
  watchlistCoverage?: WatchlistCoverageEntry[];
  onWatchlistChange?: (watchlistId: string | null) => void;
  dateRangePicker?: React.ReactNode;
  hideHeaderControls?: boolean;
  ingestionIssues?: IngestionAlertIssue[];
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

function IconSparkles() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function PlatformSourceIcon({ providerId }: { providerId: string }) {
  const norm = providerId.toLowerCase().replace(/_/g, '-');
  switch (norm) {
    case 'gnews':
    case 'google-news':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      );
    case 'newswire':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      );
    case 'wikipedia':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M14.685 4.5h2.518l5.297 14.5h-2.685l-1.378-4.048h-4.89l-1.31 4.048H9.72l4.965-14.5zm.968 8.163h3.585l-1.785-5.322-1.8 5.322zM5.385 4.5h2.518l5.297 14.5h-2.685l-1.378-4.048H4.247L2.937 19H.5l4.885-14.5zm.968 8.163h3.585l-1.785-5.322-1.8 5.322z" />
        </svg>
      );
    case 'facebook':
    case 'meta':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'tenant-owned-feed':
    case 'rss':
    case 'blog':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
        </svg>
      );
    case 'x':
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75c.97 0 1.76.78 1.76 1.75s-.79 1.76-1.76 1.76m1.39 9.74v-8.37H5.07v8.37h2.78z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" stroke="#fff" strokeWidth="2" fill="none" />
        </svg>
      );
  }
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
  previousSummary,
  range,
  initialFilters,
  watchlists = [],
  watchlistCoverage = [],
  onWatchlistChange,
  dateRangePicker,
  hideHeaderControls,
  ingestionIssues = [],
  filters: controlledFilters,
  onFiltersChange,
}: OverviewTabProps) {
  const [internalFilters, setInternalFilters] = useState<OverviewFilters>(() => initialFilters ?? EMPTY_OVERVIEW_FILTERS);
  const filters = controlledFilters ?? internalFilters;
  const setFilters = (updater: OverviewFilters | ((prev: OverviewFilters) => OverviewFilters)) => {
    const next = typeof updater === 'function' ? updater(filters) : updater;
    if (onFiltersChange) {
      onFiltersChange(next);
    } else {
      setInternalFilters(next);
    }
  };
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

  const postsSource = summary.posts ?? (summary as any).sentimentPosts ?? [];
  const filteredPosts = useMemo(() => applyOverviewFilters(postsSource, filters), [postsSource, filters]);
  const chips = useMemo(() => computeActiveChips(filters, watchlists), [filters, watchlists]);

  const sentimentSplit = useMemo(() => computeSentimentSplitFromFlat(filteredPosts), [filteredPosts]);
  const sentimentIndex = useMemo(() => computeSentimentIndex(sentimentSplit), [sentimentSplit]);

  const sentimentDelta = useMemo(() => {
    if (filteredPosts.length === 0 || sentimentIndex === null) return null;

    const dates = filteredPosts
      .map((p) => (p.publishedAt ? new Date(p.publishedAt).getTime() : null))
      .filter((t): t is number => t !== null && !isNaN(t));

    if (dates.length === 0) return null;

    const maxDate = Math.max(...dates);
    const sevenDaysMs = 7 * 86400_000;
    const fourteenDaysMs = 14 * 86400_000;

    const current7DaysPosts = filteredPosts.filter((p) => {
      if (!p.publishedAt) return false;
      const t = new Date(p.publishedAt).getTime();
      return t >= maxDate - sevenDaysMs && t <= maxDate;
    });

    const prev7DaysPosts = filteredPosts.filter((p) => {
      if (!p.publishedAt) return false;
      const t = new Date(p.publishedAt).getTime();
      return t >= maxDate - fourteenDaysMs && t < maxDate - sevenDaysMs;
    });

    if (prev7DaysPosts.length === 0) {
      if (previousSummary && previousSummary.sentimentSplit) {
        const prevIdx = computeSentimentIndex(previousSummary.sentimentSplit);
        if (prevIdx !== null) {
          return Math.round((sentimentIndex - prevIdx) * 10) / 10;
        }
      }
      return null;
    }

    const currentSplit = computeSentimentSplitFromFlat(current7DaysPosts);
    const prevSplit = computeSentimentSplitFromFlat(prev7DaysPosts);

    const currIdx = computeSentimentIndex(currentSplit);
    const prevIdx = computeSentimentIndex(prevSplit);

    if (currIdx === null || prevIdx === null) return null;
    return Math.round((currIdx - prevIdx) * 10) / 10;
  }, [filteredPosts, sentimentIndex, previousSummary]);

  const sourceBreakdown = useMemo(() => computeSourceBreakdownFromFlat(filteredPosts), [filteredPosts]);
  const authorsBySource = useMemo(() => computeAuthorsBySource(filteredPosts), [filteredPosts]);
  const topAuthors = useMemo(() => computeTopAuthorsByVolume(filteredPosts), [filteredPosts]);
  const phraseFrequency = useMemo(() => computePhraseFrequency(filteredPosts, 10), [filteredPosts]);
  // 2026-08-19 follow-up: capped to the top 6 (already ranked descending by
  // computeLanguageBreakdown()) at Menno's own request — a long-tail list of
  // every language present was more clutter than signal.
  const languages = useMemo(() => computeLanguageBreakdown(filteredPosts).slice(0, 6), [filteredPosts]);
  const countryBreakdown = useMemo(() => computeCountryBreakdown(filteredPosts), [filteredPosts]);
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
  function toggleCountryFilter(value: string) {
    setFilters((prev) => ({ ...prev, activeCountryFilter: prev.activeCountryFilter === value ? null : value }));
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
    <>
      <IngestionAlertBanner issues={ingestionIssues || []} className="mb-4" />
      <div className="an-overview-header-row">
      {!hideHeaderControls && (
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
      )}

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
            <SentimentGaugeSVG
              index={sentimentIndex}
              split={sentimentSplit}
              onSegmentClick={toggleSentimentFilter}
              activeSegment={filters.activeSentimentFilter}
              sentimentDelta={sentimentDelta}
            />
          </div>

          <div className="an-widget" id="widget-location-insights">
            <div className="an-widget-header">
              <span className="an-widget-title">Location Insights</span>
            </div>
            {countryBreakdown.length === 0 ? (
              <EmptyState heading="No geographic data yet" body="Posts with country metadata or regional datelines will appear here." />
            ) : (
              <div className="an-location-insights-body">
                <CountryWorldMap
                  countryBreakdown={countryBreakdown}
                  selectedCountry={filters.activeCountryFilter}
                  onSelectCountry={toggleCountryFilter}
                />
              </div>
            )}
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

          <div className="an-centre-bottom-row">
            <div className="an-widget" id="widget-sources-volume">
              <div className="an-widget-header">
                <span className="an-widget-title">Sources</span>
                <span className="an-widget-sublabel">Share of posts</span>
              </div>
              {sourceBreakdown.length === 0 ? (
                <EmptyState heading="No source data yet" />
              ) : (
                <ul className="an-source-detail-list">
                  {(() => {
                    const totalSourceCount = sourceBreakdown.reduce((sum, s) => sum + s.count, 0) || 1;
                    return sourceBreakdown.map((source) => {
                      const rawPct = (source.count / totalSourceCount) * 100;
                      const pct = Math.round(rawPct);
                      const displayPct = rawPct > 0 && rawPct < 0.5 ? '<1%' : `${pct}%`;
                      return (
                        <li key={source.providerId} className="an-source-detail-row">
                          <button
                            type="button"
                            className={`an-author-row an-source-row-btn${filters.activeSourceFilter === source.providerId ? ' an-author-row-active an-source-row-active' : ''}`}
                            onClick={() => toggleSourceFilter(source.providerId)}
                          >
                            <div className="an-source-identity">
                              <span className={`an-source-icon an-source-icon-${source.providerId}`}>
                                <PlatformSourceIcon providerId={source.providerId} />
                              </span>
                              <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
                            </div>

                            <div className="an-source-bar-wrapper">
                              <div className="an-source-bar-track">
                                <div
                                  className={`an-source-bar-fill an-source-bar-${source.providerId}`}
                                  style={{ width: `${Math.min(100, Math.max(3, rawPct))}%` }}
                                />
                              </div>
                            </div>

                            <div className="an-source-stat-block">
                              <span className="an-source-detail-count">{source.count.toLocaleString()}</span>
                              <span className="an-source-percent">{displayPct}</span>
                            </div>
                          </button>
                        </li>
                      );
                    });
                  })()}
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

          {/* Story 8.8 (ADR-0062 Decision §6) — AI Spike Storyteller widget.
              Rendered only when activeDateFilter is non-null (the user has
              clicked a specific chart bar on the Volume & Projections
              Timeline). Empty slot otherwise — Story 8.7's own boundary. */}
          <div className="an-widget" id="widget-spike-storyteller">
            {filters.activeDateFilter && <SpikeStorytellerWidget spikeDate={filters.activeDateFilter} />}
          </div>
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
                    {filteredPosts.map((post) => {
                      const first3Entities = (post.entities ?? []).slice(0, 3);
                      const first3Phrases = (post.keyPhrases ?? []).slice(0, 3);
                      return (
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
                              {post.author && <span className="an-drawer-post-author" title={`Author: ${post.author}`}>By {post.author}</span>}
                              {post.sentiment && <span className={`an-sentiment-mini-${post.sentiment}`}>{post.sentiment}</span>}
                              {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                              <IconChevronRight />
                            </span>
                            {(first3Entities.length > 0 || first3Phrases.length > 0) && (
                              <span className="an-drawer-post-chips">
                                {first3Entities.map((ent, i) => (
                                  <span key={`ent-${i}`} className="an-drawer-chip an-drawer-chip-entity" title={`Entity: ${ent}`}>
                                    <IconTag /> {ent}
                                  </span>
                                ))}
                                {first3Phrases.map((phrase, i) => (
                                  <span key={`phr-${i}`} className="an-drawer-chip an-drawer-chip-phrase" title={`Key Phrase: ${phrase}`}>
                                    <IconSparkles /> #{phrase}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
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
    </>
  );
}

interface SentimentGaugeSVGProps {
  /** Real 0–10 weighted score (computeSentimentIndex()) — null when there's nothing enriched to score, never a fabricated default. */
  index: number | null;
  split: { positive: number; neutral: number; negative: number };
  activeSegment: 'positive' | 'neutral' | 'negative' | null;
  onSegmentClick: (value: 'positive' | 'neutral' | 'negative') => void;
  sentimentDelta?: number | null;
}

function SentimentSmiley({ index }: { index: number | null }) {
  if (index === null) {
    return (
      <g opacity="0.35">
        <circle cx="50" cy="50" r="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="45" cy="47" r="1.5" fill="#94a3b8" />
        <circle cx="55" cy="47" r="1.5" fill="#94a3b8" />
        <line x1="45" y1="54" x2="55" y2="54" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }

  if (index >= 2.0) {
    // Green Positive Smiley — net positive majority (index > 0 = more positives than negatives)
    return (
      <g aria-label="Positive sentiment">
        <circle cx="50" cy="50" r="17" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5" />
        <circle cx="45" cy="46.5" r="1.75" fill="#059669" />
        <circle cx="55" cy="46.5" r="1.75" fill="#059669" />
        <path d="M 43 52 Q 50 59 57 52" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  if (index >= -2.0) {
    // Amber Neutral Smiley — balanced (index near 0)
    return (
      <g aria-label="Neutral sentiment">
        <circle cx="50" cy="50" r="17" fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="45" cy="46.5" r="1.75" fill="#d97706" />
        <circle cx="55" cy="46.5" r="1.75" fill="#d97706" />
        <line x1="44" y1="53.5" x2="56" y2="53.5" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  // Red Negative Smiley
  return (
    <g aria-label="Negative sentiment">
      <circle cx="50" cy="50" r="17" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="45" cy="46.5" r="1.75" fill="#dc2626" />
      <circle cx="55" cy="46.5" r="1.75" fill="#dc2626" />
      <path d="M 43 55.5 Q 50 48.5 57 55.5" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** Story 8.7 review follow-up — sentiment index on left, smiley inside donut chart, and 7-day delta change on right. */
function SentimentGaugeSVG({ index, split, activeSegment, onSegmentClick, sentimentDelta }: SentimentGaugeSVGProps) {
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
        <span className="an-gauge-index" title="Net sentiment index (−10 to +10). Positive majority → above 0; negative majority → below 0.">
          {index === null ? '—' : index.toFixed(1)}
        </span>
        <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Sentiment gauge with smiley icon">
          <circle cx="50" cy="50" r={GAUGE_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          {total > 0 &&
            segments.map((seg) => {
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
          {/* Smiley in center of donut chart */}
          <SentimentSmiley index={index} />
        </svg>

        {/* Change index number compared to previous 7 days */}
        <div
          className="an-gauge-delta-wrap"
          title={
            sentimentDelta !== null && sentimentDelta !== undefined
              ? `Change compared to previous 7 days: ${sentimentDelta > 0 ? `+${sentimentDelta.toFixed(1)}` : sentimentDelta.toFixed(1)}`
              : 'Previous 7 days data not available'
          }
        >
          {sentimentDelta !== null && sentimentDelta !== undefined ? (
            <>
              <span
                className={`an-gauge-delta-pill ${
                  sentimentDelta > 0
                    ? 'an-gauge-delta-up'
                    : sentimentDelta < 0
                      ? 'an-gauge-delta-down'
                      : 'an-gauge-delta-flat'
                }`}
              >
                {sentimentDelta > 0 ? `+${sentimentDelta.toFixed(1)}` : sentimentDelta.toFixed(1)}
              </span>
              <span className="an-gauge-delta-label">vs prev 7d</span>
            </>
          ) : (
            <span className="an-gauge-delta-none">—</span>
          )}
        </div>
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

function getPlatformColor(providerId: string): string {
  const norm = providerId.toLowerCase().replace(/_/g, '-');
  switch (norm) {
    case 'gnews':
    case 'google-news':
      return '#059669';
    case 'newswire':
      return '#4f46e5';
    case 'wikipedia':
      return '#374151';
    case 'facebook':
    case 'meta':
      return '#1877f2';
    case 'tenant-owned-feed':
    case 'rss':
    case 'blog':
      return '#ea580c';
    case 'x':
    case 'twitter':
      return '#0ea5e9';
    case 'linkedin':
      return '#0a66c2';
    case 'youtube':
      return '#ef4444';
    case 'instagram':
      return '#e1306c';
    default:
      return '#2563eb';
  }
}

function AuthorsBySourceWidget({ summary, activeSource, onRowClick }: AuthorsBySourceWidgetProps) {
  let offset = 0;
  const sortedBySource = [...summary.bySource].sort((a, b) => b.uniqueAuthorCount - a.uniqueAuthorCount);

  return (
    <div className="an-authors-by-source-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label="Authors by source">
        <circle cx="40" cy="40" r={AUTHORS_DONUT_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {summary.totalUniqueAuthors === 0
          ? null
          : sortedBySource.map((source) => {
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
                  stroke={getPlatformColor(source.providerId)}
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
        {sortedBySource.map((source) => (
          <li key={source.providerId}>
            <button
              type="button"
              className={`an-author-row${activeSource === source.providerId ? ' an-author-row-active' : ''}`}
              onClick={() => onRowClick(source.providerId)}
            >
              <div className="an-source-identity">
                <span className={`an-source-icon an-source-icon-${source.providerId}`}>
                  <PlatformSourceIcon providerId={source.providerId} />
                </span>
                <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
              </div>
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
