import { NextResponse } from 'next/server';
import { askRAG } from '@/lib/core-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await askRAG(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'RAG ask failed' },
      { status: 500 }
    );
  }
}
