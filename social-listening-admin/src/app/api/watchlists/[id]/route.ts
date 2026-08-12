/**
 * Story 6.4 (reworked 2026-08-12) — same-origin proxy for WatchlistForm.tsx's
 * edit submit and WatchlistRow.tsx's own isActive toggle and delete action.
 * `version` in the PATCH body is forwarded straight through as core-client's
 * updateWatchlist() `expectedVersion` argument, which sends it as `If-Match`
 * — the client-supplied version is always the row's own last-known value,
 * never invented here.
 */

import { NextResponse } from 'next/server';
import { updateWatchlist, deleteWatchlist } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const outcome = await updateWatchlist(id, body.patch ?? {}, body.version);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await deleteWatchlist(id);
  if (outcome.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
