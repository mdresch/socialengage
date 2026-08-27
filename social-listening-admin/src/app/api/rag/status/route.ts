import { NextResponse } from 'next/server';
import { getRAGStatus } from '@/lib/core-client';

export async function GET() {
  try {
    const result = await getRAGStatus();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'RAG status check failed' },
      { status: 500 }
    );
  }
}
