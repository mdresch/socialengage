/**
 * Story 6.27 (ADR-0060 Decision §5) — same-origin proxy for the caller's
 * own connected Facebook Pages list, keeping core-client.ts the sole
 * Bearer-attachment choke point (ADR-0036 §2), same reasoning as every
 * sibling connector proxy route.
 */

import { NextResponse } from 'next/server';
import { listFacebookPages } from '@/lib/core-client';

export async function GET() {
  const outcome = await listFacebookPages();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
