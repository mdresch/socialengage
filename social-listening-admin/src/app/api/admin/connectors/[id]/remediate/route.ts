import { NextRequest, NextResponse } from 'next/server';
import { remediateConnector } from '@/lib/core-client';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await context.params;
    const connectorId = params.id;
    const body = await req.json();
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
