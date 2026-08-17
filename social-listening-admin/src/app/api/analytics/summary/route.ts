/**
 * Story 8.1 — same-origin proxy so AnalyticsClient.tsx (a Client Component)
 * can re-fetch/re-aggregate after a date-range change without needing to
 * know CORE_API_BASE_URL or attach a bearer token itself. The real
 * pagination loop and aggregation live in fetchAnalyticsSummary.ts /
 * analyticsData.ts — this route only reads the two query params and forwards
 * the result, the same thin-proxy shape every other route in src/app/api
 * uses (ADR-0036 §2 — core-client.ts stays the sole bearer-token choke
 * point).
 */

import { NextResponse } from 'next/server';
import { fetchAnalyticsSummary } from '@/app/tenant/analytics/fetchAnalyticsSummary';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required.' }, { status: 400 });
  }

  try {
    const summary = await fetchAnalyticsSummary({ startDate, endDate });
    return NextResponse.json(summary, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load analytics data.' }, { status: 502 });
  }
}
