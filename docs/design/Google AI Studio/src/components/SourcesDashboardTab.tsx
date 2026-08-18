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
  const [selectedMapPoint, setSelectedMapPoint] = useState<string | null>(null);

  // 1. Sources By Sentiment Data (News: 10, Blogs: 9.4, Twitter: 8.8)
  const sourcesBySentiment = useMemo(() => [
    {
      id: 'news',
      name: 'News',
      score: '10',
      numericScore: 10.0,
      widthPercent: 100,
      trend: 'flat',
      iconColor: 'text-purple-800 fill-purple-800',
      iconBg: 'bg-purple-900',
      iconType: 'news',
    },
    {
      id: 'blogs',
      name: 'Blogs',
      score: '9.4',
      numericScore: 9.4,
      widthPercent: 94,
      trend: 'flat',
      iconColor: 'text-orange-500 fill-orange-500',
      iconBg: 'bg-orange-500',
      iconType: 'rss',
    },
    {
      id: 'twitter',
      name: 'Twitter',
      score: '8.8',
      numericScore: 8.8,
      widthPercent: 88,
      trend: 'up',
      iconColor: 'text-sky-500 fill-sky-500',
      iconBg: 'bg-sky-500',
      iconType: 'twitter',
    },
  ], []);

  // 2. Sources History Timeline Data (Spike on 08 Sep to 2,100)
  const sourcesHistoryData = useMemo(() => [
    { date: '01 Sep', twitter: 260, blogs: 120, videos: 0, news: 0 },
    { date: '02', twitter: 280, blogs: 130, videos: 0, news: 0 },
    { date: '03', twitter: 310, blogs: 110, videos: 0, news: 0 },
    { date: '04', twitter: 270, blogs: 90, videos: 0, news: 0 },
    { date: '05', twitter: 210, blogs: 85, videos: 0, news: 0 },
    { date: '06', twitter: 190, blogs: 70, videos: 0, news: 0 },
    { date: '07', twitter: 220, blogs: 80, videos: 0, news: 0 },
    { date: '08', twitter: 2120, blogs: 250, videos: 2, news: 1 },
    { date: '09', twitter: 580, blogs: 160, videos: 1, news: 0 },
    { date: '10', twitter: 560, blogs: 110, videos: 0, news: 0 },
    { date: '11', twitter: 610, blogs: 95, videos: 0, news: 0 },
    { date: '12', twitter: 260, blogs: 80, videos: 0, news: 0 },
    { date: '13', twitter: 290, blogs: 90, videos: 0, news: 0 },
    { date: '14', twitter: 340, blogs: 105, videos: 0, news: 0 },
  ], []);

  // 3. Activities Donut (Posts: 83%, Replies: 0%, Shares: 17%)
  const activitiesData = useMemo(() => {
    const slices = [
      { name: 'Posts', value: 83, color: '#111827' },
      { name: 'Shares', value: 17, color: '#94A3B8' },
      { name: 'Replies', value: 0.1, color: '#64748B' },
    ];
    const items = [
      { name: 'Posts', percent: '83%', color: 'bg-slate-900' },
      { name: 'Replies', percent: '0%', color: 'bg-slate-500' },
      { name: 'Shares', percent: '17%', color: 'bg-slate-400' },
    ];
    return { slices, items };
  }, []);

  // 4. Phrases by Sources
  const phrasesBySources = useMemo(() => [
    {
      source: 'Twitter',
      sourceId: 'twitter',
      iconBg: 'bg-sky-500',
      iconType: 'twitter',
      phrases: [
        { text: 'announces ...', size: 'text-base font-normal text-sky-600' },
        { text: 'microsoft anno...', size: 'text-xs text-slate-500' },
        { text: 'dynamics crm ...', size: 'text-xs text-slate-500' },
      ],
    },
    {
      source: 'Blogs',
      sourceId: 'blogs',
      iconBg: 'bg-orange-500',
      iconType: 'rss',
      phrases: [
        { text: 'can', size: 'text-sm font-normal text-slate-600' },
        { text: 'will', size: 'text-xs text-slate-500' },
        { text: 'also', size: 'text-xs text-slate-500' },
      ],
    },
    {
      source: 'Videos',
      sourceId: 'videos',
      iconBg: 'bg-rose-700',
      iconType: 'video',
      phrases: [
        { text: 'gold', size: 'text-sm font-medium text-amber-700' },
        { text: 'demonstration', size: 'text-xs text-slate-500' },
        { text: 'uk', size: 'text-xs text-slate-500' },
      ],
    },
    {
      source: 'News',
      sourceId: 'news',
      iconBg: 'bg-purple-900',
      iconType: 'news',
      phrases: [
        { text: 'one', size: 'text-xs text-slate-600' },
        { text: 'year', size: 'text-xs text-slate-500' },
        { text: 'time', size: 'text-xs text-slate-500' },
        { text: 'skills', size: 'text-xs text-slate-500' },
      ],
    },
  ], []);

  // 5. Authors by Source (Total 3,498 authors)
  const authorsData = useMemo(() => {
    const total = 3498;
    const slices = [
      { name: 'Twitter', value: 2970, color: '#0EA5E9' },
      { name: 'Blogs', value: 525, color: '#F97316' },
      { name: 'Videos', value: 2, color: '#BE123C' },
      { name: 'News', value: 1, color: '#581C87' },
    ];
    const items = [
      { id: 'twitter', label: '2,970 authors', count: 2970, trend: 'up', iconType: 'twitter', iconBg: 'bg-sky-500' },
      { id: 'blogs', label: '525 authors', count: 525, trend: 'flat', iconType: 'rss', iconBg: 'bg-orange-500' },
      { id: 'videos', label: '2 authors', count: 2, trend: 'up', iconType: 'video', iconBg: 'bg-rose-700' },
      { id: 'news', label: '1 authors', count: 1, trend: 'up', iconType: 'news', iconBg: 'bg-purple-900' },
    ];
    return { total, slices, items };
  }, []);

  // 6. Sources Volume Breakdown (Twitter 5,682, Blogs 716, Videos 3, News 1)
  const sourcesVolumeData = useMemo(() => [
    { id: 'twitter', name: 'Twitter', count: '5,682', numeric: 5682, widthPercent: 88, barColor: 'bg-sky-400', trend: 'up', iconBg: 'bg-sky-500', iconType: 'twitter' },
    { id: 'blogs', name: 'Blogs', count: '716', numeric: 716, widthPercent: 12, barColor: 'bg-orange-500', trend: 'flat', iconBg: 'bg-orange-500', iconType: 'rss' },
    { id: 'videos', name: 'Videos', count: '3', numeric: 3, widthPercent: 2, barColor: 'bg-rose-700', trend: 'up', iconBg: 'bg-rose-700', iconType: 'video' },
    { id: 'news', name: 'News', count: '1', numeric: 1, widthPercent: 1, barColor: 'bg-purple-900', trend: 'up', iconBg: 'bg-purple-900', iconType: 'news' },
  ], []);

  // 7. Volume Change by Source (+2,930 Twitter, +52 Blogs, +1 Videos, +1 News)
  const volumeChangeData = useMemo(() => [
    { id: 'twitter', name: 'Twitter', change: '+2,930', widthPercent: 85, barColor: 'bg-sky-400', trend: 'up', iconBg: 'bg-sky-500', iconType: 'twitter' },
    { id: 'blogs', name: 'Blogs', change: '+52', widthPercent: 10, barColor: 'bg-amber-400', trend: 'flat', iconBg: 'bg-orange-500', iconType: 'rss' },
    { id: 'videos', name: 'Videos', change: '+1', widthPercent: 20, barColor: 'bg-rose-900', trend: 'up', iconBg: 'bg-rose-700', iconType: 'video' },
    { id: 'news', name: 'News', change: '+1', widthPercent: 95, barColor: 'bg-purple-950', trend: 'up', iconBg: 'bg-purple-900', iconType: 'news' },
  ], []);

  // 8. Languages Breakdown (English 6,402)
  const languagesData = useMemo(() => [
    { id: 'en', name: 'English', count: '6,402', numeric: 6402, barColor: 'bg-slate-700', trend: 'up' },
  ], []);

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
      return <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    if (trend === 'down') {
      return <ArrowDownRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    return <MoveRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
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
                    activeSourceFilter === item.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 w-14 shrink-0">
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
              {/* Continental shapes overlay */}
              <svg viewBox="0 0 1000 500" className="w-full h-full object-cover">
                {/* North America */}
                <path
                  d="M150 90 L240 70 L300 80 L350 140 L280 200 L200 240 L160 180 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />
                {/* South America */}
                <path
                  d="M260 270 L320 280 L340 370 L300 440 L270 380 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />
                {/* Europe */}
                <path
                  d="M480 80 L560 70 L580 130 L520 160 L460 120 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />
                {/* Africa */}
                <path
                  d="M480 170 L560 170 L580 260 L540 350 L480 280 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />
                {/* Asia */}
                <path
                  d="M580 80 L800 90 L850 200 L760 260 L600 210 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />
                {/* Australia */}
                <path
                  d="M780 320 L860 310 L880 380 L800 390 Z"
                  fill="#B7D2F0"
                  stroke="#96BCE5"
                  strokeWidth="1"
                />

                {/* Hotspot Dots (Blue & Orange Dots) */}
                {/* North America */}
                <circle cx="210" cy="150" r="5" fill="#1D4ED8" />
                <circle cx="260" cy="140" r="6" fill="#1D4ED8" />
                <circle cx="280" cy="170" r="7" fill="#1D4ED8" />
                <circle cx="230" cy="180" r="4" fill="#EA580C" />

                {/* South America */}
                <circle cx="290" cy="320" r="5" fill="#1D4ED8" />
                <circle cx="310" cy="360" r="4" fill="#1D4ED8" />

                {/* Europe */}
                <circle cx="490" cy="110" r="7" fill="#EA580C" />
                <circle cx="515" cy="115" r="8" fill="#1D4ED8" />
                <circle cx="530" cy="130" r="6" fill="#1D4ED8" />
                <circle cx="475" cy="125" r="5" fill="#1D4ED8" />

                {/* Africa */}
                <circle cx="510" cy="220" r="4" fill="#1D4ED8" />
                <circle cx="540" cy="310" r="5" fill="#1D4ED8" />

                {/* Asia */}
                <circle cx="680" cy="160" r="6" fill="#1D4ED8" />
                <circle cx="730" cy="180" r="7" fill="#1D4ED8" />
                <circle cx="810" cy="170" r="6" fill="#1D4ED8" />
                <circle cx="750" cy="220" r="5" fill="#EA580C" />

                {/* Australia */}
                <circle cx="840" cy="350" r="5" fill="#1D4ED8" />
              </svg>

              {/* Labels on continents */}
              <div className="absolute top-12 left-10 text-[9px] font-bold text-slate-700 tracking-tighter">
                NORTH<br />AMERICA
              </div>
              <div className="absolute bottom-6 left-16 text-[9px] font-bold text-slate-700 tracking-tighter">
                SOUTH<br />AMERICA
              </div>
              <div className="absolute top-8 left-[49%] text-[9px] font-bold text-slate-700 tracking-tighter">
                EUROPE
              </div>
              <div className="absolute top-24 left-[48%] text-[9px] font-bold text-slate-700 tracking-tighter">
                AFRICA
              </div>
              <div className="absolute top-10 right-20 text-[9px] font-bold text-slate-700 tracking-tighter">
                ASIA
              </div>
              <div className="absolute bottom-6 right-8 text-[9px] font-bold text-slate-700 tracking-tighter">
                AUSTRALIA
              </div>

              {/* Bing watermark in bottom right */}
              <div className="absolute bottom-1 right-1 text-[8px] text-slate-500 flex items-center gap-1 font-sans">
                <span className="font-semibold">bing</span>
              </div>
              <div className="absolute bottom-1 left-1 text-[7px] text-slate-400 font-sans">
                © 2015 HERE © 2015 Microsoft Corporation
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
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource('twitter')}>
                  <span className="w-4 h-0.5 bg-sky-500" />
                  <span className="font-normal text-[11px]">Twitter</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource('blogs')}>
                  <span className="w-4 h-0.5 bg-orange-500" />
                  <span className="font-normal text-[11px]">Blogs</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource('videos')}>
                  <span className="w-4 h-0.5 bg-rose-700" />
                  <span className="font-normal text-[11px]">Videos</span>
                </div>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectSource('news')}>
                  <span className="w-4 h-0.5 bg-purple-900" />
                  <span className="font-normal text-[11px]">News</span>
                </div>
              </div>
            </div>

            {/* Main Area / Line Chart with the prominent spike on 08 Sep */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sourcesHistoryData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  className="cursor-pointer"
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      // Click on chart line point
                      const firstSource = e.activePayload[0].dataKey as string;
                      if (firstSource) {
                        onSelectSource(activeSourceFilter === firstSource ? null : firstSource);
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
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    domain={[0, 2500]}
                    ticks={[0, 500, 1000, 1500, 2000, 2500]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={`Date: ${label} (Click to filter source)`}
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
                                badge: activeSourceFilter === 'blogs' ? 'Active' : undefined,
                              },
                              {
                                name: 'Videos / YouTube',
                                value: `${Number(payload[2]?.value || 0).toLocaleString()} posts`,
                                color: '#F43F5E',
                                badge: activeSourceFilter === 'videos' ? 'Active' : undefined,
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
                    strokeWidth={activeSourceFilter === 'twitter' ? 3 : 2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#0EA5E9' }}
                  />
                  {/* Blogs Line (Orange) */}
                  <Line
                    type="monotone"
                    dataKey="blogs"
                    stroke="#F97316"
                    strokeWidth={activeSourceFilter === 'blogs' ? 3 : 1.75}
                    dot={false}
                  />
                  {/* Videos Line (Rose / Red) */}
                  <Line
                    type="monotone"
                    dataKey="videos"
                    stroke="#BE123C"
                    strokeWidth={activeSourceFilter === 'videos' ? 3 : 1.5}
                    dot={false}
                  />
                  {/* News Line (Dark Purple) */}
                  <Line
                    type="monotone"
                    dataKey="news"
                    stroke="#7E22CE"
                    strokeWidth={activeSourceFilter === 'news' ? 3 : 1.25}
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
              <div className="flex-1 pl-4 space-y-2 text-xs">
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
        <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-authors-by-source">
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
            <div className="flex-1 space-y-1.5 text-xs">
              {authorsData.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 font-normal truncate">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className={`w-4 h-4 ${item.iconBg} flex items-center justify-center rounded-xs`}>
                      {renderSourceIcon(item.iconType)}
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
                  activeSourceFilter === src.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left icon & count */}
                <div className="flex items-center gap-1.5 w-16 shrink-0">
                  <div className={`w-4 h-4 ${src.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                    {renderSourceIcon(src.iconType)}
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
                <div className="flex items-center gap-1.5 w-16 shrink-0">
                  <div className={`w-4 h-4 ${src.iconBg} flex items-center justify-center rounded-xs shrink-0`}>
                    {renderSourceIcon(src.iconType)}
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
                  activeLanguageFilter === lang.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left language name & count */}
                <div className="flex items-center justify-between w-24 shrink-0 pr-2">
                  <span className="text-[11px] text-slate-700">{lang.name}</span>
                  <span className="text-[11px] font-mono text-slate-800">{lang.count}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                  <div className={`h-full ${lang.barColor} w-full`} />
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
