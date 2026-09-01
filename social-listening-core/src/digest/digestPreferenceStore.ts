import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { getPlatformAdminPool } from '../db/platformAdminPool';

export interface UserDigestPreferences {
  id: string;
  tenantId: string;
  userId: string;
  isEnabled: boolean;
  sendAtLocal: string; // '08:00:00'
  timezone: string; // 'Europe/Amsterdam'
  watchlistIds: string[];
  includeAiSummary: boolean;
  includeTopPosts: boolean;
  includeTopicBreakdown: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawUserDigestPreferencesRow {
  id: string;
  tenant_id: string;
  user_id: string;
  is_enabled: boolean;
  send_at_local: string;
  timezone: string;
  watchlist_ids: string[];
  include_ai_summary: boolean;
  include_top_posts: boolean;
  include_topic_breakdown: boolean;
  last_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toCamel(row: RawUserDigestPreferencesRow): UserDigestPreferences {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    isEnabled: row.is_enabled,
    sendAtLocal: row.send_at_local,
    timezone: row.timezone,
    watchlistIds: row.watchlist_ids || [],
    includeAiSummary: row.include_ai_summary,
    includeTopPosts: row.include_top_posts,
    includeTopicBreakdown: row.include_topic_breakdown,
    lastSentAt: row.last_sent_at ? row.last_sent_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface UpsertUserDigestPreferencesInput {
  isEnabled?: boolean;
  sendAtLocal?: string;
  timezone?: string;
  watchlistIds?: string[];
  includeAiSummary?: boolean;
  includeTopPosts?: boolean;
  includeTopicBreakdown?: boolean;
}

export async function getUserDigestPreferences(
  tenantId: string,
  userId: string
): Promise<UserDigestPreferences> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<RawUserDigestPreferencesRow>(
      `SELECT * FROM user_digest_preferences WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      // Default preferences if not yet configured
      return {
        id: '',
        tenantId,
        userId,
        isEnabled: true,
        sendAtLocal: '08:00:00',
        timezone: 'Europe/Amsterdam',
        watchlistIds: [],
        includeAiSummary: true,
        includeTopPosts: true,
        includeTopicBreakdown: true,
        lastSentAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return toCamel(res.rows[0]);
  });
}

export async function upsertUserDigestPreferences(
  tenantId: string,
  userId: string,
  input: UpsertUserDigestPreferencesInput
): Promise<UserDigestPreferences> {
  return withTenant(tenantId, async (client) => {
    const existing = await client.query<RawUserDigestPreferencesRow>(
      `SELECT * FROM user_digest_preferences WHERE user_id = $1`,
      [userId]
    );

    const isEnabled = input.isEnabled ?? (existing.rows[0]?.is_enabled ?? true);
    const sendAtLocal = input.sendAtLocal ?? (existing.rows[0]?.send_at_local ?? '08:00:00');
    const timezone = input.timezone ?? (existing.rows[0]?.timezone ?? 'Europe/Amsterdam');
    const watchlistIds = input.watchlistIds ?? (existing.rows[0]?.watchlist_ids ?? []);
    const includeAiSummary = input.includeAiSummary ?? (existing.rows[0]?.include_ai_summary ?? true);
    const includeTopPosts = input.includeTopPosts ?? (existing.rows[0]?.include_top_posts ?? true);
    const includeTopicBreakdown = input.includeTopicBreakdown ?? (existing.rows[0]?.include_topic_breakdown ?? true);

    const res = await client.query<RawUserDigestPreferencesRow>(
      `INSERT INTO user_digest_preferences (
        tenant_id, user_id, is_enabled, send_at_local, timezone, watchlist_ids,
        include_ai_summary, include_top_posts, include_topic_breakdown, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        send_at_local = EXCLUDED.send_at_local,
        timezone = EXCLUDED.timezone,
        watchlist_ids = EXCLUDED.watchlist_ids,
        include_ai_summary = EXCLUDED.include_ai_summary,
        include_top_posts = EXCLUDED.include_top_posts,
        include_topic_breakdown = EXCLUDED.include_topic_breakdown,
        updated_at = now()
      RETURNING *`,
      [
        tenantId,
        userId,
        isEnabled,
        sendAtLocal,
        timezone,
        watchlistIds,
        includeAiSummary,
        includeTopPosts,
        includeTopicBreakdown,
      ]
    );

    return toCamel(res.rows[0]);
  });
}

/**
 * Scheduler query: checks for due subscriptions matching the current hour in their local timezone.
 * Uses a 20-hour cooldown to guard against repeated sends on the same calendar day.
 */
export async function findDueDigestSubscriptions(
  cooldownHours = 20
): Promise<UserDigestPreferences[]> {
  const res = await getPlatformAdminPool().query<RawUserDigestPreferencesRow>(
    `SELECT * FROM user_digest_preferences
     WHERE is_enabled = true
       AND EXTRACT(HOUR FROM (now() AT TIME ZONE timezone)) = EXTRACT(HOUR FROM send_at_local)
       AND (last_sent_at IS NULL OR last_sent_at < now() - ($1 || ' hours')::interval)`,
    [cooldownHours]
  );

  return res.rows.map(toCamel);
}

export async function updateLastSentAt(
  id: string,
  sentAt: Date = new Date()
): Promise<void> {
  await getPlatformAdminPool().query(
    `UPDATE user_digest_preferences
     SET last_sent_at = $1, updated_at = now()
     WHERE id = $2`,
    [sentAt, id]
  );
}
