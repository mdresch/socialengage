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
  /** Real 0-10 weighted score (computeSentimentIndex()) — null when this source has zero enriched posts (Story 8.6). */
  sentimentIndex: number | null;
}

/**
 * Story 8.6 — a real, transparent 0-10 weighted sentiment score:
 * positive=10, neutral=5, negative=0, averaged over the enriched total.
 * Honestly null (never a fabricated default) when there's nothing enriched
 * to score — the same anti-fabrication rule this epic applies everywhere
 * else, closing the exact defect the Google AI Studio reference committed
 * with its own hardcoded 7.6/68% sentiment-gauge fallback.
 */
export function computeSentimentIndex(split: SentimentSplit): number | null {
  const total = split.positive + split.neutral + split.negative;
  if (total === 0) return null;
  return (split.positive * 10 + split.neutral * 5) / total;
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
    .map(([providerId, providerPosts]) => {
      const sentiment = computeSentimentSplit(providerPosts);
      return {
        providerId,
        label: PROVIDER_LABELS[providerId] ?? providerId,
        count: providerPosts.length,
        sentiment,
        sentimentIndex: computeSentimentIndex(sentiment),
      };
    })
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
  /** ISO 639-1 code, e.g. "en" — Story 8.5 (ADR-0055). null when the post has no enrichment yet. */
  language: string | null;
  /** Real providerId (e.g. "gnews") — Story 8.6, needed to bucket by source and day simultaneously. */
  providerId: string;
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
      language: enrichment?.language ?? null,
      providerId: extractProviderBadge(post.rawPayload),
    };
  });
}

/**
 * Same grouping rule as computeSourceBreakdown(), over the already-flattened
 * SentimentPost shape — needed by OverviewTab.tsx (Story 8.7), whose
 * multi-dimension applyOverviewFilters() output is SentimentPost[], not raw
 * SocialPostSummary[]. Never a fixed list padded with zero-count rows for a
 * connector this tenant has no posts from, same as computeSourceBreakdown().
 */
export function computeSourceBreakdownFromFlat(posts: SentimentPost[]): SourceBreakdownEntry[] {
  const byProvider = new Map<string, SentimentPost[]>();
  for (const post of posts) {
    const bucket = byProvider.get(post.providerId);
    if (bucket) bucket.push(post);
    else byProvider.set(post.providerId, [post]);
  }
  return Array.from(byProvider.entries())
    .map(([providerId, providerPosts]) => {
      const sentiment = computeSentimentSplitFromFlat(providerPosts);
      return {
        providerId,
        label: PROVIDER_LABELS[providerId] ?? providerId,
        count: providerPosts.length,
        sentiment,
        sentimentIndex: computeSentimentIndex(sentiment),
      };
    })
    .sort((a, b) => b.count - a.count);
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

export interface LanguageBreakdownEntry {
  code: string;
  label: string;
  count: number;
}

/** Known ISO 639-1 codes this project's real AI providers can plausibly return — falls back to the raw code for anything unmapped, never dropped (Story 8.5, ADR-0055). */
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  pl: 'Polish',
  sv: 'Swedish',
};

/**
 * Story 8.5 (ADR-0055) — real per-language post counts, ranked descending.
 * A post with no real language reading is excluded entirely — never an
 * "unknown language" bucket, the same rule computeSentimentSplit() already
 * applies to un-enriched posts.
 */
export function computeLanguageBreakdown(posts: SentimentPost[]): LanguageBreakdownEntry[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.language) continue;
    counts.set(post.language, (counts.get(post.language) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, label: LANGUAGE_LABELS[code] ?? code, count }))
    .sort((a, b) => b.count - a.count);
}

export interface SourceVolumeHistoryPoint {
  date: string;
  [providerId: string]: number | string;
}

/**
 * Story 8.6 — real day-and-source-bucketed post counts, the same
 * multi-key-per-day shape computePhraseHistory() already established for
 * its own top-phrases. A source/day combination with zero posts is a real
 * zero, never omitted.
 */
export function computeSourceVolumeHistory(posts: SentimentPost[], range: DateRangeFilter, providerIds: string[]): SourceVolumeHistoryPoint[] {
  const byDay = new Map<string, Record<string, number>>();
  for (const day of enumerateDays(range)) {
    byDay.set(day, Object.fromEntries(providerIds.map((id) => [id, 0])));
  }
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket) continue;
    if (Object.prototype.hasOwnProperty.call(bucket, post.providerId)) {
      bucket[post.providerId] += 1;
    }
  }
  return Array.from(byDay.entries()).map(([date, counts]) => ({ date, ...counts }));
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
  languages: LanguageBreakdownEntry[];
  sourceVolumeHistory: SourceVolumeHistoryPoint[];
  /** The flattened, date-filtered post set — Story 8.2/8.3's own widgets recompute from this client-side when an author/phrase filter is toggled. */
  posts: SentimentPost[];
}

// ---------------------------------------------------------------------------
// Story 8.7 (ADR-0062) — Overview Tab Enhancement: the 7-dimension client-
// side filter model, deep-link parse/serialize, statistical volume
// forecast, Crisis Alert Radar, Sentiment Trajectory, Authors by Source,
// and Top Authors Feed. All pure — no next/* import, no fetch — reused by
// OverviewTab.tsx the same way every earlier tab's own aggregation is.
// ---------------------------------------------------------------------------

/**
 * Overview's own filter-state shape — six nullable dimensions, deliberately
 * a flat object rather than SentimentTab/ConversationsTab's own
 * `{ type, value }` union, because Overview needs several dimensions active
 * *simultaneously* (AND-composed), which a single-slot union can't express.
 * `selectedDateRange` is not a member here — it's the already-applied
 * GlobalDateRangePicker range every AnalyticsSummary is computed against
 * before OverviewTab ever sees it; `activeDateFilter` is the finer-grained,
 * single-day drill-down within that range.
 */
export interface OverviewFilters {
  activeDateFilter: string | null;
  activeSourceFilter: string | null;
  activeAuthorFilter: string | null;
  activeKeywordFilter: string | null;
  activeLanguageFilter: string | null;
  activeSentimentFilter: 'positive' | 'neutral' | 'negative' | null;
}

export const EMPTY_OVERVIEW_FILTERS: OverviewFilters = {
  activeDateFilter: null,
  activeSourceFilter: null,
  activeAuthorFilter: null,
  activeKeywordFilter: null,
  activeLanguageFilter: null,
  activeSentimentFilter: null,
};

/**
 * All six dimensions compose with AND semantics — every widget on the
 * Overview tab recomputes from this same single filtered set, including the
 * widget that is itself the click target for a given dimension (a
 * deliberate, simpler-than-standard-faceted-search choice — see this
 * component's own SKILL.md).
 */
export function applyOverviewFilters(posts: SentimentPost[], filters: OverviewFilters): SentimentPost[] {
  return posts.filter((post) => {
    if (filters.activeDateFilter && post.publishedAt?.slice(0, 10) !== filters.activeDateFilter) return false;
    if (filters.activeSourceFilter && post.providerId !== filters.activeSourceFilter) return false;
    if (filters.activeAuthorFilter && post.author !== filters.activeAuthorFilter) return false;
    if (filters.activeKeywordFilter && !post.keyPhrases.includes(filters.activeKeywordFilter)) return false;
    if (filters.activeLanguageFilter && post.language !== filters.activeLanguageFilter) return false;
    if (filters.activeSentimentFilter && post.sentiment !== filters.activeSentimentFilter) return false;
    return true;
  });
}

export interface OverviewFilterChip {
  type: keyof OverviewFilters;
  label: string;
  value: string;
}

/** One chip per currently-active dimension — never one for a dimension at its default (null) value. */
export function computeActiveChips(filters: OverviewFilters): OverviewFilterChip[] {
  const chips: OverviewFilterChip[] = [];
  if (filters.activeDateFilter) chips.push({ type: 'activeDateFilter', label: 'Date', value: filters.activeDateFilter });
  if (filters.activeSourceFilter) chips.push({ type: 'activeSourceFilter', label: 'Source', value: PROVIDER_LABELS[filters.activeSourceFilter] ?? filters.activeSourceFilter });
  if (filters.activeAuthorFilter) chips.push({ type: 'activeAuthorFilter', label: 'Author', value: filters.activeAuthorFilter });
  if (filters.activeKeywordFilter) chips.push({ type: 'activeKeywordFilter', label: 'Keyword', value: filters.activeKeywordFilter });
  if (filters.activeLanguageFilter) chips.push({ type: 'activeLanguageFilter', label: 'Language', value: LANGUAGE_LABELS[filters.activeLanguageFilter] ?? filters.activeLanguageFilter });
  if (filters.activeSentimentFilter) chips.push({ type: 'activeSentimentFilter', label: 'Sentiment', value: filters.activeSentimentFilter });
  return chips;
}

const RECOGNIZED_SENTIMENT_FILTER_VALUES = new Set(['positive', 'neutral', 'negative']);

/**
 * Deep-link share state (ADR-0062 Decision §4) — an invalid or unrecognised
 * param value silently falls back to the default (null), never an error.
 * `watchlist` is deliberately never read here — reserved for Story 8.9.
 */
export function parseOverviewFiltersFromSearchParams(params: URLSearchParams): OverviewFilters {
  const sentiment = params.get('sentiment');
  return {
    activeDateFilter: params.get('date') || null,
    activeSourceFilter: params.get('source') || null,
    activeAuthorFilter: params.get('author') || null,
    activeKeywordFilter: params.get('keyword') || null,
    activeLanguageFilter: params.get('language') || null,
    activeSentimentFilter: sentiment && RECOGNIZED_SENTIMENT_FILTER_VALUES.has(sentiment) ? (sentiment as OverviewFilters['activeSentimentFilter']) : null,
  };
}

/** The inverse of parseOverviewFiltersFromSearchParams() — round-trips exactly; never writes a `watchlist` param. */
export function serializeOverviewFiltersToSearchString(filters: OverviewFilters): string {
  const params = new URLSearchParams();
  if (filters.activeDateFilter) params.set('date', filters.activeDateFilter);
  if (filters.activeSourceFilter) params.set('source', filters.activeSourceFilter);
  if (filters.activeAuthorFilter) params.set('author', filters.activeAuthorFilter);
  if (filters.activeKeywordFilter) params.set('keyword', filters.activeKeywordFilter);
  if (filters.activeLanguageFilter) params.set('language', filters.activeLanguageFilter);
  if (filters.activeSentimentFilter) params.set('sentiment', filters.activeSentimentFilter);
  return params.toString();
}

/** Real post-count ranking (Top Authors Feed) — not bucketed by sentiment, unlike computeTopAuthorsBySentiment(). */
export function computeTopAuthorsByVolume(posts: SentimentPost[], limit = 5): AuthorRanking[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.author) continue;
    counts.set(post.author, (counts.get(post.author) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface AuthorsBySourceEntry {
  providerId: string;
  label: string;
  uniqueAuthorCount: number;
}

export interface AuthorsBySourceSummary {
  totalUniqueAuthors: number;
  bySource: AuthorsBySourceEntry[];
}

/** This project's three real connectors, always all three rows — the deliberate opposite of computeSourceBreakdown()'s own "never a padded fixed list" rule (see this component's own SKILL.md for why both are correct). */
const REAL_CONNECTOR_PROVIDER_IDS = ['gnews', 'newswire', 'tenant-owned-feed'];

/**
 * Authors by Source (ADR-0062 Decision §8) — real unique-author reach via
 * Set size, not raw post count; a source with zero matching posts renders a
 * real 0, never an omitted row.
 */
export function computeAuthorsBySource(posts: SentimentPost[]): AuthorsBySourceSummary {
  const totalUniqueAuthors = new Set(posts.filter((p) => p.author).map((p) => p.author)).size;
  const bySource = REAL_CONNECTOR_PROVIDER_IDS.map((providerId) => {
    const authors = new Set(posts.filter((p) => p.providerId === providerId && p.author).map((p) => p.author));
    return { providerId, label: PROVIDER_LABELS[providerId] ?? providerId, uniqueAuthorCount: authors.size };
  });
  return { totalUniqueAuthors, bySource };
}

export interface ForecastPoint {
  date: string;
  projectedVolume: number;
}

/**
 * Statistical volume forecast (ADR-0062 Decision §5) — client-side,
 * synchronous, no server round-trip: v(n) = lastVolume × 0.85ⁿ +
 * 850 × (1 − 0.85ⁿ), a simple exponential mean-reversion model. An empty
 * volume history produces an empty forecast, never a fabricated projection.
 */
export function computeVolumeForecast(volumeHistory: VolumeHistoryPoint[], days = 7): ForecastPoint[] {
  if (volumeHistory.length === 0) return [];
  const last = volumeHistory[volumeHistory.length - 1];
  const lastVolume = last.count;
  const lastDate = new Date(`${last.date}T00:00:00.000Z`);
  const points: ForecastPoint[] = [];
  for (let n = 1; n <= days; n++) {
    const decay = Math.pow(0.85, n);
    const projectedVolume = Math.round(lastVolume * decay + 850 * (1 - decay));
    const date = new Date(lastDate.getTime() + n * 86_400_000).toISOString().slice(0, 10);
    points.push({ date, projectedVolume });
  }
  return points;
}

export type CrisisAlertLevel = 'stable' | 'elevated' | 'crisis';

export interface CrisisAlertRadar {
  changePct: number;
  level: CrisisAlertLevel;
}

/**
 * 48-hour negative-sentiment momentum (ADR-0062 Decision §5) — the two most
 * recent 48h windows within the selected range, anchored at range.endDate
 * 23:59:59. Returns null ("No data") when either window has zero total
 * posts, or when the prior window has zero negative posts (a zero baseline
 * would otherwise force a fabricated "infinite % increase" — the same
 * computePercentDelta()-style discipline this codebase already applies).
 */
export function computeCrisisAlertRadar(posts: SentimentPost[], range: DateRangeFilter): CrisisAlertRadar | null {
  const endOfRange = new Date(`${range.endDate}T23:59:59.999Z`).getTime();
  const windowMs = 48 * 3600_000;
  const currentStart = endOfRange - windowMs;
  const previousStart = endOfRange - 2 * windowMs;

  let currentTotal = 0;
  let currentNegative = 0;
  let previousTotal = 0;
  let previousNegative = 0;

  for (const post of posts) {
    if (!post.publishedAt) continue;
    const t = new Date(post.publishedAt).getTime();
    if (t > currentStart && t <= endOfRange) {
      currentTotal += 1;
      if (post.sentiment === 'negative') currentNegative += 1;
    } else if (t > previousStart && t <= currentStart) {
      previousTotal += 1;
      if (post.sentiment === 'negative') previousNegative += 1;
    }
  }

  if (currentTotal === 0 || previousTotal === 0) return null;

  const delta = computePercentDelta(currentNegative, previousNegative);
  if (delta.pct === null) return null;

  const level: CrisisAlertLevel = delta.pct > 50 ? 'crisis' : delta.pct > 10 ? 'elevated' : 'stable';
  return { changePct: delta.pct, level };
}

export interface SentimentTrajectoryPoint {
  date: string;
  /** −10 (fully negative) to +10 (fully positive), zero at the neutral midpoint. null when the day has zero enriched posts — a gap, never a fabricated 0. */
  score: number | null;
}

export interface SentimentTrajectory {
  points: SentimentTrajectoryPoint[];
  /** Compares the most recent scored day against the preceding scored day. null when fewer than two scored days exist. */
  trend: 'up' | 'down' | 'flat' | null;
}

/**
 * Sentiment Trajectory (ADR-0062 Decision §5) — a per-day series, reusing
 * computeSentimentHistory()'s own day-bucketing directly rather than
 * collapsing the range into one flattened number. Each day's score is the
 * weighted mean (positive×10 + neutral×0 + negative×−10) / total.
 */
export function computeSentimentTrajectory(history: SentimentHistoryPoint[]): SentimentTrajectory {
  const points: SentimentTrajectoryPoint[] = history.map(({ date, positive, neutral, negative }) => {
    const total = positive + neutral + negative;
    const score = total === 0 ? null : (positive * 10 + neutral * 0 + negative * -10) / total;
    return { date, score };
  });

  const scored = points.filter((p) => p.score !== null) as Array<{ date: string; score: number }>;
  let trend: SentimentTrajectory['trend'] = null;
  if (scored.length >= 2) {
    const last = scored[scored.length - 1].score;
    const prev = scored[scored.length - 2].score;
    trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
  }

  return { points, trend };
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
  const sources = computeSourceBreakdown(filtered);
  return {
    totalPosts: filtered.length,
    sentimentSplit: computeSentimentSplit(filtered),
    sources,
    sentimentHistory: computeSentimentHistory(flat, range),
    topFans: computeTopAuthorsBySentiment(flat, 'positive'),
    topCritics: computeTopAuthorsBySentiment(flat, 'negative'),
    positivePhrases: computePhrasesBySentiment(flat, 'positive'),
    negativePhrases: computePhrasesBySentiment(flat, 'negative'),
    phraseFrequency,
    phraseHistory: computePhraseHistory(flat, range, topPhrases),
    volumeHistory: computeVolumeHistory(flat, range),
    languages: computeLanguageBreakdown(flat),
    sourceVolumeHistory: computeSourceVolumeHistory(flat, range, sources.map((s) => s.providerId)),
    posts: flat,
  };
}
