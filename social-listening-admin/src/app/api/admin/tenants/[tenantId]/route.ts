/**
 * Story 6.6 (reworked 2026-08-12) — same-origin proxy for
 * TenantAdminControls.tsx's update action. Scoped to exactly `status` and
 * `licenseSeatCount` at this boundary too — never forwards `domain` or
 * `activeSeatCount` even if a caller's own body included them, matching
 * this story's own revised AC scope (adminTenantsRouter.ts's own DB-level
 * grant is the real enforcement boundary; this is a UX-scoping match, not a
 * second security boundary).
 *
 * Named `[tenantId]`, not `[id]`, to match the sibling
 * `[tenantId]/break-glass/...` routes at this same directory level — the
 * Next.js App Router requires every dynamic segment at a given path
 * position to share one parameter name; `[id]` and `[tenantId]` coexisting
 * here breaks the whole route tree's compilation (found and fixed the same
 * session this file was first added, via heal-contract-failure).
 */

import { NextResponse } from 'next/server';
import { updateAdminTenant } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await request.json().catch(() => ({}));
  const input: { status?: 'active' | 'suspended'; licenseSeatCount?: number } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'status')) input.status = body.status;
  if (Object.prototype.hasOwnProperty.call(body, 'licenseSeatCount')) input.licenseSeatCount = body.licenseSeatCount;
  const outcome = await updateAdminTenant(tenantId, input);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
