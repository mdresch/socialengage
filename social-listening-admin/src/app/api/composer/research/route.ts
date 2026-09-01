import { NextResponse } from 'next/server';
import { composerResearch } from '@/lib/core-client';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const outcome = await composerResearch({
    text: typeof payload.text === 'string' ? payload.text : '',
    targetPlatforms: Array.isArray(payload.targetPlatforms) ? payload.targetPlatforms : undefined,
    maxSearchResultsPerQuery: typeof payload.maxSearchResultsPerQuery === 'number' ? payload.maxSearchResultsPerQuery : undefined,
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
