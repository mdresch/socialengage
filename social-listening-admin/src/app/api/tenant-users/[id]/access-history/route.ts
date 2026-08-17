/**
 * Story 6.14 — same-origin proxy for AccessHistoryButton.tsx's real
 * GET /v1/tenants/users/:id/access-history call. Same thin-proxy shape
 * every other route in src/app/api/** uses (ADR-0036 §2 — core-client.ts
 * stays the sole bearer-token choke point).
 */

import { NextResponse } from 'next/server';
import { getUserAccessHistory } from '@/lib/core-client';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const entries = await getUserAccessHistory(id);
    return NextResponse.json({ entries }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load access history.' }, { status: 502 });
  }
}
