import { NextRequest, NextResponse } from 'next/server';
import { getMentionSuggestions } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const suggestions = await getMentionSuggestions(body);
    return NextResponse.json({ suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to get mention suggestions' }, { status: 500 });
  }
}
