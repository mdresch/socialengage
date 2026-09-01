import { NextResponse } from 'next/server';
import { updateAlertRule, deleteAlertRule } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = await updateAlertRule(id, body);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update alert rule' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    await deleteAlertRule(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete alert rule' }, { status: 500 });
  }
}
