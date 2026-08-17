import React, { useState, useMemo } from 'react';
import {
  Smile,
  Frown,
  Meh,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  User,
  Globe,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Post } from '../types';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';

interface SentimentDashboardTabProps {
  filteredPosts: Post[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  activeSourceFilter: string | null;
  onSelectSource: (source: string | null) => void;
  activeAuthorFilter: string | null;
  onSelectAuthor: (author: string | null) => void;
  activePhraseFilter: string | null;
  onSelectPhrase: (phrase: string | null) => void;
  onOpenPostsDrawer: () => void;
  onExportWidgetData: (widgetName: string, data: any) => void;
}

export const SentimentDashboardTab: React.FC<SentimentDashboardTabProps> = ({
  filteredPosts,
  selectedTopic,
  onSelectTopic,
  activeSourceFilter,
  onSelectSource,
  activeAuthorFilter,
  onSelectAuthor,
  activePhraseFilter,
  onSelectPhrase,
  onOpenPostsDrawer,
  onExportWidgetData,
}) => {
  // 1. Sentiment History (Dual Bar + Line Chart: Positive green bars, Negative red bars, Index line, Last week line)
  const sentimentHistoryData = useMemo(() => [
    { date: '13 Oct', positive: 56, negative: -2, index: 8.8, lastWeek: 7.2 },
    { date: '14', positive: 60, negative: -8, index: 8.1, lastWeek: 7.0 },
    { date: '15', positive: 88, negative: -3, index: 8.6, lastWeek: 4.8 },
    { date: '16', positive: 80, negative: -5, index: 9.1, lastWeek: 8.9 },
    { date: '17', positive: 40, negative: 0, index: 9.3, lastWeek: 9.4 },
    { date: '18', positive: 35, negative: 0, index: 9.4, lastWeek: 9.0 },
    { date: '19', positive: 65, negative: 0, index: 9.4, lastWeek: 8.5 },
  ], []);

  // 2. Top Fans (Positive sentiment advocates)
  const topFansData = useMemo(() => [
    {
      id: 'kiefferphilippe',
      handle: 'kiefferphilippe',
      name: 'Philippe Kieffer',
      count: 10,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'businessintelligenceinfo',
      handle: 'businessintelligenceinfo',
      name: '',
      count: 6,
      source: 'rss',
      avatarBg: 'bg-orange-500',
    },
    {
      id: 'bawazir_tech',
      handle: 'bawazir_tech',
      name: 'سعيد باوزير',
      count: 6,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'inogic',
      handle: 'inogic',
      name: 'Inogic',
      count: 5,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'mpucher_CRM',
      handle: 'mpucher_CRM',
      name: 'Michael Pucher',
      count: 5,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
  ], []);

  // 3. Top Critics (Negative sentiment critics)
  const topCriticsData = useMemo(() => [
    {
      id: 'Mdiks1',
      handle: 'Mdiks1',
      name: 'Mdiks',
      count: 2,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'xRMConsultant',
      handle: 'xRMConsultant',
      name: 'xRM Consultant',
      count: 1,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'jodiem',
      handle: 'jodiem',
      name: 'JodieM',
      count: 1,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'mpesce',
      handle: 'mpesce',
      name: 'Mark Pesce',
      count: 1,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
    {
      id: 'absalomedia',
      handle: 'absalomedia',
      name: 'Lawrence Meckan',
      count: 1,
      source: 'twitter',
      avatarBg: 'bg-sky-500',
    },
  ], []);

  // 4. Negative Phrases Word Cloud
  const negativePhrases = useMemo(() => [
    { text: 'manually', size: 'text-xs text-rose-700' },
    { text: 'problem', size: 'text-xs text-rose-700 font-medium' },
    { text: 'job interview', size: 'text-xs text-rose-600' },
    { text: 'owners manual.pdf', size: 'text-xs text-rose-600' },
    { text: 'price', size: 'text-xs text-rose-700' },
    { text: 'manual para', size: 'text-xs text-rose-600' },
    { text: 'quiz questions', size: 'text-xs text-rose-700' },
    { text: 'error code', size: 'text-xs text-rose-600' },
    { text: 'mini', size: 'text-[11px] text-rose-500' },
    { text: 'solution', size: 'text-2xl md:text-3xl text-rose-700 font-normal tracking-tight' },
    { text: 'manual.pdf manual', size: 'text-xs text-rose-600' },
    { text: 'manual.pdf instruction', size: 'text-xs text-rose-700' },
    { text: 'machine', size: 'text-xs text-rose-600' },
    { text: 'manual de', size: 'text-xs text-rose-600' },
    { text: 'pdf.pdf manual', size: 'text-xs text-rose-600' },
    { text: 'really', size: 'text-xs text-rose-700' },
    { text: 'iso', size: 'text-xs text-rose-600' },
    { text: 'guide', size: 'text-xs text-rose-600' },
    { text: 'answers quiz', size: 'text-xs text-rose-700' },
    { text: 'installation', size: 'text-xs text-rose-700' },
  ], []);

  // 5. Positive Phrases Word Cloud
  const positivePhrases = useMemo(() => [
    { text: 'services', size: 'text-sm text-emerald-800' },
    { text: 'knowledge', size: 'text-xl font-normal text-emerald-900' },
    { text: 'use', size: 'text-xs text-emerald-700' },
    { text: 'make', size: 'text-xs text-emerald-700' },
    { text: 'management', size: 'text-2xl font-normal text-emerald-900 tracking-tight' },
    { text: 'also', size: 'text-xs text-emerald-700' },
    { text: 'best', size: 'text-sm text-emerald-800' },
    { text: 'first', size: 'text-xs text-emerald-700' },
    { text: 'software', size: 'text-sm text-emerald-800' },
    { text: 'new', size: 'text-base font-normal text-emerald-800' },
    { text: 'release', size: 'text-2xl font-medium text-emerald-800 tracking-tight' },
    { text: 'can', size: 'text-sm text-emerald-700' },
    { text: 'will', size: 'text-xs text-emerald-700' },
    { text: 'need', size: 'text-xs text-emerald-700' },
    { text: 'support', size: 'text-xs text-emerald-700' },
    { text: 'web', size: 'text-xs text-emerald-700' },
    { text: 'help', size: 'text-sm text-emerald-800' },
    { text: 'new knowledge management', size: 'text-xs font-medium text-emerald-900' },
    { text: 'one', size: 'text-xs text-emerald-700' },
    { text: 'integration', size: 'text-xs text-emerald-800' },
  ], []);

  // 6. Sources By Sentiment (Blogs: 9.6, Twitter: 9.2)
  const sourcesBySentiment = useMemo(() => [
    {
      id: 'blogs',
      name: 'Blogs',
      score: '9.6',
      numericScore: 9.6,
      widthPercent: 96,
      trend: 'up',
      iconType: 'rss',
      iconBg: 'bg-orange-500',
    },
    {
      id: 'twitter',
      name: 'Twitter',
      score: '9.2',
      numericScore: 9.2,
      widthPercent: 92,
      trend: 'flat',
      iconType: 'twitter',
      iconBg: 'bg-sky-500',
    },
  ], []);

  // 7. Sentiment Coverage Donut (Edited sentiment: 0%, System-rated: 100%)
  const sentimentCoverageData = useMemo(() => {
    const slices = [
      { name: 'System-rated', value: 100, color: '#475569' },
      { name: 'Edited sentiment', value: 0, color: '#1E293B' },
    ];
    return { slices };
  }, []);

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
      default:
        return <Globe className="w-3.5 h-3.5 text-white" />;
    }
  };

  const renderTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    if (trend === 'down') {
      return <ArrowDownRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    return <MoveRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
  };

  return (
    <div className="space-y-4" id="sentiment-tab-view">
      {/* 3-COLUMN GRID EXACTLY MATCHING MICROSOFT SOCIAL ENGAGEMENT SENTIMENT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (Location Insights, Top Fans, Top Critics) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1.1 LOCATION INSIGHTS (World Map with Sentiment Dots) */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sentiment-location">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LOCATION INSIGHTS
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('LocationInsights', { sentiment: 'positive_dominant', coverage: 'global' })}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Location Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="relative w-full h-36 bg-[#E2EAF4] border border-slate-200 overflow-hidden select-none">
              <svg viewBox="0 0 1000 500" className="w-full h-full object-cover">
                {/* Landmasses */}
                <path d="M150 90 L240 70 L300 80 L350 140 L280 200 L200 240 L160 180 Z" fill="#C5D8EE" />
                <path d="M260 270 L320 280 L340 370 L300 440 L270 380 Z" fill="#C5D8EE" />
                <path d="M480 80 L560 70 L580 130 L520 160 L460 120 Z" fill="#C5D8EE" />
                <path d="M480 170 L560 170 L580 260 L540 350 L480 280 Z" fill="#C5D8EE" />
                <path d="M580 80 L800 90 L850 200 L760 260 L600 210 Z" fill="#C5D8EE" />
                <path d="M780 320 L860 310 L880 380 L800 390 Z" fill="#C5D8EE" />

                {/* Sentiment Hotspot Circles (Green sentiment dots) */}
                <circle cx="210" cy="160" r="14" fill="#22C55E" opacity="0.85" />
                <circle cx="270" cy="140" r="6" fill="#22C55E" />
                <circle cx="490" cy="110" r="6" fill="#22C55E" />
                <circle cx="520" cy="120" r="7" fill="#22C55E" />
                <circle cx="540" cy="135" r="5" fill="#22C55E" />
                <circle cx="510" cy="230" r="4" fill="#22C55E" />
                <circle cx="730" cy="180" r="7" fill="#22C55E" />
                <circle cx="830" cy="350" r="5" fill="#64748B" />
              </svg>
              <div className="absolute bottom-1 right-1 text-[8px] text-slate-500 font-semibold">bing</div>
            </div>
          </div>

          {/* 1.2 TOP FANS */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-top-fans">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <span>TOP FANS</span>
                <Smile className="w-3.5 h-3.5 text-emerald-600 stroke-2" />
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('TopFans', topFansData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Top Fans"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-1">
              {topFansData.map((fan) => (
                <button
                  key={fan.id}
                  type="button"
                  onClick={() => onSelectAuthor(activeAuthorFilter === fan.handle ? null : fan.handle)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors text-left ${
                    activeAuthorFilter === fan.handle ? 'bg-emerald-50 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className={`w-4 h-4 ${fan.avatarBg} flex items-center justify-center rounded-xs shrink-0`}>
                      {renderSourceIcon(fan.source)}
                    </div>
                    <div className="truncate text-xs">
                      <span className="text-[11px] text-slate-800 font-normal">
                        {fan.handle}
                      </span>
                      {fan.name && (
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({fan.name})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-600 shrink-0 ml-2">
                    {fan.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 1.3 TOP CRITICS */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-top-critics">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <span>TOP CRITICS</span>
                <Frown className="w-3.5 h-3.5 text-rose-600 stroke-2" />
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('TopCritics', topCriticsData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Top Critics"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-1">
              {topCriticsData.map((critic) => (
                <button
                  key={critic.id}
                  type="button"
                  onClick={() => onSelectAuthor(activeAuthorFilter === critic.handle ? null : critic.handle)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors text-left ${
                    activeAuthorFilter === critic.handle ? 'bg-rose-50 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className={`w-4 h-4 ${critic.avatarBg} flex items-center justify-center rounded-xs shrink-0`}>
                      {renderSourceIcon(critic.source)}
                    </div>
                    <div className="truncate text-xs">
                      <span className="text-[11px] text-slate-800 font-normal">
                        {critic.handle}
                      </span>
                      {critic.name && (
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({critic.name})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-rose-600 shrink-0 ml-2">
                    {critic.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (Sentiment History on top, Negative Phrases & Sources below) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* 2.1 SENTIMENT HISTORY (Bar + Line Combined Chart) */}
          <div className="bg-white rounded-none border border-slate-200/90 p-5 shadow-2xs" id="widget-sentiment-history">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT HISTORY
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('SentimentHistory', sentimentHistoryData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Sentiment History Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-700 pt-1 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-[#15803D]" />
                <span className="text-[11px] text-slate-800">Positive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-[#DC2626]" />
                <span className="text-[11px] text-slate-800">Negative</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-slate-800" />
                <span className="text-[11px] text-slate-800">Index</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-slate-400" />
                <span className="text-[11px] text-slate-500">Last week</span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[260px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={sentimentHistoryData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  className="cursor-pointer"
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      // Toggle sentiment filter based on dominant volume clicked or date
                      const posVal = Number(e.activePayload[0]?.value || 0);
                      const negVal = Math.abs(Number(e.activePayload[1]?.value || 0));
                      if (posVal > negVal) {
                        onSelectSource(activeSourceFilter); // keep state intact or toggle sentiment
                      }
                    }
                  }}
                >
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    yAxisId="volume"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    domain={[-100, 100]}
                    ticks={[-100, -50, 0, 50, 100]}
                  />
                  <YAxis
                    yAxisId="index"
                    orientation="right"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    domain={[-10, 10]}
                    ticks={[-10, 0, 10]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={`Date: ${label} (Click bars to filter)`}
                            items={[
                              {
                                name: 'Positive Volume',
                                value: `${payload[0]?.value || 0} posts`,
                                color: '#16A34A',
                              },
                              {
                                name: 'Negative Volume',
                                value: `${Math.abs(Number(payload[1]?.value || 0))} posts`,
                                color: '#DC2626',
                              },
                              {
                                name: 'Sentiment Index',
                                value: payload[2]?.value ?? 0,
                                color: '#0F172A',
                                badge: 'Active Index',
                                badgeColor: 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30',
                              },
                              {
                                name: 'Last Week Benchmark',
                                value: payload[3]?.value ?? 0,
                                color: '#94A3B8',
                              },
                            ]}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Positive volume bars (Green) */}
                  <Bar
                    yAxisId="volume"
                    dataKey="positive"
                    fill="#16A34A"
                    barSize={24}
                    className="cursor-pointer"
                    onClick={() => {
                      // positive bar click
                    }}
                  />
                  {/* Negative volume bars (Red downward) */}
                  <Bar
                    yAxisId="volume"
                    dataKey="negative"
                    fill="#DC2626"
                    barSize={24}
                    className="cursor-pointer"
                    onClick={() => {
                      // negative bar click
                    }}
                  />
                  {/* Index Line (Navy/Slate) */}
                  <Line
                    yAxisId="index"
                    type="monotone"
                    dataKey="index"
                    stroke="#0F172A"
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* Last Week Index Line (Gray) */}
                  <Line
                    yAxisId="index"
                    type="monotone"
                    dataKey="lastWeek"
                    stroke="#94A3B8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2.2 BOTTOM TWO SUB-WIDGETS (Negative Phrases on Left, Sources by Sentiment on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2.2.A NEGATIVE PHRASES WORD CLOUD */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-negative-phrases">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                  <span>NEGATIVE PHRASES</span>
                  <Frown className="w-3.5 h-3.5 text-rose-600 stroke-2" />
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('NegativePhrases', negativePhrases)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Negative Phrases"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="min-h-[170px] flex flex-col justify-center items-center py-2 px-2 select-none">
                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
                  <span onClick={() => onSelectPhrase && onSelectPhrase('manually')} className="text-xs text-rose-700 hover:underline cursor-pointer">manually</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('problem')} className="text-xs text-rose-800 font-semibold hover:underline cursor-pointer">problem</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                  <span onClick={() => onSelectPhrase && onSelectPhrase('job interview')} className="text-xs text-rose-600 hover:underline cursor-pointer">job interview</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('owners manual.pdf')} className="text-xs text-rose-600 hover:underline cursor-pointer">owners manual.pdf</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                  <span onClick={() => onSelectPhrase && onSelectPhrase('price')} className="text-xs text-rose-700 hover:underline cursor-pointer">price</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('manual para')} className="text-xs text-rose-600 hover:underline cursor-pointer">manual para</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('quiz questions')} className="text-xs text-rose-700 hover:underline cursor-pointer">quiz questions</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('error code')} className="text-xs text-rose-700 hover:underline cursor-pointer">error code</span>
                </div>

                {/* Central negative word: solution */}
                <div className="my-1.5 text-center">
                  <span
                    onClick={() => onSelectPhrase && onSelectPhrase('solution')}
                    className="text-2xl font-normal text-rose-700 hover:text-rose-900 cursor-pointer"
                  >
                    solution
                  </span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
                  <span onClick={() => onSelectPhrase && onSelectPhrase('manual.pdf manual')} className="text-xs text-rose-600 hover:underline cursor-pointer">manual.pdf manual</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('manual.pdf instruction')} className="text-xs text-rose-700 hover:underline cursor-pointer">manual.pdf instruction</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center mt-1">
                  <span onClick={() => onSelectPhrase && onSelectPhrase('machine')} className="text-xs text-rose-600 hover:underline cursor-pointer">machine</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('pdf.pdf manual')} className="text-xs text-rose-600 hover:underline cursor-pointer">pdf.pdf manual</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('really')} className="text-xs text-rose-700 hover:underline cursor-pointer">really</span>
                  <span onClick={() => onSelectPhrase && onSelectPhrase('installation')} className="text-xs text-rose-700 hover:underline cursor-pointer">installation</span>
                </div>
              </div>
            </div>

            {/* 2.2.B SOURCES BY SENTIMENT */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sources-by-sentiment-card">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  SOURCES BY SENTIMENT
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('SourcesBySentiment', sourcesBySentiment)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Sources By Sentiment"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4 mt-3">
                {sourcesBySentiment.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => onSelectSource(activeSourceFilter === src.id ? null : src.id)}
                    className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                      activeSourceFilter === src.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-16 shrink-0">
                      <div className={`w-5 h-5 ${src.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                        {renderSourceIcon(src.iconType)}
                      </div>
                      <span className="text-xs font-mono text-slate-800">
                        {src.score}
                      </span>
                    </div>

                    {/* Green Bar */}
                    <div className="flex-1 h-3.5 bg-slate-100 rounded-none overflow-hidden mx-2">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${src.widthPercent}%` }}
                      />
                    </div>

                    <div className="shrink-0">
                      {renderTrendIcon(src.trend)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (Sentiment Coverage, Sentiment Index, Positive Phrases) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* 3.1 SENTIMENT COVERAGE DONUT */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sentiment-coverage">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT COVERAGE
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('SentimentCoverage', sentimentCoverageData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Coverage Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <PieChart width={96} height={96}>
                  <Pie
                    data={sentimentCoverageData.slices}
                    cx={44}
                    cy={44}
                    innerRadius={26}
                    outerRadius={40}
                    dataKey="value"
                  >
                    {sentimentCoverageData.slices.map((entry, index) => (
                      <Cell key={`cov-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              <div className="flex-1 pl-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-900 shrink-0 inline-block" />
                    <span className="text-[11px] text-slate-700">Edited sentiment</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-800 font-semibold">0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-500 shrink-0 inline-block" />
                    <span className="text-[11px] text-slate-700">System-rated</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-800 font-semibold">100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3.2 SENTIMENT GAUGE CARD (Index: 9.4, Change: 0.5 ->) */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sentiment-gauge-card">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Sentiment', { index: 9.4, change: 0.5 })}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Sentiment Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {/* Index score on left */}
              <div className="text-left">
                <div className="text-3xl font-extralight text-slate-900 tracking-tight">
                  9.4
                </div>
                <div className="text-[11px] text-slate-500 font-normal">index</div>
              </div>

              {/* Semicircular smiley gauge in center */}
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#E2E8F0"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Green segment wrapping almost the entire circle */}
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#15803D"
                    strokeWidth="7"
                    strokeDasharray="213"
                    strokeDashoffset="35"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                  <Smile className="w-7 h-7 text-slate-700 stroke-1.5" />
                </div>
              </div>

              {/* Change delta on right */}
              <div className="text-right">
                <div className="text-2xl font-extralight text-slate-900">
                  0.5
                </div>
                <div className="text-[11px] text-slate-500 font-normal flex items-center justify-end gap-1">
                  <span>change</span>
                  <MoveRight className="w-3 h-3 text-slate-600" />
                </div>
              </div>
            </div>

            {/* Slider bar from -10 to +10 with full green positive fill */}
            <div className="mt-4 pt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
              </div>
              <div className="relative h-3 w-full bg-slate-100 border border-slate-200/80 overflow-hidden flex">
                <div className="w-1/2 bg-transparent" />
                <div className="w-1/2 bg-emerald-600 h-full" style={{ width: '92%' }} />
              </div>
            </div>
          </div>

          {/* 3.3 POSITIVE PHRASES WORD CLOUD */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-positive-phrases">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <span>POSITIVE PHRASES</span>
                <Smile className="w-3.5 h-3.5 text-emerald-600 stroke-2" />
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('PositivePhrases', positivePhrases)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Positive Phrases"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-h-[170px] flex flex-col justify-center items-center py-2 px-2 select-none">
              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center">
                <span onClick={() => onSelectPhrase && onSelectPhrase('services')} className="text-xs text-emerald-700 hover:underline cursor-pointer">services</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('knowledge')} className="text-base font-normal text-emerald-900 hover:underline cursor-pointer">knowledge</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('use')} className="text-xs text-emerald-600 hover:underline cursor-pointer">use</span>
              </div>

              <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                <span onClick={() => onSelectPhrase && onSelectPhrase('make')} className="text-xs text-emerald-600 hover:underline cursor-pointer">make</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('management')} className="text-xl font-normal text-emerald-950 hover:underline cursor-pointer">management</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('also')} className="text-xs text-emerald-600 hover:underline cursor-pointer">also</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('best')} className="text-sm font-medium text-emerald-800 hover:underline cursor-pointer">best</span>
              </div>

              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center my-1">
                <span onClick={() => onSelectPhrase && onSelectPhrase('software')} className="text-sm text-emerald-800 hover:underline cursor-pointer">software</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('new')} className="text-base text-emerald-800 hover:underline cursor-pointer">new</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('release')} className="text-2xl font-normal text-emerald-900 hover:underline cursor-pointer">release</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('can')} className="text-xs text-emerald-700 hover:underline cursor-pointer">can</span>
              </div>

              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center mt-1">
                <span onClick={() => onSelectPhrase && onSelectPhrase('web')} className="text-xs text-emerald-600 hover:underline cursor-pointer">web</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('help')} className="text-sm text-emerald-800 hover:underline cursor-pointer">help</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('support')} className="text-xs text-emerald-600 hover:underline cursor-pointer">support</span>
              </div>

              <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center mt-2">
                <span onClick={() => onSelectPhrase && onSelectPhrase('new knowledge management')} className="text-xs font-semibold text-emerald-900 hover:underline cursor-pointer">new knowledge management</span>
                <span onClick={() => onSelectPhrase && onSelectPhrase('integration')} className="text-xs text-emerald-700 hover:underline cursor-pointer">integration</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
