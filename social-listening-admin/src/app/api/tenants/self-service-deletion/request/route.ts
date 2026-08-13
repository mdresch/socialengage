/**
 * Story 6.13 — same-origin proxy so TenantDeletionPanel.tsx (a Client
 * Component) can reach this endpoint without needing CORE_API_BASE_URL or a
 * bearer token itself. core-client.ts's requestTenantSelfServiceDeletion()
 * stays the sole Bearer-attachment choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { requestTenantSelfServiceDeletion } from '@/lib/core-client';

export async function POST() {
  const outcome = await requestTenantSelfServiceDeletion();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
