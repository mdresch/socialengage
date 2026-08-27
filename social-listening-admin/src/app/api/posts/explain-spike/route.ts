/**
 * Story 8.8 (ADR-0062 Decision §6) — same-origin proxy so
 * SpikeStorytellerWidget.tsx (a Client Component) can reach
 * POST /v1/posts/explain-spike without needing to know
 * CORE_API_BASE_URL or attach a bearer token itself. Mirrors
 * .../posts/[id]/enrich/route.ts exactly — the actual bearer-token
 * attachment happens inside core-client.ts's explainSpike() (via
 * authenticatedCoreFetch()), keeping core-client.ts the sole choke
 * point (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { explainSpike } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const spikeDate = typeof body?.spikeDate === 'string' ? body.spikeDate : '';
  const customPrompt = typeof body?.customPrompt === 'string' ? body.customPrompt : undefined;
  const outcome = await explainSpike(spikeDate, { customPrompt });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
