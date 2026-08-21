/**
 * Story 6.31 (ADR-0071) — same-origin BFF proxy route for updating
 * human-in-the-loop post enrichment overrides.
 * Invokes updatePostEnrichment() in core-client.ts.
 */

import { NextResponse } from 'next/server';
import { updatePostEnrichment } from '@/lib/core-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updates = await request.json().catch(() => ({}));
  const outcome = await updatePostEnrichment(id, updates);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
