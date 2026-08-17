'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { computePhraseFrequency, computePhraseHistory, type AnalyticsSummary, type DateRangeFilter } from './analyticsData';

interface ConversationsTabProps {
  summary: AnalyticsSummary;
  range: DateRangeFilter;
}

const LINE_COLORS = ['#2563eb', '#15803d', '#d97706', '#7c3aed', '#dc2626'];

/** Word-cloud size tier — relative to the top (already sorted-descending) real count, never an absolute/fabricated scale. */
function sizeTier(count: number, maxCount: number): 'an-phrase-cloud-xl' | 'an-phrase-cloud-lg' | 'an-phrase-cloud-md' | 'an-phrase-cloud-sm' {
  if (maxCount === 0) return 'an-phrase-cloud-sm';
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 'an-phrase-cloud-xl';
  if (ratio >= 0.5) return 'an-phrase-cloud-lg';
  if (ratio >= 0.25) return 'an-phrase-cloud-md';
  return 'an-phrase-cloud-sm';
}

/**
 * Story 8.3 — reuses Story 8.2's own client-side filter-and-recompute
 * pattern: selecting a phrase filters `summary.posts` and recomputes both
 * the word cloud and the history chart from the filtered subset using the
 * same pure functions, fed a filtered slice.
 */
export function ConversationsTab({ summary, range }: ConversationsTabProps) {
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredPosts = useMemo(() => {
    if (!activePhrase) return summary.posts;
    return summary.posts.filter((p) => p.keyPhrases.includes(activePhrase));
  }, [summary.posts, activePhrase]);

  const phraseFrequency = activePhrase ? computePhraseFrequency(filteredPosts) : summary.phraseFrequency;
  const topPhrases = useMemo(() => phraseFrequency.slice(0, 5).map((p) => p.phrase), [phraseFrequency]);
  const phraseHistory = activePhrase ? computePhraseHistory(filteredPosts, range, topPhrases) : summary.phraseHistory;

  function togglePhrase(phrase: string) {
    setActivePhrase((prev) => (prev === phrase ? null : phrase));
  }

  const maxCount = phraseFrequency[0]?.count ?? 0;

  return (
    <div className="an-conversations" id="analytics-conversations-tab">
      {activePhrase && (
        <div className="an-filter-banner">
          <span>
            Filtered by phrase: <strong>{activePhrase}</strong>
          </span>
          <button type="button" onClick={() => setActivePhrase(null)} className="an-filter-clear">
            Clear filter
          </button>
        </div>
      )}

      <div className="an-widget" id="widget-phrase-cloud">
        <div className="an-widget-header">
          <span className="an-widget-title">Key phrases</span>
        </div>
        {phraseFrequency.length === 0 ? (
          <EmptyState heading="No key phrases in this range" body="Key phrases appear here once posts have been AI-enriched." />
        ) : (
          <div className="an-phrase-cloud">
            {phraseFrequency.map((p) => (
              <button
                key={p.phrase}
                type="button"
                onClick={() => togglePhrase(p.phrase)}
                className={`an-phrase-btn ${sizeTier(p.count, maxCount)}${activePhrase === p.phrase ? ' an-phrase-btn-active' : ''}`}
              >
                {p.phrase} <span className="an-phrase-count">{p.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="an-widget" id="widget-phrase-history">
        <div className="an-widget-header">
          <span className="an-widget-title">Top phrases over time</span>
        </div>
        {topPhrases.length === 0 ? (
          <EmptyState heading="No key phrases in this range" />
        ) : (
          <div className="an-chart-wrap" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.phraseHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                {topPhrases.map((phrase, i) => (
                  <Line key={phrase} type="monotone" dataKey={phrase} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
