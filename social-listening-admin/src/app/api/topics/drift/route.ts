import { NextRequest, NextResponse } from 'next/server';
import { getTopicDrift } from '@/lib/core-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const start = searchParams.get('start') || '';
    const end = searchParams.get('end') || '';

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    if (!start || !end) {
      return NextResponse.json({ error: 'start and end query parameters are required' }, { status: 400 });
    }

    const result = await getTopicDrift(id, start, end);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch topic drift' },
      { status: 500 }
    );
  }
}
