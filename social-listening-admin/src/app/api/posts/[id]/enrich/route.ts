/**
 * Story 6.16 — same-origin proxy so RunEnrichmentButton.tsx (a Client
 * Component) can reach POST /v1/posts/:id/enrich without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. Mirrors
 * .../connectors/[platformId]/activate/route.ts exactly — the actual
 * bearer-token attachment happens inside core-client.ts's
 * runPostEnrichment() (via authenticatedCoreFetch()), keeping
 * core-client.ts the sole choke point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { runPostEnrichment } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;
  const outcome = await runPostEnrichment(id, { force });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
