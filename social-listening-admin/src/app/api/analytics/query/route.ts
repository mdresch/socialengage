/**
 * Story 10.5 (ADR-0088) — same-origin proxy for Ad-Hoc Analytics Queries.
 */

import { NextResponse } from 'next/server';
import { executeAdHocAnalyticsQuery } from '@/lib/core-client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await executeAdHocAnalyticsQuery(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to execute query' },
      { status: 500 }
    );
  }
}
