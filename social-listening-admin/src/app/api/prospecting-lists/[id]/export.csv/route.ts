/**
 * Story 13.14 / ADR-0117 — same-origin proxy for the bounded, metadata-only
 * prospecting-list CSV export. Forwards to `exportProspectingListCsv()` (the
 * sole Bearer-attachment choke point, ADR-0036 §2) and streams the response
 * body through with the original `Content-Type` and a friendly
 * `Content-Disposition` filename.
 *
 * Authorization, feature-gating (`exports`), and owner checks are enforced by
 * the core endpoint (Story 13.13); this proxy passes non-2xx statuses through.
 */

import { exportProspectingListCsv } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 5000;

  try {
    const response = await exportProspectingListCsv(id, limit);
    const headers = new Headers();
    const contentType = response.headers.get('Content-Type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    headers.set('Content-Disposition', `attachment; filename="prospecting-list-${id}.csv"`);
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Failed to export prospecting list' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
