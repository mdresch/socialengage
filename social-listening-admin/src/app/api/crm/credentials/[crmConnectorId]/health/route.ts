import { NextRequest, NextResponse } from 'next/server';
import { getCRMConnectorHealth } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ crmConnectorId: string }> }
) {
  try {
    const { crmConnectorId } = await params;
    const body = (await req.json()) || {};
    const health = await getCRMConnectorHealth(crmConnectorId, body.config);
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to verify CRM connector' },
      { status: 500 }
    );
  }
}
