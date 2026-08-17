'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import {
  computeSentimentSplitFromFlat,
  computeSentimentHistory,
  computeTopAuthorsBySentiment,
  computePhrasesBySentiment,
  type AnalyticsSummary,
  type DateRangeFilter,
} from './analyticsData';

interface SentimentTabProps {
  summary: AnalyticsSummary;
  range: DateRangeFilter;
}

type ActiveFilter = { type: 'author' | 'phrase'; value: string } | null;

const SENTIMENT_COLORS = { positive: '#15803d', neutral: '#64748b', negative: '#dc2626' };

/**
 * Story 8.2 — every widget here reads from the same, already-fetched
 * AnalyticsSummary (Story 8.1's own single fetch-and-aggregate loop).
 * Selecting an author or phrase filters `summary.posts` client-side and
 * recomputes each widget from the filtered subset with the exact same pure
 * functions the server-side aggregate already used — no second network
 * round trip per click.
 */
export function SentimentTab({ summary, range }: SentimentTabProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredPosts = useMemo(() => {
    if (!activeFilter) return summary.posts;
    return summary.posts.filter((p) =>
      activeFilter.type === 'author' ? p.author === activeFilter.value : p.keyPhrases.includes(activeFilter.value)
    );
  }, [summary.posts, activeFilter]);

  const sentimentSplit = activeFilter ? computeSentimentSplitFromFlat(filteredPosts) : summary.sentimentSplit;
  const sentimentHistory = activeFilter ? computeSentimentHistory(filteredPosts, range) : summary.sentimentHistory;
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

  const totalEnriched = sentimentSplit.positive + sentimentSplit.neutral + sentimentSplit.negative;

  const donutData = [
    { name: 'Positive', value: sentimentSplit.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: sentimentSplit.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: sentimentSplit.negative, color: SENTIMENT_COLORS.negative },
  ];

  return (
    <div className="an-sentiment" id="analytics-sentiment-tab">
      {activeFilter && (
        <div className="an-filter-banner">
          <span>
            Filtered by {activeFilter.type}: <strong>{activeFilter.value}</strong>
          </span>
          <button type="button" onClick={() => setActiveFilter(null)} className="an-filter-clear">
            Clear filter
          </button>
        </div>
      )}

      <div className="an-widget" id="widget-sentiment-donut">
        <div className="an-widget-header">
          <span className="an-widget-title">Sentiment split</span>
        </div>
        {totalEnriched === 0 ? (
          <EmptyState heading="No enriched posts in this range" body="Sentiment appears here once posts have been AI-enriched." />
        ) : (
          <div className="an-sent-donut-wrap">
            <PieChart width={120} height={120}>
              <Pie data={donutData} cx={60} cy={60} innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={1} stroke="#fff">
                {donutData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="an-sent-donut-legend">
              {donutData.map((d) => (
                <div key={d.name} className="an-sent-donut-row">
                  <span className="an-list-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="an-sent-donut-count">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="an-widget" id="widget-sentiment-history">
        <div className="an-widget-header">
          <span className="an-widget-title">Sentiment over time</span>
        </div>
        <div className="an-chart-wrap" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sentimentHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <AnimatedChartTooltip
                    active={active}
                    title={String(label)}
                    items={payload?.map((p) => ({ name: String(p.name), value: p.value as number, color: p.color as string })) ?? []}
                  />
                )}
              />
              <Bar dataKey="positive" stackId="s" fill={SENTIMENT_COLORS.positive} />
              <Bar dataKey="neutral" stackId="s" fill={SENTIMENT_COLORS.neutral} />
              <Bar dataKey="negative" stackId="s" fill={SENTIMENT_COLORS.negative} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="an-widget" id="widget-top-fans">
        <div className="an-widget-header">
          <span className="an-widget-title">Top fans</span>
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
                  <span>{fan.author}</span>
                  <span className="an-author-count">{fan.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="an-widget" id="widget-top-critics">
        <div className="an-widget-header">
          <span className="an-widget-title">Top critics</span>
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
                  <span>{critic.author}</span>
                  <span className="an-author-count">{critic.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="an-widget" id="widget-positive-phrases">
        <div className="an-widget-header">
          <span className="an-widget-title">Positive key phrases</span>
        </div>
        {positivePhrases.length === 0 ? (
          <EmptyState heading="No positive key phrases yet" />
        ) : (
          <div className="an-phrase-cloud">
            {positivePhrases.map((p) => (
              <button
                key={p.phrase}
                type="button"
                onClick={() => togglePhrase(p.phrase)}
                className={`an-phrase-btn an-phrase-btn-positive${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? ' an-phrase-btn-active' : ''}`}
              >
                {p.phrase} <span className="an-phrase-count">{p.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="an-widget" id="widget-negative-phrases">
        <div className="an-widget-header">
          <span className="an-widget-title">Negative key phrases</span>
        </div>
        {negativePhrases.length === 0 ? (
          <EmptyState heading="No negative key phrases yet" />
        ) : (
          <div className="an-phrase-cloud">
            {negativePhrases.map((p) => (
              <button
                key={p.phrase}
                type="button"
                onClick={() => togglePhrase(p.phrase)}
                className={`an-phrase-btn an-phrase-btn-negative${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? ' an-phrase-btn-active' : ''}`}
              >
                {p.phrase} <span className="an-phrase-count">{p.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="an-drawer-trigger" onClick={() => setDrawerOpen(true)}>
        View {filteredPosts.length} matching post{filteredPosts.length === 1 ? '' : 's'}
      </button>

      <Slideover title={`Matching posts (${filteredPosts.length})`} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {filteredPosts.length === 0 ? (
          <EmptyState heading="No matching posts" />
        ) : (
          <ul className="an-drawer-post-list">
            {filteredPosts.map((post) => (
              <li key={post.id} className="an-drawer-post-row">
                <span className="an-drawer-post-title">{post.title}</span>
                <span className="an-drawer-post-meta">
                  {post.sentiment && <span className={`an-sentiment-mini-${post.sentiment}`}>{post.sentiment}</span>}
                  {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Slideover>
    </div>
  );
}
