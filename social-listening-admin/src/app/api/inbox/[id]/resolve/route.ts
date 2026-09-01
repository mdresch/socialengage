import { NextRequest, NextResponse } from 'next/server';
import { resolveInboxItem } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const item = await resolveInboxItem(id, body.notes);
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to resolve inbox item' }, { status: 400 });
  }
}
