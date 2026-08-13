/**
 * Story 6.13 — same-origin proxy for the cancel step. core-client.ts's
 * cancelTenantSelfServiceDeletion() stays the sole Bearer-attachment choke
 * point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { cancelTenantSelfServiceDeletion } from '@/lib/core-client';

export async function DELETE() {
  const outcome = await cancelTenantSelfServiceDeletion();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
