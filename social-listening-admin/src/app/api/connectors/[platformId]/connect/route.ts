/**
 * Story 6.3 (healed 2026-08-10) — same-origin proxy so ConnectForm.tsx (a
 * Client Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. The actual bearer-token
 * attachment happens inside core-client.ts's connectPlatform() (via
 * authenticatedCoreFetch()) — this route never constructs that header
 * directly, keeping core-client.ts the sole choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { connectPlatform } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ platformId: string }> }) {
  const { platformId } = await params;
  const body = await request.json().catch(() => ({}));
  const ownerType = body.ownerType === 'user' ? 'user' : 'tenant';
  const outcome = await connectPlatform(platformId, body.credential, ownerType);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
