import { NextRequest, NextResponse } from 'next/server';
import { previewDailyDigest } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const preview = await previewDailyDigest(body);
    return NextResponse.json(preview);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate preview' }, { status: 500 });
  }
}
