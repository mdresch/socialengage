import { NextResponse } from 'next/server';
import { listWebhookSubscriptions, createWebhookSubscription } from '@/lib/core-client';

export async function GET() {
  try {
    const data = await listWebhookSubscriptions();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list webhooks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await createWebhookSubscription(body);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create webhook' }, { status: 500 });
  }
}
