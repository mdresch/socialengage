import { NextRequest, NextResponse } from 'next/server';
import { assignInboxItem } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const item = await assignInboxItem(id, body.assignedTo ?? null);
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to assign inbox item' }, { status: 400 });
  }
}
