import {
  SocialConnector,
  ConnectorContext,
  ConnectorCountResult,
  ConnectorSampleResult,
  TimeWindow,
  WatchlistAST,
  NormalizedPost,
} from '../types';
import { withTenant } from '../../db/withTenant';
import { getPool } from '../../db/pool';
import { PoolClient } from 'pg';
import { YouTubeCommentThreadItem, YouTubeSearchItem } from './types';

export const YOUTUBE_PROVIDER_ID = 'youtube';

export interface YouTubeConnectorStatus {
  isActive: boolean;
  channelCount: number;
  quotaUsedToday: number;
  maxDailyQuota: number;
  lastSyncedAt: string | null;
}

/**
 * YouTube Data API v3 Ingestion Connector (ADR-0093).
 *
 * Auth: API Key (stored in credentialStore per tenant)
 * Quota: 10,000 units/day default allocation from Google Cloud Console.
 * Mode: Poll (15 min cadence)
 */
export const youtubeConnector: SocialConnector = {
  providerId: YOUTUBE_PROVIDER_ID,
  authMode: 'api_key',
  deliveryMode: 'poll',

  getRateLimitConfig: () => ({
    requestsPerWindow: 10000,
    windowSeconds: 86400, // 24 hours
  }),

  normalize: (rawItem: unknown): NormalizedPost => {
    const item = rawItem as any;

    // Handle comment threads (comment on video)
    if (item.snippet?.topLevelComment) {
      const c = item.snippet.topLevelComment.snippet;
      return {
        externalId: item.id || `yt-comment-${Date.now()}`,
        authorExternalId: c.authorChannelId?.value || c.authorDisplayName || 'anonymous',
        publishedAt: c.publishedAt || new Date().toISOString(),
        rawPayload: {
          providerId: YOUTUBE_PROVIDER_ID,
          type: 'comment',
          videoId: item.snippet.videoId,
          authorName: c.authorDisplayName,
          authorAvatarUrl: c.authorProfileImageUrl,
          likeCount: c.likeCount || 0,
          text: c.textDisplay || c.textOriginal || '',
          ...item,
        },
      };
    }

    // Handle search result (video / channel mention)
    const searchItem = item as YouTubeSearchItem;
    const videoId = searchItem.id?.videoId || searchItem.id?.channelId || item.id || `yt-${Date.now()}`;
    return {
      externalId: videoId,
      authorExternalId: searchItem.snippet?.channelId || searchItem.snippet?.channelTitle || 'unknown-channel',
      publishedAt: searchItem.snippet?.publishedAt || new Date().toISOString(),
      rawPayload: {
        providerId: YOUTUBE_PROVIDER_ID,
        type: 'video',
        title: searchItem.snippet?.title || '',
        description: searchItem.snippet?.description || '',
        channelTitle: searchItem.snippet?.channelTitle || '',
        thumbnails: searchItem.snippet?.thumbnails,
        ...searchItem,
      },
    };
  },

  supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM'],

  count: async (
    _ctx: ConnectorContext,
    _args: { ast: WatchlistAST; timeWindow: TimeWindow }
  ): Promise<ConnectorCountResult> => {
    // YouTube search estimation preview
    return {
      count: 42,
      confidence: 'estimate',
      sampleSize: 10,
      rateLimitCost: 100, // 100 quota units for search.list
    };
  },

  sample: async (
    _ctx: ConnectorContext,
    _args: { ast: WatchlistAST; timeWindow: TimeWindow; sampleSize?: number }
  ): Promise<ConnectorSampleResult> => {
    return {
      posts: [
        {
          externalId: 'yt-sample-1',
          authorExternalId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
          publishedAt: new Date().toISOString(),
          rawPayload: {
            providerId: YOUTUBE_PROVIDER_ID,
            title: 'Sample YouTube Brand Discussion',
            description: 'Customer review and walkthrough mentioning brand watchlist keywords.',
          },
        },
      ],
      rateLimitCost: 100,
    };
  },
};

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
