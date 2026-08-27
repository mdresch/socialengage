import { NextResponse } from 'next/server';
import { testWebhookSubscription } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const data = await testWebhookSubscription(id);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to test webhook' }, { status: 500 });
  }
}
