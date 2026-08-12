/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy so
 * ProvisionTenantForm.tsx (a Client Component) can create a tenant without
 * needing CORE_API_BASE_URL or a bearer token itself. Bearer-token
 * attachment stays inside core-client.ts's createAdminTenant() (ADR-0036
 * §2) — this route never constructs that header. `domain` (enhancement,
 * 2026-08-12) is forwarded only when the caller's body actually included
 * it — createAdminTenant()/POST /v1/admin/tenants already accepted it,
 * only this proxy and the form itself were missing it.
 */

import { NextResponse } from 'next/server';
import { createAdminTenant } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input: { name: string; licenseSeatCount: number; domain?: string } = {
    name: body.name,
    licenseSeatCount: body.licenseSeatCount,
  };
  if (Object.prototype.hasOwnProperty.call(body, 'domain')) input.domain = body.domain;
  const outcome = await createAdminTenant(input);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
