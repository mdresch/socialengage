import { NextRequest, NextResponse } from 'next/server';
import { getConnectorCapabilities } from '../../../../lib/core-client';

/**
 * Story 12.2 (ADR-0101 §3) — BFF proxy for connector capability matrix.
 * GET /api/connectors/capabilities
 */
export async function GET(_req: NextRequest) {
  try {
    const result = await getConnectorCapabilities();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch connector capabilities' },
      { status: 500 }
    );
  }
}
