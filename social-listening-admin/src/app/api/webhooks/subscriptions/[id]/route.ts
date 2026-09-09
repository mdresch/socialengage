import { NextResponse } from 'next/server';
import { deleteWebhookSubscription } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    await deleteWebhookSubscription(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete webhook' }, { status: 500 });
  }
}
