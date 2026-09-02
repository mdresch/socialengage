import { NextRequest, NextResponse } from 'next/server';
import { saveCRMCredential } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) || {};
    const { crmConnectorId, ...config } = body;

    if (!crmConnectorId) {
      return NextResponse.json({ error: 'crmConnectorId is required' }, { status: 400 });
    }

    const data = await saveCRMCredential(crmConnectorId, config as Record<string, string>);

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save CRM credentials' }, { status: 500 });
  }
}
