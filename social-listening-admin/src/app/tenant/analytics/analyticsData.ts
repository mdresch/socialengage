/**
 * Story 8.1 (ADR-0054) — pure aggregation/date-filter helpers for the
 * Analytics Dashboard. No JSX, no next/* imports (mirrors
 * ../posts/postDisplay.ts's own "Load-bearing constraints" pattern) so this
 * stays directly unit-testable and reusable by Story 8.2/8.3's own widgets
 * without any React or Next.js machinery involved.
 */

import { extractProviderBadge, extractEnrichmentSummary } from '../posts/postDisplay';
import type { SocialPostSummary } from '@/lib/core-client';

export interface DateRangeFilter {
  /** Inclusive, 'YYYY-MM-DD'. */
  startDate: string;
  /** Inclusive, 'YYYY-MM-DD'. */
  endDate: string;
}

/**
 * A post with no publishedAt cannot honestly be placed inside a date range —
 * excluded, never defaulted into the range (ADR-0054's "no fabricated
 * fallback of any kind" boundary applies to exclusion decisions too, not
 * just displayed numbers).
 */
export function isPublishedWithinRange(publishedAt: string | null, range: DateRangeFilter): boolean {
  if (!publishedAt) return false;
  const day = publishedAt.slice(0, 10);
  return day >= range.startDate && day <= range.endDate;
}

export function filterPostsByDateRange(posts: SocialPostSummary[], range: DateRangeFilter): SocialPostSummary[] {
  return posts.filter((post) => isPublishedWithinRange(post.publishedAt, range));
}

export interface SentimentSplit {
  positive: number;
  neutral: number;
  negative: number;
}

const RECOGNIZED_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

/**
 * Only real, recognized `enrichment.sentiment` values are counted — a post
 * with no enrichment yet is excluded entirely, never counted as "neutral"
 * (that would misrepresent "not yet enriched" as a real sentiment reading).
 */
export function computeSentimentSplit(posts: SocialPostSummary[]): SentimentSplit {
  const split: SentimentSplit = { positive: 0, neutral: 0, negative: 0 };
  for (const post of posts) {
    const summary = extractEnrichmentSummary(post.enrichment);
    const sentiment = summary?.sentiment?.toLowerCase();
    if (sentiment && RECOGNIZED_SENTIMENTS.has(sentiment)) {
      split[sentiment as keyof SentimentSplit] += 1;
    }
  }
  return split;
}

/** Known content-connector labels — falls back to the raw providerId for anything not yet named here. */
const PROVIDER_LABELS: Record<string, string> = {
  gnews: 'GNews',
  newswire: 'Newswire',
  'tenant-owned-feed': 'Tenant-Owned Feed',
};

export interface SourceBreakdownEntry {
  providerId: string;
  label: string;
  count: number;
  sentiment: SentimentSplit;
}

/**
 * Grouped by whichever real `providerId` values are actually present in
 * `posts` — never a fixed list padded with zero-count placeholder rows for a
 * connector this tenant has no posts from (AC8).
 */
export function computeSourceBreakdown(posts: SocialPostSummary[]): SourceBreakdownEntry[] {
  const byProvider = new Map<string, SocialPostSummary[]>();
  for (const post of posts) {
    const providerId = extractProviderBadge(post.rawPayload);
    const bucket = byProvider.get(providerId);
    if (bucket) bucket.push(post);
    else byProvider.set(providerId, [post]);
  }

  return Array.from(byProvider.entries())
    .map(([providerId, providerPosts]) => ({
      providerId,
      label: PROVIDER_LABELS[providerId] ?? providerId,
      count: providerPosts.length,
      sentiment: computeSentimentSplit(providerPosts),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface AnalyticsSummary {
  totalPosts: number;
  sentimentSplit: SentimentSplit;
  sources: SourceBreakdownEntry[];
}

/**
 * The one aggregation Story 8.1's Overview and Sources tabs both read from —
 * Overview never computes anything of its own beyond this (AC7).
 */
export function computeAnalyticsSummary(posts: SocialPostSummary[], range: DateRangeFilter): AnalyticsSummary {
  const filtered = filterPostsByDateRange(posts, range);
  return {
    totalPosts: filtered.length,
    sentimentSplit: computeSentimentSplit(filtered),
    sources: computeSourceBreakdown(filtered),
  };
}
