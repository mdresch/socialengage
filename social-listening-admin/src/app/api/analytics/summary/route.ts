/**
 * Story 8.1 — same-origin proxy so AnalyticsClient.tsx (a Client Component)
 * can re-fetch/re-aggregate after a date-range change without needing to
 * know CORE_API_BASE_URL or attach a bearer token itself. The real
 * pagination loop and aggregation live in fetchAnalyticsSummary.ts /
 * analyticsData.ts — this route only reads query params and forwards the
 * result, the same thin-proxy shape every other route in src/app/api uses
 * (ADR-0036 §2 — core-client.ts stays the sole bearer-token choke point).
 *
 * Story 8.4 — gains an optional ?compare=true param. The response is always
 * { current, previous } (previous: null when comparison wasn't requested) —
 * one shape, not a conditional one, so AnalyticsClient never has to branch
 * on which it got back.
 *
 * Story 8.9 (ADR-0063) — gains an optional ?watchlistId= (or ?watchlist=) param.
 */

import { NextResponse } from 'next/server';
import { fetchAnalyticsComparison, fetchWatchlistCoverage } from '@/app/tenant/analytics/fetchAnalyticsSummary';
import { computePreviousRange } from '@/app/tenant/analytics/analyticsData';
import { listWatchlists } from '@/lib/core-client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const compare = url.searchParams.get('compare') === 'true';
  const watchlistId = url.searchParams.get('watchlistId') || url.searchParams.get('watchlist') || undefined;
  const includeCoverage = url.searchParams.get('coverage') === 'true';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required.' }, { status: 400 });
  }

  const range = { startDate, endDate };
  const previousRange = compare ? computePreviousRange(range) : null;

  try {
    const comparison = await fetchAnalyticsComparison(range, previousRange, watchlistId);
    let coverage = undefined;
    if (includeCoverage) {
      const watchlists = await listWatchlists().catch(() => []);
      coverage = await fetchWatchlistCoverage(range, watchlists);
    }
    return NextResponse.json({ ...comparison, coverage }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load analytics data.' }, { status: 502 });
  }
}
