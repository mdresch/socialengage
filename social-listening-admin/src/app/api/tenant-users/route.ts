/**
 * Story 6.8 — a thin same-origin proxy so InviteUserForm.tsx (a Client
 * Component) can reach this endpoint without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. The actual bearer-token
 * attachment happens inside core-client.ts's inviteTenantUser() (via
 * authenticatedCoreFetch()) — this route never constructs that header
 * directly, keeping core-client.ts the sole choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { inviteTenantUser } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await inviteTenantUser({ email: body.email, role: body.role });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
