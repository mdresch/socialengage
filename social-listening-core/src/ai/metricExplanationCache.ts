import { createHash } from 'crypto';
import { withTenant } from '../db/withTenant';

/** Minimal response shape the cache needs to store. */
export interface MetricExplanationResponse {
  explanation: string | null;
  confidence: 'high' | 'medium' | 'low';
  generationId: string;
}

export interface MetricExplainCacheKeyInput {
  tenantId: string;
  metricKey: string;
  value: number | string;
  timeRange: { start: string; end: string };
  filters: Record<string, unknown>;
  promptVersion: number;
}

export interface CachedMetricExplanation {
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  generationId: string;
  promptVersion: number;
  cacheHit: true;
}

/**
 * Builds a deterministic SHA-256 cache key from the ADR-0113 components.
 * The canonical form is a JSON array so component boundaries are unambiguous.
 */
export function buildMetricExplanationCacheKey(input: MetricExplainCacheKeyInput): string {
  const canonical = JSON.stringify([
    input.tenantId,
    input.metricKey,
    String(input.value),
    input.timeRange.start,
    input.timeRange.end,
    JSON.stringify(input.filters),
    input.promptVersion,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Looks up a non-expired cached explanation and bumps its hit counter.
 * Returns null when there is no matching, unexpired entry.
 */
export async function getCachedMetricExplanation(
  tenantId: string,
  cacheKeyHash: string
): Promise<CachedMetricExplanation | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<
      Pick<CachedMetricExplanation, 'explanation' | 'confidence' | 'generationId' | 'promptVersion'>
    >(
      `UPDATE metric_explanation_cache
       SET cache_hit_count = cache_hit_count + 1,
           updated_at = now()
       WHERE tenant_id = $1
         AND cache_key_hash = $2
         AND expires_at > now()
       RETURNING explanation, confidence, generation_id AS "generationId", prompt_version AS "promptVersion"`,
      [tenantId, cacheKeyHash]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      explanation: rows[0].explanation,
      confidence: rows[0].confidence,
      generationId: rows[0].generationId,
      promptVersion: rows[0].promptVersion,
      cacheHit: true,
    };
  });
}

export interface StoreMetricExplanationCacheInput {
  tenantId: string;
  cacheKeyHash: string;
  metricKey: string;
  value: number | string;
  promptVersion: number;
  response: Pick<MetricExplanationResponse, 'explanation' | 'confidence' | 'generationId'>;
  ttlSeconds: number;
}

/**
 * Stores a generated explanation in the tenant-scoped cache, replacing any
 * existing entry with the same cache key. The hit counter is reset to 0 on
 * a fresh write.
 */
export async function storeMetricExplanationCache(
  input: StoreMetricExplanationCacheInput
): Promise<void> {
  return withTenant(input.tenantId, async (client) => {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString();
    await client.query(
      `INSERT INTO metric_explanation_cache
         (tenant_id, cache_key_hash, metric_key, value, prompt_version,
          explanation, confidence, generation_id, expires_at, cache_hit_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       ON CONFLICT (tenant_id, cache_key_hash)
       DO UPDATE SET
         metric_key = EXCLUDED.metric_key,
         value = EXCLUDED.value,
         prompt_version = EXCLUDED.prompt_version,
         explanation = EXCLUDED.explanation,
         confidence = EXCLUDED.confidence,
         generation_id = EXCLUDED.generation_id,
         expires_at = EXCLUDED.expires_at,
         cache_hit_count = 0,
         updated_at = now()`,
      [
        input.tenantId,
        input.cacheKeyHash,
        input.metricKey,
        String(input.value),
        input.promptVersion,
        input.response.explanation,
        input.response.confidence,
        input.response.generationId,
        expiresAt,
      ]
    );
  });
}
