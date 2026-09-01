import { NextRequest, NextResponse } from 'next/server';
import { listInboxItems } from '@/lib/core-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const providerId = searchParams.get('providerId') || undefined;
    const watchlistId = searchParams.get('watchlistId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const result = await listInboxItems({
      status,
      priority,
      assignedTo,
      providerId,
      watchlistId,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list inbox items' }, { status: 500 });
  }
}
