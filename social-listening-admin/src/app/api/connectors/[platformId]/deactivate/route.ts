/**
 * Story 6.15 — same-origin proxy so ActivateDeactivateButton.tsx (a Client
 * Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. Mirrors
 * .../connect/route.ts exactly. `userId` is optional, forwarded only for
 * the tenant_admin-offboarding-a-user's-personal-connector case (Story
 * 1.11 AC5) — an ordinary self-deactivation never sends it.
 */

import { NextResponse } from 'next/server';
import { deactivatePlatform } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ platformId: string }> }) {
  const { platformId } = await params;
  const body = await request.json().catch(() => ({}));
  const ownerType = body.ownerType === 'user' ? 'user' : 'tenant';
  const userId = typeof body.userId === 'string' ? body.userId : undefined;
  const outcome = await deactivatePlatform(platformId, ownerType, userId);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
