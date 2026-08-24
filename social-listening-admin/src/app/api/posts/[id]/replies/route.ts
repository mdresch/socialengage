/**
 * Story 6.38 (ADR-0073) — same-origin BFF proxy for replying to an ingested
 * post and listing its reply audit rows.
 * POST /api/posts/[id]/replies forwards to submitReply() and returns the
 * created/failed outbound_activities row.
 * GET /api/posts/[id]/replies forwards to listReplies() and returns the
 * replies page.
 */

import { NextResponse } from 'next/server';
import { submitReply, listReplies } from '@/lib/core-client';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const body = typeof payload.body === 'string' ? payload.body : '';
  const outcome = await submitReply(id, body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await listReplies(id);
  return NextResponse.json(list);
}
