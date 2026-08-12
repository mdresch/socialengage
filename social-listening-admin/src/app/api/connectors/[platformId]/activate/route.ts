/**
 * Story 6.15 — same-origin proxy so ActivateDeactivateButton.tsx (a Client
 * Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. Mirrors
 * .../connect/route.ts exactly — the actual bearer-token attachment
 * happens inside core-client.ts's activatePlatform() (via
 * authenticatedCoreFetch()), keeping core-client.ts the sole choke point
 * (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { activatePlatform } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ platformId: string }> }) {
  const { platformId } = await params;
  const body = await request.json().catch(() => ({}));
  const ownerType = body.ownerType === 'user' ? 'user' : 'tenant';
  const outcome = await activatePlatform(platformId, ownerType);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
