/**
 * Story 6.40 / ADR-0074 — same-origin proxy for the full workspace JSON
 * export. Forwards to core-client.ts's exportWorkspace() — the sole
 * Bearer-attachment choke point (ADR-0036 §2) — and streams the response
 * body through with the original Content-Type and status intact, so the
 * browser receives a real file download.
 *
 * Authorization is enforced server-side by Story 3.16's backend endpoint:
 * `tenant_admin` only (BRU-001); `tenant_user` receives 403, which passes
 * through as-is.
 */

import { exportWorkspace } from '@/lib/core-client';

export async function GET() {
  const response = await exportWorkspace();
  const headers = new Headers();
  const contentType = response.headers.get('Content-Type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  headers.set(
    'Content-Disposition',
    'attachment; filename="tenant-workspace-export.json"'
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
