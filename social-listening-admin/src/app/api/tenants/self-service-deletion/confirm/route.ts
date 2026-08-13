/**
 * Story 6.13 — same-origin proxy for the confirm step, the one irreversible
 * action in this entire admin UI. core-client.ts's
 * confirmTenantSelfServiceDeletion() stays the sole Bearer-attachment choke
 * point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { confirmTenantSelfServiceDeletion } from '@/lib/core-client';

export async function POST() {
  const outcome = await confirmTenantSelfServiceDeletion();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
