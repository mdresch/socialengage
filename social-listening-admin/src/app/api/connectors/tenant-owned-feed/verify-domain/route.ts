/**
 * Story 6.12 — same-origin proxy for the re-clickable DNS TXT-record check.
 * Same reasoning as the sibling connect/route.ts: keeps core-client.ts the
 * sole Bearer-attachment choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { verifyTenantOwnedFeedDomain } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await verifyTenantOwnedFeedDomain(body.connectorActivationId);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
