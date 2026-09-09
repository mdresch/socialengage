import { NextRequest, NextResponse } from 'next/server';
import { replyToInboxItem } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.body || !body.body.trim()) {
      return NextResponse.json({ error: 'Reply body cannot be empty' }, { status: 400 });
    }
    const result = await replyToInboxItem(id, body.body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reply to inbox item' }, { status: 400 });
  }
}
