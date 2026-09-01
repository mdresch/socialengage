import { NextRequest, NextResponse } from 'next/server';
import { getConnectorQueryCapabilities } from '../../../../../lib/core-client';

/**
 * Story 12.4 (ADR-0102 §3) — BFF proxy for per-connector query capabilities.
 * GET /api/connectors/[platformId]/query-capabilities
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ platformId: string }> | { platformId: string } }
) {
  try {
    const params = await context.params;
    const platformId = params.platformId;
    const result = await getConnectorQueryCapabilities(platformId);
    if (!result) {
      return NextResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch query capabilities' },
      { status: 500 }
    );
  }
}
