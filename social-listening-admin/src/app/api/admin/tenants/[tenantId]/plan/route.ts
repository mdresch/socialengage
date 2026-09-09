/**
 * Story 13.6 (ADR-0112) — same-origin proxy for GET
 * /v1/admin/tenants/:tenantId/plan. Returns the tenant's plan tier, effective
 * max_seats, used seats, and effective feature gates to the Platform-Admin
 * tenant plan page.
 */

import { NextResponse } from 'next/server';
import { getAdminTenantPlan } from '@/lib/core-client';

export async function GET(_request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  try {
    const plan = await getAdminTenantPlan(tenantId);
    return NextResponse.json(plan);
  } catch (err: any) {
    const status = err?.message?.includes('404') || err?.message?.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err?.message || 'Tenant not found.' }, { status });
  }
}
