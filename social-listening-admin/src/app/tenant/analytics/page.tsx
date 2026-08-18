import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { fetchAnalyticsSummary } from './fetchAnalyticsSummary';
import { AnalyticsClient } from './AnalyticsClient';
import type { DateRangeFilter } from './analyticsData';

const TAB_VALUES = ['overview', 'sentiment', 'conversations', 'sources'] as const;
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
 * handled by AnalyticsClient re-fetching /api/analytics/summary.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { tab } = await searchParams;
  const initialTab: AnalyticsTab = (TAB_VALUES as readonly string[]).includes(tab ?? '')
    ? (tab as AnalyticsTab)
    : 'overview';

  const initialRange = defaultDateRange();
  const initialSummary = await fetchAnalyticsSummary(initialRange);

  return (
    <main>
      <AnalyticsClient initialSummary={initialSummary} initialRange={initialRange} initialTab={initialTab} />
    </main>
  );
}
