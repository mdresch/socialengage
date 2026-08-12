/**
 * Story 6.4 (reworked 2026-08-12) — same-origin proxy so WatchlistForm.tsx
 * (a Client Component) can create a watchlist without needing
 * CORE_API_BASE_URL or a bearer token itself. Bearer-token attachment stays
 * inside core-client.ts's createWatchlist() (ADR-0036 §2) — this route never
 * constructs that header.
 */

import { NextResponse } from 'next/server';
import { createWatchlist } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await createWatchlist({
    name: body.name,
    matchType: body.matchType,
    terms: Object.prototype.hasOwnProperty.call(body, 'terms') ? body.terms : null,
    booleanQuery: Object.prototype.hasOwnProperty.call(body, 'booleanQuery') ? body.booleanQuery : null,
    platformIds: Array.isArray(body.platformIds) ? body.platformIds : [],
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
