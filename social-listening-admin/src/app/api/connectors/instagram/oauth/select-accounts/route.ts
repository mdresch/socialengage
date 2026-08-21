import { NextResponse } from 'next/server';
import { selectInstagramAccounts } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await selectInstagramAccounts(body.sessionToken, body.igUserIds);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
