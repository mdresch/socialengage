import { NextResponse } from 'next/server';
import { updateTenantAlertStatus } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = await updateTenantAlertStatus(id, body.status);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update alert' }, { status: 500 });
  }
}
