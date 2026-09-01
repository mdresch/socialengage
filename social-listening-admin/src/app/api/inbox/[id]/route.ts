import { NextRequest, NextResponse } from 'next/server';
import { getInboxItem, updateInboxItem } from '@/lib/core-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getInboxItem(id);
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to get inbox item' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const item = await updateInboxItem(id, body);
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update inbox item' }, { status: 400 });
  }
}
