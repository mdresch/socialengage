/**
 * Story 6.8 — same-origin proxy for AccessControl.tsx's confirmed
 * set/clear-access_ends_at action. See src/app/api/tenant-users/route.ts's
 * own header comment for why this proxy exists rather than the Client
 * Component calling core directly.
 */

import { NextResponse } from 'next/server';
import { setUserAccessEndsAt } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const accessEndsAt = Object.prototype.hasOwnProperty.call(body, 'accessEndsAt') ? body.accessEndsAt : null;
  const outcome = await setUserAccessEndsAt(id, accessEndsAt);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
