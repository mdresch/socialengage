/**
 * Story 6.39 (ADR-0075) — same-origin BFF proxy for creating real outbound
 * posts on connected Facebook Pages.
 * POST /api/outbound/posts forwards to publishPost() and returns the
 * per-Page result rows with their HTTP status.
 */

import { NextResponse } from 'next/server';
import { publishPost } from '@/lib/core-client';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const outcome = await publishPost({
    text: typeof payload.text === 'string' ? payload.text : '',
    targets: Array.isArray(payload.targets) ? payload.targets : [],
    platformOverrides: payload.platformOverrides,
    linkPreview: payload.linkPreview ?? null,
  });
  return NextResponse.json({ rows: outcome.rows }, { status: outcome.status });
}
