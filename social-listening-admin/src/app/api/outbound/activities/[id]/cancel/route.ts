import { NextRequest, NextResponse } from 'next/server';
import { cancelOutboundActivity } from '@/lib/core-client';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await cancelOutboundActivity(id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to cancel activity' }, { status: 400 });
  }
}
