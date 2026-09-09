import { NextRequest, NextResponse } from 'next/server';
import { pushCaseToCRM } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...payload } = body;
    const postId = id || '00000000-0000-0000-0000-000000000000';

    const coreRes = await pushCaseToCRM(postId, payload);
    const data = await coreRes.json();

    return NextResponse.json(data, { status: coreRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to push case to CRM' }, { status: 500 });
  }
}
