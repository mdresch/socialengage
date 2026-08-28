import { NextRequest, NextResponse } from 'next/server';
import { listCRMFieldMappings, upsertCRMFieldMapping } from '@/lib/core-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const crmConnectorId = searchParams.get('crmConnectorId') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const mappings = await listCRMFieldMappings(crmConnectorId, entityType);
    return NextResponse.json(mappings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list CRM field mappings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await upsertCRMFieldMapping(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to upsert CRM field mapping' }, { status: 500 });
  }
}
