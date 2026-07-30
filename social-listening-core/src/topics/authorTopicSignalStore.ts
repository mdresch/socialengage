import { withTenant } from '../db/withTenant';

export type AuthorTopicSortBy = 'activeMonths' | 'mentionCount';

export interface AuthorTopicSignal {
  authorId: string;
  mentionCount: number;
  firstMentionAt: string | null;
  lastMentionAt: string | null;
  activeMonthsCount: number;
  avgEngagement: number | null;
  sentimentBreakdown: unknown;
}

interface AuthorTopicSignalRow {
  author_id: string;
  mention_count: number;
  first_mention_at: Date | null;
  last_mention_at: Date | null;
  active_months_count: number;
  avg_engagement: number | null;
  sentiment_breakdown: unknown;
}

/**
 * Reads AuthorTopicSignal rows for a topic, sorted by the requested raw
 * signal, high to low (ADR-0007 — no computed expertise score exists to sort
 * by instead). Reads only from author_topic_signals, never social_posts — this
 * is a read of an already-refreshed signal, not a live per-request
 * aggregation (Story 4.4/ADR-0022 owns how the table actually gets
 * refreshed). See .claude/skills/author-topic-signals/SKILL.md.
 */
export async function getAuthorTopicSignals(
  tenantId: string,
  topic: string,
  sortBy: AuthorTopicSortBy
): Promise<AuthorTopicSignal[]> {
  const orderColumn = sortBy === 'activeMonths' ? 'active_months_count' : 'mention_count';

  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<AuthorTopicSignalRow>(
      `SELECT author_id, mention_count, first_mention_at, last_mention_at,
              active_months_count, avg_engagement, sentiment_breakdown
       FROM author_topic_signals
       WHERE topic = $1
       ORDER BY ${orderColumn} DESC`,
      [topic]
    );
    return rows.map((row) => ({
      authorId: row.author_id,
      mentionCount: row.mention_count,
      firstMentionAt: row.first_mention_at ? row.first_mention_at.toISOString() : null,
      lastMentionAt: row.last_mention_at ? row.last_mention_at.toISOString() : null,
      activeMonthsCount: row.active_months_count,
      avgEngagement: row.avg_engagement,
      sentimentBreakdown: row.sentiment_breakdown,
    }));
  });
}
