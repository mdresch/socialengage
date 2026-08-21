'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { computePhraseFrequency, computePhraseHistory, computeLanguageBreakdown, type AnalyticsSummary, type DateRangeFilter } from './analyticsData';

interface ConversationsTabProps {
  summary: AnalyticsSummary;
  range: DateRangeFilter;
}

const LINE_COLORS = ['#2563eb', '#15803d', '#d97706', '#7c3aed', '#dc2626'];

function IconSparkles() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
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

/** Word-cloud size tier — relative to the top (already sorted-descending) real count, never an absolute/fabricated scale. */
function sizeTier(count: number, maxCount: number): 'an-phrase-cloud-xl' | 'an-phrase-cloud-lg' | 'an-phrase-cloud-md' | 'an-phrase-cloud-sm' {
  if (maxCount === 0) return 'an-phrase-cloud-sm';
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 'an-phrase-cloud-xl';
  if (ratio >= 0.5) return 'an-phrase-cloud-lg';
  if (ratio >= 0.25) return 'an-phrase-cloud-md';
  return 'an-phrase-cloud-sm';
}

type ActiveFilter = { type: 'phrase' | 'language'; value: string } | null;

/**
 * Story 8.3 — reuses Story 8.2's own client-side filter-and-recompute
 * pattern: selecting a phrase filters `summary.posts` and recomputes both
 * the word cloud and the history chart from the filtered subset using the
 * same pure functions, fed a filtered slice.
 *
 * Story 8.5 — generalized from a phrase-only filter to a
 * `{ type: 'phrase' | 'language', value }` union, the same shape
 * SentimentTab.tsx's own author/phrase filter already established, so the
 * new Languages widget's click-to-filter follows the identical pattern.
 */
export function ConversationsTab({ summary, range }: ConversationsTabProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredPosts = useMemo(() => {
    if (!activeFilter) return summary.posts;
    return summary.posts.filter((p) =>
      activeFilter.type === 'phrase' ? p.keyPhrases.includes(activeFilter.value) : p.language === activeFilter.value
    );
  }, [summary.posts, activeFilter]);

  const phraseFrequency = activeFilter ? computePhraseFrequency(filteredPosts) : summary.phraseFrequency;
  const topPhrases = useMemo(() => phraseFrequency.slice(0, 5).map((p) => p.phrase), [phraseFrequency]);
  const phraseHistory = activeFilter ? computePhraseHistory(filteredPosts, range, topPhrases) : summary.phraseHistory;
  const languages = activeFilter ? computeLanguageBreakdown(filteredPosts) : summary.languages;

  function togglePhrase(phrase: string) {
    setActiveFilter((prev) => (prev?.type === 'phrase' && prev.value === phrase ? null : { type: 'phrase', value: phrase }));
  }
  function toggleLanguage(code: string) {
    setActiveFilter((prev) => (prev?.type === 'language' && prev.value === code ? null : { type: 'language', value: code }));
  }

  const maxCount = phraseFrequency[0]?.count ?? 0;

  return (
    <div className="an-conversations" id="analytics-conversations-tab">
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
                className={`an-phrase-btn ${sizeTier(p.count, maxCount)}${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? ' an-phrase-btn-active' : ''}`}
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

      <div className="an-widget" id="widget-languages">
        <div className="an-widget-header">
          <span className="an-widget-title">Languages</span>
        </div>
        {languages.length === 0 ? (
          <EmptyState heading="No enriched posts in this range" body="Language appears here once posts have been AI-enriched." />
        ) : (
          <ul className="an-source-detail-list">
            {languages.map((lang) => (
              <li key={lang.code} className="an-source-detail-row">
                <button
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`an-author-row${activeFilter?.type === 'language' && activeFilter.value === lang.code ? ' an-author-row-active' : ''}`}
                >
                  <span>{lang.label}</span>
                  <span className="an-author-count">{lang.count}</span>
                </button>
              </li>
            ))}
          </ul>
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
            {filteredPosts.map((post) => {
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
