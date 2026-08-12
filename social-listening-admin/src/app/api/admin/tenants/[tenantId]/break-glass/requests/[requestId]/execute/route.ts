/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy for
 * BreakGlassPanel.tsx's execute action, the one call in this whole story
 * that returns single-disclosure material (temporaryAccessPass). This
 * route passes it straight through in the response body and does not log,
 * store, or otherwise retain it.
 */

import { NextResponse } from 'next/server';
import { executeBreakGlassRequest } from '@/lib/core-client';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; requestId: string }> }
) {
  const { tenantId, requestId } = await params;
  const outcome = await executeBreakGlassRequest({ tenantId, requestId });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
