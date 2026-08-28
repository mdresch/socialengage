import { NextRequest, NextResponse } from 'next/server';
import { publishOutboundPost, listOutboundPosts } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await publishOutboundPost(body);
    return NextResponse.json(result, { status: 202 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to publish outbound post' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const providerId = searchParams.get('providerId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await listOutboundPosts({ status, providerId, limit });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list outbound posts' }, { status: 500 });
  }
}
