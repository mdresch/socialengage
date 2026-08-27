/**
 * Story 10.2 (ADR-0086) — same-origin proxy for prospecting-lists CRUD.
 * Client components (ProspectingListsView, ProspectingListDetailView) use
 * /api/prospecting-lists instead of calling core directly so they never need
 * to handle bearer tokens. Token attachment stays inside core-client.ts.
 */

import { NextResponse } from 'next/server';
import { listProspectingLists, createProspectingList } from '@/lib/core-client';

export async function GET() {
  try {
    const result = await listProspectingLists();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list prospecting lists' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createProspectingList({
      name: body.name,
      description: body.description ?? null,
      shared: body.shared ?? false,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create prospecting list' }, { status: 500 });
  }
}
