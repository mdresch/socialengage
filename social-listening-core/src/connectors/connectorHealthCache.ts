import { deriveConnectorHealth, ConnectorHealth } from './connectorHealth';

/**
 * In-process, TTL-bound read-through cache in front of deriveConnectorHealth()
 * (Story 4.4, ADR-0022). Never a second source of truth — a cache entry is
 * exactly what deriveConnectorHealth() would return at read time, held only
 * long enough to avoid recomputing on every GET /connectors poll. Deliberately
 * has no shared-store dependency (no Redis import anywhere in this file) —
 * see .claude/skills/derived-data-caching-and-refresh/SKILL.md.
 */

const DEFAULT_TTL_MS = 60_000;

interface CacheEntry {
  value: ConnectorHealth;
  expiresAt: number;
}

export class ConnectorHealthCache {
  private readonly ttlMs: number;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  async get(tenantId: string, platformId: string, pageId?: string, userId?: string): Promise<ConnectorHealth> {
    const key = `${tenantId}:${platformId}:${pageId ?? ''}:${userId ?? ''}`;
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const value = await deriveConnectorHealth(tenantId, platformId, pageId, userId);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    return value;
  }

  flush(): void {
    this.entries.clear();
  }
}

/**
 * The single shared cache instance this process's GET /connectors uses —
 * per-instance/in-process, deliberately not shared across
 * social-listening-core instances (ADR-0022's cache-locality decision).
 */
const sharedCache = new ConnectorHealthCache(
  Number(process.env.CONNECTOR_HEALTH_CACHE_TTL_MS ?? DEFAULT_TTL_MS)
);

export function getCachedConnectorHealth(
  tenantId: string,
  platformId: string,
  pageId?: string,
  userId?: string
): Promise<ConnectorHealth> {
  return sharedCache.get(tenantId, platformId, pageId, userId);
}

export function flushConnectorHealthCache(): void {
  sharedCache.flush();
}
