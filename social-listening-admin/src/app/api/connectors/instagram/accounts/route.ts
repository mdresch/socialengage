import { NextResponse } from 'next/server';
import { listInstagramAccounts } from '@/lib/core-client';

export async function GET() {
  const outcome = await listInstagramAccounts();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
