import { NextRequest, NextResponse } from 'next/server';
import { rescheduleOutboundActivity } from '@/lib/core-client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.scheduledFor) {
      return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 });
    }
    const result = await rescheduleOutboundActivity(id, body.scheduledFor);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reschedule activity' }, { status: 400 });
  }
}
