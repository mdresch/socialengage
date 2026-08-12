/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy so
 * ProvisionTenantForm.tsx (a Client Component) can create a tenant without
 * needing CORE_API_BASE_URL or a bearer token itself. Bearer-token
 * attachment stays inside core-client.ts's createAdminTenant() (ADR-0036
 * §2) — this route never constructs that header.
 */

import { NextResponse } from 'next/server';
import { createAdminTenant } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await createAdminTenant({
    name: body.name,
    licenseSeatCount: body.licenseSeatCount,
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
