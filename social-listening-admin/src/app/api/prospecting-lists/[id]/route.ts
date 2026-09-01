import { NextResponse } from 'next/server';
import { getProspectingList, updateProspectingList, deleteProspectingList } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const result = await getProspectingList(id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Not found' }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await updateProspectingList(id, {
      name: body.name,
      description: body.description,
      shared: body.shared,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update' }, { status: err?.status || 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    await deleteProspectingList(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete' }, { status: 500 });
  }
}
