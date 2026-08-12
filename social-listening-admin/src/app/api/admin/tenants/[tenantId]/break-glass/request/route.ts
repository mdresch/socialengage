/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy for
 * BreakGlassPanel.tsx's request action. `targetUserId` is forwarded
 * verbatim from the operator's own typed-in value — no lookup happens here
 * (the Tenant-Admin-lookup-by-tenant-name gap is a real, already-named
 * backend gap, unaffected by this route).
 */

import { NextResponse } from 'next/server';
import { requestBreakGlassReset } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await request.json().catch(() => ({}));
  const outcome = await requestBreakGlassReset({ tenantId, targetUserId: body.targetUserId });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
