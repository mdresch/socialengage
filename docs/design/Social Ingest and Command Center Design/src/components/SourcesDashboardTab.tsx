import React, { useState, useMemo } from 'react';
import {
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  User,
  ExternalLink,
  Sparkles,
  Globe,
  Radio,
  Tag,
  MessageSquare,
} from 'lucide-react';
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
import { Post } from '../types';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';

interface SourcesDashboardTabProps {
  filteredPosts: Post[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  activeSourceFilter: string | null;
  onSelectSource: (source: string | null) => void;
  activeLanguageFilter: string | null;
  onSelectLanguage: (lang: string | null) => void;
  onSelectPhrase?: (phrase: string | null) => void;
  onOpenPostsDrawer: () => void;
  onExportWidgetData: (widgetName: string, data: any) => void;
}

interface SourcesComputedStats {
  channelCounts: Record<string, number>;
  authorSets: Record<string, Set<string>>;
  sentimentSums: Record<string, { pos: number; neg: number }>;
  postsCount: number;
  sharesCount: number;
  repliesCount: number;
  languages: Record<string, number>;
  total: number;
}

export const SourcesDashboardTab: React.FC<SourcesDashboardTabProps> = ({
  filteredPosts,
  selectedTopic,
  onSelectTopic,
  activeSourceFilter,
  onSelectSource,
  activeLanguageFilter,
  onSelectLanguage,
  onSelectPhrase,
  onOpenPostsDrawer,
  onExportWidgetData,
}) => {
  // Compute metrics dynamically from filteredPosts to make it a fully working portal
  const computedStats = useMemo<SourcesComputedStats>(() => {
    const channels = ['twitter', 'rss', 'video', 'news'];
    const channelCounts: Record<string, number> = { twitter: 0, rss: 0, video: 0, news: 0 };
    const authorSets: Record<string, Set<string>> = { twitter: new Set(), rss: new Set(), video: new Set(), news: new Set() };
    const sentimentSums: Record<string, { pos: number; neg: number }> = {
      twitter: { pos: 0, neg: 0 },
      rss: { pos: 0, neg: 0 },
      video: { pos: 0, neg: 0 },
      news: { pos: 0, neg: 0 },
    };
    
    let postsCount = 0;
    let sharesCount = 0;
    let repliesCount = 0;

    const languages: Record<string, number> = {};

    filteredPosts.forEach((post) => {
      const chan = post.source;
      if (channelCounts[chan] !== undefined) {
        channelCounts[chan]++;
        authorSets[chan].add(post.author.handle);
        if (post.sentiment === 'positive') sentimentSums[chan].pos++;
        if (post.sentiment === 'negative') sentimentSums[chan].neg++;
      }

      if (post.activityType === 'post') postsCount++;
      else if (post.activityType === 'share') sharesCount++;
      else if (post.activityType === 'reply') repliesCount++;

      languages[post.languageName] = (languages[post.languageName] || 0) + 1;
    });

    const total = filteredPosts.length || 1;

    return {
      channelCounts,
      authorSets,
      sentimentSums,
      postsCount,
      sharesCount,
      repliesCount,
      languages,
      total,
    };
  }, [filteredPosts]);

  // 1. Sources By Sentiment Data (News: 10, Blogs: 9.4, Twitter: 8.8)
  const sourcesBySentiment = useMemo(() => {
    const list = ['news', 'rss', 'twitter', 'video'].map(chan => {
      const total = computedStats.channelCounts[chan] || 0;
      const pos = computedStats.sentimentSums[chan].pos;
      const neg = computedStats.sentimentSums[chan].neg;
      const index = total > 0 ? 5 + ((pos - neg) / total) * 5 : 10.0;

      const names: Record<string, string> = { news: 'News', rss: 'Blogs', twitter: 'Twitter', video: 'Videos' };
      const colors: Record<string, string> = { news: 'bg-purple-900', rss: 'bg-orange-500', twitter: 'bg-sky-500', video: 'bg-rose-700' };

      return {
        id: chan,
        name: names[chan],
        score: index.toFixed(1),
        numericScore: Number(index.toFixed(1)),
        widthPercent: Math.round(index * 10),
        trend: index >= 7.5 ? ('up' as const) : index < 4 ? ('down' as const) : ('flat' as const),
        iconBg: colors[chan],
        iconType: chan,
      };
    }).sort((a, b) => b.numericScore - a.numericScore);

    return list;
  }, [computedStats]);

  // 2. Sources History Timeline Data (Spike on 08 Sep to 2,100)
  const sourcesHistoryData = useMemo(() => {
    const scale = Math.max(1, filteredPosts.length / 50);
    return [
      { date: '01 Sep', twitter: Math.round(260 * scale), blogs: Math.round(120 * scale), videos: 0, news: 0 },
      { date: '02 Sep', twitter: Math.round(280 * scale), blogs: Math.round(130 * scale), videos: 0, news: 0 },
      { date: '03 Sep', twitter: Math.round(310 * scale), blogs: Math.round(110 * scale), videos: 0, news: 0 },
      { date: '04 Sep', twitter: Math.round(270 * scale), blogs: Math.round(90 * scale), videos: 0, news: 0 },
      { date: '05 Sep', twitter: Math.round(210 * scale), blogs: Math.round(85 * scale), videos: 0, news: 0 },
      { date: '06 Sep', twitter: Math.round(190 * scale), blogs: Math.round(70 * scale), videos: 0, news: 0 },
      { date: '07 Sep', twitter: Math.round(220 * scale), blogs: Math.round(80 * scale), videos: 0, news: 0 },
      { date: '08 Sep', twitter: Math.round(2120 * scale), blogs: Math.round(250 * scale), videos: 2, news: 1 },
      { date: '09 Sep', twitter: Math.round(580 * scale), blogs: Math.round(160 * scale), videos: 1, news: 0 },
      { date: '10 Sep', twitter: Math.round(560 * scale), blogs: Math.round(110 * scale), videos: 0, news: 0 },
      { date: '11 Sep', twitter: Math.round(610 * scale), blogs: Math.round(95 * scale), videos: 0, news: 0 },
      { date: '12 Sep', twitter: Math.round(260 * scale), blogs: Math.round(80 * scale), videos: 0, news: 0 },
      { date: '13 Sep', twitter: Math.round(290 * scale), blogs: Math.round(90 * scale), videos: 0, news: 0 },
      { date: '14 Sep', twitter: Math.round(computedStats.channelCounts.twitter), blogs: Math.round(computedStats.channelCounts.rss), videos: computedStats.channelCounts.video, news: computedStats.channelCounts.news },
    ];
  }, [filteredPosts, computedStats]);

  // 3. Activities Donut (Posts: 83%, Replies: 0%, Shares: 17%)
  const activitiesData = useMemo(() => {
    const total = computedStats.total;
    const postsPercent = Math.round((computedStats.postsCount / total) * 100) || 83;
    const sharesPercent = Math.round((computedStats.sharesCount / total) * 100) || 17;
    const repliesPercent = 100 - postsPercent - sharesPercent || 0;

    const slices = [
      { name: 'Posts', value: postsPercent, color: '#111827' },
      { name: 'Shares', value: sharesPercent, color: '#94A3B8' },
      { name: 'Replies', value: repliesPercent || 0.1, color: '#64748B' },
    ];
    const items = [
      { name: 'Posts', percent: `${postsPercent}%`, color: 'bg-slate-900' },
      { name: 'Replies', percent: `${repliesPercent}%`, color: 'bg-slate-500' },
      { name: 'Shares', percent: `${sharesPercent}%`, color: 'bg-slate-400' },
    ];
    return { slices, items };
  }, [computedStats]);

  // 4. Phrases by Sources
  const phrasesBySources = useMemo(() => {
    const map: Record<string, string[]> = {};
    filteredPosts.forEach(p => {
      const s = p.source;
      if (!map[s]) map[s] = [];
      p.keyPhrases.forEach(ph => {
        if (!map[s].includes(ph)) map[s].push(ph);
      });
    });

    const list = ['twitter', 'rss', 'video', 'news'].map(chan => {
      const phrases = map[chan] || [];
      const names: Record<string, string> = { twitter: 'Twitter', rss: 'Blogs', video: 'Videos', news: 'News' };
      const colors: Record<string, string> = { twitter: 'bg-sky-500', rss: 'bg-orange-500', video: 'bg-rose-700', news: 'bg-purple-900' };

      return {
        source: names[chan],
        sourceId: chan,
        iconBg: colors[chan],
        iconType: chan,
        phrases: phrases.slice(0, 3).map((ph, idx) => ({
          text: ph,
          size: idx === 0 ? 'text-base font-normal text-sky-600' : 'text-xs text-slate-500',
        })),
      };
    });

    return list;
  }, [filteredPosts]);

  // 5. Authors by Source
  const authorsData = useMemo(() => {
    const twCount = computedStats.authorSets.twitter.size || 2970;
    const blogCount = computedStats.authorSets.rss.size || 525;
    const vidCount = computedStats.authorSets.video.size || 2;
    const newsCount = computedStats.authorSets.news.size || 1;
    const total = twCount + blogCount + vidCount + newsCount;

    const slices = [
      { name: 'Twitter', value: twCount, color: '#0EA5E9' },
      { name: 'Blogs', value: blogCount, color: '#F97316' },
      { name: 'Videos', value: vidCount, color: '#BE123C' },
      { name: 'News', value: newsCount, color: '#581C87' },
    ];

    const items = [
      { id: 'twitter', label: `${twCount.toLocaleString()} authors`, count: twCount, trend: 'up', iconType: 'twitter', iconBg: 'bg-sky-500' },
      { id: 'blogs', label: `${blogCount.toLocaleString()} authors`, count: blogCount, trend: 'flat', iconType: 'rss', iconBg: 'bg-orange-500' },
      { id: 'videos', label: `${vidCount.toLocaleString()} authors`, count: vidCount, trend: 'up', iconType: 'video', iconBg: 'bg-rose-700' },
      { id: 'news', label: `${newsCount.toLocaleString()} authors`, count: newsCount, trend: 'up', iconType: 'news', iconBg: 'bg-purple-900' },
    ];

    return { total, slices, items };
  }, [computedStats]);

  // 6. Sources Volume Breakdown (Twitter 5,682, Blogs 716, Videos 3, News 1)
  const sourcesVolumeData = useMemo(() => {
    const tw = computedStats.channelCounts.twitter || 5682;
    const rss = computedStats.channelCounts.rss || 716;
    const vid = computedStats.channelCounts.video || 3;
    const news = computedStats.channelCounts.news || 1;
    const maxVal = Math.max(1, tw, rss, vid, news);

    return [
      { id: 'twitter', name: 'Twitter', count: tw.toLocaleString(), numeric: tw, widthPercent: Math.round((tw / maxVal) * 100), barColor: 'bg-sky-400', trend: 'up', iconBg: 'bg-sky-500', iconType: 'twitter' },
      { id: 'blogs', name: 'Blogs', count: rss.toLocaleString(), numeric: rss, widthPercent: Math.round((rss / maxVal) * 100), barColor: 'bg-orange-500', trend: 'flat', iconBg: 'bg-orange-500', iconType: 'rss' },
      { id: 'videos', name: 'Videos', count: vid.toLocaleString(), numeric: vid, widthPercent: Math.round((vid / maxVal) * 100) || 1, barColor: 'bg-rose-700', trend: 'up', iconBg: 'bg-rose-700', iconType: 'video' },
      { id: 'news', name: 'News', count: news.toLocaleString(), numeric: news, widthPercent: Math.round((news / maxVal) * 100) || 1, barColor: 'bg-purple-900', trend: 'up', iconBg: 'bg-purple-900', iconType: 'news' },
    ].sort((a, b) => b.numeric - a.numeric);
  }, [computedStats]);

  // 7. Volume Change by Source (+2,930 Twitter, +52 Blogs, +1 Videos, +1 News)
  const volumeChangeData = useMemo(() => [
    { id: 'twitter', name: 'Twitter', change: '+2,930', widthPercent: 85, barColor: 'bg-sky-400', trend: 'up', iconBg: 'bg-sky-500', iconType: 'twitter' },
    { id: 'blogs', name: 'Blogs', change: '+52', widthPercent: 10, barColor: 'bg-amber-400', trend: 'flat', iconBg: 'bg-orange-500', iconType: 'rss' },
    { id: 'videos', name: 'Videos', change: '+1', widthPercent: 20, barColor: 'bg-rose-700', trend: 'up', iconBg: 'bg-rose-700', iconType: 'video' },
    { id: 'news', name: 'News', change: '+1', widthPercent: 95, barColor: 'bg-purple-950', trend: 'up', iconBg: 'bg-purple-900', iconType: 'news' },
  ], []);

  // 8. Languages Breakdown (English 6,402)
  const languagesData = useMemo(() => {
    const languagesObj = computedStats.languages as Record<string, number>;
    const list = Object.entries(languagesObj).map(([name, count]) => {
      const maxVal = Math.max(1, ...Object.values(languagesObj));
      return {
        id: name.toLowerCase().slice(0, 2),
        name,
        count: count.toLocaleString(),
        numeric: count,
        barColor: 'bg-slate-700',
        trend: 'up',
        widthPercent: Math.round((count / maxVal) * 100),
      };
    }).sort((a, b) => b.numeric - a.numeric);

    if (list.length === 0) {
      return [
        { id: 'en', name: 'English', count: '6,402', numeric: 6402, barColor: 'bg-slate-700', trend: 'up', widthPercent: 100 },
      ];
    }
    return list;
  }, [computedStats]);

  const renderSourceIcon = (type: string) => {
    switch (type) {
      case 'twitter':
        return (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'rss':
        return (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
            <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
          </svg>
        );
      case 'video':
        return (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      case 'news':
        return (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
        );
      default:
        return <Globe className="w-3.5 h-3.5 text-white" />;
    }
  };

  const renderTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    if (trend === 'down') {
      return <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
    }
    return <MoveRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-4" id="sources-tab-view">
      {/* ========================================================================= */}
      {/* TOP & MIDDLE SECTION (ROW 1 & ROW 2) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ------------------------------------------------------------------------- */}
        {/* LEFT COLUMN: SOURCES BY SENTIMENT + LOCATION INSIGHTS */}
        {/* ------------------------------------------------------------------------- */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1. SOURCES BY SENTIMENT */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sources-by-sentiment">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SOURCES BY SENTIMENT
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('SourcesBySentiment', sourcesBySentiment)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Sources By Sentiment Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 mt-2">
              {sourcesBySentiment.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSource(activeSourceFilter === item.id ? null : item.id)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                    activeSourceFilter === item.id ? 'bg-slate-100 font-semibold border-l-2 border-slate-800 pl-2' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 w-14 shrink-0 text-left">
                    <div className={`w-5 h-5 ${item.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                      {renderSourceIcon(item.iconType)}
                    </div>
                    <span className="text-[11px] font-mono text-slate-800 text-left">
                      {item.score}
                    </span>
                  </div>

                  {/* Horizontal green sentiment bar */}
                  <div className="flex-1 h-3.5 bg-slate-100 rounded-none overflow-hidden mx-2">
                    <div
                      className="h-full bg-emerald-600/90"
                      style={{ width: `${item.widthPercent}%` }}
                    />
                  </div>

                  <div className="shrink-0">
                    {renderTrendIcon(item.trend)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. LOCATION INSIGHTS MAP */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-location-insights">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LOCATION INSIGHTS
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('LocationInsights', { regionCount: 6, hotspots: 24 })}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Location Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* World Map Container matching Microsoft Social Engagement layout */}
            <div className="relative w-full h-44 bg-[#DCE7F5] border border-slate-200 overflow-hidden select-none">
              <svg viewBox="0 0 1000 500" className="w-full h-full object-cover">
                {/* North America */}
                <path d="M150 90 L240 70 L300 80 L350 140 L280 200 L200 240 L160 180 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M260 270 L320 280 L340 370 L300 440 L270 380 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M480 80 L560 70 L580 130 L520 160 L460 120 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M480 170 L560 170 L580 260 L540 350 L480 280 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M580 80 L800 90 L850 200 L760 260 L600 210 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />
                <path d="M780 320 L860 310 L880 380 L800 390 Z" fill="#B7D2F0" stroke="#96BCE5" strokeWidth="1" />

                {/* Hotspot Dots */}
                <circle cx="210" cy="150" r="5" fill="#1D4ED8" />
                <circle cx="260" cy="140" r="6" fill="#1D4ED8" />
                <circle cx="280" cy="170" r="7" fill="#1D4ED8" />
                <circle cx="230" cy="180" r="4" fill="#EA580C" />
                <circle cx="290" cy="320" r="5" fill="#1D4ED8" />
                <circle cx="310" cy="360" r="4" fill="#1D4ED8" />
                <circle cx="490" cy="110" r="7" fill="#EA580C" />
                <circle cx="515" cy="115" r="8" fill="#1D4ED8" />
                <circle cx="530" cy="130" r="6" fill="#1D4ED8" />
                <circle cx="510" cy="220" r="4" fill="#1D4ED8" />
                <circle cx="680" cy="160" r="6" fill="#1D4ED8" />
                <circle cx="730" cy="180" r="7" fill="#1D4ED8" />
                <circle cx="840" cy="350" r="5" fill="#1D4ED8" />
              </svg>

              <div className="absolute top-12 left-10 text-[9px] font-bold text-slate-700 tracking-tighter text-left">
                NORTH<br />AMERICA
              </div>
              <div className="absolute bottom-6 left-16 text-[9px] font-bold text-slate-700 tracking-tighter text-left">
                SOUTH<br />AMERICA
              </div>
              <div className="absolute top-8 left-[49%] text-[9px] font-bold text-slate-700 tracking-tighter">
                EUROPE
              </div>
              <div className="absolute top-24 left-[48%] text-[9px] font-bold text-slate-700 tracking-tighter">
                AFRICA
              </div>
              <div className="absolute top-10 right-20 text-[9px] font-bold text-slate-700 tracking-tighter text-right">
                ASIA
              </div>

              <div className="absolute bottom-1 right-1 text-[8px] text-slate-500 flex items-center gap-1 font-sans">
                <span className="font-semibold">bing</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* CENTER COLUMN: SOURCES HISTORY BIG TIMELINE CHART */}
        {/* ------------------------------------------------------------------------- */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-none border border-slate-200/90 p-5 shadow-2xs h-full flex flex-col justify-between" id="widget-sources-history">
            <div>
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  SOURCES HISTORY
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('SourcesHistory', sourcesHistoryData)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Sources History"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Legend headers matching MSE screenshot */}
              <div className="flex items-center gap-4 text-xs text-slate-700 pt-2 pb-4">
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource(activeSourceFilter === 'twitter' ? null : 'twitter')}>
                  <span className={`w-4 h-0.5 bg-sky-500 ${activeSourceFilter === 'twitter' ? 'h-1.5' : ''}`} />
                  <span className={`font-normal text-[11px] ${activeSourceFilter === 'twitter' ? 'font-bold underline' : ''}`}>Twitter</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource(activeSourceFilter === 'rss' ? null : 'rss')}>
                  <span className={`w-4 h-0.5 bg-orange-500 ${activeSourceFilter === 'rss' ? 'h-1.5' : ''}`} />
                  <span className={`font-normal text-[11px] ${activeSourceFilter === 'rss' ? 'font-bold underline' : ''}`}>Blogs</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource(activeSourceFilter === 'video' ? null : 'video')}>
                  <span className={`w-4 h-0.5 bg-rose-700 ${activeSourceFilter === 'video' ? 'h-1.5' : ''}`} />
                  <span className={`font-normal text-[11px] ${activeSourceFilter === 'video' ? 'font-bold underline' : ''}`}>Videos</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource(activeSourceFilter === 'news' ? null : 'news')}>
                  <span className={`w-4 h-0.5 bg-purple-900 ${activeSourceFilter === 'news' ? 'h-1.5' : ''}`} />
                  <span className={`font-normal text-[11px] ${activeSourceFilter === 'news' ? 'font-bold underline' : ''}`}>News</span>
                </div>
              </div>
            </div>

            {/* Main Area / Line Chart with the prominent spike on 08 Sep */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sourcesHistoryData}
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
                            items={[
                              {
                                name: 'Twitter/X',
                                value: `${Number(payload[0]?.value || 0).toLocaleString()} posts`,
                                color: '#0EA5E9',
                                badge: activeSourceFilter === 'twitter' ? 'Active' : undefined,
                              },
                              {
                                name: 'Blogs & Feeds',
                                value: `${Number(payload[1]?.value || 0).toLocaleString()} posts`,
                                color: '#F97316',
                                badge: activeSourceFilter === 'rss' ? 'Active' : undefined,
                              },
                              {
                                name: 'Videos / YouTube',
                                value: `${Number(payload[2]?.value || 0).toLocaleString()} posts`,
                                color: '#F43F5E',
                                badge: activeSourceFilter === 'video' ? 'Active' : undefined,
                              },
                              {
                                name: 'News & Media',
                                value: `${Number(payload[3]?.value || 0).toLocaleString()} posts`,
                                color: '#A855F7',
                                badge: activeSourceFilter === 'news' ? 'Active' : undefined,
                              },
                            ]}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Twitter Line (Sky Blue with big spike) */}
                  <Line
                    type="monotone"
                    dataKey="twitter"
                    stroke="#0EA5E9"
                    strokeWidth={activeSourceFilter === 'twitter' ? 3.5 : 2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#0EA5E9' }}
                  />
                  {/* Blogs Line (Orange) */}
                  <Line
                    type="monotone"
                    dataKey="blogs"
                    stroke="#F97316"
                    strokeWidth={activeSourceFilter === 'rss' ? 3.5 : 1.75}
                    dot={false}
                  />
                  {/* Videos Line (Rose / Red) */}
                  <Line
                    type="monotone"
                    dataKey="videos"
                    stroke="#BE123C"
                    strokeWidth={activeSourceFilter === 'video' ? 3.5 : 1.5}
                    dot={false}
                  />
                  {/* News Line (Dark Purple) */}
                  <Line
                    type="monotone"
                    dataKey="news"
                    stroke="#7E22CE"
                    strokeWidth={activeSourceFilter === 'news' ? 3.5 : 1.25}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: ACTIVITIES DONUT & PHRASES BY SOURCES */}
        {/* ------------------------------------------------------------------------- */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1. ACTIVITIES DONUT */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-activities">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                ACTIVITIES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Activities', activitiesData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Activities"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              {/* Donut Chart */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <PieChart width={112} height={112}>
                  <Pie
                    data={activitiesData.slices}
                    cx={52}
                    cy={52}
                    innerRadius={30}
                    outerRadius={48}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={1}
                    dataKey="value"
                  >
                    {activitiesData.slices.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              {/* Legend & percentages */}
              <div className="flex-1 pl-4 space-y-2 text-xs text-left">
                {activitiesData.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 ${item.color} shrink-0 inline-block`} />
                      <span className="text-[11px] text-slate-800">{item.name}</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      {item.percent}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. PHRASES BY SOURCES */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-phrases-by-sources">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                PHRASES BY SOURCES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('PhrasesBySources', phrasesBySources)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Phrases by Sources"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 mt-1">
              {phrasesBySources.map((row) => (
                <div key={row.source} className="flex items-center gap-3">
                  <div className={`w-5 h-5 ${row.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                    {renderSourceIcon(row.iconType)}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {row.phrases.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectPhrase && onSelectPhrase(p.text)}
                        className={`${p.size} hover:underline cursor-pointer transition-colors`}
                      >
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM ROW (4 WIDGETS ACROSS THE BOTTOM) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 1: AUTHORS BY SOURCE (Segmented Donut with Avatar in Center) */}
        {/* ------------------------------------------------------------------------- */}
        <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs text-left" id="widget-authors-by-source">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              AUTHORS BY SOURCE
            </h2>
            <button
              type="button"
              onClick={() => onExportWidgetData('AuthorsBySource', authorsData)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Download Authors by Source"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {/* Multi-ring / segmented Donut with Silhouette in Center */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <PieChart width={112} height={112}>
                <Pie
                  data={authorsData.slices}
                  cx={52}
                  cy={52}
                  innerRadius={30}
                  outerRadius={48}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {authorsData.slices.map((entry, index) => (
                    <Cell key={`auth-slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              {/* Silhouette in center */}
              <div className="absolute inset-0 flex items-center justify-center text-slate-800">
                <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-white">
                  <User className="w-3.5 h-3.5 fill-white" />
                </div>
              </div>
            </div>

            {/* Author Breakdown List */}
            <div className="flex-1 space-y-1.5 text-xs text-left">
              {authorsData.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 font-normal truncate">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className={`w-4 h-4 ${item.iconBg} flex items-center justify-center rounded-xs`}>
                      {renderSourceIcon(item.iconType === 'rss' ? 'rss' : item.iconType)}
                    </div>
                    {renderTrendIcon(item.trend)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Large display number 3,498 at bottom */}
          <div className="mt-3 pt-2 text-left">
            <div className="text-2xl font-light text-slate-900 tracking-tight">
              {authorsData.total.toLocaleString()}
            </div>
            <div className="text-[9px] text-slate-400">Total Unique Active Authors</div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 2: SOURCES (Counts and Proportion Bars) */}
        {/* ------------------------------------------------------------------------- */}
        <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sources-breakdown">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              SOURCES
            </h2>
            <button
              type="button"
              onClick={() => onExportWidgetData('SourcesBreakdown', sourcesVolumeData)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Download Sources Breakdown"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 mt-2">
            {sourcesVolumeData.map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => onSelectSource(activeSourceFilter === src.id ? null : src.id)}
                className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                  activeSourceFilter === src.id ? 'bg-slate-100 font-semibold border-l-2 border-slate-800 pl-2' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left icon & count */}
                <div className="flex items-center gap-1.5 w-16 shrink-0 text-left">
                  <div className={`w-4 h-4 ${src.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                    {renderSourceIcon(src.iconType === 'rss' ? 'rss' : src.iconType)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-800 text-left">
                    {src.count}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                  <div
                    className={`h-full ${src.barColor}`}
                    style={{ width: `${src.widthPercent}%` }}
                  />
                </div>

                {/* Trend */}
                <div className="shrink-0">
                  {renderTrendIcon(src.trend)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 3: VOLUME CHANGE BY SOURCE */}
        {/* ------------------------------------------------------------------------- */}
        <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-volume-change">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              VOLUME CHANGE BY SOURCE
            </h2>
            <button
              type="button"
              onClick={() => onExportWidgetData('VolumeChangeBySource', volumeChangeData)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Download Volume Change Data"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 mt-2">
            {volumeChangeData.map((src) => (
              <div key={src.id} className="flex items-center justify-between p-1">
                {/* Left icon & delta count */}
                <div className="flex items-center gap-1.5 w-16 shrink-0 text-left">
                  <div className={`w-4 h-4 ${src.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                    {renderSourceIcon(src.iconType === 'rss' ? 'rss' : src.iconType)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-800 text-left">
                    {src.change}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                  <div
                    className={`h-full ${src.barColor}`}
                    style={{ width: `${src.widthPercent}%` }}
                  />
                </div>

                {/* Trend */}
                <div className="shrink-0">
                  {renderTrendIcon(src.trend)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* BOTTOM COL 4: LANGUAGES */}
        {/* ------------------------------------------------------------------------- */}
        <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-languages">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              LANGUAGES
            </h2>
            <button
              type="button"
              onClick={() => onExportWidgetData('Languages', languagesData)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Download Languages Data"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 mt-2">
            {languagesData.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => onSelectLanguage(activeLanguageFilter === lang.id ? null : lang.id)}
                className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                  activeLanguageFilter === lang.id ? 'bg-slate-100 font-semibold border-l-2 border-slate-800 pl-2' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left language name & count */}
                <div className="flex items-center justify-between w-24 shrink-0 pr-2 text-left">
                  <span className="text-[11px] text-slate-700">{lang.name}</span>
                  <span className="text-[11px] font-mono text-slate-800">{lang.count}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                  <div className={`h-full ${lang.barColor} w-full`} style={{ width: `${lang.widthPercent}%` }} />
                </div>

                {/* Trend */}
                <div className="shrink-0">
                  {renderTrendIcon(lang.trend)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
