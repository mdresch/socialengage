/**
 * Story 6.20 (ADR-0057) — same-origin proxy for the per-feed edit/remove
 * actions on the multi-feed list. Same reasoning as the sibling
 * connect/verify-domain routes: keeps core-client.ts the sole
 * Bearer-attachment choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { updateTenantOwnedFeedActivation, removeTenantOwnedFeedActivation } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const outcome = await updateTenantOwnedFeedActivation(id, body.feedUrl);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await removeTenantOwnedFeedActivation(id);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
