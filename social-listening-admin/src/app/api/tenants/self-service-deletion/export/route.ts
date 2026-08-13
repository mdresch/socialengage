/**
 * Story 6.13 — same-origin proxy for the re-triggerable export step.
 * Preserves the real content-type (application/json or text/csv) and
 * status coming back from core-client.ts's requestTenantSelfServiceExport()
 * — the sole Bearer-attachment choke point (ADR-0036 §2) — unchanged, so
 * TenantDeletionPanel.tsx can turn the raw body into a real file download.
 */

import { NextResponse } from 'next/server';
import { requestTenantSelfServiceExport } from '@/lib/core-client';

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => ({}));
  const format = requestBody?.format === 'csv' ? 'csv' : 'json';
  const outcome = await requestTenantSelfServiceExport(format);
  return new NextResponse(outcome.body, {
    status: outcome.status,
    headers: { 'Content-Type': outcome.contentType },
  });
}
