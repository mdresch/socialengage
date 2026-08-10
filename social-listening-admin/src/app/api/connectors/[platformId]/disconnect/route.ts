/**
 * Story 6.3 (healed 2026-08-10) — same-origin proxy so DisconnectButton.tsx
 * (a Client Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. The actual bearer-token
 * attachment happens inside core-client.ts's disconnectPlatform() (via
 * authenticatedCoreFetch()) — this route never constructs that header
 * directly, keeping core-client.ts the sole choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { disconnectPlatform } from '@/lib/core-client';

export async function DELETE(request: Request, { params }: { params: Promise<{ platformId: string }> }) {
  const { platformId } = await params;
  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get('ownerType') === 'user' ? 'user' : 'tenant';
  const outcome = await disconnectPlatform(platformId, ownerType);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
