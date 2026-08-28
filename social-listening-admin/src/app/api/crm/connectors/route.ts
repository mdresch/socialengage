import { NextResponse } from 'next/server';
import { listCRMConnectors } from '@/lib/core-client';

export async function GET() {
  try {
    const connectors = await listCRMConnectors();
    return NextResponse.json(connectors);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list CRM connectors' }, { status: 500 });
  }
}
