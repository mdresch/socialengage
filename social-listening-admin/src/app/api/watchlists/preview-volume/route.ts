/**
 * Story 9.1 / Story 18.1 (ADR-0077, ADR-0134) — same-origin proxy route so
 * WatchlistForm.tsx (Client Component) can request volume previews and
 * cost projections without exposing CORE_API_BASE_URL or bearer tokens.
 */

import { NextResponse } from 'next/server';
import { previewWatchlistVolume } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await previewWatchlistVolume({
    watchlistId: body.watchlistId,
    ast: body.ast,
    connectorIds: Array.isArray(body.connectorIds) ? body.connectorIds : undefined,
    timeWindow: body.timeWindow,
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
