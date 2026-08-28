import { NextRequest, NextResponse } from 'next/server';
import { getTopicEvolution } from '@/lib/core-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic') || undefined;
    const topicId = searchParams.get('topicId') || undefined;
    const topicName = searchParams.get('topicName') || undefined;
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const granularity = (searchParams.get('granularity') as any) || 'day';
    const compareToPrevious = searchParams.get('compareToPrevious') === 'true';

    const result = await getTopicEvolution({
      topic,
      topicId,
      topicName,
      start,
      end,
      granularity,
      compareToPrevious,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch topic evolution' },
      { status: 500 }
    );
  }
}
