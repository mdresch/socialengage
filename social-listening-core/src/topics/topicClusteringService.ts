import { withTenant } from '../db/withTenant';
import { attachPostTopics } from './topicStore';
import type { ExtractedTopic } from '../connectors/types';

export interface TopicClusteringRefreshOptions {
  tenantId: string;
  windowDays?: number;
}

export interface TopicClusteringRefreshResult {
  processedPosts: number;
  topicsAttached: number;
}

/**
 * Story 12.7 (ADR-0104 §3) — Scheduled TopicClusteringRefresh service.
 * Re-runs or populates topic clustering for posts in the last 7 days.
 */
export class TopicClusteringRefresh {
  public static async run(options: TopicClusteringRefreshOptions): Promise<TopicClusteringRefreshResult> {
    const { tenantId, windowDays = 7 } = options;

    return withTenant(tenantId, async (client) => {
      const postsRes = await client.query(
        `SELECT id, enrichment
         FROM social_posts
         WHERE published_at >= now() - ($1 || ' days')::interval
           AND enrichment IS NOT NULL`,
        [windowDays.toString()]
      );

      let processedPosts = 0;
      let topicsAttached = 0;

      for (const row of postsRes.rows) {
        processedPosts++;
        const enrichment = row.enrichment as Record<string, any>;
        const extractedTopics: ExtractedTopic[] = [];

        if (Array.isArray(enrichment?.topics)) {
          for (const t of enrichment.topics) {
            if (t && typeof t === 'object' && typeof t.name === 'string') {
              extractedTopics.push({
                name: t.name,
                confidence: typeof t.confidence === 'number' ? t.confidence : 1.0,
              });
            }
          }
        } else if (Array.isArray(enrichment?.keyPhrases)) {
          // Derive topics from top key phrases if explicit topics are absent
          for (const phrase of enrichment.keyPhrases.slice(0, 5)) {
            if (typeof phrase === 'string' && phrase.trim().length > 2) {
              extractedTopics.push({
                name: phrase.trim(),
                confidence: 0.85,
              });
            }
          }
        }

        if (extractedTopics.length > 0) {
          const attached = await attachPostTopics(tenantId, row.id, extractedTopics);
          topicsAttached += attached.length;
        }
      }

      return { processedPosts, topicsAttached };
    });
  }
}
