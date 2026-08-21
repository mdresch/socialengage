/**
 * Story 6.29 (Story 1.16, ADR-0070 §4) — same-origin proxy route for triggering an
 * on-demand connector retry / re-sync. Gated behind authentication in core-client.ts.
 */

import { NextResponse } from 'next/server';
import { retryConnector } from '@/lib/core-client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platformId: string }> }
) {
  const { platformId } = await params;
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : undefined;

  const outcome = await retryConnector(platformId, userId);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
