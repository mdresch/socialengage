'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, InlineError, RelativeTime } from '@/components/ui';
import { GlobalDateRangePicker, type DateRangeValue } from './GlobalDateRangePicker';
import {
  applyOverviewFilters,
  EMPTY_OVERVIEW_FILTERS,
  type AnalyticsSummary,
  type DateRangeFilter,
  type OverviewFilters,
  type WatchlistCoverageEntry,
} from './analyticsData';
import type { SocialPostFull, Watchlist } from '@/lib/core-client';
import { flattenPost, type FlatPost } from '../posts/postDisplay';
import { PostDetailPanel } from '../posts/PostDetailPanel';
import { RunEnrichmentButton } from '../posts/RunEnrichmentButton';
import { OverviewTab } from './OverviewTab';
import { SourcesTab } from './SourcesTab';
import { SentimentTab } from './SentimentTab';
import { ConversationsTab } from './ConversationsTab';
import { LocationTab } from './LocationTab';
import type { AnalyticsTab } from './page';

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

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'sources', label: 'Sources' },
  { id: 'location', label: 'Location' },
];

interface AnalyticsClientProps {
  initialSummary: AnalyticsSummary;
  initialRange: DateRangeFilter;
  initialTab: AnalyticsTab;
  /** Story 8.7 — parsed server-side by page.tsx from the initial URL search params, same pattern as initialTab. */
  initialOverviewFilters: OverviewFilters;
  /** Story 8.9 (ADR-0063) — watchlists list and coverage data for Overview tab */
  watchlists?: Watchlist[];
  initialWatchlistCoverage?: WatchlistCoverageEntry[];
}

export function AnalyticsClient({
  initialSummary,
  initialRange,
  initialTab,
  initialOverviewFilters,
  watchlists = [],
  initialWatchlistCoverage = [],
}: AnalyticsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
  const [range, setRange] = useState<DateRangeFilter>(initialRange);
  const [rangeKey, setRangeKey] = useState<string>('last_30_days');
  const [summary, setSummary] = useState<AnalyticsSummary>(initialSummary);
  const [previousSummary, setPreviousSummary] = useState<AnalyticsSummary | null>(null);
  const [overviewFilters, setOverviewFilters] = useState<OverviewFilters>(() => initialOverviewFilters ?? EMPTY_OVERVIEW_FILTERS);
  const [watchlistFilter, setWatchlistFilter] = useState<string | null>(initialOverviewFilters.activeWatchlistFilter ?? null);
  const [coverage, setCoverage] = useState<WatchlistCoverageEntry[]>(initialWatchlistCoverage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceFilter = overviewFilters.activeSourceFilter;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<FlatPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const postsSource = summary.posts ?? (summary as any).sentimentPosts ?? [];
  const overviewFilteredPosts = useMemo(() => applyOverviewFilters(postsSource, overviewFilters), [postsSource, overviewFilters]);
  const displayCount = activeTab === 'overview' ? overviewFilteredPosts.length : summary.totalPosts;
  const drawerPosts = activeTab === 'overview' ? overviewFilteredPosts : (summary.posts ?? []);

  function selectTab(tab: AnalyticsTab) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`);
  }

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

  /**
   * Story 8.4 / Story 8.9 — shared re-fetch of /api/analytics/summary.
   * Forwards optional watchlist, source, and period-comparison params.
   */
  async function fetchSummaryAndCoverage(
    nextRange: DateRangeFilter,
    nextWatchlist: string | null,
    nextSource: string | null,
    withCompare = false
  ) {
    setLoading(true);
    setError(null);
    const compareParam = withCompare ? '&compare=true' : '';
    const wlParam = nextWatchlist ? `&watchlistId=${encodeURIComponent(nextWatchlist)}` : '';
    const sourceParam = nextSource ? `&providerId=${encodeURIComponent(nextSource)}` : '';
    try {
      const response = await fetch(
        `/api/analytics/summary?startDate=${encodeURIComponent(nextRange.startDate)}&endDate=${encodeURIComponent(nextRange.endDate)}${compareParam}${wlParam}${sourceParam}&coverage=true`
      );
      if (!response.ok) {
        throw new Error('Failed to load analytics data.');
      }
      const result = (await response.json()) as {
        current: AnalyticsSummary;
        previous: AnalyticsSummary | null;
        coverage?: WatchlistCoverageEntry[];
      };
      setSummary(result.current);
      setPreviousSummary(result.previous);
      if (result.coverage) {
        setCoverage(result.coverage);
      }
    } catch {
      setError('Could not load analytics data.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Story 8.4 — reads DateRangeValue.compareWithPrevious.
   * Story 8.9 — also forwards current active watchlistId and refreshes coverage.
   */
  async function handleRangeChange(value: DateRangeValue) {
    setRangeKey(value.key);
    const nextRange: DateRangeFilter = { startDate: value.startDate, endDate: value.endDate };
    setRange(nextRange);
    await fetchSummaryAndCoverage(nextRange, watchlistFilter, sourceFilter, value.compareWithPrevious);
  }

  /**
   * Story 8.9 (ADR-0063) — re-fetches posts via GET /v1/posts?watchlistId=
   * when the watchlist selector changes.
   */
  async function handleWatchlistChange(nextWatchlistId: string | null) {
    setWatchlistFilter(nextWatchlistId);
    setOverviewFilters((prev) => ({ ...prev, activeWatchlistFilter: nextWatchlistId }));
    await fetchSummaryAndCoverage(range, nextWatchlistId, sourceFilter);
  }

  /**
   * Story 8.7 — re-fetch summary and coverage when a source filter is toggled
   * so the watchlist coverage widget stays consistent with the filtered posts.
   */
  function handleOverviewFiltersChange(next: OverviewFilters) {
    setOverviewFilters(next);
    if (next.activeSourceFilter !== sourceFilter) {
      void fetchSummaryAndCoverage(range, watchlistFilter, next.activeSourceFilter);
    }
  }

  return (
    <div className="an-shell an-root" id="tenant-analytics-dashboard">
      <div className="an-header">
        <div className="an-header-title-wrap">
          <h1 className="an-page-title">Analytics</h1>
        </div>

        <div className="an-header-toolbar">
          <div className="an-header-controls">
            <div className="an-watchlist-select-wrap">
              <label htmlFor="overview-watchlist-selector" className="an-filter-label">
                Topic / Watchlist:
              </label>
              <select
                id="overview-watchlist-selector"
                className="an-watchlist-select"
                value={watchlistFilter ?? ''}
                onChange={(e) => handleWatchlistChange(e.target.value || null)}
              >
                <option value="">All Topics</option>
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.matchType.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>

            <GlobalDateRangePicker value={rangeKey} onChange={handleRangeChange} />

            <button
              type="button"
              id="widget-filtered-post-count"
              className="an-filtered-count-btn"
              onClick={() => setDrawerOpen(true)}
            >
              <span>{displayCount.toLocaleString()} matching post{displayCount === 1 ? '' : 's'}</span>
              <span className="an-post-drawer-tag">POSTS ›</span>
            </button>
          </div>
        </div>
      </div>

      <div className="an-tabs" role="tablist" aria-label="Analytics views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            id={`an-tab-${tab.id}`}
            className={`an-tab-btn${activeTab === tab.id ? ' an-tab-btn-active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <InlineError message={error} />
      {loading && <p className="an-loading">Updating…</p>}

      <div className="an-tab-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <OverviewTab
            summary={summary}
            previousSummary={previousSummary}
            range={range}
            initialFilters={initialOverviewFilters}
            filters={overviewFilters}
            onFiltersChange={handleOverviewFiltersChange}
            watchlists={watchlists}
            watchlistCoverage={coverage}
            onWatchlistChange={handleWatchlistChange}
            hideHeaderControls={true}
          />
        )}
        {activeTab === 'sources' && <SourcesTab summary={summary} previousSummary={previousSummary} range={range} />}
        {activeTab === 'sentiment' && <SentimentTab summary={summary} range={range} />}
        {activeTab === 'conversations' && <ConversationsTab summary={summary} range={range} />}
        {activeTab === 'location' && <LocationTab summary={summary} previousSummary={previousSummary} range={range} />}
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
                  <h3 id="an-drawer-title">Matching posts ({drawerPosts.length})</h3>
                </div>
                <button type="button" className="slideover-close-btn" onClick={closeDrawer} aria-label="Close panel" data-testid="slideover-close-btn">
                  ✕
                </button>
              </div>
              <div className="slideover-content">
                {drawerPosts.length === 0 ? (
                  <EmptyState heading="No matching posts" />
                ) : (
                  <ul className="an-drawer-post-list">
                    {drawerPosts.map((post) => {
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
  );
}

