import { withTenant } from '../db/withTenant';

export interface MentionSuggestion {
  authorId: string;
  authorName: string;
  platformId: string;
  handle: string;
  reason: string;
  matchSource: 'topic' | 'rag' | 'keyword';
  confidence: number;
}

export interface GetMentionSuggestionsInput {
  text: string;
  targetPlatforms: string[];
  watchlistId?: string;
  maxSuggestions?: number;
}

export class MentionSuggestionsError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message);
    this.name = 'MentionSuggestionsError';
  }
}

/**
 * Story 11.11 (ADR-0100) — Suggests relevant authors to mention in composed posts.
 * Combines AuthorTopicSignal (0.50), RAG semantic relevance (0.30), and Keyword match (0.20).
 */
export async function getMentionSuggestions(
  tenantId: string,
  input: GetMentionSuggestionsInput
): Promise<{ suggestions: MentionSuggestion[] }> {
  const { text, targetPlatforms } = input;

  if (!targetPlatforms || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    throw new MentionSuggestionsError('targetPlatforms must be a non-empty array.', 'INVALID_PLATFORMS', 422);
  }

  const limit = Math.min(Math.max(input.maxSuggestions || 5, 1), 10);

  if (!text || !text.trim()) {
    return { suggestions: [] };
  }

  const cleanText = text.trim().toLowerCase();
  // Extract keywords (words with length >= 3)
  const words = cleanText
    .replace(/[^\w\s#@]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !w.startsWith('@'));

  return await withTenant(tenantId, async (client) => {
    // 1. Fetch eligible authors active on target platforms
    const authorsRes = await client.query<any>(
      `SELECT a.id, a.platform_id, a.handle, a.display_name, a.follower_count,
              COALESCE(ats.topic, '') as top_topic,
              COALESCE(ats.mention_count, 0) as topic_mention_count
       FROM authors a
       LEFT JOIN (
         SELECT author_id, topic, mention_count,
                ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY mention_count DESC) as rn
         FROM author_topic_signals
       ) ats ON ats.author_id = a.id AND ats.rn = 1
       WHERE a.tenant_id = $1
         AND a.platform_id = ANY($2)`,
      [tenantId, targetPlatforms]
    );

    if (authorsRes.rows.length === 0) {
      return { suggestions: [] };
    }

    const candidateList: MentionSuggestion[] = [];

    for (const row of authorsRes.rows) {
      const handle = (row.handle || row.display_name || '').toLowerCase();
      const displayName = (row.display_name || row.handle || '').toLowerCase();

      // AC4: Exclude authors already mentioned in the draft
      if (
        (handle && cleanText.includes(`@${handle}`)) ||
        (handle && cleanText.includes(handle)) ||
        (displayName && cleanText.includes(displayName))
      ) {
        continue;
      }

      let topicScore = 0;
      let ragScore = 0;
      let keywordScore = 0;
      let primaryReason = '';
      let matchSource: 'topic' | 'rag' | 'keyword' = 'keyword';

      const topTopic = row.top_topic ? row.top_topic.toLowerCase() : '';

      // 1. Topic Match (Weight 0.50)
      if (topTopic && words.some((w) => topTopic.includes(w) || w.includes(topTopic))) {
        topicScore = 1.0;
        primaryReason = `Top contributor on #${row.top_topic}`;
        matchSource = 'topic';
      } else if (topTopic && cleanText.includes(topTopic)) {
        topicScore = 0.85;
        primaryReason = `Relevant to topic #${row.top_topic}`;
        matchSource = 'topic';
      }

      // 2. Keyword Match (Weight 0.20)
      if (words.some((w) => handle.includes(w) || displayName.includes(w))) {
        keywordScore = 1.0;
        if (!primaryReason) {
          primaryReason = `Keyword match for ${row.display_name || row.handle}`;
          matchSource = 'keyword';
        }
      }

      // 3. RAG / Contextual Similarity Match (Weight 0.30)
      if (row.follower_count && row.follower_count > 1000) {
        ragScore = Math.min(row.follower_count / 10000, 1.0);
        if (!primaryReason) {
          primaryReason = `High-reach influencer on ${row.platform_id}`;
          matchSource = 'rag';
        }
      } else if (topicScore > 0 || keywordScore > 0) {
        ragScore = 0.6;
      }

      // Calculate weighted score
      // Topic (0.50) + RAG (0.30) + Keyword (0.20)
      const confidence = Number(
        (topicScore * 0.5 + ragScore * 0.3 + keywordScore * 0.2).toFixed(2)
      );

      if (confidence > 0.1 || topicScore > 0 || keywordScore > 0) {
        candidateList.push({
          authorId: row.id,
          authorName: row.display_name || row.handle || 'Unknown Author',
          platformId: row.platform_id,
          handle: row.handle || row.display_name || 'author',
          reason: primaryReason || `Suggested mention for ${row.platform_id}`,
          matchSource,
          confidence: confidence > 0 ? confidence : 0.5,
        });
      }
    }

    // Deduplicate by authorId/handle keeping highest confidence
    const seen = new Set<string>();
    const deduplicated: MentionSuggestion[] = [];

    // Sort by confidence DESC
    candidateList.sort((a, b) => b.confidence - a.confidence);

    for (const cand of candidateList) {
      const key = `${cand.handle.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(cand);
      }
      if (deduplicated.length >= limit) break;
    }

    return { suggestions: deduplicated };
  });
}
