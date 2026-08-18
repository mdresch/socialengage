/**
 * Story 6.27 (ADR-0060 Decision §5) — same-origin proxy for the per-Page
 * disconnect action, same reasoning as the sibling pages/route.ts and
 * every other connector proxy route.
 */

import { NextResponse } from 'next/server';
import { disconnectFacebookPage } from '@/lib/core-client';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await disconnectFacebookPage(id);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
