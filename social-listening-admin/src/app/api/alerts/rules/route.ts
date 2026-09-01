import { NextResponse } from 'next/server';
import { listAlertRules, createAlertRule } from '@/lib/core-client';

export async function GET() {
  try {
    const data = await listAlertRules();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list alert rules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await createAlertRule(body);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create alert rule' }, { status: 500 });
  }
}
