import { NextRequest, NextResponse } from 'next/server';
import { remediateConnector } from '@/lib/core-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const connectorId = body.connectorId;
    if (!connectorId) {
      return NextResponse.json({ error: 'Missing connectorId' }, { status: 400 });
    }
    const result = await remediateConnector(
      connectorId,
      body.action,
      body.overrideMinutes
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Remediation failed' },
      { status: 500 }
    );
  }
}
