/**
 * Story 8.1 (ADR-0054) — pure aggregation/date-filter helpers for the
 * Analytics Dashboard. No JSX, no next/* imports (mirrors
 * ../posts/postDisplay.ts's own "Load-bearing constraints" pattern) so this
 * stays directly unit-testable and reusable by Story 8.2/8.3's own widgets
 * without any React or Next.js machinery involved.
 */

import { extractProviderBadge, extractEnrichmentSummary, extractAuthor, extractDisplayText } from '../posts/postDisplay';
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

/**
 * Story 8.2 — a lightweight, already-extracted post shape for the Sentiment
 * tab: enough to compute the history chart, top fans/critics, phrase
 * clouds, and the posts-drawer list, without shipping every post's full
 * rawPayload/enrichment blob to the browser a second time (the aggregates
 * above already summarize that). Derived once via `flattenForSentiment()`
 * (`postDisplay.ts`'s same extraction functions Story 6.11 already
 * established — not reimplemented here).
 */
export interface SentimentPost {
  id: string;
  publishedAt: string | null;
  author: string | null;
  sentiment: string | null;
  keyPhrases: string[];
  title: string;
}

export function flattenForSentiment(posts: SocialPostSummary[]): SentimentPost[] {
  return posts.map((post) => {
    const enrichment = extractEnrichmentSummary(post.enrichment);
    const { title } = extractDisplayText(post.rawPayload);
    return {
      id: post.id,
      publishedAt: post.publishedAt,
      author: extractAuthor(post.rawPayload),
      sentiment: enrichment?.sentiment?.toLowerCase() ?? null,
      keyPhrases: enrichment?.keyPhrases ?? [],
      title,
    };
  });
}

/** Same counting rule as `computeSentimentSplit()`, over the already-flattened shape (used when a client-side author/phrase filter is applied). */
export function computeSentimentSplitFromFlat(posts: SentimentPost[]): SentimentSplit {
  const split: SentimentSplit = { positive: 0, neutral: 0, negative: 0 };
  for (const post of posts) {
    if (post.sentiment && RECOGNIZED_SENTIMENTS.has(post.sentiment)) {
      split[post.sentiment as keyof SentimentSplit] += 1;
    }
  }
  return split;
}

export interface SentimentHistoryPoint {
  /** 'YYYY-MM-DD' */
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

/** Every day in the range, inclusive, 'YYYY-MM-DD' — shared by the sentiment-history and phrase-history bucketing (Stories 8.2/8.3 both need the identical day-enumeration rule). */
export function enumerateDays(range: DateRangeFilter): string[] {
  const days: string[] = [];
  let cursor = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return days;
}

/**
 * Bucketed by day (ADR-0054 Open Question 7) across every day in the
 * range, inclusive — a day with zero matching posts renders as a real
 * zero, never omitted or interpolated (AC2).
 */
export function computeSentimentHistory(posts: SentimentPost[], range: DateRangeFilter): SentimentHistoryPoint[] {
  const byDay = new Map<string, SentimentSplit>();
  for (const day of enumerateDays(range)) {
    byDay.set(day, { positive: 0, neutral: 0, negative: 0 });
  }
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket) continue;
    if (post.sentiment && RECOGNIZED_SENTIMENTS.has(post.sentiment)) {
      bucket[post.sentiment as keyof SentimentSplit] += 1;
    }
  }
  return Array.from(byDay.entries()).map(([date, split]) => ({ date, ...split }));
}

export interface AuthorRanking {
  author: string;
  count: number;
}

/**
 * Real author + sentiment count, ranked descending — no fallback to a
 * hardcoded name list when the real result is small or empty (AC3, closing
 * the exact defect ADR-0054 found in the uncommitted prototype). A caller
 * with fewer than `limit` real entries gets fewer than `limit` rows back,
 * never padded.
 */
export function computeTopAuthorsBySentiment(
  posts: SentimentPost[],
  sentiment: 'positive' | 'negative',
  limit = 5
): AuthorRanking[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.sentiment !== sentiment || !post.author) continue;
    counts.set(post.author, (counts.get(post.author) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface PhraseFrequency {
  phrase: string;
  count: number;
}

/** Real `enrichment.keyPhrases`, bucketed by the sentiment of the post(s) each phrase appears on (AC4). */
export function computePhrasesBySentiment(
  posts: SentimentPost[],
  sentiment: 'positive' | 'negative',
  limit = 15
): PhraseFrequency[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.sentiment !== sentiment) continue;
    for (const phrase of post.keyPhrases) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Story 8.3 — real `enrichment.keyPhrases` frequency across *every* post
 * (not bucketed by sentiment, unlike Story 8.2's phrase clouds) — the
 * Conversations tab's own word cloud. Ranked descending; an empty real
 * result returns an empty array, never a fallback (AC1, closing the
 * uncommitted prototype's `MAIN_PHRASES` fabricated fallback).
 */
export function computePhraseFrequency(posts: SentimentPost[], limit = 20): PhraseFrequency[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const phrase of post.keyPhrases) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** One point per day in range; one numeric key per phrase in `topPhrases`, real per-day count, zero when that phrase didn't appear that day. */
export interface PhraseHistoryPoint {
  date: string;
  [phrase: string]: number | string;
}

/**
 * Bucketed by day (ADR-0054 Open Question 7), tracking only `topPhrases`
 * (the word cloud's own top entries) so the chart stays a real, readable
 * trend line per phrase rather than one line per every phrase ever seen
 * (AC2, replacing the prototype's fully-static, sine-wave `PHRASES_HISTORY`).
 */
export function computePhraseHistory(posts: SentimentPost[], range: DateRangeFilter, topPhrases: string[]): PhraseHistoryPoint[] {
  const byDay = new Map<string, Record<string, number>>();
  for (const day of enumerateDays(range)) {
    byDay.set(day, Object.fromEntries(topPhrases.map((phrase) => [phrase, 0])));
  }
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket) continue;
    for (const phrase of post.keyPhrases) {
      if (Object.prototype.hasOwnProperty.call(bucket, phrase)) {
        bucket[phrase] += 1;
      }
    }
  }
  return Array.from(byDay.entries()).map(([date, counts]) => ({ date, ...counts }));
}

export interface VolumeHistoryPoint {
  date: string;
  count: number;
}

/**
 * Story 8.4 — real day-bucketed post-volume series for Overview's chart,
 * reusing the exact enumerateDays() rule computeSentimentHistory()/
 * computePhraseHistory() already established. A post with no publishedAt
 * cannot be honestly placed in the series — excluded, the same rule
 * computeSentimentHistory() already applies.
 */
export function computeVolumeHistory(posts: SentimentPost[], range: DateRangeFilter): VolumeHistoryPoint[] {
  const byDay = new Map<string, number>();
  for (const day of enumerateDays(range)) {
    byDay.set(day, 0);
  }
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.slice(0, 10);
    if (byDay.has(day)) {
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }
  return Array.from(byDay.entries()).map(([date, count]) => ({ date, count }));
}

/**
 * Story 8.4 — the immediately preceding period of equal length (inclusive
 * day count), for the date picker's "Compare to previous period" toggle.
 * A 14-day range ending yesterday compares against the 14 days immediately
 * before that — never an arbitrary or estimated prior window.
 */
export function computePreviousRange(range: DateRangeFilter): DateRangeFilter {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { startDate: prevStart.toISOString().slice(0, 10), endDate: prevEnd.toISOString().slice(0, 10) };
}

export interface PercentDelta {
  /** null means "no prior data to compare" — a null or zero previous value, never a fabricated/estimated number. */
  pct: number | null;
  trend: 'up' | 'down' | 'flat' | 'none';
}

/**
 * Story 8.4 — a real percentage delta between a current and prior-period
 * count. Division by zero (or no prior period at all) is not fabricated
 * into a 0%/∞ figure — it reports pct: null, trend: 'none', an honest "no
 * comparison possible" signal (closing the exact defect the Google AI
 * Studio reference committed with its hardcoded '+18%'/'∞' strings, none
 * derived from a real prior-period fetch).
 */
export function computePercentDelta(current: number, previous: number | null): PercentDelta {
  if (previous === null || previous === 0) {
    return { pct: null, trend: 'none' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { pct, trend };
}

export interface AnalyticsSummary {
  totalPosts: number;
  sentimentSplit: SentimentSplit;
  sources: SourceBreakdownEntry[];
  sentimentHistory: SentimentHistoryPoint[];
  topFans: AuthorRanking[];
  topCritics: AuthorRanking[];
  positivePhrases: PhraseFrequency[];
  negativePhrases: PhraseFrequency[];
  phraseFrequency: PhraseFrequency[];
  phraseHistory: PhraseHistoryPoint[];
  volumeHistory: VolumeHistoryPoint[];
  /** The flattened, date-filtered post set — Story 8.2/8.3's own widgets recompute from this client-side when an author/phrase filter is toggled. */
  posts: SentimentPost[];
}

/**
 * The one aggregation Story 8.1's Overview and Sources tabs, Story 8.2's
 * Sentiment tab, and Story 8.3's Conversations tab all read from —
 * Overview never computes anything of its own beyond this (AC7).
 */
export function computeAnalyticsSummary(posts: SocialPostSummary[], range: DateRangeFilter): AnalyticsSummary {
  const filtered = filterPostsByDateRange(posts, range);
  const flat = flattenForSentiment(filtered);
  const phraseFrequency = computePhraseFrequency(flat);
  const topPhrases = phraseFrequency.slice(0, 5).map((p) => p.phrase);
  return {
    totalPosts: filtered.length,
    sentimentSplit: computeSentimentSplit(filtered),
    sources: computeSourceBreakdown(filtered),
    sentimentHistory: computeSentimentHistory(flat, range),
    topFans: computeTopAuthorsBySentiment(flat, 'positive'),
    topCritics: computeTopAuthorsBySentiment(flat, 'negative'),
    positivePhrases: computePhrasesBySentiment(flat, 'positive'),
    negativePhrases: computePhrasesBySentiment(flat, 'negative'),
    phraseFrequency,
    phraseHistory: computePhraseHistory(flat, range, topPhrases),
    volumeHistory: computeVolumeHistory(flat, range),
    posts: flat,
  };
}
