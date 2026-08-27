import { NextResponse } from 'next/server';
import { searchRAG } from '@/lib/core-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await searchRAG(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'RAG search failed' },
      { status: 500 }
    );
  }
}
