/**
 * Influencer Scoring & Discovery Service — Story 12.15 (ADR-0108).
 * Manages Author multi-factor scoring (reach, engagement, authenticity, influence) and discovery queries.
 */

import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { getAdminPool } from '../db/adminPool';
import { PoolClient } from 'pg';

export interface ScoreInput {
  followerCount?: number;
  avgEngagement?: number;
  authenticity?: number;
  topicRelevance?: number;
  postCount?: number;
}

export interface ComputedScores {
  reachScore: number;
  engagementScore: number;
  authenticityScore: number;
  topicRelevance: number;
  influenceScore: number;
}

export interface InfluencerItem {
  authorId: string;
  authorName: string;
  platformId: string;
  publicUrl?: string;
  reachScore: number;
  engagementScore: number;
  authenticityScore: number;
  influenceScore: number;
  topTopics: Array<{ topicId: string; topicName: string; relevance: number }>;
  recentPosts: number;
}

export interface InfluencerQueryParams {
  topicId?: string;
  platformId?: string;
  watchlistId?: string;
  minScore?: number;
  sort?: 'influence' | 'reach' | 'engagement' | 'authenticity' | 'recentPosts';
  limit?: number;
}

export interface ScoreExplanation {
  authorId: string;
  influenceScore: number;
  breakdown: {
    reach: { score: number; weight: number; weighted: number };
    engagement: { score: number; weight: number; weighted: number };
    authenticity: { score: number; weight: number; weighted: number };
    topicRelevance: { score: number; weight: number; weighted: number };
  };
}

/**
 * Story 12.15: Computes bounded 0-100 component scores and weighted composite influence score.
 * Formula: 0.25*reach + 0.35*engagement + 0.20*authenticity + 0.20*topic_relevance
 */
export function computeAuthorScores(input: ScoreInput): ComputedScores {
  const followerCount = input.followerCount ?? 0;
  // Logarithmic reach scaling: 100 followers -> ~40, 10k -> 80, 100k+ -> ~100
  const reachScore = Math.min(100, Math.max(10, Math.round(Math.log10(Math.max(10, followerCount)) * 20 * 100) / 100));

  const avgEngagement = input.avgEngagement ?? 25.0;
  const engagementScore = Math.min(100, Math.max(0, Math.round(avgEngagement * 100) / 100));

  const authenticityScore = Math.min(100, Math.max(0, Math.round((input.authenticity ?? 90.0) * 100) / 100));
  const topicRelevance = Math.min(100, Math.max(0, Math.round((input.topicRelevance ?? 75.0) * 100) / 100));

  const rawComposite =
    0.25 * reachScore +
    0.35 * engagementScore +
    0.20 * authenticityScore +
    0.20 * topicRelevance;

  const influenceScore = Math.min(100, Math.round(rawComposite * 100) / 100);

  return {
    reachScore,
    engagementScore,
    authenticityScore,
    topicRelevance,
    influenceScore,
  };
}

/**
 * Daily worker refresh: computes scores for all authors within a tenant.
 */
export async function refreshAuthorScores(tenantId: string): Promise<number> {
  const pool = getAdminPool();
  const client = await pool.connect();

  try {
    const { rows: authors } = await client.query<{
      id: string;
      follower_count: number | null;
      avg_eng: number | null;
    }>(
      `SELECT a.id, a.follower_count,
              COALESCE(AVG((p.raw_payload->'engagementMetrics'->>'likes')::numeric), 50.0) as avg_eng
       FROM authors a
       LEFT JOIN social_posts p ON p.author_id = a.id
       WHERE a.tenant_id = $1
       GROUP BY a.id, a.follower_count`,
      [tenantId]
    );

    for (const a of authors) {
      const scores = computeAuthorScores({
        followerCount: a.follower_count || 1000,
        avgEngagement: Number(a.avg_eng) || 50.0,
      });

      await client.query(
        `UPDATE authors
         SET reach_score = $1,
             engagement_score = $2,
             authenticity_score = $3,
             influence_score = $4,
             last_seen_at = now()
         WHERE id = $5 AND tenant_id = $6`,
        [scores.reachScore, scores.engagementScore, scores.authenticityScore, scores.influenceScore, a.id, tenantId]
      );
    }

    return authors.length;
  } finally {
    client.release();
  }
}

/**
 * Queries and ranks influencers with topic/platform filters.
 */
export async function queryInfluencers(
  tenantId: string,
  params: InfluencerQueryParams,
  userId?: string
): Promise<InfluencerItem[]> {
  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      const conditions: string[] = ['a.tenant_id = $1'];
      const queryParams: any[] = [tenantId];
      let paramIdx = 2;

      if (params.platformId) {
        conditions.push(`a.platform_id = $${paramIdx++}`);
        queryParams.push(params.platformId);
      }

      if (params.minScore !== undefined && params.minScore !== null) {
        conditions.push(`a.influence_score >= $${paramIdx++}`);
        queryParams.push(params.minScore);
      }

      let orderColumn = 'a.influence_score';
      if (params.sort === 'reach') orderColumn = 'a.reach_score';
      if (params.sort === 'engagement') orderColumn = 'a.engagement_score';
      if (params.sort === 'authenticity') orderColumn = 'a.authenticity_score';
      if (params.sort === 'recentPosts') orderColumn = 'recent_posts';

      const limit = Math.min(200, Math.max(1, params.limit || 50));
      queryParams.push(limit);

      const sql = `
        SELECT a.id as author_id,
               COALESCE(a.display_name, a.handle, a.external_author_id) as author_name,
               a.platform_id,
               a.reach_score,
               a.engagement_score,
               a.authenticity_score,
               a.influence_score,
               COUNT(p.id)::int as recent_posts
        FROM authors a
        LEFT JOIN social_posts p ON p.author_id = a.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY a.id, a.display_name, a.handle, a.external_author_id, a.platform_id, a.reach_score, a.engagement_score, a.authenticity_score, a.influence_score
        ORDER BY ${orderColumn} DESC
        LIMIT $${paramIdx}
      `;

      const { rows } = await client.query(sql, queryParams);

      // Fetch top topics for these authors
      const authorIds = rows.map((r: any) => r.author_id);
      let topicsMap: Record<string, Array<{ topicId: string; topicName: string; relevance: number }>> = {};

      if (authorIds.length > 0) {
        const { rows: topicRows } = await client.query(
          `SELECT author_id, topic, mention_count
           FROM author_topic_signals
           WHERE tenant_id = $1 AND author_id = ANY($2::uuid[])
           ORDER BY mention_count DESC`,
          [tenantId, authorIds]
        );

        for (const tr of topicRows) {
          if (!topicsMap[tr.author_id]) topicsMap[tr.author_id] = [];
          topicsMap[tr.author_id].push({
            topicId: tr.topic,
            topicName: tr.topic.replace(/-/g, ' '),
            relevance: Math.min(1.0, tr.mention_count / 20),
          });
        }
      }

      return rows.map((r: any) => ({
        authorId: r.author_id,
        authorName: r.author_name,
        platformId: r.platform_id,
        reachScore: Number(r.reach_score) || 0,
        engagementScore: Number(r.engagement_score) || 0,
        authenticityScore: Number(r.authenticity_score) || 0,
        influenceScore: Number(r.influence_score) || 0,
        topTopics: topicsMap[r.author_id] || [],
        recentPosts: r.recent_posts || 0,
      }));
    },
    getPool(),
    userId
  );
}

/**
 * Story 12.15: Explainability endpoint for author influence score breakdown.
 */
export async function explainInfluencerScore(
  tenantId: string,
  authorId: string,
  userId?: string
): Promise<ScoreExplanation | null> {
  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT a.*, COALESCE(AVG(ats.mention_count), 15.0) as topic_mentions
         FROM authors a
         LEFT JOIN author_topic_signals ats ON ats.author_id = a.id
         WHERE a.id = $1 AND a.tenant_id = $2
         GROUP BY a.id`,
        [authorId, tenantId]
      );

      if (rows.length === 0) return null;
      const author = rows[0];

      const reach = Number(author.reach_score) || 70.0;
      const engagement = Number(author.engagement_score) || 65.0;
      const authenticity = Number(author.authenticity_score) || 85.0;
      const topicRelevance = Math.min(100, Math.round(Number(author.topic_mentions) * 5 * 100) / 100);

      const reachWeight = 0.25;
      const engagementWeight = 0.35;
      const authenticityWeight = 0.20;
      const topicWeight = 0.20;

      const weightedReach = Math.round(reach * reachWeight * 1000) / 1000;
      const weightedEngagement = Math.round(engagement * engagementWeight * 1000) / 1000;
      const weightedAuthenticity = Math.round(authenticity * authenticityWeight * 1000) / 1000;
      const weightedTopic = Math.round(topicRelevance * topicWeight * 1000) / 1000;

      const influenceScore = Number(author.influence_score) || Math.round((weightedReach + weightedEngagement + weightedAuthenticity + weightedTopic) * 100) / 100;

      return {
        authorId,
        influenceScore,
        breakdown: {
          reach: { score: reach, weight: reachWeight, weighted: weightedReach },
          engagement: { score: engagement, weight: engagementWeight, weighted: weightedEngagement },
          authenticity: { score: authenticity, weight: authenticityWeight, weighted: weightedAuthenticity },
          topicRelevance: { score: topicRelevance, weight: topicWeight, weighted: weightedTopic },
        },
      };
    },
    getPool(),
    userId
  );
}
