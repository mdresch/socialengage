/**
 * Story 13.4 (ADR-0111) — per-tenant, per-scope in-memory rate limiting for
 * the posts export surface. ADR-0020's distributed RequestGate is explicitly
 * deferred for a second concurrent instance; this is the same single-process
 * guard pattern as `src/http/rateLimitMiddleware.ts`, scoped to export scopes.
 */

export type ExportRateScope = 'sync' | 'async' | 'status' | 'download';

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // unix ms
}

interface WindowState {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowState>();

function scopeLimit(scope: ExportRateScope): number {
  const defaults: Record<ExportRateScope, string> = {
    sync: '60',
    async: '20',
    status: '120',
    download: '10',
  };
  return Number(process.env[`EXPORT_RATE_${scope.toUpperCase()}_LIMIT`] ?? defaults[scope]);
}

function windowSeconds(): number {
  return Number(process.env.EXPORT_RATE_WINDOW_SECONDS ?? '3600');
}

function key(tenantId: string, scope: ExportRateScope): string {
  return `export:${scope}:tenant:${tenantId}`;
}

/**
 * Test-only: clears all export rate-limit windows. Contract tests that set
 * low per-tenant limits call this between assertions to avoid cross-test
 * state; real callers must never use this.
 */
export function resetExportRateLimits(): void {
  store.clear();
}

/**
 * Checks whether an export request is within the tenant's hourly quota. If
 * allowed, the counter is incremented immediately. The caller must return a
 * 429 `EXPORT_RATE_LIMITED` when this returns `allowed: false`.
 */
export function checkExportRateLimit(tenantId: string, scope: ExportRateScope): RateLimitResult {
  const limit = scopeLimit(scope);
  const ws = windowSeconds() * 1000;
  const now = Date.now();
  const k = key(tenantId, scope);
  let state = store.get(k);

  if (!state || now >= state.resetAt) {
    state = { count: 1, resetAt: now + ws };
    store.set(k, state);
    return { allowed: true, limit, remaining: limit - 1, resetAt: state.resetAt };
  }

  state.count += 1;
  const remaining = Math.max(0, limit - state.count);
  return { allowed: state.count <= limit, limit, remaining, resetAt: state.resetAt };
}
