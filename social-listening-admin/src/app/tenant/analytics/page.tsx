import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listWatchlists } from '@/lib/core-client';
import { fetchAnalyticsSummary, fetchWatchlistCoverage } from './fetchAnalyticsSummary';
import { AnalyticsClient } from './AnalyticsClient';
import { parseOverviewFiltersFromSearchParams, computeAnalyticsSummary, type DateRangeFilter } from './analyticsData';

const TAB_VALUES = ['overview', 'sentiment', 'conversations', 'sources', 'location'] as const;
export type AnalyticsTab = (typeof TAB_VALUES)[number];

function defaultDateRange(): DateRangeFilter {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 29 * 86400_000);
  const startDate = start.toISOString().slice(0, 10);
  return { startDate, endDate };
}

/**
 * Story 8.1 (ADR-0054) — Analytics dashboard shell. Gates on the tenant
 * shell like every other tenant screen (Story 6.2). The initial page load
 * fetches its own default 30-day range server-side (no client round trip
 * needed for the first render); every subsequent range/tab change is
 * handled client-side via AnalyticsClient.tsx.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    source?: string;
    author?: string;
    keyword?: string;
    language?: string;
    sentiment?: string;
    watchlist?: string;
  }>;
}) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { tab, date, source, author, keyword, language, sentiment, watchlist } = await searchParams;
  const initialTab: AnalyticsTab = typeof tab === 'string' && (TAB_VALUES as readonly string[]).includes(tab)
    ? (tab as AnalyticsTab)
    : 'overview';

  const filterParams = new URLSearchParams();
  if (typeof date === 'string') filterParams.set('date', date);
  if (typeof source === 'string') filterParams.set('source', source);
  if (typeof author === 'string') filterParams.set('author', author);
  if (typeof keyword === 'string') filterParams.set('keyword', keyword);
  if (typeof language === 'string') filterParams.set('language', language);
  if (typeof sentiment === 'string') filterParams.set('sentiment', sentiment);
  if (typeof watchlist === 'string') filterParams.set('watchlist', watchlist);
  const initialOverviewFilters = parseOverviewFiltersFromSearchParams(filterParams);

  const initialRange = defaultDateRange();
  const watchlists = await listWatchlists().catch(() => []);
  const initialSummary = await fetchAnalyticsSummary(initialRange, initialOverviewFilters.activeWatchlistFilter || undefined)
    .catch(() => computeAnalyticsSummary([], initialRange));
  const initialWatchlistCoverage = await fetchWatchlistCoverage(initialRange, watchlists).catch(() => []);

  return (
    <main>
      <AnalyticsClient
        initialSummary={initialSummary}
        initialRange={initialRange}
        initialTab={initialTab}
        initialOverviewFilters={initialOverviewFilters}
        watchlists={watchlists}
        initialWatchlistCoverage={initialWatchlistCoverage}
      />
    </main>
  );
}
