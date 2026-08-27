import { NextResponse } from 'next/server';
import { listTenantAlerts } from '@/lib/core-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  try {
    const data = await listTenantAlerts({ status, limit });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list alerts inbox' }, { status: 500 });
  }
}
