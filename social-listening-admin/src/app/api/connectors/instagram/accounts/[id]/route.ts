import { NextResponse } from 'next/server';
import { disconnectInstagramAccount } from '@/lib/core-client';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await disconnectInstagramAccount(id);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
