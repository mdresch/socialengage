'use client';

import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { InteractiveWorldMap } from './InteractiveWorldMap';
import {
  computeSentimentSplitFromFlat,
  computeSentimentHistory,
  computeTopAuthorsBySentiment,
  computePhrasesBySentiment,
  computeSentimentIndex,
  type AnalyticsSummary,
  type DateRangeFilter,
  type SentimentPost,
} from './analyticsData';

interface SentimentTabProps {
  summary: AnalyticsSummary;
  previousSummary?: AnalyticsSummary | null;
  range: DateRangeFilter;
}

type ActiveFilter = { type: 'author' | 'phrase' | 'source' | 'country'; value: string } | null;

const SENTIMENT_COLORS = { positive: '#15803d', neutral: '#64748b', negative: '#dc2626' };

// ---------------------------------------------------------------------------
// Inline Icons (lucide-react is not installed)
// ---------------------------------------------------------------------------

function IconSmile() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconFrown() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconArrowUpRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function IconArrowDownRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="7" y1="7" x2="17" y2="17" />
      <polyline points="17 7 17 7 17 17" />
    </svg>
  );
}

function IconMoveRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.3 4.3l.7.7M18.4 18.4l.7.7M1 12h1M21 12h1M4.3 19.7l.7-.7M18.4 5.7l.7-.7" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Word Cloud Size Helper (Deterministic tiering based on frequency)
// ---------------------------------------------------------------------------
function getPhraseTier(count: number, maxCount: number): number {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/**
 * Story 8.2 (ADR-0054) — Sentiment Dashboard Tab
 * 3-column Microsoft Social Engagement layout:
 * - Col 1 (Left 25%): Location Insights, Top Fans, Top Critics
 * - Col 2 (Center 50%): Sentiment History composed chart, Negative Phrases & Sources by Sentiment
 * - Col 3 (Right 25%): Sentiment Gauge Card, Positive Phrases, Sentiment Coverage Donut
 */
export function SentimentTab({ summary, previousSummary, range }: SentimentTabProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Client-side filtering across the real post dataset
  const filteredPosts = useMemo(() => {
    if (!activeFilter) return summary.posts;
    return summary.posts.filter((p) => {
      if (activeFilter.type === 'author') return p.author === activeFilter.value;
      if (activeFilter.type === 'phrase') return (p.keyPhrases || []).includes(activeFilter.value);
      if (activeFilter.type === 'source') return p.providerId === activeFilter.value;
      if (activeFilter.type === 'country') return p.geoCountry === activeFilter.value;
      return true;
    });
  }, [activeFilter, summary.posts]);

  const sentimentSplit = activeFilter ? computeSentimentSplitFromFlat(filteredPosts) : summary.sentimentSplit;
  const sentimentHistoryRaw = activeFilter ? computeSentimentHistory(filteredPosts, range) : summary.sentimentHistory;
  const topFans = activeFilter ? computeTopAuthorsBySentiment(filteredPosts, 'positive') : summary.topFans;
  const topCritics = activeFilter ? computeTopAuthorsBySentiment(filteredPosts, 'negative') : summary.topCritics;
  const positivePhrases = activeFilter ? computePhrasesBySentiment(filteredPosts, 'positive') : summary.positivePhrases;
  const negativePhrases = activeFilter ? computePhrasesBySentiment(filteredPosts, 'negative') : summary.negativePhrases;

  function toggleAuthor(author: string) {
    setActiveFilter((prev) => (prev?.type === 'author' && prev.value === author ? null : { type: 'author', value: author }));
  }
  function togglePhrase(phrase: string) {
    setActiveFilter((prev) => (prev?.type === 'phrase' && prev.value === phrase ? null : { type: 'phrase', value: phrase }));
  }
  function toggleSource(source: string) {
    setActiveFilter((prev) => (prev?.type === 'source' && prev.value === source ? null : { type: 'source', value: source }));
  }
  function toggleCountry(country: string) {
    setActiveFilter((prev) => (prev?.type === 'country' && prev.value === country ? null : { type: 'country', value: country }));
  }

  const totalEnriched = sentimentSplit.positive + sentimentSplit.neutral + sentimentSplit.negative;

  // Unified net sentiment index on −10…+10 via shared computeSentimentIndex()
  const sentimentIndex = computeSentimentIndex(sentimentSplit);

  // Delta vs previous period
  const sentimentDelta = useMemo(() => {
    if (sentimentIndex === null) return null;
    // Use previousSummary if passed, otherwise split current posts into two halves by date
    const prevSplit = previousSummary
      ? computeSentimentSplitFromFlat(previousSummary.posts)
      : (() => {
          const posts = summary.posts;
          if (posts.length < 4) return null;
          const sorted = [...posts].sort((a, b) =>
            (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '')
          );
          const half = Math.floor(sorted.length / 2);
          return computeSentimentSplitFromFlat(sorted.slice(0, half));
        })();
    if (!prevSplit) return null;
    const prevIndex = computeSentimentIndex(prevSplit);
    if (prevIndex === null) return null;
    return parseFloat((sentimentIndex - prevIndex).toFixed(1));
  }, [sentimentIndex, summary.posts, previousSummary]);

  // Format sentiment history for Dual Volume Bar + Index Line Chart (including Last Week benchmark)
  const sentimentHistory = useMemo(() => {
    return sentimentHistoryRaw.map((day) => {
      const dayTotal = day.positive + day.neutral + day.negative;
      const dayIndex = computeSentimentIndex({ positive: day.positive, neutral: day.neutral, negative: day.negative }) ?? 0;

      // Calculate prior week's matching day (7 days prior)
      const prevDate = new Date(day.date);
      prevDate.setUTCDate(prevDate.getUTCDate() - 7);
      const prevDateStr = prevDate.toISOString().slice(0, 10);

      const prevPosts = filteredPosts.filter((p) => (p.publishedAt || '').slice(0, 10) === prevDateStr);
      const prevPos = prevPosts.filter((p) => p.sentiment === 'positive').length;
      const prevNeg = prevPosts.filter((p) => p.sentiment === 'negative').length;
      const prevNeu = prevPosts.filter((p) => p.sentiment === 'neutral').length;
      const prevTotal = prevPos + prevNeg + prevNeu;
      const lastWeekIndex = prevTotal > 0
        ? computeSentimentIndex({ positive: prevPos, neutral: prevNeu, negative: prevNeg })
        : null;

      return {
        ...day,
        negativeBar: day.negative > 0 ? -day.negative : 0,
        index: dayIndex,
        lastWeek: lastWeekIndex,
      };
    });
  }, [sentimentHistoryRaw, filteredPosts]);

  // Maximum volume calculation for symmetrical positive/negative scale
  const maxVol = useMemo(() => {
    const vals = sentimentHistory.map((d) => Math.max(d.positive, Math.abs(d.negativeBar || 0)));
    const peak = Math.max(2, ...vals);
    if (peak <= 5) return 5;
    if (peak <= 10) return 10;
    if (peak <= 25) return 25;
    if (peak <= 50) return 50;
    if (peak <= 100) return 100;
    return Math.ceil(peak / 50) * 50;
  }, [sentimentHistory]);

  // Top countries with sentiment breakdown
  const topCountries = useMemo(() => {
    const map = new Map<string, { code: string; name: string; pos: number; neg: number; neu: number; total: number }>();
    for (const p of summary.posts) { // always computed from full (unfiltered) posts
      const code = p.geoCountry?.toUpperCase();
      if (!code) continue;
      const name = p.geoCountryName || code;
      const entry = map.get(code) || { code, name, pos: 0, neg: 0, neu: 0, total: 0 };
      if (p.sentiment === 'positive') entry.pos += 1;
      else if (p.sentiment === 'negative') entry.neg += 1;
      else if (p.sentiment === 'neutral') entry.neu += 1;
      entry.total += 1;
      map.set(code, entry);
    }
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        index: computeSentimentIndex({ positive: e.pos, neutral: e.neu, negative: e.neg }),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [summary.posts]);

  // Max count for country bar sizing
  const maxCountryCount = useMemo(() => Math.max(1, ...topCountries.map((c) => c.total)), [topCountries]);

  // Sources by sentiment calculation
  const sourcesBySentiment = useMemo(() => {
    const map = new Map<string, { positive: number; neutral: number; negative: number; total: number }>();
    for (const post of filteredPosts) {
      if (!post.providerId) continue;
      const cur = map.get(post.providerId) || { positive: 0, neutral: 0, negative: 0, total: 0 };
      cur.total += 1;
      if (post.sentiment === 'positive') cur.positive += 1;
      else if (post.sentiment === 'negative') cur.negative += 1;
      else if (post.sentiment === 'neutral') cur.neutral += 1;
      map.set(post.providerId, cur);
    }
    return Array.from(map.entries()).map(([providerId, stats]) => {
      const score = stats.total > 0
        ? parseFloat((((stats.positive - stats.negative) / stats.total) * 5 + 5).toFixed(1))
        : 5.0;
      const widthPercent = Math.min(100, Math.max(5, Math.round((score / 10) * 100)));
      return {
        id: providerId,
        name: providerId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        score: score.toFixed(1),
        numericScore: score,
        widthPercent,
        trend: score >= 6.0 ? 'up' : (score <= 4.0 ? 'down' : 'flat'),
        total: stats.total,
      };
    }).sort((a, b) => b.numericScore - a.numericScore);
  }, [filteredPosts]);

  // Max count for phrase cloud sizing
  const maxPosCount = useMemo(() => Math.max(1, ...positivePhrases.map((p) => p.count)), [positivePhrases]);
  const maxNegCount = useMemo(() => Math.max(1, ...negativePhrases.map((p) => p.count)), [negativePhrases]);

  // Double Donut Coverage & Split Calculations
  // Inner ring: Total Posts (Enriched vs Unenriched)
  const totalPostsCount = summary.totalPosts || filteredPosts.length || 0;
  const enrichedPostsCount = totalEnriched;
  const unenrichedPostsCount = Math.max(0, totalPostsCount - enrichedPostsCount);

  const innerCoverageData = useMemo(() => [
    { name: 'Enriched posts', value: enrichedPostsCount, color: '#10b981' },
    { name: 'Unenriched', value: unenrichedPostsCount, color: '#94a3b8' },
  ], [enrichedPostsCount, unenrichedPostsCount]);

  // Outer ring: Automated AI Enrichment vs Manual Adjusted Enrichment
  const manualCount = useMemo(() => {
    return filteredPosts.filter((p) => p.sentiment && p.isOverridden).length;
  }, [filteredPosts]);
  const automatedCount = Math.max(0, enrichedPostsCount - manualCount);

  const outerCoverageData = useMemo(() => [
    { name: 'Automated (AI)', value: automatedCount, color: '#0f172a' },
    { name: 'Manual adjusted', value: manualCount, color: '#f59e0b' },
  ], [automatedCount, manualCount]);

  // Export helper
  function exportData(widgetName: string, data: unknown) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widgetName.toLowerCase()}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="an-sentiment" id="analytics-sentiment-tab">
      {/* Active filter chip bar */}
      {activeFilter && (
        <div className="an-overview-chip-bar" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="an-overview-chip">
            <span>
              Filtered by {activeFilter.type}: <strong>{activeFilter.value}</strong>
            </span>
            <button type="button" onClick={() => setActiveFilter(null)} className="an-overview-chip-dismiss" title="Clear filter">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="an-overview-grid">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (Location Insights, Top Fans, Top Critics) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-left">
          {/* 1.1 LOCATION INSIGHTS */}
          <div className="an-widget" id="widget-sentiment-location">
            <div className="an-widget-header">
              <span className="an-widget-title">Location insights</span>
              <button
                type="button"
                onClick={() => exportData('LocationInsights', { totalPosts: filteredPosts.length })}
                className="an-conversations-icon-btn"
                title="Download Location Data"
              >
                <IconDownload />
              </button>
            </div>
            {/* Globe with sentiment-index coloured pins */}
            {topCountries.length === 0 ? (
              <EmptyState heading="No location data" body="Posts with geo enrichment will appear here." />
            ) : (
              <>
                <InteractiveWorldMap
                  countries={topCountries.map((c) => ({
                    id: c.code,
                    name: c.name,
                    count: c.total,
                    score: c.index === null ? '0.0' : c.index >= 0 ? `+${c.index.toFixed(1)}` : c.index.toFixed(1),
                    numericScore: c.index ?? 0,
                    positive: c.pos,
                    neutral: c.neu,
                    negative: c.neg,
                  }))}
                  selectedCountry={activeFilter?.type === 'country' ? activeFilter.value : null}
                  onSelectCountry={(code) => {
                    if (code) toggleCountry(code);
                    else setActiveFilter(null);
                  }}
                  mapMode="sentiment"
                  height={180}
                />
              </>
            )}
          </div>

          {/* 1.2 TOP FANS */}
          <div className="an-widget" id="widget-top-fans">
            <div className="an-widget-header">
              <span className="an-widget-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
                <span>Top fans</span>
                <IconSmile />
              </span>
              <button
                type="button"
                onClick={() => exportData('TopFans', topFans)}
                className="an-conversations-icon-btn"
                title="Download Top Fans"
              >
                <IconDownload />
              </button>
            </div>
            {topFans.length === 0 ? (
              <EmptyState heading="No positive posts yet" body="Top fans appear once posts with a real author and positive sentiment exist." />
            ) : (
              <ul className="an-author-list">
                {topFans.map((fan) => (
                  <li key={fan.author}>
                    <button
                      type="button"
                      onClick={() => toggleAuthor(fan.author)}
                      className={`an-author-row${activeFilter?.type === 'author' && activeFilter.value === fan.author ? ' an-author-row-active' : ''}`}
                    >
                      <span className="truncate">{fan.author}</span>
                      <span className="an-author-count" style={{ color: '#15803d', fontWeight: 600 }}>{fan.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 1.3 TOP CRITICS */}
          <div className="an-widget" id="widget-top-critics">
            <div className="an-widget-header">
              <span className="an-widget-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
                <span>Top critics</span>
                <IconFrown />
              </span>
              <button
                type="button"
                onClick={() => exportData('TopCritics', topCritics)}
                className="an-conversations-icon-btn"
                title="Download Top Critics"
              >
                <IconDownload />
              </button>
            </div>
            {topCritics.length === 0 ? (
              <EmptyState heading="No negative posts yet" body="Top critics appear once posts with a real author and negative sentiment exist." />
            ) : (
              <ul className="an-author-list">
                {topCritics.map((critic) => (
                  <li key={critic.author}>
                    <button
                      type="button"
                      onClick={() => toggleAuthor(critic.author)}
                      className={`an-author-row${activeFilter?.type === 'author' && activeFilter.value === critic.author ? ' an-author-row-active' : ''}`}
                    >
                      <span className="truncate">{critic.author}</span>
                      <span className="an-author-count" style={{ color: '#dc2626', fontWeight: 600 }}>{critic.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (Sentiment History & Negative Phrases / Sources) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-centre">
          {/* 2.1 SENTIMENT HISTORY */}
          <div className="an-widget" id="widget-sentiment-history">
            <div className="an-widget-header">
              <span className="an-widget-title">Sentiment over time</span>
              <button
                type="button"
                onClick={() => exportData('SentimentHistory', sentimentHistory)}
                className="an-conversations-icon-btn"
                title="Download Sentiment History Data"
              >
                <IconDownload />
              </button>
            </div>

            {/* Legend indicators */}
            <div className="an-conversations-legend" style={{ marginBottom: 'var(--space-2)' }}>
              <div className="an-conversations-legend-item">
                <span className="an-conversations-legend-dot" style={{ background: '#15803d' }} />
                <span>Positive (▲)</span>
              </div>
              <div className="an-conversations-legend-item">
                <span className="an-conversations-legend-dot" style={{ background: '#dc2626' }} />
                <span>Negative (▼)</span>
              </div>
              <div className="an-conversations-legend-item">
                <span className="an-conversations-legend-dot" style={{ background: '#0f172a' }} />
                <span>Index</span>
              </div>
              <div className="an-conversations-legend-item">
                <span style={{ width: 14, height: 2, background: '#94a3b8', display: 'inline-block', verticalAlign: 'middle' }} />
                <span style={{ color: '#64748b' }}>Last week</span>
              </div>
            </div>

            <div className="an-chart-wrap" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sentimentHistory} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="vol"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[-maxVol, maxVol]}
                    ticks={[-maxVol, -Math.round(maxVol / 2), 0, Math.round(maxVol / 2), maxVol]}
                    tickFormatter={(v) => String(Math.abs(v))}
                  />
                  <YAxis yAxisId="idx" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[-10, 10]} ticks={[-10, 0, 10]} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const posItem = payload.find((p) => p.dataKey === 'positive');
                        const negItem = payload.find((p) => p.dataKey === 'negativeBar');
                        const idxItem = payload.find((p) => p.dataKey === 'index');
                        const lastWeekItem = payload.find((p) => p.dataKey === 'lastWeek');
                        const items = [
                          {
                            name: 'Positive Volume',
                            value: `${Number(posItem?.value ?? 0)} posts`,
                            color: '#16a34a',
                            valueColor: '#4ade80',
                          },
                          {
                            name: 'Negative Volume',
                            value: `${Math.abs(Number(negItem?.value ?? 0))} posts`,
                            color: '#ef4444',
                            valueColor: '#f87171',
                          },
                          {
                            name: 'Sentiment Index',
                            value: Number(idxItem?.value ?? 0),
                            color: '#38bdf8',
                            valueColor: '#38bdf8',
                          },
                        ];
                        if (lastWeekItem && lastWeekItem.value !== undefined && lastWeekItem.value !== null) {
                          items.push({
                            name: 'Last Week Benchmark',
                            value: Number(lastWeekItem.value),
                            color: '#94a3b8',
                            valueColor: '#cbd5e1',
                          });
                        }
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={String(label)}
                            items={items}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar yAxisId="vol" dataKey="positive" name="Positive Volume" fill="#15803d" barSize={18} />
                  <Bar yAxisId="vol" dataKey="negativeBar" name="Negative Volume" fill="#dc2626" barSize={18} />
                  <Line yAxisId="idx" type="monotone" dataKey="index" name="Sentiment Index" stroke="#0f172a" strokeWidth={2} dot={false} />
                  <Line
                    yAxisId="idx"
                    type="monotone"
                    dataKey="lastWeek"
                    name="Last Week Benchmark"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    connectNulls={true}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2.2 BOTTOM SUB-WIDGETS (Negative Phrases & Sources by Sentiment) */}
          <div className="an-centre-bottom-row">
            {/* 2.2.A NEGATIVE KEY PHRASES */}
            <div className="an-widget" id="widget-negative-phrases">
              <div className="an-widget-header">
                <span className="an-widget-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
                  <span>Negative key phrases</span>
                  <IconFrown />
                </span>
                <button
                  type="button"
                  onClick={() => exportData('NegativePhrases', negativePhrases)}
                  className="an-conversations-icon-btn"
                  title="Download Negative Phrases"
                >
                  <IconDownload />
                </button>
              </div>
              {negativePhrases.length === 0 ? (
                <EmptyState heading="No negative key phrases yet" />
              ) : (
                <div className="an-sentiment-cloud">
                  {negativePhrases.map((p) => {
                    const tier = getPhraseTier(p.count, maxNegCount);
                    const isSelected = activeFilter?.type === 'phrase' && activeFilter.value === p.phrase;
                    return (
                      <button
                        key={p.phrase}
                        type="button"
                        onClick={() => togglePhrase(p.phrase)}
                        className={`an-phrase-item an-neg-phrase-item an-phrase-tier-${tier}${isSelected ? ' an-phrase-selected' : ''}`}
                        title={`${p.phrase}: ${p.count} mentions`}
                      >
                        <span>{p.phrase}</span>
                        <span className="an-neg-count-badge">{p.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2.2.B SOURCES BY SENTIMENT */}
            <div className="an-widget" id="widget-sources-by-sentiment">
              <div className="an-widget-header">
                <span className="an-widget-title">Sources by sentiment</span>
                <button
                  type="button"
                  onClick={() => exportData('SourcesBySentiment', sourcesBySentiment)}
                  className="an-conversations-icon-btn"
                  title="Download Sources by Sentiment"
                >
                  <IconDownload />
                </button>
              </div>
              {sourcesBySentiment.length === 0 ? (
                <EmptyState heading="No source sentiment data" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2-5)', marginTop: 'var(--space-2)' }}>
                  {sourcesBySentiment.map((src) => {
                    const isSelected = activeFilter?.type === 'source' && activeFilter.value === src.id;
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => toggleSource(src.id)}
                        className={`an-author-row${isSelected ? ' an-author-row-active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 60, textAlign: 'left' }}>
                          {src.name}
                        </span>
                        <div style={{ flex: 1, height: 8, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${src.widthPercent}%`,
                              background: src.numericScore >= 6 ? '#15803d' : (src.numericScore <= 4 ? '#dc2626' : '#d97706'),
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>
                          {src.score}
                        </span>
                        <span style={{ display: 'inline-flex' }}>
                          {src.trend === 'up' ? <IconArrowUpRight /> : (src.trend === 'down' ? <IconArrowDownRight /> : <IconMoveRight />)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (Sentiment Gauge Card, Positive Phrases, Split Donut) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-right">
          {/* 3.1 SENTIMENT GAUGE CARD */}
          <div className="an-widget" id="widget-sentiment-gauge-card">
            <div className="an-widget-header">
              <span className="an-widget-title">Sentiment</span>
              <button
                type="button"
                onClick={() => exportData('SentimentGauge', { sentimentIndex, sentimentSplit })}
                className="an-conversations-icon-btn"
                title="Download Sentiment Data"
              >
                <IconDownload />
              </button>
            </div>

            <div className="an-conversations-sentiment-main">
              <div className="an-conversations-sentiment-score">
                <span className="an-conversations-score-val">
                  {sentimentIndex !== null ? sentimentIndex.toFixed(1) : '—'}
                </span>
                <span className="an-conversations-score-lbl">index</span>
              </div>

              <div className="an-conversations-gauge-ring">
                <svg width="76" height="76" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="30" stroke="#cbd5e1" strokeWidth="6" fill="transparent" />
                  {sentimentSplit.negative > 0 && (
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      stroke="#dc2626"
                      strokeWidth="6"
                      strokeDasharray="188"
                      strokeDashoffset={188 - (sentimentSplit.negative / (sentimentSplit.positive + sentimentSplit.neutral + sentimentSplit.negative || 1)) * 188}
                      fill="transparent"
                    />
                  )}
                  {sentimentSplit.positive > 0 && (
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      stroke="#15803d"
                      strokeWidth="6"
                      strokeDasharray="188"
                      strokeDashoffset={94}
                      fill="transparent"
                    />
                  )}
                </svg>
                <div className="an-conversations-gauge-icon">
                  <IconSmile />
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 300, color: sentimentDelta !== null && sentimentDelta > 0 ? '#15803d' : sentimentDelta !== null && sentimentDelta < 0 ? '#dc2626' : 'var(--color-text-primary)' }}>
                  {sentimentDelta !== null ? (sentimentDelta > 0 ? `+${sentimentDelta.toFixed(1)}` : sentimentDelta.toFixed(1)) : '—'}
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                  <span>vs prev period</span>
                  <IconMoveRight />
                </div>
              </div>
            </div>

            {/* Slider bar (-10 to +10) */}
            <div className="an-conversations-slider-wrap" style={{ marginTop: 'var(--space-3)' }}>
              <div className="an-conversations-slider-labels">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
              </div>
              <div className="an-conversations-slider-track">
                <div className="an-conversations-slider-mid" />
                <div
                  className={`an-conversations-slider-fill ${
                    sentimentIndex !== null && sentimentIndex >= 0 ? 'an-slider-fill-pos' : 'an-slider-fill-neg'
                  }`}
                  style={{
                    // Fills from centre (50%). Each ±1 unit = 5% width from the midpoint.
                    width: `${Math.min(50, Math.max(3, Math.abs(sentimentIndex ?? 0) * 5))}%`,
                    marginLeft: (sentimentIndex ?? 0) >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(sentimentIndex ?? 0) * 5)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3.2 POSITIVE KEY PHRASES */}
          <div className="an-widget" id="widget-positive-phrases">
            <div className="an-widget-header">
              <span className="an-widget-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
                <span>Positive key phrases</span>
                <IconSmile />
              </span>
              <button
                type="button"
                onClick={() => exportData('PositivePhrases', positivePhrases)}
                className="an-conversations-icon-btn"
                title="Download Positive Phrases"
              >
                <IconDownload />
              </button>
            </div>
            {positivePhrases.length === 0 ? (
              <EmptyState heading="No positive key phrases yet" />
            ) : (
              <div className="an-sentiment-cloud">
                {positivePhrases.map((p) => {
                  const tier = getPhraseTier(p.count, maxPosCount);
                  const isSelected = activeFilter?.type === 'phrase' && activeFilter.value === p.phrase;
                  return (
                    <button
                      key={p.phrase}
                      type="button"
                      onClick={() => togglePhrase(p.phrase)}
                      className={`an-phrase-item an-pos-phrase-item an-phrase-tier-${tier}${isSelected ? ' an-phrase-selected' : ''}`}
                      title={`${p.phrase}: ${p.count} mentions`}
                    >
                      <span>{p.phrase}</span>
                      <span className="an-pos-count-badge">{p.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3.3 DOUBLE DONUT: ENRICHMENT COVERAGE & SOURCE */}
          <div className="an-widget" id="widget-sentiment-donut">
            <div className="an-widget-header">
              <span className="an-widget-title">Sentiment coverage</span>
              <button
                type="button"
                onClick={() => exportData('SentimentCoverage', { inner: innerCoverageData, outer: outerCoverageData, sentimentSplit })}
                className="an-conversations-icon-btn"
                title="Download Coverage Data"
              >
                <IconDownload />
              </button>
            </div>
            {totalPostsCount === 0 && totalEnriched === 0 ? (
              <EmptyState heading="No enriched posts in this range" body="Sentiment appears here once posts have been AI-enriched." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const entry = payload[0];
                            const isInner = entry.name === 'Enriched posts' || entry.name === 'Unenriched';
                            const baseTotal = isInner ? (totalPostsCount || 1) : (enrichedPostsCount || 1);
                            const pct = Math.round((Number(entry.value) / baseTotal) * 100);
                            return (
                              <AnimatedChartTooltip
                                active={active}
                                title={String(entry.name)}
                                subtitle={isInner ? 'Coverage (Inner Ring)' : 'Enrichment Source (Outer Ring)'}
                                items={[
                                  {
                                    name: 'Count',
                                    value: `${Number(entry.value)} posts`,
                                    color: String(entry.payload?.fill || entry.color),
                                    valueColor: '#ffffff',
                                  },
                                  {
                                    name: 'Share',
                                    value: `${pct}%`,
                                    color: '#94a3b8',
                                    valueColor: '#cbd5e1',
                                  },
                                ]}
                              />
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Outer Ring: Automated vs Manual Adjusted */}
                      <Pie
                        data={outerCoverageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={62}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      >
                        {outerCoverageData.map((entry, index) => (
                          <Cell key={`outer-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      {/* Inner Ring: Total Enriched vs Unenriched */}
                      <Pie
                        data={innerCoverageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={24}
                        outerRadius={38}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      >
                        {innerCoverageData.map((entry, index) => (
                          <Cell key={`inner-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                  {/* Outer Ring Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <span>Enrichment Type (Outer)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0f172a', display: 'inline-block' }} />
                      <span>Automated (AI)</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {enrichedPostsCount > 0 ? `${Math.round((automatedCount / enrichedPostsCount) * 100)}%` : '100%'} ({automatedCount})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
                      <span>Manual adjusted</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {enrichedPostsCount > 0 ? `${Math.round((manualCount / enrichedPostsCount) * 100)}%` : '0%'} ({manualCount})
                    </span>
                  </div>

                  {/* Inner Ring Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 'var(--space-1)' }}>
                    <span>Coverage Status (Inner)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                      <span>Enriched posts</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {totalPostsCount > 0 ? `${Math.round((enrichedPostsCount / totalPostsCount) * 100)}%` : '0%'} ({enrichedPostsCount})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#94a3b8', display: 'inline-block' }} />
                      <span>Unenriched</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {totalPostsCount > 0 ? `${Math.round((unenrichedPostsCount / totalPostsCount) * 100)}%` : '0%'} ({unenrichedPostsCount})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <button type="button" className="an-drawer-trigger" onClick={() => setDrawerOpen(true)}>
        View {filteredPosts.length} matching post{filteredPosts.length === 1 ? '' : 's'}
      </button>

      {/* Slideover Drawer for Matching Posts */}
      <Slideover title={`Matching posts (${filteredPosts.length})`} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {filteredPosts.length === 0 ? (
          <EmptyState heading="No matching posts" />
        ) : (
          <ul className="an-drawer-post-list">
            {filteredPosts.map((post: SentimentPost) => {
              const first3Entities = (post.entities ?? []).slice(0, 3);
              const first3Phrases = (post.keyPhrases ?? []).slice(0, 3);
              return (
                <li key={post.id} className="an-drawer-post-row">
                  <span className="an-drawer-post-title">{post.title}</span>
                  <span className="an-drawer-post-meta">
                    {post.author && <span className="an-drawer-post-author" title={`Author: ${post.author}`}>By {post.author}</span>}
                    {post.sentiment && <span className={`an-sentiment-mini-${post.sentiment}`}>{post.sentiment}</span>}
                    {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                  </span>
                  {(first3Entities.length > 0 || first3Phrases.length > 0) && (
                    <span className="an-drawer-post-chips">
                      {first3Entities.map((ent, i) => (
                        <span key={`ent-${i}`} className="an-drawer-chip an-drawer-chip-entity" title={`Entity: ${ent}`}>
                          <IconTag /> {ent}
                        </span>
                      ))}
                      {first3Phrases.map((phrase, i) => (
                        <span key={`phr-${i}`} className="an-drawer-chip an-drawer-chip-phrase" title={`Key Phrase: ${phrase}`}>
                          <IconSparkles /> #{phrase}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Slideover>
    </div>
  );
}
