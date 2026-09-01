import { NextResponse } from 'next/server';
import { getAiInsightsDigest } from '@/lib/core-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') === 'weekly' ? 'weekly' : 'daily';

  try {
    const data = await getAiInsightsDigest(period);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get AI digest' }, { status: 500 });
  }
}
