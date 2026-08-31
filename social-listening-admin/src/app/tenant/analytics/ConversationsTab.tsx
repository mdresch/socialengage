'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState, Slideover, RelativeTime } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import {
  computePhraseFrequency,
  computePhraseHistory,
  computeLanguageBreakdown,
  computeSourceBreakdownFromFlat,
  computeSentimentSplitFromFlat,
  computeSentimentIndex,
  type AnalyticsSummary,
  type DateRangeFilter,
} from './analyticsData';

interface ConversationsTabProps {
  summary: AnalyticsSummary;
  range: DateRangeFilter;
}

const LINE_COLORS = ['#1e3a8a', '#0d9488', '#16a34a', '#7c3aed', '#dc2626'];

function IconSparkles() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
    </svg>
  );
}

function IconEntityTag() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
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

function PlatformIcon({ providerId }: { providerId: string }) {
  const norm = providerId.toLowerCase().replace(/_/g, '-');
  switch (norm) {
    case 'facebook':
    case 'meta':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'x':
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75c.97 0 1.76.78 1.76 1.75s-.79 1.76-1.76 1.76m1.39 9.74v-8.37H5.07v8.37h2.78z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'gnews':
    case 'google-news':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      );
    case 'newswire':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
        </svg>
      );
  }
}

function sizeTier(count: number, maxCount: number): string {
  if (maxCount === 0) return 'an-phrase-cloud-sm';
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 'an-phrase-cloud-xl';
  if (ratio >= 0.5) return 'an-phrase-cloud-lg';
  if (ratio >= 0.25) return 'an-phrase-cloud-md';
  return 'an-phrase-cloud-sm';
}

type ActiveFilter =
  | { type: 'phrase'; value: string }
  | { type: 'language'; value: string }
  | { type: 'source'; value: string }
  | { type: 'sentiment'; value: string }
  | null;

export function ConversationsTab({ summary, range }: ConversationsTabProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredPosts = useMemo(() => {
    if (!activeFilter) return summary.posts;
    return summary.posts.filter((p) => {
      if (activeFilter.type === 'phrase') return p.keyPhrases.includes(activeFilter.value);
      if (activeFilter.type === 'language') return p.language === activeFilter.value;
      if (activeFilter.type === 'source') return p.providerId === activeFilter.value;
      if (activeFilter.type === 'sentiment') return p.sentiment === activeFilter.value;
      return true;
    });
  }, [summary.posts, activeFilter]);

  const phraseFrequency = activeFilter ? computePhraseFrequency(filteredPosts) : summary.phraseFrequency;
  const topPhrases = useMemo(() => phraseFrequency.slice(0, 5).map((p) => p.phrase), [phraseFrequency]);
  const phraseHistory = activeFilter ? computePhraseHistory(filteredPosts, range, topPhrases) : summary.phraseHistory;
  const languages = activeFilter ? computeLanguageBreakdown(filteredPosts) : summary.languages;
  const sourceBreakdown = useMemo(() => computeSourceBreakdownFromFlat(filteredPosts), [filteredPosts]);

  const sentimentSplit = useMemo(() => computeSentimentSplitFromFlat(filteredPosts), [filteredPosts]);
  const sentimentIndex = useMemo(() => computeSentimentIndex(sentimentSplit), [sentimentSplit]);

  const topSourcePhrases = useMemo(() => {
    const topSource = activeFilter?.type === 'source' ? activeFilter.value : sourceBreakdown[0]?.providerId;
    if (!topSource) return phraseFrequency.slice(5, 18);
    const sourcePosts = filteredPosts.filter((p) => p.providerId === topSource);
    const sf = computePhraseFrequency(sourcePosts, 15);
    return sf.length > 0 ? sf : phraseFrequency.slice(5, 18);
  }, [filteredPosts, activeFilter, sourceBreakdown, phraseFrequency]);

  const trendingPhrases = useMemo(() => {
    return phraseFrequency.slice(3, 15);
  }, [phraseFrequency]);

  function togglePhrase(phrase: string) {
    setActiveFilter((prev) => (prev?.type === 'phrase' && prev.value === phrase ? null : { type: 'phrase', value: phrase }));
  }
  function toggleLanguage(code: string) {
    setActiveFilter((prev) => (prev?.type === 'language' && prev.value === code ? null : { type: 'language', value: code }));
  }
  function toggleSource(sourceId: string) {
    setActiveFilter((prev) => (prev?.type === 'source' && prev.value === sourceId ? null : { type: 'source', value: sourceId }));
  }
  function toggleSentiment(sent: string) {
    setActiveFilter((prev) => (prev?.type === 'sentiment' && prev.value === sent ? null : { type: 'sentiment', value: sent }));
  }

  const maxCount = phraseFrequency[0]?.count ?? 0;
  const totalPostsCount = filteredPosts.length;
  const totalSourceCount = sourceBreakdown.reduce((sum, s) => sum + s.count, 0) || 1;

  function exportData(widgetName: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widgetName.toLowerCase()}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="an-conversations" id="analytics-conversations-tab">
      {/* Active filter chip bar if a filter is active */}
      {activeFilter && (
        <div className="an-overview-chip-bar" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="an-overview-chip">
            <span>Filtered by {activeFilter.type}: <strong>{activeFilter.value}</strong></span>
            <button type="button" onClick={() => setActiveFilter(null)} className="an-overview-chip-dismiss" title="Clear filter">✕</button>
          </div>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="an-overview-grid">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (SENTIMENT & SUMMARY) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-left">
          {/* 1.1 SENTIMENT CARD */}
          <div className="an-widget" id="widget-sentiment">
            <div className="an-widget-header">
              <span className="an-widget-title">Sentiment</span>
              <button
                type="button"
                onClick={() => exportData('Sentiment', { sentimentIndex, sentimentSplit })}
                className="an-conversations-icon-btn"
                title="Export Sentiment Data"
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

                <div className="an-conversations-gauge-center-icon">
                  {sentimentIndex === null || sentimentIndex >= 2.0 ? (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  ) : sentimentIndex >= -2.0 ? (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="8" y1="15" x2="16" y2="15" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  )}
                </div>
              </div>

              <div className="an-conversations-sentiment-breakdown">
                <button
                  type="button"
                  onClick={() => toggleSentiment('positive')}
                  className={`an-conversations-sent-btn an-conversations-sent-pos ${activeFilter?.type === 'sentiment' && activeFilter.value === 'positive' ? 'an-theme-active' : ''}`}
                >
                  +{sentimentSplit.positive} pos
                </button>
                <button
                  type="button"
                  onClick={() => toggleSentiment('neutral')}
                  className={`an-conversations-sent-btn an-conversations-sent-neu ${activeFilter?.type === 'sentiment' && activeFilter.value === 'neutral' ? 'an-theme-active' : ''}`}
                >
                  {sentimentSplit.neutral} neu
                </button>
                <button
                  type="button"
                  onClick={() => toggleSentiment('negative')}
                  className={`an-conversations-sent-btn an-conversations-sent-neg ${activeFilter?.type === 'sentiment' && activeFilter.value === 'negative' ? 'an-theme-active' : ''}`}
                >
                  -{sentimentSplit.negative} neg
                </button>
              </div>
            </div>

            <div className="an-conversations-slider-wrap">
              <div className="an-conversations-slider-labels">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
              </div>
              <div className="an-conversations-slider-track">
                <div
                  className={`an-conversations-slider-fill ${
                    (sentimentIndex ?? 0) >= 0 ? 'an-slider-fill-pos' : 'an-slider-fill-neg'
                  }`}
                  style={{
                    // Slider fills from the centre (50%). Each ±1 unit = 5% from centre.
                    // Positive index fills rightward from 50%; negative fills leftward.
                    width: `${Math.min(50, Math.max(3, Math.abs(sentimentIndex ?? 0) * 5))}%`,
                    marginLeft: (sentimentIndex ?? 0) >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(sentimentIndex ?? 0) * 5)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 1.2 CONVERSATION SUMMARY CARD */}
          <div className="an-widget" id="widget-conversation-summary">
            <div className="an-widget-header">
              <span className="an-widget-title">Volume breakdown</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="an-conversations-icon-btn"
                style={{ fontSize: '0.6875rem', color: 'var(--color-accent)' }}
                title="View matching posts"
              >
                View posts ›
              </button>
            </div>
            <div className="an-conversations-summary-list">
              <div className="an-conversations-summary-row" onClick={() => setDrawerOpen(true)} style={{ cursor: 'pointer' }}>
                <span className="an-conversations-summary-lbl">Total conversations</span>
                <span className="an-conversations-summary-val">{totalPostsCount.toLocaleString()}</span>
              </div>
              <div className="an-conversations-summary-row">
                <span className="an-conversations-summary-lbl">Enriched with phrases</span>
                <span className="an-conversations-summary-val">
                  {filteredPosts.filter((p) => p.keyPhrases && p.keyPhrases.length > 0).length.toLocaleString()}
                </span>
              </div>
              <div className="an-conversations-summary-row">
                <span className="an-conversations-summary-lbl">Active languages</span>
                <span className="an-conversations-summary-val">{languages.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (PHRASES WORD CLOUD HERO & BOTTOM SOURCES) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-centre">
          {/* 2.1 CENTRAL PHRASES WORD CLOUD HERO */}
          <div className="an-widget" id="widget-phrase-cloud">
            <div className="an-widget-header">
              <span className="an-widget-title">Key phrases</span>
              <button
                type="button"
                onClick={() => exportData('KeyPhrases', phraseFrequency)}
                className="an-conversations-icon-btn"
                title="Export Key Phrases Data"
              >
                <IconDownload />
              </button>
            </div>

            {phraseFrequency.length === 0 ? (
              <EmptyState heading="No key phrases in this range" body="Key phrases appear here once posts have been AI-enriched." />
            ) : (
              <div className="an-conversations-cloud-hero">
                {phraseFrequency.map((p) => (
                  <button
                    key={p.phrase}
                    type="button"
                    onClick={() => togglePhrase(p.phrase)}
                    className={`an-conversations-phrase-btn ${sizeTier(p.count, maxCount)}${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? ' an-phrase-btn-active' : ''}`}
                  >
                    <span>{p.phrase}</span>
                    <span className="an-phrase-count">{p.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2.2 BOTTOM ROW: SOURCES & TOP SOURCE PHRASES */}
          <div className="an-centre-bottom-row">
            {/* 2.2.A SOURCES */}
            <div className="an-widget" id="widget-sources">
              <div className="an-widget-header">
                <span className="an-widget-title">Sources</span>
                <button
                  type="button"
                  onClick={() => exportData('Sources', sourceBreakdown)}
                  className="an-conversations-icon-btn"
                  title="Export Sources Data"
                >
                  <IconDownload />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {sourceBreakdown.length === 0 ? (
                  <EmptyState heading="No source data" />
                ) : (
                  sourceBreakdown.map((src) => {
                    const isSelected = activeFilter?.type === 'source' && activeFilter.value === src.providerId;
                    const rawPct = (src.count / totalSourceCount) * 100;
                    return (
                      <button
                        key={src.providerId}
                        type="button"
                        onClick={() => toggleSource(src.providerId)}
                        className={`an-source-row-btn${isSelected ? ' an-source-row-active' : ''}`}
                      >
                        <div className="an-source-identity">
                          <span className={`an-source-icon an-source-icon-${src.providerId}`}>
                            <PlatformIcon providerId={src.providerId} />
                          </span>
                          <span className={`provider-pill provider-pill-${src.providerId}`}>{src.label}</span>
                        </div>

                        <div className="an-source-bar-wrapper">
                          <div className="an-source-bar-track">
                            <div
                              className={`an-source-bar-fill an-source-bar-${src.providerId}`}
                              style={{ width: `${Math.min(100, Math.max(5, rawPct))}%` }}
                            />
                          </div>
                        </div>

                        <div className="an-source-stat-block">
                          <span className="an-source-count">{src.count}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2.2.B TOP SOURCE PHRASES / THEMES */}
            <div className="an-widget" id="widget-source-phrases">
              <div className="an-widget-header">
                <span className="an-widget-title">Top conversation themes</span>
                <button
                  type="button"
                  onClick={() => exportData('Themes', topSourcePhrases)}
                  className="an-conversations-icon-btn"
                  title="Export Themes Data"
                >
                  <IconDownload />
                </button>
              </div>

              <div className="an-conversations-themes-cloud">
                {topSourcePhrases.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No themes detected</span>
                ) : (
                  topSourcePhrases.map((p) => (
                    <button
                      key={p.phrase}
                      type="button"
                      onClick={() => togglePhrase(p.phrase)}
                      className={`an-conversations-theme-tag ${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? 'an-theme-active' : ''}`}
                    >
                      #{p.phrase}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (PHRASES HISTORY, TRENDING, LANGUAGES) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-right">
          {/* 3.1 PHRASES HISTORY */}
          <div className="an-widget" id="widget-phrase-history">
            <div className="an-widget-header">
              <span className="an-widget-title">Top phrases over time</span>
              <button
                type="button"
                onClick={() => exportData('PhrasesHistory', summary.phraseHistory)}
                className="an-conversations-icon-btn"
                title="Export Phrases History Data"
              >
                <IconDownload />
              </button>
            </div>

            <div className="an-conversations-legend">
              {topPhrases.map((phrase, i) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => togglePhrase(phrase)}
                  className={`an-conversations-legend-btn ${activeFilter?.type === 'phrase' && activeFilter.value === phrase ? 'an-legend-active' : ''}`}
                >
                  <span className="an-conversations-legend-dot" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                  <span style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phrase}</span>
                </button>
              ))}
            </div>

            {topPhrases.length === 0 ? (
              <EmptyState heading="No key phrases in this range" />
            ) : (
              <div className="an-chart-wrap" style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.phraseHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                      <Line
                        key={phrase}
                        type="monotone"
                        dataKey={phrase}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={activeFilter?.type === 'phrase' && activeFilter.value === phrase ? 3 : 1.75}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 3.2 TRENDING PHRASES */}
          <div className="an-widget" id="widget-trending-phrases">
            <div className="an-widget-header">
              <span className="an-widget-title">Trending phrases</span>
              <button
                type="button"
                onClick={() => exportData('TrendingPhrases', trendingPhrases)}
                className="an-conversations-icon-btn"
                title="Export Trending Phrases"
              >
                <IconDownload />
              </button>
            </div>

            <div className="an-conversations-trending-cloud">
              {trendingPhrases.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No trending phrases</span>
              ) : (
                trendingPhrases.map((p) => (
                  <button
                    key={p.phrase}
                    type="button"
                    onClick={() => togglePhrase(p.phrase)}
                    className={`an-conversations-trending-btn ${activeFilter?.type === 'phrase' && activeFilter.value === p.phrase ? 'an-trending-active' : ''}`}
                  >
                    {p.phrase}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 3.3 LANGUAGES */}
          <div className="an-widget" id="widget-languages">
            <div className="an-widget-header">
              <span className="an-widget-title">Languages</span>
              <button
                type="button"
                onClick={() => exportData('Languages', languages)}
                className="an-conversations-icon-btn"
                title="Export Languages Data"
              >
                <IconDownload />
              </button>
            </div>

            {languages.length === 0 ? (
              <EmptyState heading="No enriched posts in this range" body="Language appears here once posts have been AI-enriched." />
            ) : (
              <ul className="an-source-detail-list" style={{ gap: 'var(--space-1-5)' }}>
                {languages.slice(0, 5).map((lang) => {
                  const isSelected = activeFilter?.type === 'language' && activeFilter.value === lang.code;
                  return (
                    <li key={lang.code} className="an-source-detail-row" style={{ padding: 'var(--space-1) 0' }}>
                      <button
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={`an-author-row${isSelected ? ' an-author-row-active' : ''}`}
                      >
                        <span>{lang.label}</span>
                        <span className="an-author-count">{lang.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Slideover Drawer for Matching Posts */}
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
                          <IconEntityTag /> {ent}
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
