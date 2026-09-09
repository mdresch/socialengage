import { NextRequest, NextResponse } from 'next/server';
import { getCRMCredential, deleteCRMCredential } from '@/lib/core-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ crmConnectorId: string }> }
) {
  try {
    const { crmConnectorId } = await params;
    const credential = await getCRMCredential(crmConnectorId);
    return NextResponse.json(credential);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load CRM credentials' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ crmConnectorId: string }> }
) {
  try {
    const { crmConnectorId } = await params;
    const ok = await deleteCRMCredential(crmConnectorId);
    if (!ok) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete CRM credentials' }, { status: 500 });
  }
}
