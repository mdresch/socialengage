/**
 * Story 6.40 / ADR-0074 — same-origin proxy for the matched-posts CSV
 * export. Forwards to core-client.ts's exportPostsCsv() — the sole
 * Bearer-attachment choke point (ADR-0036 §2) — and streams the response
 * body through with the original Content-Type and status intact, so the
 * browser receives a real file download.
 *
 * Authorization is enforced server-side by Story 3.16's backend endpoint:
 * both `tenant_admin` and `tenant_user` (BRU-002); `platform_admin`
 * receives 403, which passes through as-is.
 */

import { exportPostsCsv } from '@/lib/core-client';

export async function GET() {
  const response = await exportPostsCsv();
  const headers = new Headers();
  const contentType = response.headers.get('Content-Type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  headers.set(
    'Content-Disposition',
    'attachment; filename="matched-posts-export.csv"'
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
