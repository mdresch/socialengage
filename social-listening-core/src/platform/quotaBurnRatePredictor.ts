import { getAdminPool } from '../db/adminPool';
import { getPool } from '../db/pool';

export interface TenantQuotaBurnProjection {
  tenantId: string;
  tenantName: string;
  monthlyQuota: number;
  consumedTokens: number;
  dailyVelocity7d: number;
  daysRemaining: number | null;
  projectedExhaustionDate: string | null;
  status: 'healthy' | 'warning_30d' | 'critical_7d';
}

export function computeBurnProjection(
  monthlyQuota: number,
  consumedTokens: number,
  dailyUsage7d: number[]
): {
  dailyVelocity7d: number;
  daysRemaining: number | null;
  projectedExhaustionDate: string | null;
  status: 'healthy' | 'warning_30d' | 'critical_7d';
} {
  const sum7d = dailyUsage7d.reduce((a, b) => a + b, 0);
  const count = dailyUsage7d.length || 7;
  const dailyVelocity7d = count > 0 ? Math.round((sum7d / count) * 100) / 100 : 0;

  if (consumedTokens >= monthlyQuota) {
    return {
      dailyVelocity7d,
      daysRemaining: 0,
      projectedExhaustionDate: new Date().toISOString(),
      status: 'critical_7d',
    };
  }

  if (dailyVelocity7d <= 0) {
    return {
      dailyVelocity7d: 0,
      daysRemaining: null,
      projectedExhaustionDate: null,
      status: 'healthy',
    };
  }

  const remainingQuota = Math.max(0, monthlyQuota - consumedTokens);
  const daysRemaining = Math.round((remainingQuota / dailyVelocity7d) * 10) / 10;
  const projectedExhaustionDate = new Date(Date.now() + daysRemaining * 86400 * 1000).toISOString();

  let status: 'healthy' | 'warning_30d' | 'critical_7d' = 'healthy';
  if (daysRemaining <= 7) {
    status = 'critical_7d';
  } else if (daysRemaining <= 30) {
    status = 'warning_30d';
  }

  return {
    dailyVelocity7d,
    daysRemaining,
    projectedExhaustionDate,
    status,
  };
}

export async function getTenantQuotaBurnProjections(): Promise<TenantQuotaBurnProjection[]> {
  const adminPool = getAdminPool();
  const client = await adminPool.connect();
  try {
    const { rows: tenants } = await client.query<{
      id: string;
      name: string;
      license_seat_count: number;
    }>(`SELECT id, name, license_seat_count FROM tenants ORDER BY name ASC`);

    if (!tenants || tenants.length === 0) {
      return [];
    }

    const appPool = getPool();
    const appClient = await appPool.connect();
    let postStats: Array<{ tenant_id: string; count_30d: string; count_7d: string }> = [];
    try {
      const { rows } = await appClient.query<{
        tenant_id: string;
        count_30d: string;
        count_7d: string;
      }>(
        `SELECT
           tenant_id,
           COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS count_30d,
           COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS count_7d
         FROM social_posts
         GROUP BY tenant_id`
      );
      postStats = rows;
    } catch {
      postStats = [];
    } finally {
      appClient.release();
    }

    const statsMap = new Map(postStats.map((s) => [s.tenant_id, s]));

    return tenants.map((t) => {
      const stats = statsMap.get(t.id);
      const posts30d = parseInt(stats?.count_30d || '0', 10);
      const posts7d = parseInt(stats?.count_7d || '0', 10);
      const consumedTokens = posts30d * 850;
      const tokens7d = posts7d * 850;
      const dailyUsage = [
        tokens7d / 7,
        tokens7d / 7,
        tokens7d / 7,
        tokens7d / 7,
        tokens7d / 7,
        tokens7d / 7,
        tokens7d / 7,
      ];
      const monthlyQuota = Math.max(50000, (t.license_seat_count || 1) * 10000);

      const proj = computeBurnProjection(monthlyQuota, consumedTokens, dailyUsage);
      return {
        tenantId: t.id,
        tenantName: t.name,
        monthlyQuota,
        consumedTokens,
        dailyVelocity7d: proj.dailyVelocity7d,
        daysRemaining: proj.daysRemaining,
        projectedExhaustionDate: proj.projectedExhaustionDate,
        status: proj.status,
      };
    });
  } finally {
    client.release();
  }
}
