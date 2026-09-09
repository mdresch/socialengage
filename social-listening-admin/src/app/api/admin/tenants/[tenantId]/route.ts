/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy for
 * TenantAdminControls.tsx's and TenantPlanForm.tsx's update action. Scoped to
 * `status`, `licenseSeatCount`, `name`, `plan`, and `featureGates` at this
 * boundary — never forwards `domain` or `activeSeatCount` even if a caller's
 * own body included them, matching the relevant AC scopes
 * (adminTenantsRouter.ts's own DB-level grant is the real enforcement
 * boundary; this is a UX-scoping match, not a second security boundary).
 *
 * Named `[tenantId]`, not `[id]`, to match the sibling
 * `[tenantId]/break-glass/...` and `[tenantId]/plan` routes at this same
 * directory level — the Next.js App Router requires every dynamic segment at a
 * given path position to share one parameter name; `[id]` and `[tenantId]`
 * coexisting here breaks the whole route tree's compilation.
 */

import { NextResponse } from 'next/server';
import { updateAdminTenant } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await request.json().catch(() => ({}));

  if (Object.prototype.hasOwnProperty.call(body, 'activeSeatCount')) {
    return NextResponse.json({ error: 'activeSeatCount cannot be set via this endpoint.' }, { status: 400 });
  }

  const input: {
    status?: 'active' | 'suspended';
    licenseSeatCount?: number;
    name?: string;
    plan?: string;
    featureGates?: Record<string, any>;
  } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'status')) input.status = body.status;
  if (Object.prototype.hasOwnProperty.call(body, 'licenseSeatCount')) input.licenseSeatCount = body.licenseSeatCount;
  if (Object.prototype.hasOwnProperty.call(body, 'name')) input.name = body.name;
  if (Object.prototype.hasOwnProperty.call(body, 'plan')) input.plan = body.plan;
  if (Object.prototype.hasOwnProperty.call(body, 'featureGates')) input.featureGates = body.featureGates;
  const outcome = await updateAdminTenant(tenantId, input);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
