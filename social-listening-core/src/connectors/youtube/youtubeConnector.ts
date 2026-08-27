import { withTenant } from '../../db/withTenant';
import { getPool } from '../../db/pool';
import { PoolClient } from 'pg';

export interface YouTubeConnectorStatus {
  isActive: boolean;
  channelCount: number;
  quotaUsedToday: number;
  maxDailyQuota: number;
  lastSyncedAt: string | null;
}

export async function getYouTubeConnectorStatus(
  tenantId: string,
  userId: string
): Promise<YouTubeConnectorStatus> {
  return withTenant<YouTubeConnectorStatus>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT
           COUNT(*) AS channel_count,
           COALESCE(SUM(quota_used_today), 0) AS total_quota_used,
           MAX(last_synced_at) AS last_synced_at
         FROM youtube_channel_subscriptions
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      );

      const channelCount = parseInt(rows[0]?.channel_count || '0', 10);
      const quotaUsedToday = parseInt(rows[0]?.total_quota_used || '0', 10);
      const lastSyncedAt = rows[0]?.last_synced_at ? new Date(rows[0].last_synced_at).toISOString() : null;

      return {
        isActive: channelCount > 0,
        channelCount,
        quotaUsedToday,
        maxDailyQuota: 10000,
        lastSyncedAt,
      };
    },
    getPool(),
    userId
  );
}

export async function connectYouTubeChannel(
  tenantId: string,
  userId: string,
  input: { channelId: string; channelTitle?: string }
): Promise<{ channelId: string; channelTitle: string; status: 'connected' }> {
  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `INSERT INTO youtube_channel_subscriptions (
           tenant_id, channel_id, channel_title, quota_used_today, last_synced_at, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, 100, now(), true, now(), now())
         RETURNING *`,
        [tenantId, input.channelId.trim(), input.channelTitle || input.channelId]
      );

      return {
        channelId: rows[0].channel_id,
        channelTitle: rows[0].channel_title,
        status: 'connected',
      };
    },
    getPool(),
    userId
  );
}
