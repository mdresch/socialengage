/**
 * Story 6.12 — same-origin proxy so TenantOwnedFeedSetup.tsx (a Client
 * Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. The actual bearer-token
 * attachment happens inside core-client.ts's connectTenantOwnedFeed() (via
 * authenticatedCoreFetch()) — this route never constructs that header
 * directly, keeping core-client.ts the sole choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { connectTenantOwnedFeed } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await connectTenantOwnedFeed(body.domain, body.feedUrl, body.name);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
