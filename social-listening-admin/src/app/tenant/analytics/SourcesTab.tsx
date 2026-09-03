'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { EmptyState } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import type { AnalyticsSummary, DateRangeFilter } from './analyticsData';
import type { FlatPost } from '../posts/postDisplay';
import { PostDetailPanel } from '../posts/PostDetailPanel';

interface SourcesTabProps {
  summary: AnalyticsSummary;
  previousSummary?: AnalyticsSummary | null;
  range?: DateRangeFilter;
  onViewPost?: (post: FlatPost) => void;
}

const PROVIDER_CONFIG: Record<
  string,
  { label: string; color: string; barColor: string; iconType: string }
> = {
  twitter: { label: 'Twitter / X', color: '#0ea5e9', barColor: '#0ea5e9', iconType: 'twitter' },
  x: { label: 'Twitter / X', color: '#0ea5e9', barColor: '#0ea5e9', iconType: 'twitter' },
  gnews: { label: 'News (GNews)', color: '#7e22ce', barColor: '#7e22ce', iconType: 'news' },
  news: { label: 'News & Media', color: '#7e22ce', barColor: '#7e22ce', iconType: 'news' },
  newswire: { label: 'Newswire PR', color: '#9333ea', barColor: '#9333ea', iconType: 'news' },
  'tenant-owned-feed': { label: 'Blogs & RSS', color: '#f97316', barColor: '#f97316', iconType: 'rss' },
  blogs: { label: 'Blogs & Feeds', color: '#f97316', barColor: '#f97316', iconType: 'rss' },
  rss: { label: 'RSS Feeds', color: '#f97316', barColor: '#f97316', iconType: 'rss' },
  youtube: { label: 'Videos (YouTube)', color: '#be123c', barColor: '#be123c', iconType: 'video' },
  videos: { label: 'Videos', color: '#be123c', barColor: '#be123c', iconType: 'video' },
  facebook: { label: 'Facebook', color: '#1877f2', barColor: '#1877f2', iconType: 'facebook' },
  reddit: { label: 'Reddit', color: '#ff4500', barColor: '#ff4500', iconType: 'reddit' },
  linkedin: { label: 'LinkedIn', color: '#0a66c2', barColor: '#0a66c2', iconType: 'linkedin' },
  instagram: { label: 'Instagram', color: '#e1306c', barColor: '#e1306c', iconType: 'instagram' },
  tiktok: { label: 'TikTok', color: '#0f172a', barColor: '#0f172a', iconType: 'tiktok' },
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese',
  ar: 'Arabic',
  ru: 'Russian',
  hi: 'Hindi',
  ko: 'Korean',
  id: 'Indonesian',
};

function getProviderMeta(providerId: string, fallbackLabel?: string) {
  const norm = (providerId || '').toLowerCase().replace(/_/g, '-');
  return (
    PROVIDER_CONFIG[norm] || {
      label: fallbackLabel || providerId || 'Other',
      color: '#475569',
      barColor: '#475569',
      iconType: 'globe',
    }
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

function IconUser() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ProviderIcon({ type }: { type: string }) {
  switch (type) {
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'rss':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'news':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'reddit':
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffffff">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      );
  }
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0.05) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <title>{`+${delta.toFixed(1)}`}</title>
        <polyline points="7 17 17 7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    );
  }
  if (delta < -0.05) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <title>{`${delta.toFixed(1)}`}</title>
        <polyline points="7 7 17 17" />
        <polyline points="17 7 17 17 7 17" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <title>No change</title>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function SourcesTab({ summary, previousSummary, range, onViewPost }: SourcesTabProps) {
  if (!summary.sources || summary.sources.length === 0) {
    return (
      <EmptyState
        heading="No posts in this range"
        body="Try a wider date range, or connect a platform to start ingesting content."
      />
    );
  }

  const posts = summary.posts || [];
  const prevPosts = previousSummary?.posts || [];

  // Active filters
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(null);
  const [activeLanguageFilter, setActiveLanguageFilter] = useState<string | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePost, setActivePost] = useState<FlatPost | null>(null);

  // 1. Sources by Sentiment Breakdown
  const sourcesBySentiment = useMemo(() => {
    const maxScore = Math.max(1, ...summary.sources.map((s) => s.sentimentIndex ?? 0));
    return summary.sources.map((source) => {
      const meta = getProviderMeta(source.providerId, source.label);
      const score = source.sentimentIndex !== null ? source.sentimentIndex : 0;
      const scoreStr = source.sentimentIndex !== null ? source.sentimentIndex.toFixed(1) : '—';
      const widthPercent = Math.min(100, Math.max(10, Math.round((Math.max(0, score) / 10) * 100)));
      return {
        id: source.providerId,
        name: source.label,
        score: scoreStr,
        numericScore: score,
        widthPercent,
        color: meta.color,
        iconType: meta.iconType,
        count: source.count,
        trend: score > 0 ? 'up' : score < 0 ? 'down' : 'flat',
      };
    }).sort((a, b) => b.count - a.count);
  }, [summary.sources]);

  // 2. Activities Donut (Posts vs Shares vs Replies)
  const activitiesData = useMemo(() => {
    let postsCount = 0;
    let sharesCount = 0;
    let repliesCount = 0;

    for (const p of posts) {
      const raw = (p as any).rawPayload as Record<string, unknown> | undefined;
      const isRetweet = Boolean(raw?.retweeted_status || raw?.referenced_tweets);
      const isReply = Boolean(raw?.in_reply_to_status_id || raw?.parent_id);

      if (isRetweet) sharesCount += 1;
      else if (isReply) repliesCount += 1;
      else postsCount += 1;
    }

    const total = posts.length || 1;
    const postsPct = Math.round((postsCount / total) * 100);
    const sharesPct = Math.round((sharesCount / total) * 100);
    const repliesPct = Math.max(0, 100 - postsPct - sharesPct);

    const slices = [
      { name: 'Posts', value: postsCount || 1, percent: `${postsPct}%`, color: '#0f172a' },
      { name: 'Shares', value: sharesCount, percent: `${sharesPct}%`, color: '#94a3b8' },
      { name: 'Replies', value: repliesCount, percent: `${repliesPct}%`, color: '#64748b' },
    ];

    return { slices, total, postsCount, sharesCount, repliesCount };
  }, [posts]);

  // 3. Phrases by Sources
  const phrasesBySources = useMemo(() => {
    const map = new Map<string, { source: string; providerId: string; phrases: Map<string, number> }>();

    for (const p of posts) {
      const prov = (p.providerId || 'other').toLowerCase();
      const meta = getProviderMeta(prov);
      const entry = map.get(prov) || { source: meta.label, providerId: prov, phrases: new Map() };
      for (const phrase of (p.keyPhrases || [])) {
        entry.phrases.set(phrase, (entry.phrases.get(phrase) || 0) + 1);
      }
      map.set(prov, entry);
    }

    return Array.from(map.values()).map((item) => {
      const topPhrases = Array.from(item.phrases.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([text, count]) => ({ text, count }));
      const meta = getProviderMeta(item.providerId);
      return {
        source: item.source,
        providerId: item.providerId,
        color: meta.color,
        iconType: meta.iconType,
        phrases: topPhrases,
      };
    }).filter((i) => i.phrases.length > 0).slice(0, 4);
  }, [posts]);

  // 4. Authors by Source
  const authorsData = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of posts) {
      const prov = (p.providerId || 'other').toLowerCase();
      const author = p.author || p.id;
      if (!map.has(prov)) map.set(prov, new Set());
      map.get(prov)!.add(author);
    }

    let totalUnique = 0;
    const slices: Array<{ name: string; value: number; color: string }> = [];
    const items: Array<{ id: string; label: string; count: number; color: string; iconType: string }> = [];

    Array.from(map.entries()).forEach(([prov, set]) => {
      const meta = getProviderMeta(prov);
      const count = set.size;
      totalUnique += count;
      slices.push({ name: meta.label, value: count, color: meta.color });
      items.push({ id: prov, label: `${count.toLocaleString()} authors`, count, color: meta.color, iconType: meta.iconType });
    });

    return { total: totalUnique || posts.length, slices, items };
  }, [posts]);

  // 5. Sources Volume Breakdown (with percentage bars)
  const sourcesVolumeData = useMemo(() => {
    const maxVal = Math.max(1, ...summary.sources.map((s) => s.count));
    return summary.sources.map((source) => {
      const meta = getProviderMeta(source.providerId, source.label);
      return {
        id: source.providerId,
        name: source.label,
        count: source.count.toLocaleString(),
        numeric: source.count,
        widthPercent: Math.round((source.count / maxVal) * 100),
        color: meta.color,
        iconType: meta.iconType,
        trend: 'up',
      };
    }).sort((a, b) => b.numeric - a.numeric);
  }, [summary.sources]);

  // 6. Volume Change by Source (Comparison vs previous period)
  const volumeChangeData = useMemo(() => {
    const prevMap = new Map<string, number>();
    for (const p of prevPosts) {
      const prov = (p.providerId || 'other').toLowerCase();
      prevMap.set(prov, (prevMap.get(prov) || 0) + 1);
    }

    const maxVal = Math.max(1, ...summary.sources.map((s) => s.count));
    return summary.sources.map((source) => {
      const prevCount = prevMap.get(source.providerId.toLowerCase()) || 0;
      const delta = source.count - prevCount;
      const deltaStr = delta >= 0 ? `+${delta.toLocaleString()}` : `${delta.toLocaleString()}`;
      const meta = getProviderMeta(source.providerId, source.label);
      return {
        id: source.providerId,
        name: source.label,
        change: deltaStr,
        numericDelta: delta,
        widthPercent: Math.min(100, Math.max(10, Math.round((Math.abs(delta) / maxVal) * 100))),
        color: meta.color,
        iconType: meta.iconType,
        trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      };
    });
  }, [summary.sources, prevPosts]);

  // 7. Languages Breakdown
  const languagesData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) {
      const lang = (p.language || 'en').toLowerCase();
      map.set(lang, (map.get(lang) || 0) + 1);
    }
    const maxVal = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .map(([code, count]) => ({
        id: code,
        name: LANGUAGE_NAMES[code] || code.toUpperCase(),
        count: count.toLocaleString(),
        numeric: count,
        widthPercent: Math.round((count / maxVal) * 100),
        trend: 'up',
      }))
      .sort((a, b) => b.numeric - a.numeric);
  }, [posts]);

  // Filtered posts for drawer
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (activeSourceFilter && (p.providerId || '').toLowerCase() !== activeSourceFilter.toLowerCase()) {
        return false;
      }
      if (activeLanguageFilter && (p.language || 'en').toLowerCase() !== activeLanguageFilter.toLowerCase()) {
        return false;
      }
      if (selectedPhrase && !(p.keyPhrases || []).includes(selectedPhrase)) {
        return false;
      }
      return true;
    });
  }, [posts, activeSourceFilter, activeLanguageFilter, selectedPhrase]);

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
    <div className="an-sources-tab-root" id="analytics-sources-tab" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ========================================================================= */}
      {/* TOP SECTION (ROW 1 & ROW 2: 3 COLUMNS) */}
      {/* ========================================================================= */}
      <div className="an-overview-grid">
        {/* ------------------------------------------------------------------------- */}
        {/* LEFT COLUMN: SOURCES BY SENTIMENT + LOCATION INSIGHTS */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-overview-col an-overview-col-left" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* 1. SOURCES BY SENTIMENT */}
          <div className="an-widget" id="widget-sources-by-sentiment">
            <div className="an-widget-header">
              <span className="an-widget-title">SOURCES BY SENTIMENT</span>
              <button
                type="button"
                onClick={() => exportData('SourcesBySentiment', sourcesBySentiment)}
                className="an-conversations-icon-btn"
                title="Download Sources By Sentiment Data"
              >
                <IconDownload />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
              {sourcesBySentiment.map((item) => {
                const isSelected = activeSourceFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSourceFilter(isSelected ? null : item.id)}
                    className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 75, flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, flexShrink: 0 }}>
                        <ProviderIcon type={item.iconType} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.score}</span>
                    </div>

                    <div style={{ flex: 1, height: 12, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 8px' }}>
                      <div style={{ height: '100%', width: `${item.widthPercent}%`, background: '#15803d', transition: 'width 200ms ease' }} />
                    </div>

                    <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                      <TrendArrow delta={item.numericScore} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. LOCATION INSIGHTS MINI MAP */}
          <div className="an-widget" id="widget-location-insights">
            <div className="an-widget-header">
              <span className="an-widget-title">LOCATION INSIGHTS</span>
              <button
                type="button"
                onClick={() => exportData('LocationInsights', { sources: summary.sources.length })}
                className="an-conversations-icon-btn"
                title="Download Location Data"
              >
                <IconDownload />
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 160,
                background: '#DCE7F5',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                userSelect: 'none',
                marginTop: 'var(--space-1)',
              }}
            >
              <svg viewBox="0 0 1000 500" style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
                <path d="M150 90 L240 70 L300 80 L350 140 L280 200 L200 240 L160 180 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M260 270 L320 280 L340 370 L300 440 L270 380 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M480 80 L560 70 L580 130 L520 160 L460 120 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M480 170 L560 170 L580 260 L540 350 L480 280 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M580 80 L800 90 L850 200 L760 260 L600 210 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M780 320 L860 310 L880 380 L800 390 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />

                {/* Hotspot Dots */}
                <circle cx="260" cy="140" r="6" fill="#1D4ED8" />
                <circle cx="280" cy="170" r="7" fill="#1D4ED8" />
                <circle cx="230" cy="180" r="4" fill="#EA580C" />
                <circle cx="490" cy="110" r="7" fill="#EA580C" />
                <circle cx="515" cy="115" r="8" fill="#1D4ED8" />
                <circle cx="730" cy="180" r="7" fill="#1D4ED8" />
                <circle cx="810" cy="170" r="6" fill="#1D4ED8" />
              </svg>

              <div style={{ position: 'absolute', top: 8, left: 8, fontSize: '0.5625rem', fontWeight: 700, color: '#334155', letterSpacing: '0.05em' }}>
                GLOBAL DISPERSION
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* CENTER COLUMN: SOURCES HISTORY BIG TIMELINE CHART */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-overview-col an-overview-col-centre" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="an-widget" id="widget-sources-history" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="an-widget-header">
                <span className="an-widget-title">SOURCES HISTORY</span>
                <button
                  type="button"
                  onClick={() => exportData('SourcesHistory', summary.sourceVolumeHistory)}
                  className="an-conversations-icon-btn"
                  title="Download Sources History"
                >
                  <IconDownload />
                </button>
              </div>

              {/* Interactive Legend Headers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', paddingTop: 'var(--space-1)', paddingBottom: 'var(--space-2)' }}>
                {summary.sources.map((src) => {
                  const meta = getProviderMeta(src.providerId, src.label);
                  const isSelected = activeSourceFilter === src.providerId;
                  return (
                    <div
                      key={src.providerId}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: activeSourceFilter && !isSelected ? 0.45 : 1 }}
                      onClick={() => setActiveSourceFilter(isSelected ? null : src.providerId)}
                    >
                      <span style={{ width: 12, height: 3, background: meta.color, borderRadius: 1 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 400 }}>{src.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Line Chart */}
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summary.sourceVolumeHistory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={`Date: ${label}`}
                            items={payload.map((p) => {
                              const meta = getProviderMeta(String(p.dataKey));
                              return {
                                name: meta.label,
                                value: `${Number(p.value || 0).toLocaleString()} posts`,
                                color: meta.color,
                                valueColor: '#ffffff',
                              };
                            })}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  {summary.sources.map((source) => {
                    const meta = getProviderMeta(source.providerId, source.label);
                    const isSelected = activeSourceFilter === source.providerId;
                    return (
                      <Line
                        key={source.providerId}
                        type="monotone"
                        dataKey={source.providerId}
                        name={source.label}
                        stroke={meta.color}
                        strokeWidth={isSelected ? 3 : 1.75}
                        dot={false}
                        activeDot={{ r: 5, fill: meta.color }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: ACTIVITIES DONUT & PHRASES BY SOURCES */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-overview-col an-overview-col-right" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* 1. ACTIVITIES DONUT */}
          <div className="an-widget" id="widget-activities">
            <div className="an-widget-header">
              <span className="an-widget-title">ACTIVITIES</span>
              <button
                type="button"
                onClick={() => exportData('Activities', activitiesData)}
                className="an-conversations-icon-btn"
                title="Download Activities"
              >
                <IconDownload />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-1)' }}>
              <div style={{ width: 96, height: 96, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={activitiesData.slices}
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={42}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    >
                      {activitiesData.slices.map((entry, index) => (
                        <Cell key={`act-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12 }}>
                {activitiesData.slices.map((item) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                      <span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. PHRASES BY SOURCES */}
          <div className="an-widget" id="widget-phrases-by-sources">
            <div className="an-widget-header">
              <span className="an-widget-title">PHRASES BY SOURCES</span>
              <button
                type="button"
                onClick={() => exportData('PhrasesBySources', phrasesBySources)}
                className="an-conversations-icon-btn"
                title="Download Phrases by Sources"
              >
                <IconDownload />
              </button>
            </div>

            {phrasesBySources.length === 0 ? (
              <EmptyState heading="No phrases by sources" body="Key phrases grouped by source will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                {phrasesBySources.map((row) => (
                  <div key={row.source} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 18, height: 18, background: row.color, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, flexShrink: 0 }}>
                      <ProviderIcon type={row.iconType} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {row.phrases.map((p) => {
                        const isSelected = selectedPhrase === p.text;
                        return (
                          <button
                            key={p.text}
                            type="button"
                            onClick={() => setSelectedPhrase(isSelected ? null : p.text)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: isSelected ? 'var(--color-surface-selected)' : 'rgba(15, 23, 42, 0.04)',
                              border: isSelected ? '1px solid var(--color-accent)' : '1px solid transparent',
                              color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                              borderRadius: 4,
                              padding: '1px 5px',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{p.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM ROW (4 WIDGETS ACROSS THE BOTTOM) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 1: AUTHORS BY SOURCE */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-widget" id="widget-authors-by-source">
          <div className="an-widget-header">
            <span className="an-widget-title">AUTHORS BY SOURCE</span>
            <button
              type="button"
              onClick={() => exportData('AuthorsBySource', authorsData)}
              className="an-conversations-icon-btn"
              title="Download Authors by Source"
            >
              <IconDownload />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 'var(--space-1)' }}>
            <div style={{ width: 88, height: 88, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={authorsData.slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={24}
                    outerRadius={38}
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  >
                    {authorsData.slices.map((entry, index) => (
                      <Cell key={`auth-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                  <IconUser />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
              {authorsData.items.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 14, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                      <ProviderIcon type={item.iconType} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-1)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 300, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {authorsData.total.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>total authors</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 2: SOURCES (Counts and Proportion Bars) */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-widget" id="widget-sources-breakdown">
          <div className="an-widget-header">
            <span className="an-widget-title">SOURCES</span>
            <button
              type="button"
              onClick={() => exportData('SourcesBreakdown', sourcesVolumeData)}
              className="an-conversations-icon-btn"
              title="Download Sources Breakdown"
            >
              <IconDownload />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-1)' }}>
            {sourcesVolumeData.map((src) => {
              const isSelected = activeSourceFilter === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setActiveSourceFilter(isSelected ? null : src.id)}
                  className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 75, flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, background: src.color, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                      <ProviderIcon type={src.iconType} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{src.count}</span>
                  </div>

                  <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 6px' }}>
                    <div style={{ height: '100%', width: `${src.widthPercent}%`, background: src.color, transition: 'width 200ms ease' }} />
                  </div>

                  <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                    <TrendArrow delta={1} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 3: VOLUME CHANGE BY SOURCE */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-widget" id="widget-volume-change">
          <div className="an-widget-header">
            <span className="an-widget-title">VOLUME CHANGE BY SOURCE</span>
            <button
              type="button"
              onClick={() => exportData('VolumeChangeBySource', volumeChangeData)}
              className="an-conversations-icon-btn"
              title="Download Volume Change Data"
            >
              <IconDownload />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-1)' }}>
            {volumeChangeData.map((src) => (
              <div key={src.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 75, flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, background: src.color, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                    <ProviderIcon type={src.iconType} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: src.numericDelta >= 0 ? '#15803d' : '#dc2626' }}>
                    {src.change}
                  </span>
                </div>

                <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 6px' }}>
                  <div style={{ height: '100%', width: `${src.widthPercent}%`, background: src.color, transition: 'width 200ms ease' }} />
                </div>

                <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                  <TrendArrow delta={src.numericDelta} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 4: LANGUAGES */}
        {/* ------------------------------------------------------------------------- */}
        <div className="an-widget" id="widget-languages">
          <div className="an-widget-header">
            <span className="an-widget-title">LANGUAGES</span>
            <button
              type="button"
              onClick={() => exportData('Languages', languagesData)}
              className="an-conversations-icon-btn"
              title="Download Languages Data"
            >
              <IconDownload />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-1)' }}>
            {languagesData.map((lang) => {
              const isSelected = activeLanguageFilter === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setActiveLanguageFilter(isSelected ? null : lang.id)}
                  className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 85, paddingRight: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{lang.name}</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{lang.count}</span>
                  </div>

                  <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 6px' }}>
                    <div style={{ height: '100%', width: `${lang.widthPercent}%`, background: '#334155', transition: 'width 200ms ease' }} />
                  </div>

                  <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                    <TrendArrow delta={1} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Matching Posts Slideover Trigger */}
      <button type="button" className="an-drawer-trigger" onClick={() => setDrawerOpen(true)}>
        View {filteredPosts.length} matching post{filteredPosts.length === 1 ? '' : 's'}
      </button>

      {/* Slideover Drawer for Matching Posts */}
      {drawerOpen && (
        <div className="an-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="an-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="an-drawer-header">
              <h3>
                {activeSourceFilter
                  ? `Posts from ${getProviderMeta(activeSourceFilter).label}`
                  : activeLanguageFilter
                  ? `Posts in ${LANGUAGE_NAMES[activeLanguageFilter] || activeLanguageFilter}`
                  : selectedPhrase
                  ? `Posts mentioning "${selectedPhrase}"`
                  : 'All Source Posts'}{' '}
                ({filteredPosts.length})
              </h3>
              <button type="button" className="an-drawer-close" onClick={() => setDrawerOpen(false)}>
                &times;
              </button>
            </div>
            <div className="an-drawer-body">
              {filteredPosts.length === 0 ? (
                <EmptyState heading="No matching posts" body="No posts match the current filter." />
              ) : (
                <div className="an-posts-list">
                  {filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      className="an-post-card"
                      onClick={() => {
                        const flat: FlatPost = {
                          id: post.id,
                          createdAt: post.publishedAt || new Date().toISOString(),
                          publishedAt: post.publishedAt || new Date().toISOString(),
                          rawPayload: {},
                          enrichment: null,
                          bodyMarkdown: null,
                          title: post.title || 'Untitled Post',
                          snippet: null,
                          provider: post.providerId || 'social',
                          url: null,
                          author: post.author,
                          pageName: null,
                          pageId: null,
                          watchlistId: null,
                          instagramContext: null,
                          linkedinContext: null,
                          enrichmentSummary: null,
                        };
                        if (onViewPost) {
                          onViewPost(flat);
                        } else {
                          setActivePost(flat);
                        }
                      }}
                    >
                      <div className="an-post-card-header">
                        <span className="an-post-author">{post.author}</span>
                        <span className={`provider-pill provider-pill-${post.providerId || 'default'}`}>
                          {getProviderMeta(post.providerId || '').label}
                        </span>
                        <span className={`an-sentiment-badge an-badge-${post.sentiment || 'neutral'}`}>
                          {post.sentiment || 'neutral'}
                        </span>
                      </div>
                      <p className="an-post-title">{post.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {activePost && (
        <PostDetailPanel
          post={activePost}
          onClose={() => setActivePost(null)}
        />
      )}
    </div>
  );
}
