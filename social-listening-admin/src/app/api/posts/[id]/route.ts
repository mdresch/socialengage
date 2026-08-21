/**
 * 2026-08-19 — same-origin proxy so the Analytics Overview tab's own
 * post-detail drawer (a client component) can fetch one post's full detail
 * on demand, without knowing CORE_API_BASE_URL or attaching a bearer token
 * itself. Mirrors .../posts/[id]/enrich/route.ts exactly — the actual
 * bearer-token attachment happens inside core-client.ts's getPost() (via
 * authenticatedCoreFetch()), keeping core-client.ts the sole choke point
 * (ADR-0036 §2). A 404 (unknown id, or another tenant's post — RLS makes
 * the two indistinguishable) is forwarded as a real 404, not swallowed.
 */

import { NextResponse } from 'next/server';
import { getPost } from '@/lib/core-client';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json(post);
}
