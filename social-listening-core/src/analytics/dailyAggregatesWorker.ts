/**
 * Story 10.3 (ADR-0087) — Daily aggregate count refresh worker.
 *
 * Recomputes daily count rollups for source, author, sentiment, and watchlist
 * dimensions across all tenants. Runs every 15 minutes via setInterval.
 * Uses getAdminPool() to bypass RLS so it can aggregate across all tenants.
 *
 * Late-arriving posts (ingested after UTC midnight) are handled by the
 * ON CONFLICT DO UPDATE (upsert) strategy — the rollup for a historical date
 * is always recomputed from `social_posts` directly.
 */

import { getAdminPool } from '../db/adminPool';

let workerTimer: NodeJS.Timeout | null = null;

export async function runDailyAggregatesRefresh(): Promise<{ tenantsRefreshed: number; errors: number }> {
  const pool = getAdminPool();
  let tenantsRefreshed = 0;
  let errors = 0;

  const client = await pool.connect();
  try {
    // Get all active tenant IDs
    const { rows: tenants } = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE status = 'active' ORDER BY id`
    );

    for (const tenant of tenants) {
      try {
        await refreshTenantAggregates(tenant.id);
        tenantsRefreshed++;
      } catch (err) {
        errors++;
        console.error(`[dailyAggregatesWorker] Error refreshing tenant ${tenant.id}:`, err);
      }
    }
  } finally {
    client.release();
  }

  return { tenantsRefreshed, errors };
}

async function refreshTenantAggregates(tenantId: string): Promise<void> {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Refresh today and yesterday (late-arriving posts coverage)
    const dates = [
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    ];

    for (const date of dates) {
      // 1. Source daily counts
      await client.query(
        `INSERT INTO source_daily_counts (tenant_id, date, platform_id, post_count, positive_count, neutral_count, negative_count, updated_at)
         SELECT
           $1::uuid,
           $2::date,
           COALESCE(raw_payload->>'providerId', 'unknown') AS platform_id,
           COUNT(*) AS post_count,
           COUNT(*) FILTER (WHERE enrichment->>'sentiment' = 'positive') AS positive_count,
           COUNT(*) FILTER (WHERE enrichment->>'sentiment' = 'neutral') AS neutral_count,
           COUNT(*) FILTER (WHERE enrichment->>'sentiment' = 'negative') AS negative_count,
           now()
         FROM social_posts
         WHERE tenant_id = $1 AND DATE(published_at) = $2::date
         GROUP BY COALESCE(raw_payload->>'providerId', 'unknown')
         ON CONFLICT (tenant_id, date, platform_id)
         DO UPDATE SET
           post_count = EXCLUDED.post_count,
           positive_count = EXCLUDED.positive_count,
           neutral_count = EXCLUDED.neutral_count,
           negative_count = EXCLUDED.negative_count,
           updated_at = now()`,
        [tenantId, date]
      );

      // 2. Author daily counts
      await client.query(
        `INSERT INTO author_daily_counts (tenant_id, date, author_id, post_count, engagement_total, updated_at)
         SELECT
           $1::uuid,
           $2::date,
           author_id,
           COUNT(*) AS post_count,
           COALESCE(SUM(author_follower_count_at_publish), 0) AS engagement_total,
           now()
         FROM social_posts
         WHERE tenant_id = $1 AND DATE(published_at) = $2::date AND author_id IS NOT NULL
         GROUP BY author_id
         ON CONFLICT (tenant_id, date, author_id)
         DO UPDATE SET
           post_count = EXCLUDED.post_count,
           engagement_total = EXCLUDED.engagement_total,
           updated_at = now()`,
        [tenantId, date]
      );

      // 3. Sentiment daily counts
      await client.query(
        `INSERT INTO sentiment_daily_counts (tenant_id, date, sentiment, post_count, updated_at)
         SELECT
           $1::uuid,
           $2::date,
           COALESCE(enrichment->>'sentiment', 'neutral') AS sentiment,
           COUNT(*) AS post_count,
           now()
         FROM social_posts
         WHERE tenant_id = $1 AND DATE(published_at) = $2::date
           AND COALESCE(enrichment->>'sentiment', 'neutral') IN ('positive', 'neutral', 'negative', 'mixed')
         GROUP BY COALESCE(enrichment->>'sentiment', 'neutral')
         ON CONFLICT (tenant_id, date, sentiment)
         DO UPDATE SET
           post_count = EXCLUDED.post_count,
           updated_at = now()`,
        [tenantId, date]
      );

      // 4. Watchlist daily counts (via post_watchlist_matches join)
      await client.query(
        `INSERT INTO watchlist_daily_counts (tenant_id, date, watchlist_id, post_count, positive_count, neutral_count, negative_count, updated_at)
         SELECT
           sp.tenant_id,
           $2::date,
           pwm.watchlist_id,
           COUNT(DISTINCT sp.id) AS post_count,
           COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'positive') AS positive_count,
           COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'neutral') AS neutral_count,
           COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'negative') AS negative_count,
           now()
         FROM post_watchlist_matches pwm
         JOIN social_posts sp ON sp.id = pwm.post_id
         WHERE sp.tenant_id = $1 AND DATE(sp.published_at) = $2::date
         GROUP BY sp.tenant_id, pwm.watchlist_id
         ON CONFLICT (tenant_id, date, watchlist_id)
         DO UPDATE SET
           post_count = EXCLUDED.post_count,
           positive_count = EXCLUDED.positive_count,
           neutral_count = EXCLUDED.neutral_count,
           negative_count = EXCLUDED.negative_count,
           updated_at = now()`,
        [tenantId, date]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Starts the 15-minute refresh worker loop.
 */
export function startDailyAggregatesWorker(): void {
  if (workerTimer !== null) return; // already running

  console.log('[dailyAggregatesWorker] Starting 15-minute refresh cycle');

  // Run once immediately on startup
  runDailyAggregatesRefresh().catch((err) =>
    console.error('[dailyAggregatesWorker] Initial refresh failed:', err)
  );

  workerTimer = setInterval(() => {
    runDailyAggregatesRefresh().catch((err) =>
      console.error('[dailyAggregatesWorker] Scheduled refresh failed:', err)
    );
  }, 15 * 60 * 1000); // 15 minutes
}

export function stopDailyAggregatesWorker(): void {
  if (workerTimer !== null) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
