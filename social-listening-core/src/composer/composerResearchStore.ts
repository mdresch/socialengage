import { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { withTenant } from '../db/withTenant';
import { ComposerResearchResult } from './composerResearchService';

export interface TenantResearchSettings {
  researchCacheTtlHours: number;
  researchDailyRequestCap: number;
  researchMonthlyCostCapUsd: number | null;
}

export interface ResearchRunRecord {
  userId: string;
  textHash: string;
  aiProviderId: string;
  searchProviderIds: string[];
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
}

const DEFAULT_CACHE_TTL_HOURS = 24;
const DEFAULT_DAILY_REQUEST_CAP = 50;

/**
 * Derives the canonical text hash per ADR-0121 / TDS-0121.
 * Normalizes text (lowercase, trimmed whitespace) and includes sorted provider IDs.
 */
export function computeResearchTextHash(
  text: string,
  aiProviderId: string,
  searchProviderIds: string[]
): string {
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const sortedSearchProviders = [...searchProviderIds].sort().join(',');
  const input = `${normalizedText}:${aiProviderId}:${sortedSearchProviders}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Reads research-specific tenant settings from `tenant_settings`.
 * Falls back to default values (24h TTL, 50 daily cap, null cost cap).
 */
export async function getTenantResearchSettings(
  tenantId: string,
  client: PoolClient
): Promise<TenantResearchSettings> {
  const res = await client.query(
    `SELECT research_cache_ttl_hours, research_daily_request_cap, research_monthly_cost_cap_usd
     FROM tenant_settings
     WHERE tenant_id = $1`,
    [tenantId]
  );

  if (res.rows.length === 0) {
    return {
      researchCacheTtlHours: DEFAULT_CACHE_TTL_HOURS,
      researchDailyRequestCap: DEFAULT_DAILY_REQUEST_CAP,
      researchMonthlyCostCapUsd: null,
    };
  }

  const row = res.rows[0];
  return {
    researchCacheTtlHours: row.research_cache_ttl_hours ?? DEFAULT_CACHE_TTL_HOURS,
    researchDailyRequestCap: row.research_daily_request_cap ?? DEFAULT_DAILY_REQUEST_CAP,
    researchMonthlyCostCapUsd: row.research_monthly_cost_cap_usd !== null ? Number(row.research_monthly_cost_cap_usd) : null,
  };
}

/**
 * Counts research runs for this tenant for the current calendar day.
 */
export async function getDailyResearchRunCount(
  tenantId: string,
  client: PoolClient
): Promise<number> {
  const res = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM research_runs
     WHERE tenant_id = $1
       AND created_at >= date_trunc('day', now())`,
    [tenantId]
  );
  return res.rows[0]?.cnt ?? 0;
}

/**
 * Sums estimated cost (USD) for this tenant for the current calendar month.
 */
export async function getMonthlyResearchEstimatedCost(
  tenantId: string,
  client: PoolClient
): Promise<number> {
  const res = await client.query(
    `SELECT COALESCE(SUM(estimated_cost_usd), 0)::numeric AS total_cost
     FROM research_runs
     WHERE tenant_id = $1
       AND created_at >= date_trunc('month', now())`,
    [tenantId]
  );
  return Number(res.rows[0]?.total_cost ?? 0);
}

/**
 * Fetches cached research result if present and not expired.
 */
export async function getCachedResearchResult(
  tenantId: string,
  textHash: string,
  client: PoolClient
): Promise<ComposerResearchResult | null> {
  const res = await client.query(
    `SELECT result_json
     FROM research_cache
     WHERE tenant_id = $1
       AND text_hash = $2
       AND expires_at > now()`,
    [tenantId, textHash]
  );

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0].result_json as ComposerResearchResult;
}

/**
 * Persists or updates cached research result with the configured TTL hours.
 */
export async function setCachedResearchResult(
  tenantId: string,
  textHash: string,
  result: ComposerResearchResult,
  ttlHours: number,
  client: PoolClient
): Promise<void> {
  await client.query(
    `INSERT INTO research_cache (tenant_id, text_hash, result_json, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)
     ON CONFLICT (tenant_id, text_hash)
     DO UPDATE SET result_json = EXCLUDED.result_json,
                   expires_at = EXCLUDED.expires_at,
                   created_at = now()`,
    [tenantId, textHash, JSON.stringify(result), ttlHours]
  );
}

/**
 * Appends a research run telemetry record. Errors are caught and swallowed per TDS-0121 Decision §8
 * to prevent failing user requests due to telemetry write issues.
 */
export async function recordResearchRun(
  tenantId: string,
  record: ResearchRunRecord,
  client: PoolClient
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO research_runs (
        tenant_id, user_id, text_hash, ai_provider_id, search_provider_ids,
        cache_hit, tokens_in, tokens_out, estimated_cost_usd, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        tenantId,
        record.userId,
        record.textHash,
        record.aiProviderId,
        record.searchProviderIds,
        record.cacheHit,
        record.tokensIn,
        record.tokensOut,
        record.estimatedCostUsd,
      ]
    );
  } catch (err) {
    // Non-fatal per TDS-0121 §8
  }
}
