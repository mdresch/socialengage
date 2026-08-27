import { NextResponse } from 'next/server';
import { updateProspectingEntry, deleteProspectingEntry } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string; entryId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, entryId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await updateProspectingEntry(id, entryId, {
      relationship_stage: body.relationship_stage,
      notes: body.notes,
      tags: body.tags,
      custom_attributes: body.custom_attributes,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update entry' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id, entryId } = await params;
  try {
    await deleteProspectingEntry(id, entryId);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete entry' }, { status: 500 });
  }
}
