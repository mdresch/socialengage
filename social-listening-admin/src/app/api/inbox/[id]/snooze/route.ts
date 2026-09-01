import { NextRequest, NextResponse } from 'next/server';
import { snoozeInboxItem } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.snoozedUntil) {
      return NextResponse.json({ error: 'snoozedUntil timestamp is required' }, { status: 400 });
    }
    const item = await snoozeInboxItem(id, body.snoozedUntil);
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to snooze inbox item' }, { status: 400 });
  }
}
