/**
 * Story 13.14 / ADR-0117 — same-origin proxy for pushing all or selected
 * prospecting-list entries to a configured CRM connector as leads.
 * Forwards to `pushProspectingListToCrm()` (the sole Bearer-attachment choke
 * point, ADR-0036 §2) and returns the core response body and status unchanged.
 *
 * Authorization, feature-gating (`prospecting_crm`), and owner checks are
 * enforced by the core endpoint (Story 13.13); this proxy passes non-2xx
 * statuses through.
 */

import { NextResponse } from 'next/server';
import { pushProspectingListToCrm } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { crmConnectorId, caseType, selectedEntryIds, customFields } = body;
    const coreRes = await pushProspectingListToCrm(id, {
      crmConnectorId,
      caseType,
      selectedEntryIds,
      customFields,
    });
    const data = await coreRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: coreRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to push to CRM' }, { status: 500 });
  }
}
