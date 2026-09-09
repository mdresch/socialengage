import { NextRequest, NextResponse } from 'next/server';
import { getConnectorTargets } from '@/lib/core-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ platformId: string }> }
) {
  try {
    const { platformId } = await params;
    const targets = await getConnectorTargets(platformId);
    return NextResponse.json({ platformId, targets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch connector targets' }, { status: 500 });
  }
}
